# 🚀 Руководство по развёртыванию — _k0t1k Project

> Руководство по развёртыванию, мониторингу и обслуживанию в промышленной среде

---

## 📋 Содержание

- [Обзор](#обзор)
- [Системные требования](#системные-требования)
- [Контрольный список перед развёртыванием](#контрольный-список-перед-развёртыванием)
- [Архитектура развёртывания](#архитектура-развёртывания)
- [Пошаговое развёртывание](#пошаговое-развёртывание)
- [Проверка после развёртывания](#проверка-после-развёртывания)
- [Настройка первого администратора](#настройка-первого-администратора)
- [Настройка SSL/TLS](#настройка-ssltls)
- [Стратегия резервного копирования](#стратегия-резервного-копирования)
- [Мониторинг и оповещения](#мониторинг-и-оповещения)
- [Руководство по масштабированию](#руководство-по-масштабированию)
- [Процедуры обслуживания](#процедуры-обслуживания)
- [Устранение неполадок](#устранение-неполадок)
- [Усиление безопасности](#усиление-безопасности)

---

## 🎯 Обзор

Данное руководство описывает развёртывание платформы скоринга _k0t1k в промышленных средах. Предполагается familiarity с Docker, администрированием Linux и основами сетевой инфраструктуры.

### Варианты развёртывания

1. **Docker Compose** (рекомендуется для хакатона и небольших проектов)
2. **Kubernetes** (для крупномасштабного промышленного использования)
3. **Bare Metal** (ручная настройка, не рекомендуется)

---

## 💻 Системные требования

### Минимальные требования

| Ресурс | Спецификация |
|--------|--------------|
| **CPU** | 4 ядра |
| **RAM** | 8 ГБ |
| **Хранилище** | 50 ГБ SSD |
| **Сеть** | 100 Мбит/с |
| **ОС** | Ubuntu 20.04+, CentOS 8+, Debian 11+ |

### Рекомендуемые требования для промышленной среды

| Ресурс | Спецификация |
|--------|--------------|
| **CPU** | 8 ядер |
| **RAM** | 16 ГБ |
| **Хранилище** | 100 ГБ NVMe SSD |
| **Сеть** | 1 Гбит/с |
| **ОС** | Ubuntu 22.04 LTS |

### Программные зависимости

| ПО | Версия | Назначение |
|----|--------|------------|
| **Docker** | 20.10+ | Контейнеризация |
| **Docker Compose** | 2.0+ | Оркестрация |
| **Git** | 2.30+ | Управление версиями |
| **Nginx** | (в контейнере) | Обратный прокси |
| **PostgreSQL** | 16 (в контейнере) | База данных |
| **Redis** | 7 (в контейнере) | Кеширование |

---

## ✅ Контрольный список перед развёртыванием

Перед развёртыванием убедитесь, что все пункты выполнены:

### Безопасность

- [ ] `JWT_SECRET_KEY` установлен в криптографически стойкое значение (64+ символов)
- [ ] `POSTGRES_PASSWORD` изменён со значения по умолчанию
- [ ] `LLM_API_KEY`, `SCORE_API_KEY`, `EMBEDDER_API_KEY` настроены
- [ ] CORS origins настроены для промышленного домена
- [ ] Правила файрвола настроены (открыты только порты 80, 443)
- [ ] Включена аутентификация по SSH-ключам
- [ ] Вход root через SSH отключён

### Инфраструктура

- [ ] Доменное имя настроено (например, k0t1k.example.com)
- [ ] DNS-записи созданы (A-запись, указывающая на IP сервера)
- [ ] SSL-сертификат получен (Let's Encrypt или коммерческий)
- [ ] Хранилище резервных копий настроено (S3, NFS или внешний диск)
- [ ] Система мониторинга установлена (опционально)

### Приложение

- [ ] Код проверен и протестирован локально
- [ ] Переменные окружения проверены
- [ ] План миграции базы данных подготовлен
- [ ] План отката задокументирован
- [ ] Команда обучена процедурам развёртывания

---

## 🏗️ Архитектура развёртывания

### Развёртывание на одном сервере

```
┌─────────────────────────────────────────────┐
│              Production Server               │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │        Cloudflare CDN (опционально)  │   │
│  └──────────────┬──────────────────────┘   │
│                 │                          │
│  ┌──────────────▼──────────────────────┐   │
│  │         Nginx (порт 80/443)         │   │
│  │  • Завершение SSL                   │   │
│  │  • Обратный прокси                  │   │
│  │  • Раздача статических файлов       │   │
│  └──────────────┬──────────────────────┘   │
│                 │                          │
│  ┌──────────────▼──────────────────────┐   │
│  │      Backend (FastAPI, порт 8000)   │   │
│  │  • API-сервер                       │   │
│  │  • ML-модель                        │   │
│  └──────────────┬──────────────────────┘   │
│                 │                          │
│        ┌────────┴────────┐                │
│  ┌─────▼─────┐    ┌─────▼─────┐          │
│  │PostgreSQL │    │  Redis    │          │
│  │ порт 5432 │    │ порт 6379 │          │
│  └───────────┘    └───────────┘          │
│                                              │
│  Тома (Volumes):                             │
│  - pgdata:/var/lib/postgresql/data          │
│  - redisdata:/data                          │
│  - ./backend/data:/app/data                 │
│  - ./backend/models:/app/models             │
└─────────────────────────────────────────────┘
```

---

## 📦 Пошаговое развёртывание

### Шаг 1: Подготовка сервера

```bash
# Обновление системных пакетов
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Проверка установки
docker --version
docker-compose --version

# Установка Git
sudo apt install git -y
```

### Шаг 2: Клонирование репозитория

```bash
# Клонирование проекта
cd /opt
sudo git clone https://github.com/DataNomads/k0t1k.git
cd k0t1k

# Настройка прав доступа
sudo chown -R $USER:$USER /opt/k0t1k
```

### Шаг 3: Настройка окружения

```bash
# Копирование шаблона окружения
cp .env.example .env

# Редактирование переменных окружения
nano .env
```

**Пример .env для промышленной среды**:

```env
# PostgreSQL
POSTGRES_DB=k0t1k
POSTGRES_USER=k0t1k
POSTGRES_PASSWORD=SuperSecurePassword123!@#

# API-ключи (с alem.plus)
LLM_API_KEY=your-production-llm-key
SCORE_API_KEY=your-production-score-key
EMBEDDER_API_KEY=your-production-embedder-key

# JWT (генерация: python -c "import secrets; print(secrets.token_urlsafe(64))")
JWT_SECRET_KEY=your-64-character-random-string-here

# Google OAuth (опционально)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# CORS (обновите вашим доменом)
CORS_ORIGINS=["https://k0t1k.example.com"]

# Cloudflare Tunnel (опционально)
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
```

### Шаг 4: Запуск сервисов

```bash
# Запуск всех сервисов
docker-compose up --build -d

# Проверка статуса сервисов
docker-compose ps

# Просмотр логов
docker-compose logs -f backend
docker-compose logs -f nginx
```

**Ожидаемый вывод**:

```
NAME                STATUS         PORTS
k0t1k-postgres-1    Up (healthy)   0.0.0.0:5432->5432/tcp
k0t1k-redis-1       Up (healthy)   0.0.0.0:6379->6379/tcp
k0t1k-backend-1     Up (healthy)   0.0.0.0:8000->8000/tcp
k0t1k-nginx-1       Up (healthy)   0.0.0.0:80->80/tcp
```

### Шаг 5: Проверка развёртывания

```bash
# Проверка работоспособности бэкенда
curl http://localhost:8000/api/health

# Ожидаемый ответ:
# {"status":"ok","model_loaded":true,"redis_connected":true,"llm_available":true}

# Проверка фронтенда
curl -I http://localhost:80/

# Ожидаемый ответ: HTTP/1.1 200 OK
```

---

## ✅ Проверка после развёртывания

### Автоматический скрипт проверки работоспособности

```bash
#!/bin/bash
# health-check.sh

echo "🏥 Запуск проверки работоспособности..."

# 1. Проверка сервисов
echo ""
echo "📦 Проверка сервисов..."
docker-compose ps | grep -q "postgres" && echo "✅ PostgreSQL: РАБОТАЕТ" || echo "❌ PostgreSQL: НЕ РАБОТАЕТ"
docker-compose ps | grep -q "redis" && echo "✅ Redis: РАБОТАЕТ" || echo "❌ Redis: НЕ РАБОТАЕТ"
docker-compose ps | grep -q "backend" && echo "✅ Backend: РАБОТАЕТ" || echo "❌ Backend: НЕ РАБОТАЕТ"
docker-compose ps | grep -q "nginx" && echo "✅ Nginx: РАБОТАЕТ" || echo "❌ Nginx: НЕ РАБОТАЕТ"

# 2. Проверка Backend API
echo ""
echo "🔌 Проверка API..."
HEALTH=$(curl -s http://localhost:8000/api/health)
echo $HEALTH | python3 -m json.tool

# 3. Проверка подключения к базе данных
echo ""
echo "🗄️  Проверка базы данных..."
docker-compose exec -T postgres psql -U k0t1k -d k0t1k -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ База данных: ПОДКЛЮЧЕНО"
else
    echo "❌ База данных: ПОДКЛЮЧЕНИЕ НЕ УДАЛОСЬ"
fi

# 4. Проверка Redis
echo ""
echo "💾 Проверка Redis..."
docker-compose exec -T redis redis-cli ping | grep -q "PONG"
if [ $? -eq 0 ]; then
    echo "✅ Redis: ОТВЕЧАЕТ"
else
    echo "❌ Redis: НЕ ОТВЕЧАЕТ"
fi

echo ""
echo "✅ Проверка работоспособности завершена!"
```

### Контрольный список ручной проверки

- [ ] Фронтенд загружается по адресу https://your-domain.com
- [ ] Backend API отвечает по адресу https://your-domain.com/api/health
- [ ] Регистрация пользователей работает
- [ ] Вход пользователей работает
- [ ] Swagger UI доступен по адресу https://your-domain.com/docs
- [ ] Загрузка файлов работает (протестируйте небольшим файлом)
- [ ] Миграции базы данных применены
- [ ] В логах отсутствуют ошибки

---

## 👑 Настройка первого администратора

### Способ 1: Скрипт быстрой настройки

```bash
#!/bin/bash
# setup-first-admin.sh

echo "👑 Настройка первого администратора..."

# 1. Регистрация пользователя
echo ""
echo "📝 Регистрация администратора..."
curl -s -X POST http://localhost:80/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@admin.com",
    "password": "SecureAdminPassword123!@#",
    "full_name": "System Administrator"
  }' || echo "⚠️  Пользователь, возможно, уже существует"

# 2. Предоставление прав администратора
echo ""
echo "🔑 Предоставление прав администратора..."
docker-compose exec postgres psql -U k0t1k -d k0t1k -c "UPDATE users SET is_admin = True, is_active = True WHERE email = 'admin@admin.com';"

# 3. Проверка
echo ""
echo "✅ Проверка прав администратора..."
docker-compose exec -T postgres psql -U k0t1k -d k0t1k -c \
  "SELECT id, email, full_name, is_admin, is_active FROM users WHERE email = 'admin@admin.com';"

echo ""
echo "🎉 Настройка администратора завершена!"
echo "   URL: https://your-domain.com"
echo "   Email: admin@admin.com"
echo "   Password: SecureAdminPassword123!@#"
echo ""
echo "⚠️  ВАЖНО: Смените пароль сразу после первого входа!"
```

### Способ 2: Вручную через SQL

```bash
# Подключение к базе данных
docker-compose exec postgres psql -U k0t1k -d k0t1k

# SQL-команды:
UPDATE users
SET is_admin = true, is_active = true
WHERE email = 'admin@admin.com';

SELECT id, email, is_admin, is_active FROM users;

\q
```

---

## 🔒 Настройка SSL/TLS

### Вариант 1: Let's Encrypt с Certbot

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение сертификата
sudo certbot --nginx -d k0t1k.example.com

# Автоматическое продление (уже настроено certbot)
sudo certbot renew --dry-run
```

### Вариант 2: Cloudflare SSL

При использовании Cloudflare:

1. Перейдите в Cloudflare Dashboard → SSL/TLS
2. Установите режим шифрования «Full (strict)»
3. Origin Certificate → Создать сертификат
4. Установите сертификат на сервер

### Обновление Nginx для HTTPS

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

    # Настройки SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Остальная конфигурация...
}
```

---

## 💾 Стратегия резервного копирования

### Резервное копирование базы данных

```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/opt/backups/k0t1k/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/k0t1k_db_$TIMESTAMP.sql.gz"

# Создание каталога резервных копий
mkdir -p $BACKUP_DIR

# Резервное копирование базы данных
docker-compose exec -T postgres pg_dump -U k0t1k k0t1k | gzip > $BACKUP_FILE

echo "✅ Резервная копия базы данных создана: $BACKUP_FILE"

# Удаление резервных копий старше 30 дней
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### Резервное копирование моделей

```bash
#!/bin/bash
# backup-models.sh

BACKUP_DIR="/opt/backups/k0t1k/models"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Резервное копирование моделей
tar -czf $BACKUP_DIR/k0t1k_models_$TIMESTAMP.tar.gz ./backend/models/

echo "✅ Резервная копия моделей создана: $BACKUP_DIR/k0t1k_models_$TIMESTAMP.tar.gz"
```

### Автоматическое резервное копирование (Cron)

```bash
# Редактирование crontab
crontab -e

# Добавление записей:
# Резервное копирование базы данных ежедневно в 2:00
0 2 * * * /opt/k0t1k/scripts/backup-db.sh

# Резервное копирование моделей еженедельно в воскресенье в 3:00
0 3 * * 0 /opt/k0t1k/scripts/backup-models.sh
```

### Восстановление из резервной копии

```bash
# Восстановление базы данных
gunzip -c k0t1k_db_20260405_020000.sql.gz | docker-compose exec -T postgres psql -U k0t1k -d k0t1k

# Восстановление моделей
tar -xzf k0t1k_models_20260405_030000.tar.gz -C /opt/k0t1k/
```

---

## 📊 Мониторинг и оповещения

### Мониторинг Docker Stats

```bash
# Использование ресурсов в реальном времени
docker stats

# Однократный снимок
docker stats --no-stream
```

### Мониторинг логов

```bash
# Просмотр всех логов
docker-compose logs -f

# Только логи бэкенда
docker-compose logs -f backend

# Поиск ошибок
docker-compose logs backend | grep -i error

# Последние 100 строк
docker-compose logs --tail=100 backend
```

### Мониторинг приложения

Создание эндпоинта мониторинга:

```python
# Добавить в endpoints.py
@router.get("/metrics")
async def get_metrics():
    """Эндпоинт метрик, совместимый с Prometheus."""
    return {
        "active_users": await get_active_users_count(),
        "requests_per_minute": await get_rpm(),
        "average_response_time_ms": await get_avg_response_time(),
        "model_predictions_count": await get_prediction_count(),
        "error_rate": await get_error_rate()
    }
```

### Правила оповещений (пример)

| Метрика | Порог | Действие |
|---------|-------|----------|
| **Загрузка CPU** | > 80% в течение 5 мин | Уведомление администратора по email |
| **Использование памяти** | > 90% | Уведомление администратора по email |
| **Использование диска** | > 85% | Уведомление администратора по email |
| **Частота ошибок API** | > 5% в течение 5 мин | Уведомление в Slack |
| **Подключения к БД** | > 100 | Уведомление администратора по email |
| **Время предсказания модели** | > 5 с | Уведомление в Slack |

---

## 📈 Руководство по масштабированию

### Вертикальное масштабирование

Увеличение ресурсов сервера:

| Ресурс | Текущее | Рекомендуемое |
|--------|---------|---------------|
| **CPU** | 4 ядра | 8–16 ядер |
| **RAM** | 8 ГБ | 16–32 ГБ |
| **Хранилище** | 50 ГБ | 100–500 ГБ |

### Горизонтальное масштабирование

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

### Масштабирование базы данных

1. **Реплики для чтения**: для аналитических запросов
2. **Пулинг соединений**: PgBouncer для управления подключениями
3. **Оптимизация запросов**: добавление индексов для медленных запросов

```sql
-- Добавление индексов для часто используемых запросов
CREATE INDEX idx_applications_region ON applications(region);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_merit_score ON applications(merit_score DESC);
```

### Масштабирование кеша

Кластеризация Redis для высокой доступности:

```bash
# Конфигурация Redis Sentinel
redis-sentinel /etc/redis/sentinel.conf
```

---

## 🔧 Процедуры обслуживания

### Обновление приложения

```bash
# Получение последних изменений
cd /opt/k0t1k
git pull origin main

# Пересборка и перезапуск
docker-compose up --build -d

# Проверка обновления
curl http://localhost:8000/api/health
docker-compose logs --tail=50 backend
```

### Миграция базы данных

```bash
# Ручной запуск миграций
docker-compose exec backend alembic upgrade head

# Проверка статуса миграции
docker-compose exec backend alembic current

# Откат одной миграции
docker-compose exec backend alembic downgrade -1
```

### Обновление модели

```bash
# Загрузка нового набора данных через веб-интерфейс
# Или через API:
curl -X POST https://k0t1k.example.com/api/data/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@new_data.xlsx"

# Мониторинг прогресса обучения
curl https://k0t1k.example.com/api/upload/status/{task_id}

# Активация новой версии модели
curl -X POST https://k0t1k.example.com/api/admin/models/v1.1.0.joblib/activate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Ротация логов

```bash
# Настройка ротации логов Docker
sudo nano /etc/docker/daemon.json

{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# Перезапуск Docker
sudo systemctl restart docker
```

---

## 🔧 Устранение неполадок

### Распространённые проблемы

#### Проблема 1: Backend не запускается

**Симптомы**: Контейнер бэкенда немедленно завершает работу

**Диагностика**:
```bash
docker-compose logs backend
```

**Решения**:
- Проверьте файл `.env` на отсутствие переменных
- Проверьте подключение к базе данных
- Убедитесь, что API-ключи действительны

#### Проблема 2: Ошибка подключения к базе данных

**Симптомы**: Ошибки «Connection refused»

**Диагностика**:
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

**Решения**:
- Проверьте `DATABASE_URL` в `.env`
- Убедитесь, что контейнер PostgreSQL запущен
- Проверьте сетевое подключение

#### Проблема 3: Высокое использование памяти

**Симптомы**: Серверу не хватает оперативной памяти

**Диагностика**:
```bash
docker stats
free -h
```

**Решения**:
- Увеличьте объём оперативной памяти сервера
- Уменьшите `DB_POOL_SIZE` в `.env`
- Перезапустите сервисы: `docker-compose restart`

#### Проблема 4: Медленные ответы API

**Симптомы**: API отвечает более 5 секунд

**Диагностика**:
```bash
# Проверка времени выполнения запросов к базе данных
docker-compose exec postgres psql -U k0t1k -d k0t1k -c "
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"
```

**Решения**:
- Добавьте индексы в базу данных
- Включите кеширование Redis
- Оптимизируйте медленные запросы

### Аварийные процедуры

#### Перезапуск всех сервисов

```bash
docker-compose down
docker-compose up -d
```

#### Аварийный сброс базы данных

```bash
# ВНИМАНИЕ: Это удалит все данные!
docker-compose down -v
docker-compose up -d
```

#### Аварийный откат

```bash
# Откат к предыдущей версии
git checkout v1.0.0
docker-compose down
docker-compose up --build -d
```

---

## 🔒 Усиление безопасности

### Настройка файрвола

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Проверка
sudo ufw status
```

### Усиление SSH

```bash
sudo nano /etc/ssh/sshd_config

# Изменение настроек:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3

# Перезапуск SSH
sudo systemctl restart sshd
```

### Безопасность Docker

```bash
# Запуск контейнеров от имени не-root пользователя
# Добавьте в docker-compose.yml:
services:
  backend:
    user: "1000:1000"

  nginx:
    user: "1000:1000"
```

### Безопасность базы данных

```sql
-- Создание пользователя только для чтения для аналитики
CREATE USER analyst WITH PASSWORD 'analyst_password';
GRANT CONNECT ON DATABASE k0t1k TO analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analyst;

-- Отзыв привилегий по умолчанию
REVOKE ALL ON DATABASE k0t1k FROM PUBLIC;
```

---

**Последнее обновление**: 5 апреля 2026 г.
**Поддержка**: Команда DataNomads
**Проект**: _k0t1k Project
**Версия развёртывания**: v1.0
