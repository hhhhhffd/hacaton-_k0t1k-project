# 🤖 Документация ML Пайплайна — _k0t1k Project

> Полное руководство по пайплайну машинного обучения: от подготовки данных до деплоя модели

---

## 📋 Оглавление

- [Обзор](#обзор)
- [Архитектура Пайплайна](#архитектура-пайплайна)
- [Подготовка Данных](#подготовка-данных)
- [Инженерия Признаков](#инженерия-признаков)
- [Обучение Модели](#обучение-модели)
- [Оценка Модели](#оценка-модели)
- [Сериализация Модели](#сериализация-модели)
- [Пайплайн Вывода](#пайплайн-вывода)
- [Версионирование Моделей](#версионирование-моделей)
- [Оптимизация Производительности](#оптимизация-производительности)
- [Устранение Неисправностей](#устранение-неисправностей)

---

## 🎯 Обзор

ML пайплайн _k0t1k — это производственная система для скоринга заявок на сельскохозяйственные субсидии. Использует **LightGBM** как основной алгоритм с комплексной инженерией признаков и объяснимостью.

### Ключевые Принципы Дизайна

1. **Без Утечки Цели**: Раздельные `fit()` и `transform()` для предотвращения использования будущей информации
2. **Воспроизводимость**: Фиксированные случайные сиды и детерминированные операции
3. **Объяснимость**: SHAP значения для каждого предсказания
4. **Готовность к Проду**: Пакетный скоринг с обработкой ошибок
5. **Версионированные Модели**: Отслеживание всех версий с метаданными

### Этапы Пайплайна

```
Сырые Excel Данные
    ↓
[1. Загрузка и Очистка Данных]
    ↓
[2. Инженерия Признаков]
    ↓
[3. Создание Целевой Переменной]
    ↓
[4. Обучение Модели]
    ↓
[5. Оценка Модели]
    ↓
[6. Сериализация Модели]
    ↓
[7. Пакетный Скоринг]
    ↓
Проскоренные Заявки в БД
```

---

## 🏗️ Архитектура Пайплайна

### Структура Файлов

```
backend/app/ml/
├── __init__.py
├── data_loader.py      # Загрузка и очистка Excel
├── features.py         # Инженерия признаков (20 признаков)
├── model.py            # LightGBM обертка с обучением
├── explainer.py        # SHAP объяснения
└── scoring_pipeline.py # Двухэтапный скоринговый пайплайн
```

---

## 📥 Подготовка Данных

### Загрузка Данных

**Файл**: `backend/app/ml/data_loader.py`

```python
def load_giss_excel(file_path: str) -> pd.DataFrame:
    """
    Загрузить и очистить экспорт ГИС.
    
    Параметры:
        file_path: Путь к .xlsx файлу
    
    Возвращает:
        Очищенный DataFrame с валидированными данными
    """
    
    # Чтение Excel (пропуск первых 4 строк - метаданные заголовка)
    df = pd.read_excel(
        file_path,
        skiprows=4,
        header=None,
        names=[f"col{i}" for i in range(13)],
        engine="openpyxl"
    )
    
    # Переименование колонок
    df = df.rename(columns={
        "col0": "sequential_number",
        "col1": "submission_date",
        "col4": "region",
        "col5": "akimat",
        "col6": "application_number",
        "col7": "direction",
        "col8": "subsidy_name",
        "col9": "status",
        "col10": "normativ",
        "col11": "amount",
        "col12": "farm_district"
    })
    
    # Удаление неиспользуемых колонок
    df = df.drop(columns=["col2", "col3"], errors="ignore")
    
    return df
```

### Очистка Данных

```python
def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Очистка и валидация данных.
    
    Шаги:
    1. Конвертация числовых колонок (обработка запятых как десятичных)
    2. Фильтрация валидных номеров заявок (regex: ^\d{5,}$)
    3. Удаление строк с пропущенными критическими данными
    4. Сброс индекса
    """
    
    # Конвертация числовых колонок
    df["normativ"] = pd.to_numeric(df["normativ"], errors="coerce").fillna(0.0)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)
    
    # Фильтрация валидных номеров заявок
    before_count = len(df)
    df = df[df["application_number"].astype(str).str.match(r"^\d{5,}$", na=False)]
    df = df.reset_index(drop=True)
    
    logger.info(f"Очищенные данные: {before_count} → {len(df)} строк")
    
    return df
```

---

## 🔧 Инженерия Признаков

### Класс FeatureTransformer

**Файл**: `backend/app/ml/features.py`

```python
class FeatureTransformer:
    """
    Инженерия признаков с предотвращением утечки цели.
    
    КРИТИЧНО: Статистика вычисляется ТОЛЬКО на обучающих данных,
    затем применяется к тестовым/инференс данным.
    """
    
    def __init__(self):
        # Статистика, вычисленная во время fit()
        self.approval_rates = None
        self.region_medians = None
        self.subsidy_medians = None
        self.direction_counts = None
    
    def fit(self, df: pd.DataFrame) -> 'FeatureTransformer':
        """
        Вычисление статистики ТОЛЬКО на обучающих данных.
        
        Эта статистика используется для инженерии признаков
        и не должна включать тестовые данные для предотвращения утечки.
        """
        
        # Процент одобрений по типу субсидии
        self.approval_rates = (
            df.groupby("subsidy_name")["is_merit_worthy"]
            .mean()
            .to_dict()
        )
        
        # Медианные суммы по регионам
        self.region_medians = (
            df.groupby("region")["amount"]
            .median()
            .to_dict()
        )
        
        # Медианные суммы по типу субсидии
        self.subsidy_medians = (
            df.groupby("subsidy_name")["amount"]
            .median()
            .to_dict()
        )
        
        # Количество заявок по направлению
        self.direction_counts = (
            df.groupby("direction").size()
            .to_dict()
        )
        
        return self
    
    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Трансформация данных с использованием предвычисленной статистики.
        
        Создает 20 признаков из сырых данных заявок.
        """
        
        df = df.copy()
        
        # 1. Базовые производные признаки
        df["head_count"] = np.where(
            df["normativ"] > 0,
            df["amount"] / df["normativ"],
            0.0
        ).clip(0, 50000)
        
        df["amount_per_head"] = np.where(
            df["head_count"] > 0,
            df["amount"] / df["head_count"],
            0.0
        ).clip(0, 10_000_000)
        
        # 2. Временные признаки
        df["submission_date"] = pd.to_datetime(df["submission_date"], errors="coerce")
        df["month"] = df["submission_date"].dt.month
        df["hour"] = df["submission_date"].dt.hour
        df["day_of_week"] = df["submission_date"].dt.dayofweek
        
        # 3. Агрегированные признаки (с использованием предвычисленной статистики)
        df["subsidy_type_approval_rate"] = df["subsidy_name"].map(
            self.approval_rates
        ).fillna(0.5)
        
        df["amount_vs_region_median"] = df["amount"] - df["region"].map(
            self.region_medians
        ).fillna(df["amount"].median())
        
        df["amount_vs_subsidy_median"] = df["amount"] - df["subsidy_name"].map(
            self.subsidy_medians
        ).fillna(df["amount"].median())
        
        df["direction_competition"] = df["direction"].map(
            self.direction_counts
        ).fillna(0)
        
        # 4. Производные признаки
        df["normativ_amount_ratio"] = np.where(
            df["amount"] > 0,
            df["normativ"] / df["amount"],
            0.0
        )
        
        df["amount_log"] = np.log1p(df["amount"])
        
        # 5. Признаки Farmer Portrait (из синтетических данных или дефолтные)
        if "pasture_area_ha" not in df.columns:
            df["pasture_area_ha"] = 0.0
        if "historical_mortality_rate" not in df.columns:
            df["historical_mortality_rate"] = 0.0
        if "current_head_count" not in df.columns:
            df["current_head_count"] = 0.0
        
        # 6. Бинарные признаки (поиск по ключевым словам)
        df["is_cooperative"] = df["subsidy_name"].str.contains(
            "кооператив|кооперация", case=False, na=False
        ).astype(int)
        
        df["is_breeding"] = df["subsidy_name"].str.contains(
            "племенн|селекцион", case=False, na=False
        ).astype(int)
        
        df["is_import"] = df["subsidy_name"].str.contains(
            "импорт|зарубеж", case=False, na=False
        ).astype(int)
        
        # 7. Категориальные признаки
        df["animal_type"] = df["subsidy_name"].apply(classify_animal_type)
        df["subsidy_category"] = df["subsidy_name"].apply(classify_subsidy_category)
        df["normativ_tier"] = pd.cut(
            df["normativ"],
            bins=[-1, 0, 1000, 10000, float('inf')],
            labels=["zero", "low", "mid", "high"]
        )
        
        return df
```

### Полный Список Признаков (20 Признаков)

| # | Признак | Тип | Источник | Описание |
|---|---------|-----|----------|-------------|
| 1 | `head_count` | Числовой | Вычислен | Количество скота (amount/normativ) |
| 2 | `amount_per_head` | Числовой | Вычислен | Субсидия на голову |
| 3 | `month` | Числовой | Временной | Месяц заявки (1-12) |
| 4 | `hour` | Числовой | Временной | Час заявки (0-23) |
| 5 | `day_of_week` | Числовой | Временной | День недели (0-6) |
| 6 | `amount_vs_region_median` | Числовой | Агрегированный | Отклонение от медианы региона |
| 7 | `amount_vs_subsidy_median` | Числовой | Агрегированный | Отклонение от медианы субсидии |
| 8 | `subsidy_type_approval_rate` | Числовой | Агрегированный | Исторический процент одобрения |
| 9 | `direction_competition` | Числовой | Агрегированный | Заявок по направлению |
| 10 | `normativ_amount_ratio` | Числовой | Вычислен | Отношение норматива к сумме |
| 11 | `amount_log` | Числовой | Трансформированный | Логарифмированная сумма |
| 12 | `pasture_area_ha` | Числовой | Синтетический | Площадь пастбищ (гектары) |
| 13 | `historical_mortality_rate` | Числовой | Синтетический | Процент падежа |
| 14 | `current_head_count` | Числовой | Синтетический | Текущее поголовье |
| 15 | `is_cooperative` | Бинарный | Ключевые слова | Является кооперативом |
| 16 | `is_breeding` | Бинарный | Ключевые слова | Племенное хозяйство |
| 17 | `is_import` | Бинарный | Ключевые слова | Импорт скота |
| 18 | `animal_type` | Категориальный | Ключевые слова | Тип животного |
| 19 | `subsidy_category` | Категориальный | Ключевые слова | Категория субсидии |
| 20 | `normativ_tier` | Категориальный | Биннированный | Уровень норматива |

---

## 🎓 Обучение Модели

### Класс ScoringModel

**Файл**: `backend/app/ml/model.py`

```python
class ScoringModel:
    """
    LightGBM обертка с обучением, оценкой и сериализацией.
    """
    
    def __init__(self):
        self.model = None
        self.metadata = {}
    
    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
        params: Optional[Dict] = None
    ) -> Dict:
        """
        Обучение LightGBM модели с ранней остановкой.
        
        Параметры:
            X_train: Обучающие признаки
            y_train: Обучающая цель
            X_val: Валидационные признаки
            y_val: Валидационная цель
            params: Опциональные гиперпараметры
        
        Возвращает:
            Метрики обучения
        """
        
        # Гиперпараметры по умолчанию
        if params is None:
            params = {
                "n_estimators": 500,
                "max_depth": 7,
                "learning_rate": 0.05,
                "num_leaves": 63,
                "min_child_samples": 50,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "scale_pos_weight": self._compute_class_weight(y_train),
                "random_state": 42,
                "verbose": -1
            }
        
        # Инициализация модели
        self.model = LGBMClassifier(**params)
        
        # Обучение с ранней остановкой
        self.model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            callbacks=[
                early_stopping(stopping_rounds=50),
                log_evaluation(period=100)
            ]
        )
        
        # Вычисление метрик обучения
        train_metrics = self._compute_metrics(X_train, y_train)
        val_metrics = self._compute_metrics(X_val, y_val)
        
        self.metadata = {
            "train_metrics": train_metrics,
            "val_metrics": val_metrics,
            "hyperparameters": params,
            "training_date": datetime.now().isoformat(),
            "n_features": X_train.shape[1],
            "feature_names": list(X_train.columns)
        }
        
        return {
            "train": train_metrics,
            "validation": val_metrics
        }
```

### Пайплайн Обучения

```python
def train_model_pipeline(df: pd.DataFrame) -> ScoringModel:
    """
    Полный пайплайн обучения.
    
    Шаги:
    1. Разделение данных (80/20 стратифицированное)
    2. Fit FeatureTransformer на обучающих данных
    3. Трансформация обоих наборов данных
    4. Обучение LightGBM модели
    5. Кросс-валидация
    6. Возврат обученной модели
    """
    
    # Шаг 1: Создание целевой переменной
    df["is_merit_worthy"] = compute_target_variable(df)
    
    # Шаг 2: Разделение данных
    train_df, test_df = train_test_split(
        df,
        test_size=0.2,
        stratify=df["is_merit_worthy"],
        random_state=42
    )
    
    # Шаг 3: Fit transformer ТОЛЬКО на обучающих данных
    transformer = FeatureTransformer()
    transformer.fit(train_df)
    
    # Шаг 4: Трансформация обоих наборов
    X_train = transformer.transform(train_df)
    X_test = transformer.transform(test_df)
    y_train = train_df["is_merit_worthy"]
    y_test = test_df["is_merit_worthy"]
    
    # Выбор колонок признаков
    feature_cols = [col for col in X_train.columns if col not in [
        "application_number", "submission_date", "is_merit_worthy"
    ]]
    
    X_train = X_train[feature_cols]
    X_test = X_test[feature_cols]
    
    # Шаг 5: Обучение модели
    model = ScoringModel()
    training_results = model.train(X_train, y_train, X_test, y_test)
    
    # Шаг 6: Кросс-валидация
    cv_results = model.cross_validate(
        pd.concat([X_train, X_test]),
        pd.concat([y_train, y_test])
    )
    
    # Шаг 7: Обновление метаданных
    model.metadata["cv_results"] = cv_results
    model.metadata["test_metrics"] = model._compute_metrics(X_test, y_test)
    
    logger.info(f"Обучение завершено: {training_results}")
    logger.info(f"Кросс-валидация: {cv_results}")
    
    return model
```

---

## 📊 Оценка Модели

### Метрики Оценки

| Метрика | Формула | Целевое Значение | Описание |
|---------|---------|------------------|-------------|
| **Accuracy** | (TP+TN)/(TP+TN+FP+FN) | > 0.75 | Общая точность |
| **Precision** | TP/(TP+FP) | > 0.70 | Истинные положительные / предсказанные положительные |
| **Recall** | TP/(TP+FN) | > 0.70 | Истинные положительные / фактические положительные |
| **F1-Score** | 2·(Precision·Recall)/(Precision+Recall) | > 0.70 | Гармоническое среднее |
| **ROC-AUC** | Площадь под ROC кривой | > 0.80 | Способность разделения |

### Ожидаемые Результаты Кросс-Валидации

```json
{
  "cv_results": {
    "accuracy": {"mean": 0.78, "std": 0.02},
    "precision": {"mean": 0.76, "std": 0.03},
    "recall": {"mean": 0.75, "std": 0.03},
    "f1": {"mean": 0.75, "std": 0.02},
    "roc_auc": {"mean": 0.82, "std": 0.02}
  }
}
```

---

## 💾 Сериализация Модели

### Сохранение Моделей

```python
def save_model(model: ScoringModel, version: str) -> str:
    """
    Сохранить модель с метаданными.
    
    Созданные файлы:
    - models/{version}.joblib (веса модели)
    - models/{version}.meta.json (метаданные)
    
    Возвращает:
        Путь к сохраненной модели
    """
    
    model_dir = Path("models")
    model_dir.mkdir(exist_ok=True)
    
    # Сохранение модели
    model_path = model_dir / f"{version}.joblib"
    joblib.dump(model.model, model_path)
    
    # Сохранение метаданных
    meta_path = model_dir / f"{version}.meta.json"
    with open(meta_path, 'w') as f:
        json.dump(model.metadata, f, indent=2)
    
    logger.info(f"Модель сохранена: {model_path}")
    
    return str(model_path)
```

### Загрузка Моделей

```python
def load_model(version: str) -> ScoringModel:
    """
    Загрузить модель с диска.
    
    Параметры:
        version: Строка версии модели
    
    Возвращает:
        Загруженная ScoringModel
    """
    
    model_dir = Path("models")
    model_path = model_dir / f"{version}.joblib"
    meta_path = model_dir / f"{version}.meta.json"
    
    # Загрузка модели
    model = ScoringModel()
    model.model = joblib.load(model_path)
    
    # Загрузка метаданных
    with open(meta_path, 'r') as f:
        model.metadata = json.load(f)
    
    logger.info(f"Модель загружена: {version}")
    
    return model
```

---

## 🔮 Пайплайн Вывода

### Двухэтапный Скоринг

**Файл**: `backend/app/ml/scoring_pipeline.py`

```python
class ScoringPipeline:
    """
    Двухэтапный скоринговый пайплайн:
    Этап 1: Жесткие фильтры (мгновенный отказ)
    Этап 2: ML скоринг (нюансированная оценка)
    """
    
    def __init__(self, model: ScoringModel):
        self.model = model
        self.explainer = SHAPExplainer(model)
    
    def score_application(self, application: dict) -> dict:
        """
        Скоринг одиночной заявки.
        
        Возвращает:
            Результат скоринга с объяснением
        """
        
        # Этап 1: Жесткие фильтры
        passed, violations = self._hard_filters(application)
        if not passed:
            return {
                "merit_score": 0.0,
                "is_approved": False,
                "risk_level": "red",
                "violations": violations
            }
        
        # Этап 2: ML скоринг
        features = self._extract_features(application)
        score = self.model.predict_proba(features) * 100
        
        # Определение одобрения и уровня риска
        is_approved = score >= 50.0
        risk_level = self._classify_risk(score)
        
        return {
            "merit_score": round(score, 2),
            "is_approved": is_approved,
            "risk_level": risk_level,
            "violations": []
        }
    
    def _hard_filters(self, application: dict) -> Tuple[bool, List[str]]:
        """
        Этап 1: Фильтры жестких правил.
        
        Критерии мгновенного отказа:
        1. normativ > 0
        2. amount > 0
        3. head_count в [1, 50000]
        4. submission_date в пределах 365 дней
        5. pasture_load <= legal_capacity
        """
        
        violations = []
        
        if application.get("normativ", 0) <= 0:
            violations.append("Норматив должен быть больше 0")
        
        if application.get("amount", 0) <= 0:
            violations.append("Сумма должна быть больше 0")
        
        head_count = application.get("amount", 0) / max(application.get("normativ", 1), 1)
        if not (1 <= head_count <= 50000):
            violations.append("Недопустимое количество голов")
        
        # ... дополнительные фильтры
        
        return (len(violations) == 0, violations)
```

---

## 📦 Версионирование Моделей

### Формат Версии

```
v{major}.{minor}.{patch}

Примеры:
v1.0.0 - Начальная модель
v1.1.0 - Переобучение на новых данных
v1.1.1 - Исправление бага
v2.0.0 -Major архитектурное изменение
```

### Реестр Моделей

```python
class ModelRegistry:
    """Управление версиями моделей и активациями."""
    
    def __init__(self, redis_client):
        self.redis = redis_client
    
    def register_model(self, version: str, path: str):
        """Регистрация новой версии модели."""
        self.redis.set(f"model:{version}:path", path)
        self.redis.set(f"model:{version}:active", "false")
    
    def activate_model(self, version: str):
        """Активация конкретной версии модели."""
        self.redis.set("active_model_version", version)
        self.redis.set(f"model:{version}:active", "true")
    
    def get_active_model(self) -> str:
        """Получение активной версии модели."""
        return self.redis.get("active_model_version") or "v1.0.0"
```

---

## ⚡ Оптимизация Производительности

### Оптимизация Обучения

1. **Ранняя Остановка**: Остановка после 50 раундов без улучшения
2. **Субсэмплирование**: Использование 80% данных на итерацию
3. **Биннинг Признаков**: Нативный гистограммный подход LightGBM
4. **Параллельное Обучение**: Использование всех ядер CPU

```python
params = {
    "n_jobs": -1,  # Использовать все ядра
    "n_estimators": 500,  # Максимум деревьев
    "early_stopping_round": 50,  # Ранняя остановка
    "subsample": 0.8,  # Использовать 80% данных
    "colsample_bytree": 0.8  # Использовать 80% признаков
}
```

### Оптимизация Вывода

1. **Кэширование**: Redis кэш для скорингов (1 час TTL)
2. **Пакетная Обработка**: Скоринг нескольких заявок одновременно
3. **Кэширование Признаков**: Кэш статистики трансформера

```python
# Redis кэширование
async def get_cached_score(redis, app_id: str) -> Optional[float]:
    """Получить скоринг из кэша."""
    cached = await redis.get(f"score:{app_id}")
    if cached:
        return float(cached)
    return None

async def cache_score(redis, app_id: str, score: float):
    """Закэшировать скоринг на 1 час."""
    await redis.setex(f"score:{app_id}", 3600, str(score))
```

---

## 🔧 Устранение Неисправностей

### Распространенные Проблемы

| Проблема | Причина | Решение |
|----------|---------|----------|
| **Плохие CV метрики** | Утечка цели | Проверить разделение fit/transform |
| **Переобучение** | Слишком сложная модель | Уменьшить max_depth, увеличить min_child_samples |
| **Медленное обучение** | Большой датасет | Использовать subsample, уменьшить n_estimators |
| **Ошибки предсказания** | Отсутствующие признаки | Проверить соответствие колонок признаков обучению |
| **Модель не загружается** | Несоответствие версий | Проверить совместимость версии joblib |

---

**Последнее Обновление**: 5 апреля 2026  
**Поддержка**: Команда DataNomads  
**Проект**: _k0t1k Project
