# 🔌 API Reference Documentation — _k0t1k Project

> Complete API reference with examples for all endpoints

---

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Health & Status](#health--status)
- [Authentication Endpoints](#authentication-endpoints)
- [Data Management](#data-management)
- [Applications](#applications)
- [Analytics](#analytics)
- [Budget Simulation](#budget-simulation)
- [AI Assistant](#ai-assistant)
- [Administration](#administration)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)

---

## 🎯 Overview

**Base URL**: `http://localhost:8000/api` (local)  
**Protocol**: HTTPS (production)  
**Format**: JSON  
**Character Encoding**: UTF-8 (Cyrillic supported)

### Response Format

**Success**:
```json
{
  "data": {...},
  "message": "Success"
}
```

**Error**:
```json
{
  "detail": "Error message",
  "status_code": 400
}
```

**Paginated List**:
```json
{
  "data": [...],
  "total": 1234,
  "page": 1,
  "page_size": 50,
  "total_pages": 25
}
```

---

## 🔐 Authentication

### JWT Token

All authenticated endpoints require JWT token in Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Lifetime

- **Default**: 24 hours
- **Configurable**: Via `JWT_EXPIRATION_HOURS` in `.env`

---

## 🏥 Health & Status

### GET `/api/health`

Check system health status.

**Request**:
```bash
curl http://localhost:8000/api/health
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "model_loaded": true,
  "redis_connected": true,
  "llm_available": true
}
```

**Response Fields**:
- `status`: Overall status ("ok" or "degraded")
- `model_loaded`: ML model loaded
- `redis_connected`: Redis cache available
- `llm_available`: LLM API accessible

---

## 🔑 Authentication Endpoints

### POST `/api/auth/register`

Register new user.

**Request**:
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure_password_123",
    "full_name": "Иван Иванов"
  }'
```

**Request Body**:
```json
{
  "email": "string (required)",
  "password": "string (min 6 chars, required)",
  "full_name": "string (required)"
}
```

**Response** (201 Created):
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "Иван Иванов",
    "is_active": false,
    "is_admin": false
  }
}
```

**Note**: New users are inactive by default. Admin must activate.

---

### POST `/api/auth/login`

Login with email and password.

**Request**:
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure_password_123"
  }'
```

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "Иван Иванов",
    "is_active": true,
    "is_admin": false
  }
}
```

**Error** (401 Unauthorized):
```json
{
  "detail": "Incorrect email or password"
}
```

---

### POST `/api/auth/google`

Login with Google OAuth.

**Request**:
```bash
curl -X POST http://localhost:8000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "google_token": "google_oauth_token_here"
  }'
```

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "id": 2,
    "email": "user@gmail.com",
    "full_name": "Иван Иванов",
    "is_active": true,
    "is_admin": false,
    "auth_provider": "google"
  }
}
```

---

### GET `/api/auth/me`

Get current user information.

**Request**:
```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response** (200 OK):
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "Иван Иванов",
  "is_active": true,
  "is_admin": false,
  "auth_provider": "local",
  "created_at": "2026-04-05T12:00:00"
}
```

---

### POST `/api/auth/change-password`

Change user password.

**Request**:
```bash
curl -X POST http://localhost:8000/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "old_password_123",
    "new_password": "new_secure_password_456"
  }'
```

**Response** (200 OK):
```json
{
  "message": "Password changed successfully"
}
```

---

## 📊 Data Management

### POST `/api/data/upload`

Upload Excel file and start model training.

**Authorization**: Admin only

**Request**:
```bash
curl -X POST http://localhost:8000/api/data/upload \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "file=@data.xlsx"
```

**Response** (202 Accepted):
```json
{
  "task_id": "abc123-def456-ghi789",
  "message": "Upload accepted, training started"
}
```

**File Requirements**:
- Format: Excel (.xlsx)
- Max size: 100 MB
- Must contain standard GISS columns

---

### GET `/api/upload/status/{task_id}`

Check training task status.

**Request**:
```bash
curl http://localhost:8000/api/upload/status/abc123-def456-ghi789 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response** (Processing):
```json
{
  "task_id": "abc123-def456-ghi789",
  "status": "processing",
  "progress": 0.75,
  "message": "Training model..."
}
```

**Response** (Completed):
```json
{
  "task_id": "abc123-def456-ghi789",
  "status": "completed",
  "progress": 1.0,
  "message": "Training completed. 58432 applications scored.",
  "metrics": {
    "accuracy": 0.78,
    "f1": 0.75,
    "roc_auc": 0.82
  }
}
```

---

## 📝 Applications

### GET `/api/applications`

List applications with pagination and filters.

**Request**:
```bash
curl "http://localhost:8000/api/applications?page=1&page_size=50&region=Абай&min_score=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Query Parameters**:
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 50, max: 200)
- `region`: Filter by region (optional)
- `status`: Filter by status (optional)
- `min_score`: Filter by minimum score (optional)
- `sort_by`: Sort field (default: "merit_score")
- `sort_order`: "asc" or "desc" (default: "desc")

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 1,
      "application_number": "01300100258072",
      "region": "область Абай",
      "akimat": "ГУ \"Управление сельского хозяйства области Абай\"",
      "direction": "Субсидирование в скотоводстве",
      "subsidy_name": "Заявка на получение субсидий...",
      "status": "Исполнена",
      "normativ": 15000.0,
      "amount": 4635000.0,
      "farm_district": "Жарминский район",
      "merit_score": 78.5,
      "is_approved": true,
      "risk_level": "green",
      "created_at": "2026-04-05T12:00:00"
    }
  ],
  "total": 58432,
  "page": 1,
  "page_size": 50,
  "total_pages": 1169
}
```

---

### GET `/api/applications/{id}`

Get single application details.

**Request**:
```bash
curl http://localhost:8000/api/applications/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response** (200 OK):
```json
{
  "id": 1,
  "application_number": "01300100258072",
  "region": "область Абай",
  "amount": 4635000.0,
  "normativ": 15000.0,
  "merit_score": 78.5,
  "is_approved": true,
  "risk_level": "green",
  "farmer_name": null,
  "pasture_area_ha": 125.5,
  "historical_mortality_rate": 5.2,
  "current_head_count": 150,
  "shap_values": {
    "amount_per_head": 12.3,
    "pasture_area_ha": 8.7
  },
  "llm_explanation": "Данная заявка получила скоринг 78.5 из 100..."
}
```

---

### GET `/api/applications/{id}/explain`

Get SHAP + LLM explanation for application.

**Request**:
```bash
curl http://localhost:8000/api/applications/1/explain \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response** (200 OK):
```json
{
  "application_id": 1,
  "merit_score": 78.5,
  "shap_values": {
    "amount_per_head": 12.3,
    "pasture_area_ha": 8.7,
    "historical_mortality_rate": -5.2,
    "subsidy_type_approval_rate": 3.1
  },
  "top_positive": ["amount_per_head", "pasture_area_ha"],
  "top_negative": ["historical_mortality_rate"],
  "llm_explanation": "Данная заявка получила скоринг 78.5 из 100.\n\n✅ Положительные факторы:\n• Эффективность субсидии: сумма на голову составляет 2.3 млн тг\n• Площадь пастбищ достаточна для заявленного поголовья\n\n⚠️ Факторы риска:\n• Уровень падежа скота немного превышает норму"
}
```

---

### GET `/api/applications/{id}/explain-stream`

Get streaming explanation via SSE.

**Request**:
```bash
curl -N http://localhost:8000/api/applications/1/explain-stream \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response** (Server-Sent Events):
```
data: {"token": "Данная"}
data: {"token": " заявка"}
data: {"token": " получила"}
data: {"token": " скоринг"}
data: {"token": " 78.5"}
data: {"token": " из"}
data: {"token": " 100."}
data: [DONE]
```

---

### GET `/api/applications/{id}/pdf`

Download commission decision PDF.

**Request**:
```bash
curl http://localhost:8000/api/applications/1/pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output protocol.pdf
```

**Response**: PDF file (application/pdf)

---

## 📈 Analytics

### GET `/api/stats`

Get aggregated statistics.

**Request**:
```bash
curl http://localhost:8000/api/stats
```

**Response** (200 OK):
```json
{
  "total_applications": 58432,
  "approved_applications": 24156,
  "approval_rate": 0.413,
  "average_merit_score": 52.3,
  "total_amount": 125000000000.0,
  "approved_amount": 51625000000.0,
  "regions_count": 20,
  "last_upload": "2026-04-05T12:00:00"
}
```

---

### GET `/api/global-shap`

Get global SHAP feature importances.

**Request**:
```bash
curl http://localhost:8000/api/global-shap
```

**Response** (200 OK):
```json
{
  "feature_importance": {
    "amount_per_head": 0.245,
    "pasture_area_ha": 0.189,
    "historical_mortality_rate": 0.167,
    "subsidy_type_approval_rate": 0.134,
    "current_head_count": 0.089,
    "month": 0.045,
    "amount_vs_region_median": 0.038,
    "day_of_week": 0.025,
    "hour": 0.023,
    "direction_competition": 0.018,
    "amount_log": 0.015,
    "normativ_amount_ratio": 0.012
  }
}
```

---

### GET `/api/analytics/fifo-vs-merit`

Compare FIFO vs Merit-based approaches.

**Request**:
```bash
curl http://localhost:8000/api/analytics/fifo-vs-merit
```

**Response** (200 OK):
```json
{
  "merit_based": {
    "funded_applications": 1245,
    "total_funded": 51625000000.0,
    "average_merit_score": 72.5,
    "budget_utilization": 0.89
  },
  "fifo": {
    "funded_applications": 987,
    "total_funded": 51625000000.0,
    "average_merit_score": 58.3,
    "budget_utilization": 0.89
  },
  "improvement": {
    "more_farmers": 258,
    "higher_average_score": 14.2,
    "better_utilization": 0.0
  }
}
```

---

### POST `/api/analytics/simulate-weights`

Simulate custom feature weights.

**Request**:
```bash
curl -X POST http://localhost:8000/api/analytics/simulate-weights \
  -H "Content-Type: application/json" \
  -d '{
    "weights": {
      "amount_per_head": 0.3,
      "pasture_area_ha": 0.25,
      "historical_mortality_rate": 0.2,
      "subsidy_type_approval_rate": 0.15,
      "current_head_count": 0.1
    },
    "total_budget": 100000000000.0
  }'
```

**Response** (200 OK):
```json
{
  "funded_applications": 1156,
  "total_funded": 98750000000.0,
  "average_score": 68.9,
  "budget_utilization": 0.987
}
```

---

### GET `/api/fairness`

Get fairness audit (regional bias).

**Request**:
```bash
curl http://localhost:8000/api/fairness
```

**Response** (200 OK):
```json
{
  "gini_index": 0.12,
  "regional_cv": 0.08,
  "approval_by_region": {
    "область Абай": 0.42,
    "Акмолинская область": 0.45,
    "Алматинская область": 0.38
  },
  "fairness_score": "good",
  "recommendation": "Model shows low regional bias"
}
```

---

### GET `/api/data-quality`

Get data quality statistics.

**Request**:
```bash
curl http://localhost:8000/api/data-quality
```

**Response** (200 OK):
```json
{
  "total_applications": 58432,
  "completeness": {
    "region": 100.0,
    "amount": 100.0,
    "normativ": 98.5,
    "pasture_area_ha": 95.2
  },
  "validity": {
    "valid_amounts": 99.8,
    "valid_normativ": 97.3,
    "valid_dates": 100.0
  },
  "synthetic_data_percentage": 15.3,
  "last_updated": "2026-04-05T12:00:00"
}
```

---

### GET `/api/model-info`

Get model architecture and metrics.

**Request**:
```bash
curl http://localhost:8000/api/model-info
```

**Response** (200 OK):
```json
{
  "model_type": "LightGBM",
  "version": "v1.0.0",
  "training_date": "2026-04-05T12:00:00",
  "hyperparameters": {
    "n_estimators": 500,
    "max_depth": 7,
    "learning_rate": 0.05,
    "num_leaves": 63
  },
  "metrics": {
    "accuracy": 0.78,
    "precision": 0.76,
    "recall": 0.75,
    "f1": 0.75,
    "roc_auc": 0.82
  },
  "n_features": 20,
  "feature_names": [...]
}
```

---

## 💰 Budget Simulation

### POST `/api/budget-simulate`

Simulate merit-based budget distribution.

**Request**:
```bash
curl -X POST http://localhost:8000/api/budget-simulate \
  -H "Content-Type: application/json" \
  -d '{
    "total_budget": 100000000000.0
  }'
