# 🏆 k0t1k — AI-Скоринг Сельхозпроизводителей

> **Решение для хакатона Decentrathon 5.0 | Трек AI inDrive Gov**

[![English](https://img.shields.io/badge/🇬🇧English-README-blue)](README.md)
[![Қазақша](https://img.shields.io/badge/🇰🇿Қазақша-README-blue)](README.kz.md)
[![Русский](https://img.shields.io/badge/🇷🇺Русский-README-blue)](README.ru.md)

---

## 📋 Оглавление

- [О Проекте](#о-проекте)
- [Проблема](#проблема)
- [Решение](#решение)
- [Ключевые Возможности](#ключевые-возможности)
- [Архитектура Системы](#архитектура-системы)
- [Технологический Стек](#технологический-стек)
- [Модель Машинного Обучения](#модель-машинного-обучения)
- [Источники Данных](#источники-данных)
- [Быстрый Запуск](#быстрый-запуск)
- [Первоначальная Настройка Администратора](#первоначальная-настройка-администратора)
- [Загрузка Данных](#загрузка-данных)
- [API Endpoints](#api-endpoints)
- [Объяснимость (Explainability)](#объяснимость-explainability)
- [Безопасность и Аутентификация](#безопасность-и-аутентификация)
- [Структура Проекта](#структура-проекта)
- [Конфигурация](#конфигурация)
- [Разработка Локально](#разработка-локально)
- [Деплой и Продакшен](#деплой-и-продакшен)
- [Ограничения и Известные Проблемы](#ограничения-и-известные-проблемы)
- [Критерии Оценивания](#критерии-оценивания)
- [Команда](#команда)
- [Лицензия](#лицензия)

---

## 🎯 О Проекте

**k0t1k** — это интеллектуальная система скоринга сельскохозяйственных производителей для распределения государственных субсидий в Республике Казахстан. Система разработана для хакатона **Decentrathon 5.0** в рамках трека **AI inDrive Gov**.

### Миссия

Переход от устаревшего принципа распределения субсидий **«кто первый подал — тот и получил»** к **merit-based подходу** — распределению на основе реальных данных об эффективности хозяйства, соответствии законодательным нормам и потенциале роста.

### Стейкхолдеры

- **Сотрудники государственных органов** (Министерство сельского хозяйства, акиматы)
- **Аналитические подразделения** и специалисты по работе с данными
- **Сельхозпроизводители** (получатели субсидий)
- **Комиссии по распределению субсидий**

---

## 🔥 Проблема

### Текущая Ситуация

Государственные субсидии для сельхозпроизводителей в Казахстане распределяются по принципу **очерёдности подачи документов**:

```
Фермер подал заявку первым → Получил финансирование (пока не закончился бюджет)
```

### Критические Проблемы

1. **❌ Игнорирование эффективности**
   - Реальная эффективность хозяйства не учитывается
   - История использования предыдущих субсидий не анализируется
   - Потенциал к росту не оценивается

2. **❌ Манипуляции и несправедливость**
   - Манипуляции с очередностью подачи
   - Непрозрачное распределение средств
   - Субсидии уходят не тем, кто действительно нуждается

3. **❌ Отсутствие аналитики**
   - Решения принимаются без data-driven подхода
   - Нет автоматизированной проверки соответствия нормам
   - Ручная обработка заявок требует значительных ресурсов

4. **❌ Регуляторная сложность**
   - Множество приказов и нормативных актов (Приказы №11064, №12488, №108)
   - Сложность проверки соответствия всем требованиям вручную

---

## 💡 Решение

### Концепция

**k0t1k** использует **машинное обучение (LightGBM)** для создания скоринговой модели, которая:

1. **Ранжирует заявителей** на основе комплексного анализа данных
2. **Объясняет решения** — какие факторы повлияли на оценку (SHAP + LLM)
3. **Формирует shortlist** кандидатов для рассмотрения комиссией
4. **Сохраняет человеческий контроль** — финальное решение за экспертом

### Ключевые Принципы

```
┌─────────────────────────────────────────────────────┐
│  AI РЕКОМЕНДУЕТ                                     │
│  ↓                                                  │
│  • Анализирует данные                               │
│  • Рассчитывает скоринг (0-100)                     │
│  • Объясняет факторы решения                        │
│  • Предупреждает о нарушениях                       │
│                                                     │
│  ЧЕЛОВЕК РЕШАЕТ                                     │
│  ↓                                                  │
│  • Рассматривает рекомендации AI                    │
│  • Применяет экспертное мнение                      │
│  • Принимает финальное решение                      │
│  • Несёт ответственность                            │
└─────────────────────────────────────────────────────┘
```

---

## ✨ Ключевые Возможности

### 🤖 ML-Скоринг

- **LightGBM модель** с 20 признаками для оценки эффективности
- **Двухэтапный скоринг**: жёсткие фильтры + ML-модель
- **Защита от target leakage** через разделение fit/transform
- **5-fold кросс-валидация** для подтверждения качества

### 📊 Объяснимость (Explainability)

- **SHAP значения** — локальное объяснение для каждой заявки
- **Глобальная важность признаков** — понимание модели в целом
- **LLM-объяснения** (Qwen 3.5) — текстовое описание на понятном языке
- **Streaming объяснений** через Server-Sent Events (SSE)

### 📈 Аналитика

- **FIFO vs Merit сравнение** — наглядная демонстрация преимуществ
- **Симуляция бюджета** — распределение средств по merit-based подходу
- **Симуляция весов** — настройка весов признаков для комиссий
- **Fairness аудит** — проверка на региональную предвзятость (Gini index, CV)
- **Transparency Report** — публичный отчёт о прозрачности решений

### 🛡️ Антифрод-Система

- **Детекция сговоров** — одинаковые суммы/площади в районах
- **Ночные подачи** — аномальное время подачи заявок
- **Новые фермы** — подозрительно новые хозяйства
- **Экстремальные суммы** — аномально высокие запросы

### 📄 Документация

- **PDF протоколы** — протокол решения комиссии (с поддержкой кириллицы)
- **PDF бюджета** — распределение бюджетных средств
- **PDF отказы** — уведомления об отказе с объяснением причин

### 🌐 Многоязычность

- **Русский язык** — полный интерфейс
- **Казахский язык** — полный интерфейс
- **LLM объяснения** на обоих языках

### 👤 Фермерский Портал

- **Публичная подача заявок** — без авторизации
- **Проверка статуса** — отслеживание заявки по номеру
- **Проактивные предложения** — AI находит перспективных фермеров
- **Гайды и инструкции** — помощь в оформлении

### 👨‍💼 Административная Панель

- **Управление пользователями** — активация, блокировка, права админа
- **Управление моделями** — версионирование, активация разных моделей
- **Загрузка данных** — Excel загрузка с автоматическим обучением
- **Дашборд аналитики** — статистика, фильтры, графики

---

## 🏗️ Архитектура Системы

### Диаграмма Компонентов

```
┌───────────────────────────────────────────────────────────┐
│                    Пользователи                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Чиновник │  │ Аналитик │  │  Фермер  │  │  Админ   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
└───────┼─────────────┼─────────────┼─────────────┼────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │
                 ┌────▼────┐
                 │  Nginx  │  Порт 80
                 │  (SPA + │  • React фронтенд
                 │  Proxy) │  • Прокси /api/ → backend:8000
                 └────┬────┘  • SSE поддержка
                      │
        ┌─────────────┴─────────────┐
        │                           │
   ┌────▼────┐              ┌───────▼──────┐
   │Frontend │              │   Backend    │
   │ React + │              │   FastAPI    │  Порт 8000
   │TypeScript│              │   + Uvicorn  │
   │  Vite   │              └───────┬──────┘
   │Tailwind │                      │
   └─────────┘          ┌───────────┼───────────┐
                        │           │           │
                  ┌─────▼────┐ ┌───▼────┐ ┌───▼────┐
                  │PostgreSQL│ │ Redis  │ │  ML    │
                  │  Порт    │ │ Порт   │ │Модели  │
                  │  5432    │ │ 6379   │ │LightGBM│
                  └──────────┘ └────────┘ └────────┘
```

### Поток Данных

```
1. Админ загружает Excel (GISS выгрузка)
   │
   ├─→ Валидация данных
   │
   ├─→ Предобработка (FeatureTransformer.fit)
   │   ├─ Извлечение 20 признаков
   │   ├─ Расчёт целевой переменной is_merit_worthy
   │   └─ Проверка по нормам законодательства
   │
   ├─→ Обучение модели (LightGBM)
   │   ├─ 80/20 split (stratified)
   │   ├─ Early stopping (50 rounds)
   │   └─ 5-fold CV для валидации
   │
   ├─→ Пакетный скоринг всех заявок
   │   ├─ Hard filters (норматив > 0, amount > 0, etc.)
   │   ├─ ML скоринг (predict_proba * 100)
   │   └─ Сохранение в PostgreSQL
   │
   └─→ Кэширование в Redis (1 час)

2. Пользователь просит объяснение заявки
   │
   ├─→ Проверка кэша Redis
   │   └─ Если есть → возврат из кэша
   │
   ├─→ Расчёт SHAP значений (TreeExplainer)
   │
   ├─→ Генерация текста через Qwen 3.5
   │   └─ Промпт с контекстом заявки + SHAP
   │
   └─→ Сохранение в кэш + возврат пользователю

3. Симуляция бюджета
   │
   ├─→ Сортировка по merit_score (desc)
   ├─→ Жадное распределение средств
   └─→ Сравнение с FIFO подходом
```

---

## 🛠️ Технологический Стек

### Backend

| Технология | Версия | Назначение |
|------------|--------|------------|
| **Python** | 3.11+ | Язык разработки |
| **FastAPI** | 0.115.0 | Async веб-фреймворк |
| **Uvicorn** | - | ASGI сервер |
| **SQLAlchemy** | 2.0 | ORM (async режим) |
| **asyncpg** | - | Async PostgreSQL драйвер |
| **Alembic** | 1.13.0 | Миграции БД |
| **PostgreSQL** | 16 | Основная база данных |
| **Redis** | 7 | Кэширование |
| **LightGBM** | 4.5.0 | ML модель (классификатор) |
| **SHAP** | 0.46.0 | Объяснимость модели |
| **scikit-learn** | 1.5.0 | ML утилиты |
| **pandas** | 2.2.0 | Обработка данных |
| **numpy** | 1.26.0 | Численные операции |
| **Qwen 3.5** | - | LLM для объяснений (alem.plus) |
| **Score API** | - | Семантическая проверка (alem.plus) |
| **Embedder** | text-1024 | Векторизация текста (alem.plus) |
| **python-jose** | - | JWT токены |
| **bcrypt** | - | Хеширование паролей |
| **slowapi** | - | Rate limiting |
| **fpdf2** | - | Генерация PDF (кириллица) |

### Frontend

| Технология | Версия | Назначение |
|------------|--------|------------|
| **React** | 19 | UI фреймворк |
| **TypeScript** | 5.9 | Типизация |
| **Vite** | 8 | Сборщик |
| **TailwindCSS** | 4 | Стилизация |
| **React Router** | 7 | Роутинг |
| **Zustand** | 5 | State management |
| **TanStack Table** | 8 | Таблицы с пагинацией |
| **Recharts** | 3 | Графики |
| **Axios** | 1.14 | HTTP клиент |
| **Lucide React** | 1.7 | Иконки |

### DevOps

| Технология | Назначение |
|------------|------------|
| **Docker** | Контейнеризация |
| **Docker Compose** | Оркестрация сервисов |
| **Nginx** | Реверс-прокси + SPA сервер |
| **Cloudflare Tunnel** | Безопасный внешний доступ |
| **GitHub Actions** | CI/CD (опционально) |

---

## 🧠 Модель Машинного Обучения

### Признаки (Features)

**Всего: 20 признаков**

#### Числовые (13)

| Признак | Описание | Источник |
|---------|----------|----------|
| `head_count` | Количество голов (amount / normativ) | Расчётный |
| `month` | Месяц подачи заявки | Временной |
| `hour` | Час подачи заявки | Временной |
| `day_of_week` | День недели подачи | Временной |
| `amount_per_head` | Субсидия на голову | Расчётный |
| `subsidy_type_approval_rate` | Исторический % одобрения по типу | Агрегированный |
| `amount_vs_region_median` | Отклонение от медианы региона | Агрегированный |
| `amount_vs_subsidy_median` | Отклонение от медианы субсидии | Агрегированный |
| `normativ_amount_ratio` | Отношение норматива к сумме | Расчётный |
| `direction_competition` | Конкуренция по направлению | Агрегированный |
| `amount_log` | Логарифм суммы | Расчётный |
| `pasture_area_ha` | Площадь пастбищ (га) | Farmer Portrait |
| `historical_mortality_rate` | Исторический падеж (%) | Farmer Portrait |
| `current_head_count` | Текущее поголовье | Farmer Portrait |

#### Бинарные (3)

| Признак | Описание |
|---------|----------|
| `is_cooperative` | Является кооперативом |
| `is_breeding` | Племенное хозяйство |
| `is_import` | Импорт скота |

#### Категориальные (3)

| Признак | Категории |
|---------|-----------|
| `animal_type` | КРС, молоко, овцы, лошади, другое |
| `subsidy_category` | Приобретение, удешевление, племенное, другое |
| `normativ_tier` | low, mid, high, zero |

### Целевая Переменная

**`is_merit_worthy`** — бинарный признак (0/1), определяется по трём критериям:

1. **Падеж скота ≤ нормы** (Приказ №12488)
   - Зависит от типа животного
   - Динамические пороги из `laws.py`

2. **Эффективность субсидии** (Приказ №108)
   - Сумма на голову ≤ 5,000,000 KZT
   - Разумное использование средств

3. **Соответствие пастбищным нормам** (Приказ №11064)
   - Площадь пастбищ достаточна для поголовья
   - Зависит от типа животного и региона

### Гиперпараметры LightGBM

```python
LGBMClassifier(
    n_estimators=500,
    max_depth=7,
    learning_rate=0.05,
    num_leaves=63,
    min_child_samples=50,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=自动计算,
    random_state=42
)
```

### Валидация

- **Train/Test Split**: 80/20 (stratified)
- **Cross-Validation**: 5-fold StratifiedKFold
- **Early Stopping**: 50 rounds
- **Метрики**: Accuracy, Precision, Recall, F1, ROC-AUC

---

## 📊 Источники Данных

### Основной Датасет

**Источник**: Выгрузка из государственной информационной системы (ГИСС)

**Формат**: Excel (.xlsx)

**Структура** (13 колонок из выгрузки):

| № | Колонка | Тип | Описание |
|---|---------|-----|----------|
| 1 | `sequential_number` | Integer | Порядковый номер заявки |
| 2 | `submission_date` | DateTime | Дата и время подачи |
| 3 | `region` | String | Область (Абай, Акмолинская, etc.) |
| 4 | `akimat` | String | Наименование акимата |
| 5 | `application_number` | String | Уникальный номер заявки (14 цифр) |
| 6 | `direction` | String | Направление (скотоводство, растениеводство, etc.) |
| 7 | `subsidy_name` | Text | Полное название субсидии |
| 8 | `status` | String | Статус (Исполнена, Отозвано, etc.) |
| 9 | `normativ` | Float | Норматив выдачи (KZT/единицу) |
| 10 | `amount` | Float | Общая сумма заявки (KZT) |
| 11 | `farm_district` | String | Район хозяйства |
| 12 | `farmer_name` | String | ФИО фермера (опционально) |
| 13 | `land_area` | Float | Площадь земель (га) |

**Пример строки**:

```
№: 58358
Дата: 21.01.2025 11:15:40
Область: область Абай
Акимат: ГУ "Управление сельского хозяйства области Абай"
Заявка: 01300100258072
Направление: Субсидирование в скотоводстве
Субсидия: Заявка на получение субсидий на ведение селекционной...
Статус: Исполнена
Норматив: 15,000.00
Сумма: 4,635,000.00
Район: Жарминский район
```

### Синтетические Данные (Farmer Portrait)

**Проблема**: Реальная выгрузка содержит только данные о заявках. Для скоринга нужны данные о хозяйствах.

**Решение**: Генерация синтетических признаков на основе реальных данных + законодательных норм

**Скрипт**: `scripts/generate_synthetic_features.py`

#### Генерируемые Признаки

| Признак | Метод Генерации | Обоснование |
|---------|-----------------|-------------|
| `pasture_area_ha` | На основе поголовья × норма га/голову + шум | Приказ №11064 (предельно допустимые нагрузки) |
| `historical_mortality_rate` | На основе типа животного + норма падежа | Приказ №12488 (естественный приплод) |
| `current_head_count` | На основе запрошенного количества + множитель | Реалистичные размеры хозяйств |

#### Алгоритм Генерации

```python
# 1. Загрузка реальных данных из Excel
df = pd.read_excel("Выгрузка по выданным субсидиям 2025 год.xlsx")

# 2. Классификация типа животных по названию субсидии
animal_type = classify_by_keywords(subsidy_name)

# 3. Получение динамических норм из laws.py
ha_per_head = get_pasture_requirement_ha(animal_type, region)
mortality_norm = get_mortality_norm(animal_type)

# 4. Расчёт запрашиваемого поголовья
requested_quantity = amount / normativ

# 5. Генерация текущего поголовья
current_head_count = requested_quantity * uniform(1.5, 5.0)

# 6. Генерация площади пастбищ
# Здоровые фермеры: площадь с запасом
pasture_area = current_head_count * ha_per_head * uniform(1.1, 2.0)
# Нарушители (~20%): площадь меньше нормы
pasture_area = (current + requested) * ha_per_head * uniform(0.2, 0.9)

# 7. Генерация падежа
# Здоровые (~70%): падеж ниже нормы
mortality = uniform(0.1%, mortality_norm)
# Проблемные (~30%): падеж выше нормы
mortality = mortality_norm + uniform(0.1, 5.0)

# 8. Расчёт целевой переменной
is_merit_worthy = (
    (mortality <= mortality_norm) &  # Критерий 1
    (amount_per_head <= 5_000_000) &  # Критерий 2
    (total_heads <= legal_capacity)   # Критерий 3
)
```

#### Законодательные Нормы (laws.py)

**Приказ №11064** — Предельно допустимые нагрузки на пастбища:

| Тип Животного | га/голову |
|---------------|-----------|
| КРС (мясной) | 1.0 |
| КРС (молочный) | 1.5 |
| Овцы | 0.1 |
| Лошади | 1.2 |

**Приказ №12488** — Нормы естественного приплода/падежа:

| Тип Животного | Норма Падежа (%) |
|---------------|------------------|
| КРС | 8-10% |
| Овцы | 12-15% |
| Лошади | 5-7% |
| Птица | 15-20% |

**Приказ №108** — Пороги эффективности субсидий:

| Параметр | Значение |
|----------|----------|
| Макс. сумма на голову | 5,000,000 KZT |
| Мин. норматив | > 0 |

### Дополнительные Источники

Для обогащения модели допускается использование:

- **Открытые данные МСХ РК** — статистика по регионам
- **Демографические данные** — Bureau of National Statistics
- **Климатические данные** — метео данные по областям
- **Рыночные цены** — средние цены на скот/продукцию

*Все дополнительные источники должны быть явно указаны в документации решения.*

---

## 🚀 Быстрый Запуск

### Предварительные Требования

- **Docker** (версия 20.10+)
- **Docker Compose** (версия 2.0+)
- **Git**
- **Минимум 8 GB RAM** (для ML-модели)
- **API ключи** от alem.plus (LLM, Score API, Embedder)

### Пошаговая Инструкция

#### Шаг 1: Клонирование Репозитория

```bash
git clone https://github.com/your-username/k0t1k.git
cd k0t1k
```

#### Шаг 2: Настройка Переменных Окружения

```bash
# Копируем шаблон
cp .env.example .env

# Редактируем .env
# Обязательно заполните:
# - LLM_API_KEY (от alem.plus)
# - SCORE_API_KEY (от alem.plus)
# - EMBEDDER_API_KEY (от alem.plus)
# - JWT_SECRET_KEY (любая секретная строка)
# - GOOGLE_CLIENT_ID (опционально)
```

**Минимальный .env для локального запуска**:

```env
POSTGRES_DB=k0t1k
POSTGRES_USER=k0t1k
POSTGRES_PASSWORD=k0t1k_local

LLM_API_KEY=ваш-ключ-от-alem-plus
SCORE_API_KEY=ваш-ключ-от-alem-plus
EMBEDDER_API_KEY=ваш-ключ-от-alem-plus

JWT_SECRET_KEY=my-super-secret-key-123
```

#### Шаг 3: Запуск Через Docker Compose

```bash
# Запуск всех сервисов
docker compose up --build

# Или в фоновом режиме
docker compose up --build -d
```

**Что происходит при запуске**:

1. ✅ Собираются Docker-образы (backend + frontend)
2. ✅ Запускается PostgreSQL (порт 5432)
3. ✅ Запускается Redis (порт 6379)
4. ✅ Применяются миграции Alembic
5. ✅ Запускается Backend FastAPI (порт 8000)
6. ✅ Запускается Nginx Frontend (порт 80)
7. ✅ (Опционально) Cloudflare Tunnel

#### Шаг 4: Проверка Работоспособности

```bash
# Проверка здоровья backend
curl http://localhost:8000/api/health

# Ожидаемый ответ:
{
  "status": "ok",
  "model_loaded": true,
  "redis_connected": true,
  "llm_available": true
}

# Проверка Frontend
# Откройте в браузере: http://localhost
```

#### Шаг 5: Регистрация Первого Пользователя

```bash
# Регистрация через API
curl -X POST http://localhost:80/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@admin.com",
    "password": "admin123",
    "full_name": "Администратор"
  }'
```

#### Шаг 6: Выдача Прав Администратора

```bash
# Способ 1: Через SQL (рекомендуется)
docker compose exec db psql -U postgres -d k0t1k_db -c \
  "UPDATE users SET is_admin = True, is_active = True WHERE email = 'admin@admin.com';"

# Способ 2: Через psql с интерактивным режимом
docker compose exec db psql -U postgres -d k0t1k_db

# Внутри psql:
UPDATE users SET is_admin = true, is_active = true WHERE email = 'admin@admin.com';
\q

# Способ 3: Проверка результата
docker compose exec db psql -U postgres -d k0t1k_db -c \
  "SELECT id, email, is_admin, is_active FROM users WHERE email = 'admin@admin.com';"
```

> **⚠️ Важно**: В зависимости от конфигурации БД, имя базы данных может быть `k0t1k` вместо `k0t1k_db`. Проверьте в `.env` файле значение `POSTGRES_DB`.

**Правильная команда для вашей конфигурации**:

```bash
# Для POSTGRES_DB=k0t1k (из вашего docker-compose.yml)
docker compose exec postgres psql -U k0t1k -d k0t1k -c \
  "UPDATE users SET is_admin = True, is_active = True WHERE email = 'admin@admin.com';"
```

#### Шаг 7: Вход в Систему

1. Откройте **http://localhost**
2. Введите email: `admin@admin.com`
3. Введите пароль: `admin123`
4. Вы в админ-панели! 🎉

---

## 👑 Первоначальная Настройка Администратора

### Полный Сценарий Первого Запуска

```bash
#!/bin/bash
# first-admin.sh — Скрипт настройки первого администратора

echo "🚀 Настройка первого администратора k0t1k"
echo "=========================================="

# 1. Проверка что сервисы запущены
echo "📡 Проверка сервисов..."
docker compose ps | grep -q "backend" || { echo "❌ Backend не запущен!"; exit 1; }
docker compose ps | grep -q "postgres" || { echo "❌ PostgreSQL не запущен!"; exit 1; }
echo "✅ Сервисы работают"

# 2. Регистрация пользователя
echo ""
echo "📝 Регистрация пользователя..."
curl -s -X POST http://localhost:80/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@admin.com",
    "password": "admin123",
    "full_name": "Главный Администратор"
  }' || echo "⚠️ Пользователь уже существует"

# 3. Выдача прав администратора
echo ""
echo "🔑 Выдача прав администратора..."
docker compose exec postgres psql -U k0t1k -d k0t1k -c \
  "UPDATE users SET is_admin = true, is_active = true WHERE email = 'admin@admin.com';"

# 4. Проверка
echo ""
echo "✅ Проверка прав..."
docker compose exec postgres psql -U k0t1k -d k0t1k -c \
  "SELECT id, email, full_name, is_admin, is_active FROM users WHERE email = 'admin@admin.com';"

echo ""
echo "🎉 Готово! Войдите на http://localhost с учётными данными:"
echo "   Email: admin@admin.com"
echo "   Password: admin123"
```

### Альтернативные Способы Создания Админа

#### Через Python Скрипт

```bash
# Внутри контейнера backend
docker compose exec backend python -c "
import asyncio
from app.db.session import AsyncSessionLocal
from app.db.models import User
from app.core.auth import get_password_hash
from datetime import datetime

async def create_admin():
    async with AsyncSessionLocal() as session:
        admin = User(
            email='admin@admin.com',
            hashed_password=get_password_hash('admin123'),
            full_name='Администратор',
            is_admin=True,
            is_active=True,
            auth_provider='local',
            created_at=datetime.utcnow()
        )
        session.add(admin)
        await session.commit()
        print('✅ Админ создан!')

asyncio.run(create_admin())
"
```

#### Через Прямой SQL Запрос

```bash
# Подключение к БД
docker compose exec postgres psql -U k0t1k -d k0t1k

# SQL запросы
SELECT * FROM users;  -- Проверить существующих
INSERT INTO users (email, hashed_password, full_name, is_admin, is_active, auth_provider, created_at)
VALUES ('admin@admin.com', '$2b$12$...', 'Админ', true, true, 'local', NOW());
```

### Сброс Пароля Администратора

```bash
# Генерация нового хэша пароля
docker compose exec backend python -c "
from app.core.auth import get_password_hash
print(get_password_hash('new_password_123'))
"

# Обновление в БД (вставьте полученный хэш)
docker compose exec postgres psql -U k0t1k -d k0t1k -c "
UPDATE users 
SET hashed_password = '\$2b\$12\$your_new_hash_here' 
WHERE email = 'admin@admin.com';
"
```

---

## 📥 Загрузка Данных

### Подготовка Датасета

#### Вариант 1: Использование Реальных Данных

1. Получите выгрузку из ГИС (формат Excel .xlsx)
2. Убедитесь что файл содержит стандартные колонки (13 колонок, см. раздел "Источники Данных")
3. Поместите файл в `backend/data/raw/`

#### Вариант 2: Генерация Синтетических Данных

```bash
# Генерация обогащенного датасета
docker compose exec backend python scripts/generate_synthetic_features.py

# Скрипт:
# 1. Читает реальную выгрузку
# 2. Добавляет Farmer Portrait признаки
# 3. Рассчитывает is_merit_worthy
# 4. Сохраняет в backend/data/raw/enriched_data_2025_merit.xlsx
```

### Загрузка Через Web-Интерфейс

1. Войдите как администратор
2. Перейдите в **Dashboard**
3. Нажмите **"Загрузить Excel"**
4. Выберите файл (.xlsx)
5. Нажмите **"Загрузить и Обучить"**

**Что происходит**:

```
[HTTP 202] Загрузка принята → background task запущена
   ↓
[Task ID] Возвращается task_id для отслеживания
   ↓
[Progress] GET /api/upload/status/{task_id}
   ↓
[Done] Модель обучена, заявки проскорены, кэш обновлён
```

### Загрузка Через API

```bash
# Загрузка файла
curl -X POST http://localhost:80/api/data/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@backend/data/raw/enriched_data_2025_merit.xlsx"

# Ожидаемый ответ:
{
  "task_id": "abc123-def456-ghi789",
  "message": "Upload accepted, training started"
}

# Отслеживание прогресса
curl http://localhost:80/api/upload/status/abc123-def456-ghi789

# Ожидаемый ответ:
{
  "status": "processing",  # или "completed"
  "progress": 0.75,
  "message": "Training model..."
}
```

### Автоматическая Предобработка

При загрузке система автоматически:

1. ✅ Определяет формат (GISS vs Enriched)
2. ✅ Очищает данные (удаляет мусорные строки)
3. ✅ Валидирует номера заявок (14 цифр)
4. ✅ Преобразует типы данных
5. ✅ Заполняет пропуски значениями по умолчанию
6. ✅ Рассчитывает признаки (если не загружены)

---

## 🔌 API Endpoints

###健康检查

```
GET /api/health
```

**Response**:
```json
{
  "status": "ok",
  "model_loaded": true,
  "redis_connected": true,
  "llm_available": true
}
```

### Аутентификация

```
POST /api/auth/register       # Регистрация
POST /api/auth/login          # Вход
POST /api/auth/google         # Google OAuth
GET  /api/auth/me             # Текущий пользователь
POST /api/auth/change-password # Смена пароля
```

### Данные и Обучение

```
POST /api/data/upload                  # Загрузить Excel
GET  /api/upload/status/{task_id}      # Статус обучения
```

### Заявки

```
GET /api/applications                  # Список заявок
GET /api/applications/{id}             # Детали заявки
GET /api/applications/{id}/explain     # SHAP + LLM объяснение
GET /api/applications/{id}/explain-stream  # SSE объяснение
GET /api/applications/{id}/pdf         # PDF протокол
GET /api/applications/{id}/refusal-pdf # PDF отказ
```

### Аналитика

```
GET  /api/stats                        # Статистика
GET  /api/global-shap                  # Глобальные SHAP
GET  /api/analytics/fifo-vs-merit      # FIFO vs Merit
POST /api/analytics/simulate-weights   # Симуляция весов
GET  /api/analytics/transparency-report # Transparency Report
GET  /api/data-quality                 # Качество данных
GET  /api/fairness                     # Fairness аудит
GET  /api/model-info                   # Информация о модели
```

### Бюджет

```
POST /api/budget-simulate              # Симуляция бюджета
POST /api/budget-simulate/pdf          # PDF бюджета
```

### AI Ассистент

```
POST /api/assistant/chat               # Чат с ассистентом
POST /api/assistant/chat-stream        # Стриминг чат
```

### Проактивные Предложения

```
GET /api/proactive-offers              # Перспективные фермеры
```

### Администрирование

```
GET  /api/admin/users                  # Список пользователей
POST /api/admin/users/{id}/toggle-active  # Активировать/Блокировать
POST /api/admin/users/{id}/toggle-admin   # Права админа
GET  /api/admin/models                 # Версии моделей
POST /api/admin/models/{filename}/activate # Активировать модель
```

### Полная Документация API

После запуска откройте: **http://localhost:8000/docs** (Swagger UI)

---

## 🧠 Объяснимость (Explainability)

### Почему Это Важно

Согласно требованиям inDrive Gov:

> **"AI не должен выступать как единственный источник истины. Система должна помогать принимать решения, а не заменять эксперта."**

### Уровни Объяснимости

#### Уровень 1: Score (0-100)

```json
{
  "application_id": 12345,
  "merit_score": 78.5,
  "is_approved": true,
  "risk_level": "green"
}
```

#### Уровень 2: SHAP Values

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

#### Уровень 3: LLM Объяснение (Qwen 3.5)

```
Данная заявка получила скоринг 78.5 из 100.

✅ Положительные факторы:
• Эффективность субсидии: сумма на голову составляет 2.3 млн тг, 
  что в пределах разумного (ниже порога 5 млн тг)
• Площадь пастбищ достаточна для заявленного поголовья (соответствует 
  Приказу №11064)
• Исторический процент одобрения по данному типу субсидий: 85%

⚠️ Факторы риска:
• Уровень падежа скота (5.2%) немного превышает норму для КРС (8%), 
  но находится в допустимых пределах

Рекомендация: Заявка соответствует критериям merit-based скоринга.
```

### SSE Streaming

```bash
curl -N http://localhost:80/api/applications/12345/explain-stream \
  -H "Authorization: Bearer TOKEN"

# Ответ приходит в реальном времени:
data: {"token": "Данная"}
data: {"token": " заявка"}
data: {"token": " получила"}
...
```

### Global SHAP (Все Заявки)

```bash
curl http://localhost:80/api/global-shap

# Ответ:
{
  "feature_importance": {
    "amount_per_head": 0.245,
    "pasture_area_ha": 0.189,
    "historical_mortality_rate": 0.167,
    "subsidy_type_approval_rate": 0.134,
    ...
  }
}
```

---

## 🔐 Безопасность и Аутентификация

### Методы Аутентификации

1. **Email + Password** (JWT токены)
2. **Google OAuth** (опционально)

### JWT Токены

```python
# Header авторизации
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Время жизни токена: 24 часа (настраивается в config.py)
```

### Роли Пользователей

| Роль | Права |
|------|-------|
| **Неактивный** | Нет доступа (ожидает одобрения админа) |
| **Пользователь** | Просмотр заявок, объяснения, аналитика |
| **Администратор** | Всё + управление пользователями, загрузка данных, модели |

### Rate Limiting

```
Защита от brute-force:
- Login: 5 попыток в минуту
- API: 100 запросов в минуту
- Объяснения: 20 в минуту (LLM дорогой!)
```

### CORS

```env
# Разрешённые origins
CORS_ORIGINS=["http://localhost:80","http://localhost:5173"]
```

### Cloudflare Tunnel (Опционально)

```yaml
# cloudflared-config.yml
tunnel: k0t1k-tunnel
credentials-file: /etc/cloudflared/creds.json
ingress:
  - hostname: k0t1k.example.com
    service: http://nginx:80
```

**Настройка**:

```bash
# Получите токен из Cloudflare Dashboard
# Добавьте в .env:
CLOUDFLARE_TUNNEL_TOKEN=your-token-here

# Запустите:
docker compose up cloudflared -d
```

---

## 📁 Структура Проекта

```
k0t1k/
├── 📄 README.md                          # Английская документация
├── 📄 README.ru.md                       # Русская документация
├── 📄 README.kz.md                       # Казахская документация
├── 📄 docs/
│   ├── ARCHITECTURE.md                   # Архитектура системы
│   ├── DATA_SOURCES.md                   # Источники данных
│   ├── ML_PIPELINE.md                    # ML пайплайн
│   ├── API_REFERENCE.md                  # Справочник API
│   └── DEPLOYMENT.md                     # Деплой
│
├── 📂 backend/
│   ├── 📄 Dockerfile
│   ├── 📄 requirements.txt
│   ├── 📄 alembic.ini
│   ├── 📄 pytest.ini
│   │
│   ├── 📂 app/
│   │   ├── 📄 main.py                    # Entry point FastAPI
│   │   │
│   │   ├── 📂 api/
│   │   │   ├── 📄 endpoints.py           # Основные API роуты (2627 строк!)
│   │   │   ├── 📄 auth_router.py         # Аутентификация
│   │   │   └── 📄 admin_router.py        # Админ роуты
│   │   │
│   │   ├── 📂 core/
│   │   │   ├── 📄 config.py              # Pydantic настройки
│   │   │   ├── 📄 auth.py                # JWT + bcrypt
│   │   │   ├── 📄 redis.py               # Redis клиент
│   │   │   ├── 📄 sanitize.py            # LLM санитизация
│   │   │   └── 📄 laws.py                # Законодательные нормы
│   │   │
│   │   ├── 📂 db/
│   │   │   ├── 📄 models.py              # SQLAlchemy модели
│   │   │   └── 📄 session.py             # Async сессии
│   │   │
│   │   ├── 📂 ml/
│   │   │   ├── 📄 model.py               # LightGBM модель
│   │   │   ├── 📄 features.py            # Feature engineering (20 признаков)
│   │   │   ├── 📄 explainer.py           # SHAP объяснения
│   │   │   └── 📄 data_loader.py         # Загрузка Excel
│   │   │
│   │   ├── 📂 integrations/
│   │   │   └── 📄 alemplus.py            # AlemPlus клиент (Qwen, Score, Embedder)
│   │   │
│   │   ├── 📂 schemas/
│   │   │   ├── 📄 auth.py                # Pydantic auth схемы
│   │   │   └── 📄 application.py         # Pydantic запросы/ответы
│   │   │
│   │   └── 📂 services/
│   │       ├── 📄 scoring_service.py     # Сервис скоринга
│   │       ├── 📄 scoring_pipeline.py    # Пайплайн скоринга (2-stage)
│   │       ├── 📄 anti_fraud_service.py  # Антифрод
│   │       ├── 📄 proactive_offers_service.py
│   │       └── 📄 pdf_service.py         # Генерация PDF
│   │
│   ├── 📂 alembic/
│   │   ├── 📄 env.py
│   │   └── 📂 versions/
│   │       ├── 001_initial_schema.py
│   │       ├── 002_add_users_table.py
│   │       ├── 003_add_merit_score_indexes.py
│   │       ├── 004_add_farmer_portal_columns.py
│   │       └── 005_add_missing_columns.py
│   │
│   ├── 📂 models/                        # Сохранённые модели (joblib)
│   ├── 📂 data/                          # Датасеты Excel
│   │   └── 📂 raw/
│   │       └── Выгрузка по выданным субсидиям 2025 год.xlsx
│   │
│   └── 📂 tests/
│       ├── 📄 test_api.py
│       ├── 📄 test_auth.py
│       ├── 📄 test_features.py
│       └── 📄 test_sanitize.py
│
├── 📂 frontend/
│   ├── 📄 Dockerfile
│   ├── 📄 package.json
│   ├── 📄 vite.config.ts
│   ├── 📄 nginx.conf
│   │
│   └── 📂 src/
│       ├── 📄 main.tsx
│       ├── 📄 App.tsx
│       ├── 📄 types/index.ts
│       │
│       ├── 📂 services/
│       │   └── 📄 api.ts                 # Axios клиент
│       │
│       ├── 📂 store/
│       │   ├── 📄 authStore.ts           # Zustand auth
│       │   └── 📄 appStore.ts            # Zustand app state
│       │
│       ├── 📂 pages/
│       │   ├── 📄 DashboardPage.tsx      # Главный дашборд
│       │   ├── 📄 AnalyticsPage.tsx      # Аналитика (FIFO vs Merit)
│       │   ├── 📄 AdminPage.tsx          # Админ-панель
│       │   ├── 📄 LoginPage.tsx          # Вход
│       │   ├── 📄 ApplyPage.tsx          # Подача заявки
│       │   ├── 📄 StatusPage.tsx         # Проверка статуса
│       │   ├── 📄 GuidePage.tsx          # Гайд
│       │   ├── 📄 ProactiveOffersPage.tsx
│       │   └── 📄 Preza3Page.tsx         # Презентация
│       │
│       ├── 📂 components/
│       │   ├── 📄 Header.tsx
│       │   ├── 📄 Sidebar.tsx
│       │   ├── 📄 ApplicationTable.tsx
│       │   ├── 📄 ExplainabilityModal.tsx
│       │   ├── 📄 BudgetSimulator.tsx
│       │   └── 📄 ...
│       │
│       └── 📂 i18n/
│           └── 📄 useTranslation.ts      # i18n RU/KZ
│
├── 📂 scripts/
│   ├── 📄 generate_synthetic_features.py # Генерация Farmer Portrait
│   └── 📄 hashgenerator.py
│
├── 📄 docker-compose.yml                 # Оркестрация
├── 📄 .env.example                       # Шаблон переменных
├── 📄 .gitignore
├── 📄 cloudflared-config.yml             # Cloudflare Tunnel
└── 📄 LICENSE
```

---

## ⚙️ Конфигурация

### Переменные Окружения (.env)

#### Обязательные

| Переменная | Описание | Пример |
|------------|----------|--------|
| `POSTGRES_DB` | Имя БД | `k0t1k` |
| `POSTGRES_USER` | Пользователь БД | `k0t1k` |
| `POSTGRES_PASSWORD` | Пароль БД | `k0t1k_local` |
| `LLM_API_KEY` | Ключ LLM (alem.plus) | `your-key` |
| `SCORE_API_KEY` | Ключ Score API | `your-key` |
| `EMBEDDER_API_KEY` | Ключ Embedder | `your-key` |
| `JWT_SECRET_KEY` | Секрет JWT | `random-string` |

#### Опциональные

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `LLM_BASE_URL` | URL LLM API | `https://llm.alem.ai/v1` |
| `LLM_MODEL` | Модель LLM | `qwen3` |
| `EMBEDDER_URL` | URL Embedder API | `https://llm.alem.ai/v1` |
| `EMBEDDER_MODEL` | Модель Embedder | `text-1024` |
| `SCORE_API_URL` | URL Score API | `https://reranker-llm.alem.ai/v1` |
| `GOOGLE_CLIENT_ID` | Google OAuth ID | `` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret | `` |
| `CORS_ORIGINS` | Разрешённые CORS | `["http://localhost:80"]` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Токен Cloudflare | `` |

### Настройки Backend (config.py)

```python
class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_URL: str
    REDIS_CACHE_TTL: int = 3600  # 1 час
    
    # ML
    MODEL_PATH: str = "models"
    MODEL_VERSION_FORMAT: str = "v{major}.{minor}.{patch}"
    
    # LLM
    LLM_BASE_URL: str
    LLM_API_KEY: str
    LLM_MODEL: str = "qwen3"
    LLM_MAX_TOKENS: int = 1000
    LLM_TEMPERATURE: float = 0.3
    
    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # CORS
    CORS_ORIGINS: List[str]
    
    class Config:
        env_file = ".env"
```

---

## 💻 Разработка Локально

### Backend

```bash
cd backend

# Создание виртуального окружения
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows

# Установка зависимостей
pip install -r requirements.txt

# Запуск PostgreSQL и Redis (Docker)
docker compose up postgres redis -d

# Миграции БД
alembic upgrade head

# Запуск сервера
uvicorn app.main:app --reload --port 8000

# Тесты
pytest

# Линтер
ruff check app/
```

### Frontend

```bash
cd frontend

# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev

# Сборка
npm run build

# Линтер
npm run lint
```

### Горячая Перезагрузка

Backend: `uvicorn --reload` — автоматически перезагружается при изменении .py файлов

Frontend: Vite HMR — мгновенное обновление при изменении .tsx/.ts файлов

---

## 🚀 Деплой и Продакшен

### Продакшен Чеклист

- [ ] Заменить `JWT_SECRET_KEY` на криптографически стойкий
- [ ] Настроить `POSTGRES_PASSWORD` (не использовать дефолтный)
- [ ] Указать реальные `LLM_API_KEY`, `SCORE_API_KEY`, `EMBEDDER_API_KEY`
- [ ] Настроить `CORS_ORIGINS` для домена продакшена
- [ ] Включить HTTPS (Cloudflare или Nginx + Let's Encrypt)
- [ ] Настроить бэкапы PostgreSQL
- [ ] Мониторинг (Prometheus + Grafana или аналоги)
- [ ] Логирование (ELK Stack или аналоги)

### Деплой на Сервер

```bash
# 1. Клонирование
git clone https://github.com/your-org/k0t1k.git
cd k0t1k

# 2. Настройка
cp .env.example .env
nano .env  # Заполните реальными ключами

# 3. Деплой
docker compose up --build -d

# 4. Проверка
docker compose ps
curl http://localhost/api/health

# 5. Создание админа
# (см. раздел "Первоначальная Настройка Администратора")
```

### Мониторинг

```bash
# Логи Backend
docker compose logs -f backend

# Логи Frontend
docker compose logs -f nginx

# Логи БД
docker compose logs -f postgres

# Статус контейнеров
docker compose ps

# Использование ресурсов
docker stats
```

### Бэкапы

```bash
# Бэкап PostgreSQL
docker compose exec postgres pg_dump -U k0t1k k0t1k > backup_$(date +%Y%m%d).sql

# Восстановление
docker compose exec -T postgres psql -U k0t1k k0t1k < backup_20260405.sql
```

---

## ⚠️ Ограничения и Известные Проблемы

### Текущие Ограничения

1. **Синтетические Данные**
   - Farmer Portrait признаки генерируются синтетически
   - Реальные данные хозяйств недоступны
   - **Решение**: Интеграция с реальными системами учёта

2. **Зависимость от Внешних API**
   - LLM объяснения требуют alem.plus API
   - Без интернета объяснения не работают
   - **Решение**: Локальная LLM (например, Llama 3)

3. **Масштабируемость**
   - LightGBM работает на одном сервере
   - При >100k заявок потребуется распределённая архитектура
   - **Решение**: Spark ML или облачные ML сервисы

4. **Региональное Покрытие**
   - Законодательные нормы могут отличаться по регионам
   - Не все регионы учтены в `laws.py`
   - **Решение**: Расширение базы нормативов

### Известные Проблемы

| Проблема | Статус | Workaround |
|----------|--------|------------|
| Кириллица в PDF | ✅ Исправлено | Используется шрифт DejaVuSans |
| Долгие объяснения LLM | ⚠️ Мониторится | Кэширование 1 час, SSE |
| Большие Excel (>50MB) | ⚠️ Лимит | Разделение на части |
| Google OAuth без HTTPS | ❌ Не работает | Требуется HTTPS |

---

## 📊 Критерии Оценивания

Согласно ТЗ Decentrathon 5.0:

| Критерий | Вес | Что Оценивается | Как Мы Выполняем |
|----------|-----|-----------------|------------------|
| **Проблема & ценность** | 15 | Понимание задачи и практическая польза | ✅ Решаем реальную проблему FIFO → Merit |
| **Работа с данными** | 15 | Качество обработки, источники, признаки | ✅ 20 признаков, синтетика + реальные данные |
| **Модель & логика** | 20 | Обоснованность подхода, корректность | ✅ LightGBM + 2-stage scoring + CV |
| **Explainability** | 15 | Понятность объяснений | ✅ SHAP + LLM + Streaming |
| **Technical Implementation** | 15 | Рабочий прототип, стабильность | ✅ Полный стек, Docker, CI/CD ready |
| **Демо & UX** | 10 | Понятность использования | ✅ Интуитивный UI, дашборды, графики |
| **Документация** | 10 | README, запуск, данные, ограничения | ✅ **Эта документация** 🚀 |
| **ИТОГО** | **100** | | |

---

## 👥 Команда

**Название команды**: DataNomads

**Проект**: _k0t1k Project

| Роль | Имя |
|------|-----|
| Team Lead / Fullstack | Ваше Имя |
| ML Engineer | Ваше Имя |
| Data Scientist | Ваше Имя |
| UI/UX Designer | Ваше Имя |

---

## 📄 Лицензия

Этот проект лицензирован по лицензии **GNU General Public License v3.0** — см. файл [LICENSE](LICENSE) для подробностей.

---

## 🙏 Благодарности

- **OskemenHUB** — за помощь в съемке демо-материалов и поддержку проекта
- **Decentrathon 5.0** — за площадку для инноваций
- **inDrive** — за вдохновение и поддержку

---

## 📞 Контакты

- **GitHub**: https://github.com/your-username/k0t1k
- **Email**: your-email@example.com
- **Telegram**: @your-telegram

---

**Сделано с ❤️ для Decentrathon 5.0**
