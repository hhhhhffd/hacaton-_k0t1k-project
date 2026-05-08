"""Pydantic-схемы для заявок и результатов скоринга."""

from datetime import datetime

from pydantic import BaseModel, Field


class ApplicationResponse(BaseModel):
    """Полная информация о заявке — данные + результаты скоринга."""

    id: int
    sequential_number: int = Field(0, description="№ п/п из выгрузки")
    submission_date: datetime | None = Field(None, description="Дата поступления")
    region: str = Field(description="Область")
    akimat: str = Field("", description="Акимат")
    application_number: str = Field(description="Номер заявки (14 цифр)")
    direction: str = Field(description="Направление животноводства")
    subsidy_name: str = Field("", description="Наименование субсидирования")
    status: str = Field("Новая", description="Статус заявки")
    normativ: float = Field(0.0, description="Норматив (тенге/единица)")
    amount: float = Field(description="Причитающая сумма (тенге)")
    farm_district: str = Field("", description="Район хозяйства")

    # Публичные поля
    farmer_name: str | None = Field(None, description="ФИО или название хозяйства")
    land_area: float | None = Field(None, description="Площадь земель (га)")
    pasture_area_ha: float | None = Field(None, description="Пастбища (ГА)")
    historical_mortality_rate: float | None = Field(None, description="Падёж (%)")
    current_head_count: float | None = Field(None, description="Поголовье")

    # Результаты AI-скоринга
    merit_score: float | None = Field(None, description="Балл 0-100")
    risk_level: str | None = Field(None, description="Уровень риска: green/yellow/red")
    risk_reason: str | None = Field(None, description="Причина риска (для Anti-Fraud)")
    shap_values: dict | None = Field(None, description="SHAP-значения по фичам")
    llm_explanation: str | None = Field(None, description="Текстовое объяснение от LLM")
    is_approved: bool | None = Field(None, description="Предсказание модели")

    model_config = {"from_attributes": True}


class ApplicationListResponse(BaseModel):
    """Список заявок с пагинацией."""

    items: list[ApplicationResponse]
    total: int = Field(description="Общее количество заявок (с учётом фильтров)")
    skip: int = Field(description="Сколько пропущено")
    limit: int = Field(description="Размер страницы")


class ScoreResponse(BaseModel):
    """Результат скоринга одной заявки."""

    application_id: int
    merit_score: float = Field(ge=0, le=100, description="Балл 0-100")
    risk_level: str = Field(description="green/yellow/red")
    shap_values: dict = Field(description="SHAP-значения {фича: значение}")
    llm_explanation: str = Field(description="Объяснение на русском языке")
    hard_rules_checklist: list[dict] | None = Field(
        default=None,
        description="Чеклист соответствия жёстким нормам НПА"
    )


class PublicApplicationStatus(BaseModel):
    """Статус заявки для фермера (публичный)."""

    id: int
    application_number: str
    status: str
    merit_score: float | None = Field(None, description="Балл 0-100")
    rank: int | None = Field(None, description="Место в очереди (по баллу)")
    total_applications: int | None = Field(None, description="Всего заявок в этой категории")
    explanation: str | None = Field(None, description="Понятное объяснение на языке фермера")
    recommendations: list[str] = Field(default_factory=list, description="Рекомендации по улучшению балла")


class ProactiveOfferResponse(BaseModel):
    """Модель для проактивного предложения (Auto-Offer)."""

    farmer_name: str
    region: str
    direction: str
    pasture_area_ha: float
    current_head_count: float
    historical_mortality_rate: float
    predicted_merit_score: float = Field(description="Предсказанный высокий балл")
    recommendation_text: str = Field(description="Почему мы предлагаем субсидию", default="Идеальный кандидат для развития отрасли")

class ApplicationCreate(BaseModel):
    """Схема для подачи заявки фермером (публичная)."""

    farmer_name: str = Field(description="ФИО или название хозяйства")
    region: str = Field(description="Область")
    land_area: float = Field(gt=0, description="Площадь земель (га)")
    direction: str = Field(description="Направление (субсидия)")
    amount: float = Field(gt=0, description="Запрашиваемая сумма (тенге)")


class BudgetSimRequest(BaseModel):
    """Запрос на симуляцию бюджета."""

    budget: float = Field(gt=0, description="Доступный бюджет (тенге)")
    region: str | None = Field(None, description="Фильтр по области")
    direction: str | None = Field(None, description="Фильтр по направлению")
    export_all: bool = Field(False, description="Вернуть все профинансированные заявки (для экспорта)")


class BudgetSimResponse(BaseModel):
    """Результат симуляции бюджета."""

    total_applications: int = Field(description="Всего заявок (после фильтров)")
    funded_count: int = Field(description="Заявок в рамках бюджета")
    total_amount: float = Field(description="Потрачено из бюджета")
    remaining_budget: float = Field(description="Остаток бюджета")
    avg_funded_score: float = Field(default=0.0, description="Средний балл профинансированных")
    funded_applications: list[ApplicationResponse] = Field(description="Топ-50 профинансированных заявок")