```

**Request Body**:
```json
{
  "total_budget": "float (required, > 0)"
}
```

**Response** (200 OK):
```json
{
  "total_budget": 100000000000.0,
  "allocated_budget": 98750000000.0,
  "remaining_budget": 12500000000.0,
  "funded_applications": 1245,
  "average_merit_score": 72.5,
  "budget_utilization": 0.9875,
  "funded_ids": [1, 2, 3, ...]
}
```

---

### POST `/api/budget-simulate/pdf`

Download budget simulation PDF.

**Request**:
```bash
curl -X POST http://localhost:8000/api/budget-simulate/pdf \
  -H "Content-Type: application/json" \
  -d '{"total_budget": 100000000000.0}' \
  --output budget.pdf
```

**Response**: PDF file (application/pdf)

---

## 🤖 AI Assistant

### POST `/api/assistant/chat`

Chat with AI assistant.

**Request**:
```bash
curl -X POST http://localhost:8000/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Какие факторы влияют на скоринг?",
    "language": "ru"
  }'
```

**Request Body**:
```json
{
  "message": "string (required)",
  "language": "string (ru|kz, default: ru)",
  "context": "object (optional)"
}
```

**Response** (200 OK):
```json
{
  "response": "На скоринг влияют следующие факторы:\n\n1. Эффективность субсидии (сумма на голову)\n2. Площадь пастбищ\n3. Уровень падежа скота\n4. Исторический процент одобрения\n\nСамый важный фактор — эффективность использования средств.",
  "language": "ru"
}
```

---

### POST `/api/assistant/chat-stream`

Streaming chat with AI assistant.

**Request**:
```bash
curl -N -X POST http://localhost:8000/api/assistant/chat-stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Как улучшить скоринг?", "language": "ru"}'
```

**Response** (Server-Sent Events):
```
data: {"token": "Для"}
data: {"token": " улучшения"}
data: {"token": " скоринга"}
data: {"token": " рекомендуется"}
...
data: [DONE]
```

---

## 👨‍💼 Administration

### GET `/api/admin/users`

List all users (admin only).

**Request**:
```bash
curl http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "full_name": "Иван Иванов",
      "is_active": true,
      "is_admin": false,
      "created_at": "2026-04-05T12:00:00"
    }
  ],
  "total": 15
}
```

---

### POST `/api/admin/users/{id}/toggle-active`

Activate or block user (admin only).

**Request**:
```bash
curl -X POST http://localhost:8000/api/admin/users/1/toggle-active \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response** (200 OK):
```json
{
  "user_id": 1,
  "is_active": true,
  "message": "User activated"
}
```

