# 🏆 k0t1k — AI Scoring for Agricultural Subsidies

> **Solution for Decentrathon 5.0 | AI inDrive Gov Track**

[![English](https://img.shields.io/badge/🇬🇧English-README-blue)](README.md)
[![Қазақша](https://img.shields.io/badge/🇰🇿Қазақша-README-blue)](README.kz.md)
[![Русский](https://img.shields.io/badge/🇷🇺Русский-README-blue)](README.ru.md)

---

## 📋 Table of Contents

- [About Project](#about-project)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Machine Learning Model](#machine-learning-model)
- [Data Sources](#data-sources)
- [Quick Start](#quick-start)
- [First Admin Setup](#first-admin-setup)
- [Data Upload](#data-upload)
- [API Endpoints](#api-endpoints)
- [Explainability](#explainability)
- [Security & Authentication](#security--authentication)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Limitations & Known Issues](#limitations--known-issues)
- [Evaluation Criteria](#evaluation-criteria)
- [Team](#team)
- [License](#license)

---

## 🎯 About Project

**k0t1k** is an intelligent agricultural producer scoring system for distributing government subsidies in the Republic of Kazakhstan. The system was developed for **Decentrathon 5.0** hackathon as part of the **AI inDrive Gov** track.

### Mission

Transition from the outdated **"first-come-first-served"** subsidy distribution principle to a **merit-based approach** — distribution based on actual farm efficiency data, legislative compliance, and growth potential.

### Stakeholders

- **Government employees** (Ministry of Agriculture, akimats)
- **Analytical departments** and data specialists
- **Agricultural producers** (subsidy recipients)
- **Subsidy distribution commissions**

---

## 🔥 Problem Statement

### Current Situation

Government agricultural subsidies in Kazakhstan are distributed based on **application submission order**:

```
Farmer submitted first → Received funding (until budget runs out)
```

### Critical Problems

1. **❌ Efficiency Ignored**
   - Actual farm efficiency is not considered
   - Previous subsidy usage history is not analyzed
   - Growth potential is not assessed

2. **❌ Manipulation & Unfairness**
   - Queue manipulation
   - Non-transparent fund distribution
   - Subsidies go to those who don't truly need them

3. **❌ No Analytics**
   - Decisions made without data-driven approach
   - No automated compliance verification
   - Manual application processing requires significant resources

4. **❌ Regulatory Complexity**
   - Multiple orders and regulations (Orders #11064, #12488, #108)
   - Difficulty verifying all requirements manually

---

## 💡 Solution

### Concept

**k0t1k** uses **machine learning (LightGBM)** to create a scoring model that:

1. **Ranks applicants** based on comprehensive data analysis
2. **Explains decisions** — which factors influenced the score (SHAP + LLM)
3. **Generates shortlist** of candidates for commission review
4. **Maintains human control** — final decision rests with expert

### Key Principles

```
┌─────────────────────────────────────────────────────┐
│  AI RECOMMENDS                                      │
│  ↓                                                  │
│  • Analyzes data                                    │
│  • Calculates scoring (0-100)                       │
│  • Explains decision factors                        │
│  • Warns about violations                           │
│                                                     │
│  HUMAN DECIDES                                      │
│  ↓                                                  │
│  • Reviews AI recommendations                       │
│  • Applies expert judgment                          │
│  • Makes final decision                             │
│  • Bears responsibility                             │
└─────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🤖 ML Scoring

- **LightGBM model** with 20 features for efficiency assessment
- **Two-stage scoring**: hard filters + ML model
- **Target leakage protection** via fit/transform separation
- **5-fold cross-validation** to confirm quality

### 📊 Explainability

- **SHAP values** — local explanation for each application
- **Global feature importance** — overall model understanding
- **LLM explanations** (Qwen 3.5) — text description in plain language
- **Streaming explanations** via Server-Sent Events (SSE)

### 📈 Analytics

- **FIFO vs Merit comparison** — visual demonstration of advantages
- **Budget simulation** — merit-based fund distribution
- **Weight simulation** — feature weight adjustment for commissions
- **Fairness audit** — regional bias verification (Gini index, CV)
- **Transparency Report** — public decision transparency report

### 🛡️ Anti-Fraud System

- **Collusion detection** — identical amounts/areas in districts
- **Night submissions** — anomalous application timing
- **New farms** — suspiciously new operations
- **Extreme amounts** — anomalously high requests

### 📄 Documentation

- **PDF protocols** — commission decision protocol (Cyrillic support)
- **PDF budgets** — budget fund distribution
- **PDF refusals** — refusal notifications with reason explanations

### 🌐 Multilingual Support

- **Russian language** — full interface
- **Kazakh language** — full interface
- **LLM explanations** in both languages

### 👤 Farmer Portal

- **Public application submission** — no authentication required
- **Status checking** — track application by number
- **Proactive offers** — AI finds promising farmers
- **Guides** — application assistance

### 👨‍💼 Admin Panel

- **User management** — activation, blocking, admin rights
- **Model management** — versioning, activating different models
- **Data upload** — Excel upload with automatic training
- **Analytics dashboard** — statistics, filters, charts

---

## 🏗️ System Architecture

```
┌───────────────────────────────────────────────────────────┐
│                        Users                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Official │  │ Analyst  │  │  Farmer  │  │  Admin   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
└───────┼─────────────┼─────────────┼─────────────┼────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │
                 ┌────▼────┐
                 │  Nginx  │  Port 80
                 │  (SPA + │  • React frontend
                 │  Proxy) │  • Proxy /api/ → backend:8000
                 └────┬────┘  • SSE support
                      │
        ┌─────────────┴─────────────┐
        │                           │
   ┌────▼────┐              ┌───────▼──────┐
   │Frontend │              │   Backend    │
   │ React + │              │   FastAPI    │  Port 8000
   │TypeScript│              │   + Uvicorn  │
   │  Vite   │              └───────┬──────┘
   │Tailwind │                      │
   └─────────┘          ┌───────────┼───────────┐
                        │           │           │
                  ┌─────▼────┐ ┌───▼────┐ ┌───▼────┐
                  │PostgreSQL│ │ Redis  │ │  ML    │
                  │  Port    │ │ Port   │ │Models  │
                  │  5432    │ │ 6379   │ │LightGBM│
                  └──────────┘ └────────┘ └────────┘
```

---

## 🛠️ Tech Stack

### Backend

| Technology | Version | Purpose |
|------------|--------|---------|
| **Python** | 3.11+ | Development language |
| **FastAPI** | 0.115.0 | Async web framework |
| **Uvicorn** | - | ASGI server |
| **SQLAlchemy** | 2.0 | ORM (async mode) |
| **asyncpg** | - | Async PostgreSQL driver |
| **Alembic** | 1.13.0 | DB migrations |
| **PostgreSQL** | 16 | Primary database |
| **Redis** | 7 | Caching |
| **LightGBM** | 4.5.0 | ML model (classifier) |
| **SHAP** | 0.46.0 | Model explainability |
| **scikit-learn** | 1.5.0 | ML utilities |
| **pandas** | 2.2.0 | Data processing |
| **numpy** | 1.26.0 | Numerical operations |
| **Qwen 3.5** | - | LLM for explanations (alem.plus) |
| **Score API** | - | Semantic verification (alem.plus) |
| **Embedder** | text-1024 | Text vectorization (alem.plus) |
| **python-jose** | - | JWT tokens |
| **bcrypt** | - | Password hashing |
| **slowapi** | - | Rate limiting |
| **fpdf2** | - | PDF generation (Cyrillic) |

### Frontend

| Technology | Version | Purpose |
|------------|--------|---------|
| **React** | 19 | UI framework |
| **TypeScript** | 5.9 | Type safety |
| **Vite** | 8 | Bundler |
| **TailwindCSS** | 4 | Styling |
| **React Router** | 7 | Routing |
| **Zustand** | 5 | State management |
| **TanStack Table** | 8 | Paginated tables |
| **Recharts** | 3 | Charts |
| **Axios** | 1.14 | HTTP client |
| **Lucide React** | 1.7 | Icons |

### DevOps

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Service orchestration |
| **Nginx** | Reverse proxy + SPA server |
| **Cloudflare Tunnel** | Secure external access |

---

## 🧠 Machine Learning Model

### Features (20 total)

#### Numeric (13)

| Feature | Description | Source |
|---------|-------------|--------|
| `head_count` | Number of heads (amount / normativ) | Computed |
| `month` | Application month | Temporal |
| `hour` | Application hour | Temporal |
| `day_of_week` | Application day of week | Temporal |
| `amount_per_head` | Subsidy per head | Computed |
| `subsidy_type_approval_rate` | Historical approval rate | Aggregated |
| `amount_vs_region_median` | Deviation from region median | Aggregated |
| `amount_vs_subsidy_median` | Deviation from subsidy median | Aggregated |
| `normativ_amount_ratio` | Normativ to amount ratio | Computed |
| `direction_competition` | Competition by direction | Aggregated |
| `amount_log` | Log-transformed amount | Computed |
| `pasture_area_ha` | Pasture area (ha) | Farmer Portrait |
| `historical_mortality_rate` | Historical mortality (%) | Farmer Portrait |
| `current_head_count` | Current head count | Farmer Portrait |

#### Binary (3)

| Feature | Description |
|---------|-------------|
| `is_cooperative` | Is cooperative |
| `is_breeding` | Breeding farm |
| `is_import` | Livestock import |

#### Categorical (3)

| Feature | Categories |
|---------|-----------|
| `animal_type` | Cattle, milk, sheep, horses, other |
| `subsidy_category` | Acquisition, price reduction, breeding, other |
| `normativ_tier` | low, mid, high, zero |

### Target Variable

**`is_merit_worthy`** — binary feature (0/1), determined by three criteria:

1. **Livestock mortality ≤ norm** (Order #12488)
   - Depends on animal type
   - Dynamic thresholds from `laws.py`

2. **Subsidy efficiency** (Order #108)
   - Amount per head ≤ 5,000,000 KZT
   - Reasonable fund usage

3. **Pasture norm compliance** (Order #11064)
   - Pasture area sufficient for herd size
   - Depends on animal type and region

### LightGBM Hyperparameters

```python
LGBMClassifier(
    n_estimators=500,
    max_depth=7,
    learning_rate=0.05,
    num_leaves=63,
    min_child_samples=50,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=auto_calculated,
    random_state=42
)
```

### Validation

- **Train/Test Split**: 80/20 (stratified)
- **Cross-Validation**: 5-fold StratifiedKFold
- **Early Stopping**: 50 rounds
- **Metrics**: Accuracy, Precision, Recall, F1, ROC-AUC

---

## 📊 Data Sources

### Primary Dataset

**Source**: Government information system (GISS) export

**Format**: Excel (.xlsx)

**Structure** (13 columns from export):

| # | Column | Type | Description |
|---|--------|------|-------------|
| 1 | `sequential_number` | Integer | Application sequence number |
| 2 | `submission_date` | DateTime | Submission date and time |
| 3 | `region` | String | Oblast (Abai, Akmola, etc.) |
| 4 | `akimat` | String | Akimat name |
| 5 | `application_number` | String | Unique application number (14 digits) |
| 6 | `direction` | String | Direction (livestock, crops, etc.) |
| 7 | `subsidy_name` | Text | Full subsidy name |
| 8 | `status` | String | Status (Executed, Withdrawn, etc.) |
| 9 | `normativ` | Float | Subsidy rate (KZT/unit) |
| 10 | `amount` | Float | Total amount (KZT) |
| 11 | `farm_district` | String | Farm district |
| 12 | `farmer_name` | String | Farmer name (optional) |
| 13 | `land_area` | Float | Land area (ha) |

### Synthetic Data (Farmer Portrait)

**Problem**: Real export contains only application data. Scoring requires farm data.

**Solution**: Generate synthetic features based on real data + legislative norms

**Script**: `scripts/generate_synthetic_features.py`

#### Generated Features

| Feature | Generation Method | Justification |
|---------|-------------------|---------------|
| `pasture_area_ha` | Based on herd count × ha/head norm + noise | Order #11064 (maximum pasture loads) |
| `historical_mortality_rate` | Based on animal type + mortality norm | Order #12488 (natural offspring) |
| `current_head_count` | Based on requested quantity + multiplier | Realistic farm sizes |

#### Legislative Norms (laws.py)

**Order #11064** — Maximum pasture loads:

| Animal Type | ha/head |
|-------------|---------|
| Cattle (beef) | 1.0 |
| Cattle (dairy) | 1.5 |
| Sheep | 0.1 |
| Horses | 1.2 |

**Order #12488** — Mortality norms:

| Animal Type | Mortality Norm (%) |
|-------------|-------------------|
| Cattle | 8-10% |
| Sheep | 12-15% |
| Horses | 5-7% |
| Poultry | 15-20% |

---

## 🚀 Quick Start

### Prerequisites

- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **Git**
- **Minimum 8 GB RAM** (for ML model)
- **API keys** from alem.plus (LLM, Score API, Embedder)

### Step-by-Step Guide

#### Step 1: Clone Repository

```bash
git clone https://github.com/your-username/k0t1k.git
cd k0t1k
```

#### Step 2: Configure Environment

```bash
# Copy template
cp .env.example .env

# Edit .env
# Required:
# - LLM_API_KEY (from alem.plus)
# - SCORE_API_KEY (from alem.plus)
# - EMBEDDER_API_KEY (from alem.plus)
# - JWT_SECRET_KEY (any secret string)
# - GOOGLE_CLIENT_ID (optional)
```

**Minimal .env for local run**:

```env
POSTGRES_DB=k0t1k
POSTGRES_USER=k0t1k
POSTGRES_PASSWORD=k0t1k_local

LLM_API_KEY=your-alem-plus-key
SCORE_API_KEY=your-alem-plus-key
EMBEDDER_API_KEY=your-alem-plus-key

JWT_SECRET_KEY=my-super-secret-key-123
```

#### Step 3: Run via Docker Compose

```bash
# Start all services
docker compose up --build

# Or in background mode
docker compose up --build -d
```

**What happens on startup**:

1. ✅ Docker images built (backend + frontend)
2. ✅ PostgreSQL started (port 5432)
3. ✅ Redis started (port 6379)
4. ✅ Alembic migrations applied
5. ✅ Backend FastAPI started (port 8000)
6. ✅ Nginx Frontend started (port 80)
7. ✅ (Optional) Cloudflare Tunnel

#### Step 4: Verify Operation

```bash
# Check backend health
curl http://localhost:8000/api/health

# Expected response:
{
  "status": "ok",
  "model_loaded": true,
  "redis_connected": true,
  "llm_available": true
}

# Check Frontend
# Open in browser: http://localhost
```

#### Step 5: Register First User

```bash
# Register via API
curl -X POST http://localhost:80/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@admin.com",
    "password": "admin123",
    "full_name": "Administrator"
  }'
```

#### Step 6: Grant Admin Rights

```bash
# Method 1: Via SQL (recommended)
docker compose exec postgres psql -U k0t1k -d k0t1k -c \
  "UPDATE users SET is_admin = True, is_active = True WHERE email = 'admin@admin.com';"

# Method 2: Interactive psql
docker compose exec postgres psql -U k0t1k -d k0t1k

# Inside psql:
UPDATE users SET is_admin = true, is_active = true WHERE email = 'admin@admin.com';
\q

# Method 3: Verify result
docker compose exec postgres psql -U k0t1k -d k0t1k -c \
  "SELECT id, email, is_admin, is_active FROM users WHERE email = 'admin@admin.com';"
```

> **⚠️ Important**: Depending on DB configuration, database name may be `k0t1k` instead of `k0t1k_db`. Check `POSTGRES_DB` value in `.env` file.

#### Step 7: Login

1. Open **http://localhost**
2. Enter email: `admin@admin.com`
3. Enter password: `admin123`
4. You're in the admin panel! 🎉

---

## 👑 First Admin Setup

### Complete First Run Script

```bash
#!/bin/bash
# first-admin.sh — First administrator setup script

echo "🚀 Setting up k0t1k first admin"
echo "=========================================="

# 1. Check services are running
echo "📡 Checking services..."
docker compose ps | grep -q "backend" || { echo "❌ Backend not started!"; exit 1; }
docker compose ps | grep -q "postgres" || { echo "❌ PostgreSQL not started!"; exit 1; }
echo "✅ Services running"

# 2. Register user
echo ""
echo "📝 Registering user..."
curl -s -X POST http://localhost:80/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@admin.com",
    "password": "admin123",
    "full_name": "Main Administrator"
  }' || echo "⚠️ User already exists"

# 3. Grant admin rights
echo ""
echo "🔑 Granting admin rights..."
docker compose exec postgres psql -U k0t1k -d k0t1k -c \
  "UPDATE users SET is_admin = true, is_active = true WHERE email = 'admin@admin.com';"

# 4. Verify
echo ""
echo "✅ Verifying rights..."
docker compose exec postgres psql -U k0t1k -d k0t1k -c \
  "SELECT id, email, full_name, is_admin, is_active FROM users WHERE email = 'admin@admin.com';"

echo ""
echo "🎉 Done! Login at http://localhost with credentials:"
echo "   Email: admin@admin.com"
echo "   Password: admin123"
```

---

## 📥 Data Upload

### Preparing Dataset

#### Option 1: Using Real Data

1. Obtain GISS export (Excel .xlsx format)
2. Ensure file contains standard columns (13 columns, see "Data Sources" section)
3. Place file in `backend/data/raw/`

#### Option 2: Generate Synthetic Data

```bash
# Generate enriched dataset
docker compose exec backend python scripts/generate_synthetic_features.py

# Script:
# 1. Reads real export
# 2. Adds Farmer Portrait features
# 3. Calculates is_merit_worthy
# 4. Saves to backend/data/raw/enriched_data_2025_merit.xlsx
```

### Upload via Web Interface

1. Login as administrator
2. Navigate to **Dashboard**
3. Click **"Upload Excel"**
4. Select file (.xlsx)
5. Click **"Upload & Train"**

**What happens**:

```
[HTTP 202] Upload accepted → background task started
   ↓
[Task ID] task_id returned for tracking
   ↓
[Progress] GET /api/upload/status/{task_id}
   ↓
[Done] Model trained, applications scored, cache updated
```

### Upload via API

```bash
# Upload file
curl -X POST http://localhost:80/api/data/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@backend/data/raw/enriched_data_2025_merit.xlsx"

# Expected response:
{
  "task_id": "abc123-def456-ghi789",
  "message": "Upload accepted, training started"
}

# Track progress
curl http://localhost:80/api/upload/status/abc123-def456-ghi789

# Expected response:
{
  "status": "processing",  # or "completed"
  "progress": 0.75,
  "message": "Training model..."
}
```

---

## 🔌 API Endpoints

### Health Check

```
GET /api/health
```

### Authentication

```
POST /api/auth/register       # Register
POST /api/auth/login          # Login
POST /api/auth/google         # Google OAuth
GET  /api/auth/me             # Current user
POST /api/auth/change-password # Change password
```

### Data & Training

```
POST /api/data/upload                  # Upload Excel
GET  /api/upload/status/{task_id}      # Training status
```

### Applications

```
GET /api/applications                  # List applications
GET /api/applications/{id}             # Application details
GET /api/applications/{id}/explain     # SHAP + LLM explanation
GET /api/applications/{id}/explain-stream  # SSE explanation
GET /api/applications/{id}/pdf         # PDF protocol
GET /api/applications/{id}/refusal-pdf # PDF refusal
```

### Analytics

```
GET  /api/stats                        # Statistics
GET  /api/global-shap                  # Global SHAP
GET  /api/analytics/fifo-vs-merit      # FIFO vs Merit
POST /api/analytics/simulate-weights   # Weight simulation
GET  /api/analytics/transparency-report # Transparency Report
GET  /api/data-quality                 # Data quality
GET  /api/fairness                     # Fairness audit
GET  /api/model-info                   # Model info
```

### Budget

```
POST /api/budget-simulate              # Budget simulation
POST /api/budget-simulate/pdf          # Budget PDF
```

### AI Assistant

```
POST /api/assistant/chat               # Chat with assistant
POST /api/assistant/chat-stream        # Streaming chat
```

### Proactive Offers

```
GET /api/proactive-offers              # Promising farmers
```

### Administration

```
GET  /api/admin/users                  # List users
POST /api/admin/users/{id}/toggle-active  # Activate/Block
POST /api/admin/users/{id}/toggle-admin   # Admin rights
GET  /api/admin/models                 # Model versions
POST /api/admin/models/{filename}/activate # Activate model
```

### Full API Documentation

After startup, open: **http://localhost:8000/docs** (Swagger UI)

---

## 🧠 Explainability

### Why It Matters

Per inDrive Gov requirements:

> **"AI must not act as the sole source of truth. The system should assist in decision-making, not replace the expert."**

### Explainability Levels

#### Level 1: Score (0-100)

```json
{
  "application_id": 12345,
  "merit_score": 78.5,
  "is_approved": true,
  "risk_level": "green"
}
```

#### Level 2: SHAP Values

```json
{
  "shap_values": {
    "amount_per_head": +12.3,
    "pasture_area_ha": +8.7,
    "historical_mortality_rate": -5.2,
    "subsidy_type_approval_rate": +3.1
  },
  "top_positive": ["amount_per_head", "pasture_area_ha"],
  "top_negative": ["historical_mortality_rate"]
}
```

#### Level 3: LLM Explanation (Qwen 3.5)

```
This application received a score of 78.5 out of 100.

✅ Positive factors:
• Subsidy efficiency: amount per head is 2.3M KZT, 
  which is within reasonable limits (below 5M threshold)
• Pasture area is sufficient for declared herd size (complies with 
  Order #11064)
• Historical approval rate for this subsidy type: 85%

⚠️ Risk factors:
• Livestock mortality rate (5.2%) slightly exceeds norm for cattle (8%), 
  but remains within acceptable limits

Recommendation: Application meets merit-based scoring criteria.
```

---

## 🔐 Security & Authentication

### Authentication Methods

1. **Email + Password** (JWT tokens)
2. **Google OAuth** (optional)

### JWT Tokens

```python
# Authorization header
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Token lifetime: 24 hours (configurable in config.py)
```

### User Roles

| Role | Permissions |
|------|-------------|
| **Inactive** | No access (awaiting admin approval) |
| **User** | View applications, explanations, analytics |
| **Administrator** | Everything + user management, data upload, models |

### Rate Limiting

```
Brute-force protection:
- Login: 5 attempts per minute
- API: 100 requests per minute
- Explanations: 20 per minute (LLM is expensive!)
```

---

## 📁 Project Structure

```
k0t1k/
├── 📄 README.md                          # English documentation
├── 📄 README.ru.md                       # Russian documentation
├── 📄 README.kz.md                       # Kazakh documentation
├── 📄 docs/
│   ├── ARCHITECTURE.md                   # System architecture
│   ├── DATA_SOURCES.md                   # Data sources
│   ├── ML_PIPELINE.md                    # ML pipeline
│   ├── API_REFERENCE.md                  # API reference
│   └── DEPLOYMENT.md                     # Deployment
│
├── 📂 backend/
│   ├── 📄 Dockerfile
│   ├── 📄 requirements.txt
│   ├── 📄 alembic.ini
│   │
│   ├── 📂 app/
│   │   ├── 📄 main.py                    # FastAPI entry point
│   │   ├── 📂 api/                       # API endpoints
│   │   ├── 📂 core/                      # Core utilities
│   │   ├── 📂 db/                        # Database models
│   │   ├── 📂 ml/                        # ML models & features
│   │   ├── 📂 integrations/              # External APIs
│   │   ├── 📂 schemas/                   # Pydantic schemas
│   │   └── 📂 services/                  # Business logic
│   │
│   ├── 📂 alembic/                       # Database migrations
│   ├── 📂 models/                        # Saved ML models
│   ├── 📂 data/                          # Excel datasets
│   └── 📂 tests/                         # Unit tests
│
├── 📂 frontend/
│   ├── 📄 Dockerfile
│   ├── 📄 package.json
│   │
│   └── 📂 src/
│       ├── 📂 pages/                     # React pages
│       ├── 📂 components/                # React components
│       ├── 📂 services/                  # API client
│       ├── 📂 store/                     # State management
│       └── 📂 i18n/                      # Internationalization
│
├── 📂 scripts/
│   └── 📄 generate_synthetic_features.py # Farmer Portrait generation
│
├── 📄 docker-compose.yml                 # Service orchestration
├── 📄 .env.example                       # Environment template
└── 📄 LICENSE
```

---

## ⚙️ Configuration

### Environment Variables (.env)

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `k0t1k` |
| `POSTGRES_USER` | Database user | `k0t1k` |
| `POSTGRES_PASSWORD` | Database password | `k0t1k_local` |
| `LLM_API_KEY` | LLM key (alem.plus) | `your-key` |
| `SCORE_API_KEY` | Score API key | `your-key` |
| `EMBEDDER_API_KEY` | Embedder key | `your-key` |
| `JWT_SECRET_KEY` | JWT secret | `random-string` |

#### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_BASE_URL` | LLM API URL | `https://llm.alem.ai/v1` |
| `LLM_MODEL` | LLM model | `qwen3` |
| `GOOGLE_CLIENT_ID` | Google OAuth ID | `` |
| `CORS_ORIGINS` | Allowed CORS | `["http://localhost:80"]` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare token | `` |

---

## 💻 Local Development

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL and Redis (Docker)
docker compose up postgres redis -d

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build
npm run build

# Lint
npm run lint
```

---

## 🚀 Production Deployment

### Production Checklist

- [ ] Replace `JWT_SECRET_KEY` with cryptographically secure value
- [ ] Set `POSTGRES_PASSWORD` (don't use default)
- [ ] Provide real `LLM_API_KEY`, `SCORE_API_KEY`, `EMBEDDER_API_KEY`
- [ ] Configure `CORS_ORIGINS` for production domain
- [ ] Enable HTTPS (Cloudflare or Nginx + Let's Encrypt)
- [ ] Configure PostgreSQL backups
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Configure logging (ELK Stack)

### Deploy to Server

```bash
# 1. Clone
git clone https://github.com/your-org/k0t1k.git
cd k0t1k

# 2. Configure
cp .env.example .env
nano .env  # Fill with real values

# 3. Deploy
docker compose up --build -d

# 4. Verify
docker compose ps
curl http://localhost/api/health

# 5. Create admin
# (see "First Admin Setup" section)
```

---

## ⚠️ Limitations & Known Issues

### Current Limitations

1. **Synthetic Data**
   - Farmer Portrait features are generated synthetically
   - Real farm data is unavailable
   - **Solution**: Integrate with real accounting systems

2. **External API Dependency**
   - LLM explanations require alem.plus API
   - Explanations don't work without internet
   - **Solution**: Local LLM (e.g., Llama 3)

3. **Scalability**
   - LightGBM runs on single server
   - >100k applications will require distributed architecture
   - **Solution**: Spark ML or cloud ML services

4. **Regional Coverage**
   - Legislative norms may vary by region
   - Not all regions covered in `laws.py`
   - **Solution**: Expand norms database

### Known Issues

| Issue | Status | Workaround |
|-------|--------|------------|
| Cyrillic in PDF | ✅ Fixed | Uses DejaVuSans font |
| Slow LLM explanations | ⚠️ Monitored | 1-hour cache, SSE |
| Large Excel files (>50MB) | ⚠️ Limited | Split into parts	|

---

## 📊 Evaluation Criteria

Per Decentrathon 5.0 requirements:

| Criterion | Weight | What's Evaluated | How We Meet It |
|-----------|--------|------------------|----------------|
| **Problem & Value** | 15 | Task understanding and practical value | ✅ Solves real FIFO → Merit problem |
| **Data Work** | 15 | Data processing quality, sources, features | ✅ 20 features, synthetic + real data |
| **Model & Logic** | 20 | Approach validity, correctness | ✅ LightGBM + 2-stage scoring + CV |
| **Explainability** | 15 | Explanation clarity | ✅ SHAP + LLM + Streaming |
| **Technical Implementation** | 15 | Working prototype, stability | ✅ Full stack, Docker, CI/CD ready |
| **Demo & UX** | 10 | Usage clarity | ✅ Intuitive UI, dashboards, charts |
| **Documentation** | 10 | README, launch, data, limitations | ✅ **This documentation** 🚀 |
| **TOTAL** | **100** | | |

---

## 🙏 Acknowledgments

- **OskemenHUB** — за помощь в съемке демо-материалов и поддержку проекта
- **Decentrathon 5.0** — за площадку для инноваций
- **inDrive** — за вдохновение и поддержку

---

## 📞 Contacts

- **https://datanomads.cc**

---

**Made with ❤️ for Decentrathon 5.0**