class BudgetCompareMethod(BaseModel):
    """Агрегатные метрики одного метода распределения (FIFO или Merit)."""

    funded_count: int = Field(description="Количество профинансированных заявок")
    total_amount: float = Field(description="Сумма финансирования (тенге)")
    avg_score: float = Field(description="Средний merit_score профинансированных")
    anomaly_count: int = Field(description="Аномалии: risk_level=red")
    funded_pct: float = Field(description="% профинансированных от всех в выборке")


class BudgetCompareResponse(BaseModel):
    """Результат сравнения FIFO vs Merit — хедлайнер для питча."""

    budget: float = Field(description="Бюджет для сравнения (тенге)")
    total_applications: int = Field(description="Всего заявок в выборке")
    fifo: BudgetCompareMethod = Field(description="FIFO: хронологическое распределение")
    merit: BudgetCompareMethod = Field(description="Merit: распределение по баллу LightGBM")
    score_improvement: float = Field(description="Прирост среднего балла (Merit - FIFO)")
    anomaly_reduction: int = Field(description="Сокращение аномалий (FIFO.anomaly - Merit.anomaly)")




class FilterParams(BaseModel):
    """Параметры фильтрации для списка заявок."""

    region: str | None = None
    direction: str | None = None
    status: str | None = None
    min_score: float | None = Field(None, ge=0, le=100)
    max_score: float | None = Field(None, ge=0, le=100)


class StatsResponse(BaseModel):
    """Агрегированная статистика по всем заявкам."""

    total_applications: int
    scored_applications: int
    avg_score: float | None
    score_distribution: dict[str, int] = Field(description="Распределение баллов по диапазонам")
    top_regions: list[dict[str, str | int | float]] = Field(description="Топ регионов по среднему баллу")
    anomaly_counts: dict[str, int] = Field(description="Количество по risk_level")
    status_counts: dict[str, int] = Field(description="Количество по статусам")


class GlobalShapResponse(BaseModel):
    """Глобальные SHAP-значения (средние абсолютные по всем заявкам)."""

    feature_importances: dict[str, float] = Field(description="{фича: средний |SHAP|}, отсортировано по убыванию")
    total_samples: int


# ============================================================
# Аналитика — FIFO vs Merit, Симулятор весов
# ============================================================


class FifoVsMeritColumn(BaseModel):
    """Статистика одного столбца (FIFO или Merit) в сравнении."""

    funded_count: int = Field(description="Количество профинансированных заявок")
    total_amount: float = Field(description="Сумма финансирования (тенге)")
    avg_score: float = Field(description="Средний балл качества (merit_score)")
    median_score: float = Field(description="Медианный балл")
    anomaly_count: int = Field(description="Количество аномалий (risk_level=red)")
    coop_pct: float = Field(description="Доля кооперативов (%)")
    avg_head_count: float = Field(description="Средний масштаб хозяйства (head_count)")
    top_regions: list[dict[str, str | int | float]] = Field(description="Топ-5 регионов по кол-ву")
    direction_distribution: dict[str, int] = Field(description="Распределение по направлениям")
    score_histogram: list[dict[str, int | str]] = Field(description="Гистограмма баллов")


class FifoVsMeritResponse(BaseModel):
    """Результат сравнения FIFO vs Merit — хедлайнер для питча."""

    budget: float = Field(description="Бюджет для сравнения (тенге)")
    total_applications: int = Field(description="Всего заявок в выборке")
    fifo: FifoVsMeritColumn = Field(description="Статистика FIFO-выборки")
    merit: FifoVsMeritColumn = Field(description="Статистика Merit-выборки")
    score_improvement: float = Field(description="Прирост среднего балла (Merit - FIFO)")
    anomaly_reduction: int = Field(description="Сокращение аномалий (FIFO - Merit)")
    coop_improvement: float = Field(description="Прирост кооперативов (п.п.)")


class WeightSimRequest(BaseModel):
    """Запрос на симуляцию пользовательских весов."""

    weights: dict[str, float] = Field(
        description="Пользовательские веса фичей {имя_фичи: 0-100}",
        examples=[{
            "head_count": 80,
            "is_cooperative": 60,
            "district_approval_rate": 50,
            "is_breeding": 40,
            "production_growth_pct": 70,
        }],
    )
    top_n: int = Field(default=10, ge=1, le=50, description="Сколько топовых заявок показать")


class WeightSimApplication(BaseModel):
    """Одна заявка в результатах симуляции весов."""

    id: int
    application_number: str
    region: str
    direction: str
    amount: float
    original_score: float = Field(description="Исходный балл (default weights)")
    new_score: float = Field(description="Новый балл (custom weights)")
    rank_change: int = Field(description="Изменение ранга: + вверх, - вниз")


class WeightSimResponse(BaseModel):
    """Результат симуляции с пользовательскими весами."""

    top_applications: list[WeightSimApplication] = Field(description="Топ заявки по новым весам")
    avg_score_change: float = Field(description="Изменение среднего балла (по всем заявкам)")
    total_reshuffle: int = Field(description="Количество заявок, сменивших ранг в топ-100")
    weights_used: dict[str, float] = Field(description="Применённые веса (нормализованные)")