---

### POST `/api/admin/users/{id}/toggle-admin`

Grant or revoke admin rights (admin only).

**Request**:
```bash
curl -X POST http://localhost:8000/api/admin/users/1/toggle-admin \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response** (200 OK):
```json
{
  "user_id": 1,
  "is_admin": true,
  "message": "Admin rights granted"
}
```

---

### GET `/api/admin/models`

List model versions (admin only).

**Request**:
```bash
curl http://localhost:8000/api/admin/models \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response** (200 OK):
```json
{
  "models": [
    {
      "version": "v1.0.0",
      "training_date": "2026-04-05T12:00:00",
      "is_active": true,
      "metrics": {
        "accuracy": 0.78,
        "f1": 0.75,
        "roc_auc": 0.82
      }
    }
  ],
  "active_version": "v1.0.0"
}
```

---

### POST `/api/admin/models/{filename}/activate`

Activate model version (admin only).

**Request**:
```bash
curl -X POST http://localhost:8000/api/admin/models/v1.0.0.joblib/activate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response** (200 OK):
```json
{
  "version": "v1.0.0",
  "message": "Model activated"
}
```

---

## ❌ Error Responses

### Common Errors

**400 Bad Request**:
```json
{
  "detail": "Invalid request body",
  "status_code": 400
}
```

**401 Unauthorized**:
```json
{
  "detail": "Invalid authentication credentials"
}
```

**403 Forbidden**:
```json
{
  "detail": "Admin privileges required"
}
```

**404 Not Found**:
```json
{
  "detail": "Application not found"
}
```

**422 Validation Error**:
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error"
    }
  ]
}
```

**500 Internal Server Error**:
```json
{
  "detail": "Internal server error"
}
```

---

## ⏱️ Rate Limiting

### Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 5 requests | 1 minute |
| `/auth/register` | 3 requests | 1 minute |
| `/applications/{id}/explain` | 20 requests | 1 minute |
| `/assistant/chat` | 10 requests | 1 minute |
| All other endpoints | 100 requests | 1 minute |

### Rate Limit Response Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1617712800
```

### Rate Limit Exceeded (429)

```json
{
  "detail": "Rate limit exceeded. Try again in 45 seconds."
}
```

---

**Last Updated**: April 5, 2026  
**Maintained By**: DataNomads Team  
**Project**: _k0t1k Project  
**API Version**: v1.0
