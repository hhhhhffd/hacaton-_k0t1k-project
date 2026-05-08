# 🔌 Справочник API — проект _k0t1k

> Полная документация по API с примерами для всех эндпоинтов

---

## 📋 Содержание

- [Обзор](#обзор)
- [Аутентификация](#аутентификация)
- [Проверка состояния](#проверка-состояния)
- [Эндпоинты аутентификации](#эндпоинты-аутентификации)
- [Управление данными](#управление-данными)
- [Заявки](#заявки)
- [Аналитика](#аналитика)
- [Моделирование бюджета](#моделирование-бюджета)
- [AI-ассистент](#ai-ассистент)
- [Администрирование](#администрирование)
- [Ответы об ошибках](#ответы-об-ошибках)
- [Ограничение частоты запросов](#ограничение-частоты-запросов)

---

## 🎯 Обзор

**Базовый URL**: `http://localhost:8000/api` (локально)
**Протокол**: HTTPS (продакшен)
**Формат**: JSON
**Кодировка**: UTF-8 (поддержка кириллицы)

### Формат ответа

**Успешный ответ**:
```json
{
  "data": {...},
  "message": "Success"
}
```

**Ошибка**:
```json
{
  "detail": "Текст ошибки",
  "status_code": 400
}
```

**Пагинированный список**:
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

## 🔐 Аутентификация

### JWT-токен

Все защищённые эндпоинты требуют JWT-токен в заголовке Authorization:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Время жизни токена

- **По умолчанию**: 24 часа
- **Настраивается**: через `JWT_EXPIRATION_HOURS` в `.env`

---

## 🏥 Проверка состояния

### GET `/api/health`

Проверка общего состояния системы.

**Запрос**:
```bash
curl http://localhost:8000/api/health
```

**Ответ** (200 OK):
```json
{
  "status": "ok",
  "model_loaded": true,
  "redis_connected": true,
  "llm_available": true
}
```

**Поля ответа**:
- `status`: Общее состояние ("ok" или "degraded")
- `model_loaded`: ML-модель загружена
- `redis_connected`: Redis-кэш доступен
- `llm_available`: LLM API доступен

---

## 🔑 Эндпоинты аутентификации

### POST `/api/auth/register`

Регистрация нового пользователя.

**Запрос**:
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure_password_123",
    "full_name": "Иван Иванов"
  }'
```

**Тело запроса**:
```json
{
  "email": "строка (обязательно)",
  "password": "строка (мин. 6 символов, обязательно)",
  "full_name": "строка (обязательно)"
}
```

**Ответ** (201 Created):
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

**Примечание**: Новые пользователи создаются неактивными. Активацию выполняет администратор.

---

### POST `/api/auth/login`

Вход по электронной почте и паролю.

**Запрос**:
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure_password_123"
  }'
```

**Ответ** (200 OK):
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

**Ошибка** (401 Unauthorized):
```json
{
  "detail": "Неверный email или пароль"
}
```

---

### POST `/api/auth/google`

Вход через Google OAuth.

**Запрос**:
```bash
curl -X POST http://localhost:8000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "google_token": "google_oauth_token_here"
  }'
```

**Ответ** (200 OK):
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

Получение информации о текущем пользователе.

**Запрос**:
```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Ответ** (200 OK):
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

Смена пароля пользователя.

**Запрос**:
```bash
curl -X POST http://localhost:8000/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "old_password_123",
    "new_password": "new_secure_password_456"
  }'
```

**Ответ** (200 OK):
```json
{
  "message": "Пароль успешно изменён"
}
```

---

## 📊 Управление данными

### POST `/api/data/upload`

Загрузка Excel-файла и запуск обучения модели.

**Авторизация**: Только для администраторов

**Запрос**:
```bash
curl -X POST http://localhost:8000/api/data/upload \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "file=@data.xlsx"
```

**Ответ** (202 Accepted):
```json
{
  "task_id": "abc123-def456-ghi789",
  "message": "Загрузка принята, обучение начато"
}
```

**Требования к файлу**:
- Формат: Excel (.xlsx)
- Максимальный размер: 100 МБ
- Должен содержать стандартные столбцы GISS

---

### GET `/api/upload/status/{task_id}`

Проверка статуса задачи обучения.

**Запрос**:
```bash
curl http://localhost:8000/api/upload/status/abc123-def456-ghi789 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Ответ** (В процессе):
```json
{
  "task_id": "abc123-def456-ghi789",
  "status": "processing",
  "progress": 0.75,
  "message": "Обучение модели..."
}
```

**Ответ** (Завершено):
```json
{
  "task_id": "abc123-def456-ghi789",
  "status": "completed",
  "progress": 1.0,
  "message": "Обучение завершено. Оценено 58432 заявки.",
  "metrics": {
    "accuracy": 0.78,
    "f1": 0.75,
    "roc_auc": 0.82
  }
}
```

---

## 📝 Заявки

### GET `/api/applications`

Получение списка заявок с пагинацией и фильтрами.

**Запрос**:
```bash
curl "http://localhost:8000/api/applications?page=1&page_size=50&region=Абай&min_score=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Параметры запроса**:
- `page`: Номер страницы (по умолчанию: 1)
- `page_size`: Количество записей на странице (по умолчанию: 50, макс.: 200)
- `region`: Фильтр по региону (необязательно)
- `status`: Фильтр по статусу (необязательно)
- `min_score`: Фильтр по минимальному баллу (необязательно)
- `sort_by`: Поле сортировки (по умолчанию: "merit_score")
- `sort_order`: Порядок сортировки "asc" или "desc" (по умолчанию: "desc")

**Ответ** (200 OK):
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

Получение информации об одной заявке.

**Запрос**:
```bash
curl http://localhost:8000/api/applications/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Ответ** (200 OK):
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

Получение SHAP- и LLM-объяснения для заявки.

**Запрос**:
```bash
curl http://localhost:8000/api/applications/1/explain \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Ответ** (200 OK):
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

Потоковое получение объяснения через SSE.

**Запрос**:
```bash
curl -N http://localhost:8000/api/applications/1/explain-stream \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Ответ** (Server-Sent Events):
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

Скачивание PDF-файла решения комиссии.

**Запрос**:
```bash
curl http://localhost:8000/api/applications/1/pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output protocol.pdf
```

**Ответ**: PDF-файл (application/pdf)

---

## 📈 Аналитика

### GET `/api/stats`

Получение агрегированной статистики.

**Запрос**:
```bash
curl http://localhost:8000/api/stats
```

**Ответ** (200 OK):
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

Получение глобальных SHAP-значимостей признаков.

**Запрос**:
```bash
curl http://localhost:8000/api/global-shap
```

**Ответ** (200 OK):
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

Сравнение подходов FIFO и Merit-based.

**Запрос**:
```bash
curl http://localhost:8000/api/analytics/fifo-vs-merit
```

**Ответ** (200 OK):
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

Моделирование с пользовательскими весами признаков.

**Запрос**:
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

**Ответ** (200 OK):
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

Получение аудита справедливости (региональная предвзятость).

**Запрос**:
```bash
curl http://localhost:8000/api/fairness
```

**Ответ** (200 OK):
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
  "recommendation": "Модель демонстрирует низкую региональную предвзятость"
}
```

---

### GET `/api/data-quality`

Получение статистики качества данных.

**Запрос**:
```bash
curl http://localhost:8000/api/data-quality
```

**Ответ** (200 OK):
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

Получение информации об архитектуре и метриках модели.

**Запрос**:
```bash
curl http://localhost:8000/api/model-info
```

**Ответ** (200 OK):
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

## 💰 Моделирование бюджета

### POST `/api/budget-simulate`

Моделирование распределения бюджета на основе merit-скоринга.

**Запрос**:
```bash
curl -X POST http://localhost:8000/api/budget-simulate \
  -H "Content-Type: application/json" \
  -d '{
    "total_budget": 100000000000.0
  }'
```

**Тело запроса**:
```json
{
  "total_budget": "число с плавающей точкой (обязательно, > 0)"
}
```

**Ответ** (200 OK):
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

Скачивание PDF-отчёта моделирования бюджета.

**Запрос**:
```bash
curl -X POST http://localhost:8000/api/budget-simulate/pdf \
  -H "Content-Type: application/json" \
  -d '{"total_budget": 100000000000.0}' \
  --output budget.pdf
```

**Ответ**: PDF-файл (application/pdf)

---

## 🤖 AI-ассистент

### POST `/api/assistant/chat`

Чат с AI-ассистентом.

**Запрос**:
```bash
curl -X POST http://localhost:8000/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Какие факторы влияют на скоринг?",
    "language": "ru"
  }'
```

**Тело запроса**:
```json
{
  "message": "строка (обязательно)",
  "language": "строка (ru|kz, по умолчанию: ru)",
  "context": "объект (необязательно)"
}
```

**Ответ** (200 OK):
```json
{
  "response": "На скоринг влияют следующие факторы:\n\n1. Эффективность субсидии (сумма на голову)\n2. Площадь пастбищ\n3. Уровень падежа скота\n4. Исторический процент одобрения\n\nСамый важный фактор — эффективность использования средств.",
  "language": "ru"
}
```

---

### POST `/api/assistant/chat-stream`

Потоковый чат с AI-ассистентом.

**Запрос**:
```bash
curl -N -X POST http://localhost:8000/api/assistant/chat-stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Как улучшить скоринг?", "language": "ru"}'
```

**Ответ** (Server-Sent Events):
```
data: {"token": "Для"}
data: {"token": " улучшения"}
data: {"token": " скоринга"}
data: {"token": " рекомендуется"}
...
data: [DONE]
```

---

## 👨‍💼 Администрирование

### GET `/api/admin/users`

Получение списка всех пользователей (только для администраторов).

**Запрос**:
```bash
curl http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Ответ** (200 OK):
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

Активация или блокировка пользователя (только для администраторов).

**Запрос**:
```bash
curl -X POST http://localhost:8000/api/admin/users/1/toggle-active \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Ответ** (200 OK):
```json
{
  "user_id": 1,
  "is_active": true,
  "message": "Пользователь активирован"
}
```

---

### POST `/api/admin/users/{id}/toggle-admin`

Предоставление или отзыв прав администратора (только для администраторов).

**Запрос**:
```bash
curl -X POST http://localhost:8000/api/admin/users/1/toggle-admin \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Ответ** (200 OK):
```json
{
  "user_id": 1,
  "is_admin": true,
  "message": "Права администратора предоставлены"
}
```

---

### GET `/api/admin/models`

Получение списка версий моделей (только для администраторов).

**Запрос**:
```bash
curl http://localhost:8000/api/admin/models \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Ответ** (200 OK):
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

Активация версии модели (только для администраторов).

**Запрос**:
```bash
curl -X POST http://localhost:8000/api/admin/models/v1.0.0.joblib/activate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Ответ** (200 OK):
```json
{
  "version": "v1.0.0",
  "message": "Модель активирована"
}
```

---

## ❌ Ответы об ошибках

### Типовые ошибки

**400 Bad Request — Некорректный запрос**:
```json
{
  "detail": "Некорректное тело запроса",
  "status_code": 400
}
```

**401 Unauthorized — Не авторизован**:
```json
{
  "detail": "Неверные учётные данные для аутентификации"
}
```

**403 Forbidden — Доступ запрещён**:
```json
{
  "detail": "Требуются права администратора"
}
```

**404 Not Found — Не найдено**:
```json
{
  "detail": "Заявка не найдена"
}
```

**422 Validation Error — Ошибка валидации**:
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "недопустимый формат email",
      "type": "value_error"
    }
  ]
}
```

**500 Internal Server Error — Внутренняя ошибка сервера**:
```json
{
  "detail": "Внутренняя ошибка сервера"
}
```

---

## ⏱️ Ограничение частоты запросов

### Лимиты

| Эндпоинт | Лимит | Окно |
|----------|-------|------|
| `/auth/login` | 5 запросов | 1 минута |
| `/auth/register` | 3 запроса | 1 минута |
| `/applications/{id}/explain` | 20 запросов | 1 минута |
| `/assistant/chat` | 10 запросов | 1 минута |
| Все остальные эндпоинты | 100 запросов | 1 минута |

### Заголовки ответа с информацией о лимитах

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1617712800
```

### Превышение лимита (429)

```json
{
  "detail": "Превышен лимит запросов. Повторите попытку через 45 секунд."
}
```

---

**Последнее обновление**: 5 апреля 2026 г.
**Ответственный**: Команда DataNomads
**Проект**: _k0t1k Project
**Версия API**: v1.0