# ============================================================
# Аналитика — Fairness Audit, Data Quality, Model Info
# ============================================================


class RegionFairnessStats(BaseModel):
    """Статистика справедливости по одному региону."""

    region: str
    count: int = Field(description="Количество заявок")
    avg_score: float = Field(description="Средний балл")
    median_score: float = Field(description="Медианный балл")
    std_score: float = Field(description="Стандартное отклонение балла")
    min_score: float
    max_score: float
    pct_green: float = Field(description="% заявок с risk_level=green")
    pct_yellow: float = Field(description="% заявок с risk_level=yellow")
    pct_red: float = Field(description="% заявок с risk_level=red")


class FairnessResponse(BaseModel):
    """Аудит справедливости — доказательство отсутствия bias по регионам."""

    total_applications: int
    total_regions: int
    overall_avg_score: float
    overall_std_score: float

    # Коэффициент вариации между регионами (низкий = справедливо)
    inter_region_cv: float = Field(description="Коэффициент вариации средних баллов между регионами (%). < 15% = справедливо")

    # Максимальное отклонение от среднего
    max_deviation: float = Field(description="Максимальное отклонение среднего балла региона от общего среднего")
    max_deviation_region: str = Field(description="Регион с максимальным отклонением")

    # Индекс Джини по распределению баллов (0 = идеальное равенство)
    gini_index: float = Field(description="Индекс Джини по баллам (0-1). < 0.3 = справедливое распределение")

    # Корреляция регион→балл (низкая = регион не определяет результат)
    region_score_correlation: float = Field(description="Корреляция региона с баллом (eta-squared). < 0.06 = слабое влияние")

    # Справедливость по направлениям
    direction_avg_scores: dict[str, float] = Field(description="Средний балл по направлениям животноводства")

    # Детализация по регионам
    regions: list[RegionFairnessStats]

    # Вердикт
    verdict: str = Field(description="Текстовый вердикт: справедлива ли модель")


class DataQualityResponse(BaseModel):
    """Статистика качества данных — полнота, аномалии, распределения."""

    total_rows: int
    columns_count: int

    # Полнота данных
    completeness: dict[str, float] = Field(description="% заполненности по ключевым полям")

    # Уникальные значения
    unique_regions: int
    unique_directions: int
    unique_statuses: int
    unique_districts: int

    # Числовые распределения
    amount_stats: dict[str, float] = Field(description="min, max, mean, median, std для суммы")
    normativ_stats: dict[str, float] = Field(description="min, max, mean, median, std для норматива")

    # Аномалии
    zero_normativ_count: int = Field(description="Заявки с нулевым нормативом")
    zero_amount_count: int = Field(description="Заявки с нулевой суммой")
    extreme_amount_count: int = Field(description="Заявки с суммой > 10x медианы")
    missing_date_count: int = Field(description="Заявки без даты подачи")

    # Временное покрытие
    date_range: dict[str, str | None] = Field(description="Период данных (min_date, max_date)")
    submissions_by_month: dict[str, int] = Field(description="Количество заявок по месяцам")


class ModelInfoResponse(BaseModel):
    """Информация о модели — метрики, архитектура, обоснование."""

    model_config = {"protected_namespaces": ()}

    model_type: str = Field(description="Тип модели")
    is_loaded: bool
    feature_count: int
    feature_names: list[str]

    # Метрики hold-out (если обучена)
    metrics: dict[str, float] | None = Field(None, description="accuracy, f1, roc_auc + cv_*_mean/std")
    training_samples: int | None = None
    test_samples: int | None = None

    # 5-fold CV метрики для демонстрации отсутствия переобучения
    cv_folds: int | None = Field(None, description="Количество фолдов (5)")
    cv_roc_auc_mean: float | None = Field(None, description="Средний ROC-AUC по 5 фолдам")
    cv_roc_auc_std: float | None = Field(None, description="Стд. отклонение ROC-AUC по фолдам")
    cv_f1_mean: float | None = Field(None, description="Средний F1 по 5 фолдам")
    cv_f1_std: float | None = Field(None, description="Стд. отклонение F1 по фолдам")

    # Гиперпараметры
    hyperparameters: dict[str, int | float | str]

    # Обоснование архитектуры
    architecture_rationale: str = Field(description="Обоснование выбора модели и подхода")

    # Стабильность (edge-case тесты)
    robustness_checks: list[dict[str, str | bool]] = Field(
        description="Результаты проверок на edge cases",
    )


# ============================================================
# AI-ассистент для граждан
# ============================================================


class ChatMessage(BaseModel):
    """Сообщение в чате."""

    role: str = Field(description="Роль: user или assistant")
    content: str = Field(description="Текст сообщения")


class ChatRequest(BaseModel):
    """Запрос к AI-ассистенту."""

    message: str = Field(description="Вопрос пользователя")
    history: list[ChatMessage] | None = Field(None, description="История диалога")
    lang: str = Field("ru", description="Язык ответа: ru или kz")


class ChatResponse(BaseModel):
    """Ответ AI-ассистента."""

    response: str = Field(description="Ответ ассистента")
    lang: str = Field(description="Язык ответа")
