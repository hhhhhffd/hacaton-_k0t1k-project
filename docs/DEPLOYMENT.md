# 🚀 Deployment Guide — _k0t1k Project

> Production deployment, monitoring, and maintenance guide

---

## 📋 Table of Contents

- [Overview](#overview)
- [System Requirements](#system-requirements)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Deployment Architecture](#deployment-architecture)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [Post-Deployment Verification](#post-deployment-verification)
- [First Admin Setup](#first-admin-setup)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Backup Strategy](#backup-strategy)
- [Monitoring & Alerting](#monitoring--alerting)
- [Scaling Guide](#scaling-guide)
- [Maintenance Procedures](#maintenance-procedures)
- [Troubleshooting](#troubleshooting)
- [Security Hardening](#security-hardening)

---

## 🎯 Overview

This guide covers deploying the _k0t1k scoring platform to production environments. It assumes familiarity with Docker, Linux administration, and basic networking.

### Deployment Options

1. **Docker Compose** (Recommended for hackathon & small-scale)
2. **Kubernetes** (For large-scale production)
3. **Bare Metal** (Manual setup, not recommended)

---

## 💻 System Requirements

### Minimum Requirements

| Resource | Specification |
|----------|---------------|
| **CPU** | 4 cores |
| **RAM** | 8 GB |
| **Storage** | 50 GB SSD |
| **Network** | 100 Mbps |
| **OS** | Ubuntu 20.04+, CentOS 8+, Debian 11+ |

### Recommended Production Requirements

| Resource | Specification |
|----------|---------------|
| **CPU** | 8 cores |
| **RAM** | 16 GB |
| **Storage** | 100 GB NVMe SSD |
| **Network** | 1 Gbps |
| **OS** | Ubuntu 22.04 LTS |

### Software Dependencies

| Software | Version | Purpose |
|----------|---------|---------|
| **Docker** | 20.10+ | Containerization |
| **Docker Compose** | 2.0+ | Orchestration |
| **Git** | 2.30+ | Version control |
| **Nginx** | (in container) | Reverse proxy |
| **PostgreSQL** | 16 (in container) | Database |
| **Redis** | 7 (in container) | Caching |

---

## ✅ Pre-Deployment Checklist

Before deploying, ensure all items are completed:

### Security

- [ ] `JWT_SECRET_KEY` set to cryptographically secure value (64+ chars)
- [ ] `POSTGRES_PASSWORD` changed from default
- [ ] `LLM_API_KEY`, `SCORE_API_KEY`, `EMBEDDER_API_KEY` configured
- [ ] CORS origins configured for production domain
- [ ] Firewall rules configured (only ports 80, 443 open)
- [ ] SSH key-based authentication enabled
- [ ] Root login via SSH disabled

### Infrastructure

- [ ] Domain name configured (e.g., k0t1k.example.com)
- [ ] DNS records created (A record pointing to server IP)
- [ ] SSL certificate obtained (Let's Encrypt or commercial)
- [ ] Backup storage configured (S3, NFS, or external drive)
- [ ] Monitoring system set up (optional)

### Application

- [ ] Code reviewed and tested locally
- [ ] Environment variables validated
- [ ] Database migration plan prepared
- [ ] Rollback plan documented
- [ ] Team trained on deployment procedures

---

## 🏗️ Deployment Architecture

### Single-Server Deployment

```
┌─────────────────────────────────────────────┐
│              Production Server               │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │        Cloudflare CDN (Optional)    │   │
│  └──────────────┬──────────────────────┘   │
│                 │                          │
│  ┌──────────────▼──────────────────────┐   │
│  │         Nginx (Port 80/443)         │   │
│  │  • SSL Termination                  │   │
│  │  • Reverse Proxy                    │   │
│  │  • Static File Server               │   │
│  └──────────────┬──────────────────────┘   │
│                 │                          │
│  ┌──────────────▼──────────────────────┐   │
│  │      Backend (FastAPI, Port 8000)   │   │
│  │  • API Server                       │   │
│  │  • ML Model                         │   │
│  └──────────────┬──────────────────────┘   │
│                 │                          │
│        ┌────────┴────────┐                │
│  ┌─────▼─────┐    ┌─────▼─────┐          │
│  │PostgreSQL │    │  Redis    │          │
│  │ Port 5432 │    │ Port 6379 │          │
│  └───────────┘    └───────────┘          │
│                                              │
│  Volumes:                                    │
│  - pgdata:/var/lib/postgresql/data          │
│  - redisdata:/data                          │
│  - ./backend/data:/app/data                 │
│  - ./backend/models:/app/models             │
└─────────────────────────────────────────────┘
```

---

## 📦 Step-by-Step Deployment

### Step 1: Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version

# Install Git
sudo apt install git -y
```

### Step 2: Clone Repository

```bash
# Clone project
cd /opt
sudo git clone https://github.com/DataNomads/k0t1k.git
cd k0t1k

# Set permissions
sudo chown -R $USER:$USER /opt/k0t1k
```

### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Production .env Example**:

```env
# PostgreSQL
POSTGRES_DB=k0t1k
POSTGRES_USER=k0t1k
POSTGRES_PASSWORD=SuperSecurePassword123!@#

# API Keys (from alem.plus)
LLM_API_KEY=your-production-llm-key
SCORE_API_KEY=your-production-score-key
EMBEDDER_API_KEY=your-production-embedder-key

# JWT (generate with: python -c "import secrets; print(secrets.token_urlsafe(64))")
JWT_SECRET_KEY=your-64-character-random-string-here

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# CORS (update with your domain)
CORS_ORIGINS=["https://k0t1k.example.com"]

# Cloudflare Tunnel (optional)
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
```

### Step 4: Deploy Services

```bash
# Start all services
docker-compose up --build -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f nginx
```

**Expected Output**:

```
NAME                STATUS         PORTS
k0t1k-postgres-1    Up (healthy)   0.0.0.0:5432->5432/tcp
k0t1k-redis-1       Up (healthy)   0.0.0.0:6379->6379/tcp
k0t1k-backend-1     Up (healthy)   0.0.0.0:8000->8000/tcp
k0t1k-nginx-1       Up (healthy)   0.0.0.0:80->80/tcp
```

### Step 5: Verify Deployment

```bash
# Check backend health
curl http://localhost:8000/api/health

# Expected response:
# {"status":"ok","model_loaded":true,"redis_connected":true,"llm_available":true}

# Check frontend
curl -I http://localhost:80/

# Expected: HTTP/1.1 200 OK
```

---

## ✅ Post-Deployment Verification

### Automated Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "🏥 Running health checks..."

# 1. Check services
echo ""
echo "📦 Checking services..."
docker-compose ps | grep -q "postgres" && echo "✅ PostgreSQL: UP" || echo "❌ PostgreSQL: DOWN"
docker-compose ps | grep -q "redis" && echo "✅ Redis: UP" || echo "❌ Redis: DOWN"
docker-compose ps | grep -q "backend" && echo "✅ Backend: UP" || echo "❌ Backend: DOWN"
docker-compose ps | grep -q "nginx" && echo "✅ Nginx: UP" || echo "❌ Nginx: DOWN"

# 2. Check backend API
echo ""
echo "🔌 Checking API..."
HEALTH=$(curl -s http://localhost:8000/api/health)
echo $HEALTH | python3 -m json.tool

# 3. Check database connectivity
echo ""
echo "🗄️  Checking database..."
docker-compose exec -T postgres psql -U k0t1k -d k0t1k -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Database: CONNECTED"
else
    echo "❌ Database: CONNECTION FAILED"
fi

# 4. Check Redis
echo ""
echo "💾 Checking Redis..."
docker-compose exec -T redis redis-cli ping | grep -q "PONG"
if [ $? -eq 0 ]; then
    echo "✅ Redis: RESPONDING"
else
    echo "❌ Redis: NOT RESPONDING"
fi

echo ""
echo "✅ Health check completed!"
```

### Manual Verification Checklist

- [ ] Frontend loads at https://your-domain.com
- [ ] Backend API responds at https://your-domain.com/api/health
- [ ] User registration works
- [ ] User login works
- [ ] Swagger UI accessible at https://your-domain.com/docs
- [ ] File upload works (test with small file)
- [ ] Database migrations applied
- [ ] Logs show no errors

---

## 👑 First Admin Setup

### Method 1: Quick Setup Script

```bash
#!/bin/bash
# setup-first-admin.sh

echo "👑 Setting up first administrator..."

# 1. Register user
echo ""
echo "📝 Registering admin user..."
curl -s -X POST http://localhost:80/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@admin.com",
    "password": "SecureAdminPassword123!@#",
    "full_name": "System Administrator"
  }' || echo "⚠️  User may already exist"

# 2. Grant admin rights
echo ""
echo "🔑 Granting admin rights..."
docker-compose exec -T postgres psql -U k0t1k -d k0t1k -c \
  "UPDATE users SET is_admin = true, is_active = true WHERE email = 'admin@admin.com';"

# 3. Verify
echo ""
echo "✅ Verifying admin rights..."
docker-compose exec -T postgres psql -U k0t1k -d k0t1k -c \
  "SELECT id, email, full_name, is_admin, is_active FROM users WHERE email = 'admin@admin.com';"

echo ""
echo "🎉 Admin setup complete!"
echo "   URL: https://your-domain.com"
echo "   Email: admin@admin.com"
echo "   Password: SecureAdminPassword123!@#"
echo ""
echo "⚠️  IMPORTANT: Change password immediately after first login!"
```

### Method 2: Manual SQL

```bash
# Connect to database
docker-compose exec postgres psql -U k0t1k -d k0t1k

# SQL commands:
UPDATE users 
SET is_admin = true, is_active = true 
WHERE email = 'admin@admin.com';

SELECT id, email, is_admin, is_active FROM users;

\q
```

---

## 🔒 SSL/TLS Configuration

### Option 1: Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d k0t1k.example.com

# Auto-renewal (already configured by certbot)
sudo certbot renew --dry-run
```

### Option 2: Cloudflare SSL

If using Cloudflare:

1. Go to Cloudflare Dashboard → SSL/TLS
2. Set encryption mode to "Full (strict)"
3. Origin Certificate → Create Certificate
4. Install certificate on server

### Update Nginx for HTTPS

```nginx
server {
    listen 80;
    server_name k0t1k.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name k0t1k.example.com;

    ssl_certificate /etc/letsencrypt/live/k0t1k.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/k0t1k.example.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Rest of configuration...
}
```

---

## 💾 Backup Strategy

### Database Backups

```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/opt/backups/k0t1k/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/k0t1k_db_$TIMESTAMP.sql.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T postgres pg_dump -U k0t1k k0t1k | gzip > $BACKUP_FILE

echo "✅ Database backup created: $BACKUP_FILE"

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### Model Backups

```bash
#!/bin/bash
# backup-models.sh

BACKUP_DIR="/opt/backups/k0t1k/models"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup models
tar -czf $BACKUP_DIR/k0t1k_models_$TIMESTAMP.tar.gz ./backend/models/

echo "✅ Models backup created: $BACKUP_DIR/k0t1k_models_$TIMESTAMP.tar.gz"
```

### Automated Backups (Cron)

```bash
# Edit crontab
crontab -e

# Add entries:
# Database backup daily at 2 AM
0 2 * * * /opt/k0t1k/scripts/backup-db.sh

# Models backup weekly on Sunday at 3 AM
0 3 * * 0 /opt/k0t1k/scripts/backup-models.sh
```

### Restore from Backup

```bash
# Restore database
gunzip -c k0t1k_db_20260405_020000.sql.gz | docker-compose exec -T postgres psql -U k0t1k -d k0t1k

# Restore models
tar -xzf k0t1k_models_20260405_030000.tar.gz -C /opt/k0t1k/
```

---

## 📊 Monitoring & Alerting

### Docker Stats Monitoring

```bash
# Real-time resource usage
docker stats

# One-time snapshot
docker stats --no-stream
```

### Log Monitoring

```bash
# View all logs
docker-compose logs -f

# Backend logs only
docker-compose logs -f backend

# Search for errors
docker-compose logs backend | grep -i error

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Application Monitoring

Create monitoring endpoint:

```python
# Add to endpoints.py
@router.get("/metrics")
async def get_metrics():
    """Prometheus-compatible metrics endpoint."""
    return {
        "active_users": await get_active_users_count(),
        "requests_per_minute": await get_rpm(),
        "average_response_time_ms": await get_avg_response_time(),
        "model_predictions_count": await get_prediction_count(),
        "error_rate": await get_error_rate()
    }
```

### Alert Rules (Example)

| Metric | Threshold | Action |
|--------|-----------|--------|
| **CPU Usage** | > 80% for 5 min | Email admin |
| **Memory Usage** | > 90% | Email admin |
| **Disk Usage** | > 85% | Email admin |
| **API Error Rate** | > 5% for 5 min | Slack notification |
| **Database Connections** | > 100 | Email admin |
| **Model Prediction Time** | > 5s | Slack notification |

---

## 📈 Scaling Guide

### Vertical Scaling

Increase server resources:

| Resource | Current | Recommended |
|----------|---------|-------------|
| **CPU** | 4 cores | 8-16 cores |
| **RAM** | 8 GB | 16-32 GB |
| **Storage** | 50 GB | 100-500 GB |

### Horizontal Scaling

```
                    ┌──────────┐
                    │  Nginx   │
                    │(Load Bal)│
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
        ┌─────▼────┐ ┌──▼──┐ ┌────▼────┐
        │Backend 1 │ │Backend2│Backend3│
        └─────┬────┘ └──┬──┘ └────┬────┘
              │          │          │
              └──────────┼──────────┘
                         │
              ┌──────────▼──────────┐
              │   PostgreSQL (RDS)  │
              │   Redis (ElastiCache)│
              └─────────────────────┘
```

### Database Scaling

1. **Read Replicas**: For analytics queries
2. **Connection Pooling**: PgBouncer for connection management
3. **Query Optimization**: Add indexes for slow queries

```sql
-- Add indexes for common queries
CREATE INDEX idx_applications_region ON applications(region);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_merit_score ON applications(merit_score DESC);
```

### Cache Scaling

Redis clustering for high availability:

```bash
# Redis Sentinel configuration
redis-sentinel /etc/redis/sentinel.conf
```

---

## 🔧 Maintenance Procedures

### Update Application

```bash
# Pull latest changes
cd /opt/k0t1k
git pull origin main

# Rebuild and restart
docker-compose up --build -d

# Verify update
curl http://localhost:8000/api/health
docker-compose logs --tail=50 backend
```

### Database Migration

```bash
# Run migrations manually
docker-compose exec backend alembic upgrade head

# Check migration status
docker-compose exec backend alembic current

# Rollback one migration
docker-compose exec backend alembic downgrade -1
```

### Model Update

```bash
# Upload new dataset via web interface
# Or via API:
curl -X POST https://k0t1k.example.com/api/data/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@new_data.xlsx"

# Monitor training progress
curl https://k0t1k.example.com/api/upload/status/{task_id}

# Activate new model version
curl -X POST https://k0t1k.example.com/api/admin/models/v1.1.0.joblib/activate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Log Rotation

```bash
# Configure Docker log rotation
sudo nano /etc/docker/daemon.json

{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# Restart Docker
sudo systemctl restart docker
```

---

## 🔧 Troubleshooting

### Common Issues

#### Issue 1: Backend Won't Start

**Symptoms**: Backend container exits immediately

**Diagnosis**:
```bash
docker-compose logs backend
```

**Solutions**:
- Check `.env` file for missing variables
- Verify database connectivity
- Check API keys are valid

#### Issue 2: Database Connection Failed

**Symptoms**: "Connection refused" errors

**Diagnosis**:
```bash
docker-compose exec backend python -c "
import asyncio
from app.db.session import engine

async def test():
    async with engine.connect() as conn:
        print('Connected!')

asyncio.run(test())
"
```

**Solutions**:
- Verify `DATABASE_URL` in `.env`
- Check PostgreSQL container is running
- Verify network connectivity

#### Issue 3: High Memory Usage

**Symptoms**: Server running out of RAM

**Diagnosis**:
```bash
docker stats
free -h
```

**Solutions**:
- Increase server RAM
- Reduce `DB_POOL_SIZE` in `.env`
- Restart services: `docker-compose restart`

#### Issue 4: Slow API Responses

**Symptoms**: API taking > 5 seconds

**Diagnosis**:
```bash
# Check database query times
docker-compose exec postgres psql -U k0t1k -d k0t1k -c "
SELECT query, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
"
```

**Solutions**:
- Add database indexes
- Enable Redis caching
- Optimize slow queries

### Emergency Procedures

#### Restart All Services

```bash
docker-compose down
docker-compose up -d
```

#### Emergency Database Reset

```bash
# WARNING: This deletes all data!
docker-compose down -v
docker-compose up -d
```

#### Emergency Rollback

```bash
# Rollback to previous version
git checkout v1.0.0
docker-compose down
docker-compose up --build -d
```

---

## 🔒 Security Hardening

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Verify
sudo ufw status
```

### SSH Hardening

```bash
sudo nano /etc/ssh/sshd_config

# Change settings:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3

# Restart SSH
sudo systemctl restart sshd
```

### Docker Security

```bash
# Run containers as non-root
# Add to docker-compose.yml:
services:
  backend:
    user: "1000:1000"
  
  nginx:
    user: "1000:1000"
```

### Database Security

```sql
-- Create read-only user for analytics
CREATE USER analyst WITH PASSWORD 'analyst_password';
GRANT CONNECT ON DATABASE k0t1k TO analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analyst;

-- Revoke default privileges
REVOKE ALL ON DATABASE k0t1k FROM PUBLIC;
```

---

**Last Updated**: April 5, 2026  
**Maintained By**: DataNomads Team  
**Project**: _k0t1k Project  
**Deployment Version**: v1.0
