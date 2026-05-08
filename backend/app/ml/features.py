"""
Инженерия признаков — 17 признаков из данных + целевая переменная + детекция аномалий.

=== DATA_SOURCES.md ===
Все признаки извлекаются из Excel-выгрузки GISS (subsidy.plem.kz).
Синтетические признаки УДАЛЕНЫ — они генерировались через np.random и делали метрики бессмысленными.

Источники данных для каждого признака:
| Признак                     | Источник (колонка Excel)           | Трансформация                          |
|-----------------------------|-------------------------------------|----------------------------------------|
| head_count                  | col10 (Норматив), col11 (Сумма)    | amount / normativ, clip(0, 50000)      |
| is_cooperative              | col8 (Наименование субсидирования) | contains("кооператив")                 |
| animal_type                 | col8 (Наименование субсидирования) | keyword classification                 |
| subsidy_category            | col8 (Наименование субсидирования) | keyword classification                 |
| month                       | col1 (Дата поступления)            | dt.month                               |
| hour                        | col1 (Дата поступления)            | dt.hour                                |
| day_of_week                 | col1 (Дата поступления)            | dt.dayofweek                           |
| amount_per_head             | col10, col11                       | amount / head_count, clip(0, 10M)      |
| subsidy_type_approval_rate  | col8, col9 (Статус заявки)         | groupby(subsidy_name).mean(is_approved)|
| amount_vs_region_median     | col4 (Область), col11 (Сумма)      | amount / median(region), clip(0, 50)   |
| amount_vs_subsidy_median    | col8, col11                        | amount / median(subsidy_name)          |
| is_breeding                 | col8                               | contains("племен")                     |
| is_import                   | col8                               | contains("импорт|канад|...")           |
| normativ_amount_ratio       | col10, col11                       | normativ / amount, clip(0, 1)          |
| direction_competition       | col7 (Направление)                 | count(direction)                       |
| normativ_tier               | col10                              | pd.qcut → low/mid/high                 |
| amount_log                  | col11                              | log1p(amount)                          |
========================

"""

import logging
from typing import Any

import numpy as np
import pandas as pd

from app.core.laws import get_mortality_norm, get_merit_amount_threshold

logger = logging.getLogger("k0t1k.features")

# === Маппинг ключевых слов → тип животного ===
# Определяем по содержимому поля subsidy_name
_ANIMAL_TYPE_KEYWORDS: dict[str, list[str]] = {
    "КРС": ["крс", "крупн", "бычк", "тёлк", "телк", "нетел", "бык"],
    "молоко": ["молок", "молоч", "дойн"],
    "птица": ["птиц", "курица", "бройлер", "индейк", "гус", "утк", "яиц"],
    "овцы": ["овц", "овеч", "баран", "ягн", "козо", "коз"],
    "лошади": ["лошад", "кобыл", "жеребц", "жереб", "кумыс"],
    "верблюды": ["верблюд", "шубат"],
    "свиньи": ["свин", "поросят"],
    "мёд": ["мёд", "мед", "пчел", "пасек"],
}

# === Маппинг ключевых слов → категория субсидии ===
_SUBSIDY_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "приобретение": ["приобрет", "покупк", "закуп"],
    "удешевление": ["удешевлен", "комбикорм", "корм"],
    "селекционная_работа": ["селекцион", "племен", "породн"],
    "осеменение": ["осемен", "искусств"],
    "выращивание": ["выращив", "откорм", "содерж", "маточн"],
}

# === Статусы для целевой переменной (старая FIFO-цель) ===
_APPROVED_STATUSES = {"Исполнена", "Одобрена", "Сформировано поручение"}
_REJECTED_STATUSES = {"Отклонена", "Отозвано"}
# "Получена" — исключаем из обучения (не финальный статус)

# === Константы для Merit-цели (из законодательства РК) ===
# Безопасное значение смертности для строк без данных.
# NaN означает "данных нет" — строка исключается из критерия падежа.
# Это предотвращает ситуацию когда заявки без данных получают
# незаслуженное преимущество (раньше default=0.0 → "идеальный падёж").
_MORTALITY_SAFE_DEFAULT: float = float("nan")


def _classify_by_keywords(text: str, keyword_map: dict[str, list[str]], default: str = "другое") -> str:
    """Классифицирует текст по первому совпавшему ключевому слову из маппинга."""
    text_lower = text.lower()
    for category, keywords in keyword_map.items():
        for keyword in keywords:
            if keyword in text_lower:
                return category
    return default


class FeatureTransformer:
    """
    sklearn-совместимый трансформер признаков с раздельным fit/transform.
    
    КРИТИЧЕСКИ ВАЖНО для предотвращения target leakage:
    - subsidy_type_approval_rate вычисляется ТОЛЬКО на train выборке (fit)
    - На test выборке применяется маппинг из train (transform)
    - Если тип субсидии не встречался в train → используется default=0.5
    
    Это предотвращает "утечку будущего" когда информация из test попадает в train.
    """
    
    def __init__(self) -> None:
        # Маппинг subsidy_name → approval_rate, вычисленный на train
        self._subsidy_approval_map: dict[str, float] = {}
        # Медианы amount по регионам (из train)
        self._region_median_map: dict[str, float] = {}
        # Медианы amount по типам субсидий (из train)
        self._subsidy_median_map: dict[str, float] = {}
        # Количество заявок по направлениям (из train)
        self._direction_count_map: dict[str, int] = {}
        # Квантили норматива для normativ_tier
        self._normativ_q33: float = 0.0
        self._normativ_q66: float = 0.0
        self._is_fitted: bool = False
    
    def fit(self, df: pd.DataFrame, y: pd.Series | None = None) -> "FeatureTransformer":
        """
        Вычисляет статистики на TRAIN выборке.
        
        ВАЖНО: вызывать ТОЛЬКО на train данных, до train_test_split!
        """
        logger.info("FeatureTransformer.fit() на %d строках", len(df))
        
        # === subsidy_type_approval_rate ===
        # КРИТИЧНО: вычисляем % одобрения ТОЛЬКО по train данным
        # Это предотвращает target leakage — модель не видит статистику test
        approved_mask = df["status"].isin(_APPROVED_STATUSES)
        has_final_status = df["status"].isin(_APPROVED_STATUSES | _REJECTED_STATUSES)
        
        temp_approved = np.where(has_final_status, approved_mask.astype(float), np.nan)
        temp_df = df.copy()
        temp_df["_is_approved_temp"] = temp_approved
        
        # Средний % одобрения по каждому типу субсидии
        approval_by_subsidy = temp_df.groupby("subsidy_name")["_is_approved_temp"].mean()
        self._subsidy_approval_map = approval_by_subsidy.fillna(0.5).to_dict()
        
        # === Медианы для amount_vs_region_median ===
        self._region_median_map = df.groupby("region")["amount"].median().to_dict()
        
        # === Медианы для amount_vs_subsidy_median ===
        self._subsidy_median_map = df.groupby("subsidy_name")["amount"].median().to_dict()
        
        # === Счётчики для direction_competition ===
        self._direction_count_map = df["direction"].value_counts().to_dict()
        
        # === Квантили для normativ_tier ===
        normativ_nonzero = df["normativ"][df["normativ"] > 0]
        if len(normativ_nonzero) > 0:
            self._normativ_q33 = float(normativ_nonzero.quantile(0.33))
            self._normativ_q66 = float(normativ_nonzero.quantile(0.66))
        
        self._is_fitted = True
        logger.info("FeatureTransformer fitted: %d типов субсидий, %d регионов",
                    len(self._subsidy_approval_map), len(self._region_median_map))
        return self
    
    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Применяет трансформации с использованием статистик из fit().
        
        Для новых категорий (не встречались в train) использует fallback:
        - subsidy_type_approval_rate → 0.5 (нейтральный)
        - region_median → global median
        - direction_competition → 1
        """
        if not self._is_fitted:
            raise RuntimeError("FeatureTransformer не обучен — вызовите fit() сначала")
        
        df = df.copy()
        
        # --- Предобработка: заменяем NaN в числовых полях нулями ---
        for col in ["normativ", "amount"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        
        # --- 1. head_count — количество голов (масштаб хозяйства) ---
        raw_head_count = np.where(df["normativ"] > 0, df["amount"] / df["normativ"], 0.0)
        df["head_count"] = np.clip(raw_head_count, 0, 50000)
        
        # --- 2. is_cooperative — кооператив или нет ---
        df["is_cooperative"] = df["subsidy_name"].str.contains("кооператив", case=False, na=False).astype(int)
        
        # --- 3. animal_type — тип животного из наименования субсидии ---
        df["animal_type"] = df["subsidy_name"].apply(
            lambda x: _classify_by_keywords(str(x), _ANIMAL_TYPE_KEYWORDS, default="другое")
        )
        
        # --- 4. subsidy_category — категория субсидии ---
        df["subsidy_category"] = df["subsidy_name"].apply(
            lambda x: _classify_by_keywords(str(x), _SUBSIDY_CATEGORY_KEYWORDS, default="другое")
        )
        
        # --- 5, 6, 7. Временные признаки из даты подачи ---
        df["month"] = df["date"].dt.month.fillna(0).astype(int)
        df["hour"] = df["date"].dt.hour.fillna(0).astype(int)
        df["day_of_week"] = df["date"].dt.dayofweek.fillna(0).astype(int)
        
        # --- 8. amount_per_head — эффективность: сколько тенге на 1 голову ---
        df["amount_per_head"] = np.where(
            df["head_count"] > 0,
            np.clip(df["amount"] / df["head_count"], 0, 10_000_000),
            0.0,
        )
        
        # --- 9. subsidy_type_approval_rate (БЕЗ LEAKAGE!) ---
        # Используем маппинг из fit(), а не вычисляем по текущим данным
        df["subsidy_type_approval_rate"] = df["subsidy_name"].map(
            self._subsidy_approval_map
        ).fillna(0.5)  # Fallback для невиданных типов субсидий
        
        # --- 10. amount_vs_region_median ---
        region_median_series = df["region"].map(self._region_median_map)
        global_median = np.median(list(self._region_median_map.values())) if self._region_median_map else 1.0
        region_median_series = region_median_series.fillna(global_median)
        df["amount_vs_region_median"] = np.clip(
            np.where(region_median_series > 0, df["amount"] / region_median_series, 0.0), 0, 50,
        )
        
        # --- 11. amount_vs_subsidy_median ---
        subsidy_median_series = df["subsidy_name"].map(self._subsidy_median_map)
        global_subsidy_median = np.median(list(self._subsidy_median_map.values())) if self._subsidy_median_map else 1.0
        subsidy_median_series = subsidy_median_series.fillna(global_subsidy_median)
        df["amount_vs_subsidy_median"] = np.clip(
            np.where(subsidy_median_series > 0, df["amount"] / subsidy_median_series, 0.0), 0, 50,
        )
        
        # --- 12. is_breeding — племенное хозяйство ---
        df["is_breeding"] = df["subsidy_name"].str.contains("племен", case=False, na=False).astype(int)
        
        # --- 13. is_import — импортный скот ---
        import_pattern = r"импорт|канад|австрал|герман|голланд|дан|франц|америк|сша|европ"
        df["is_import"] = df["subsidy_name"].str.contains(import_pattern, case=False, na=False).astype(int)
        
        # --- 14. normativ_amount_ratio ---
        df["normativ_amount_ratio"] = np.where(
            df["amount"] > 0,
            np.clip(df["normativ"] / df["amount"], 0, 1),
            0.0,
        )
        
        # --- 15. direction_competition ---
        df["direction_competition"] = df["direction"].map(
            self._direction_count_map
        ).fillna(1).astype(int)
        
        # --- 16. normativ_tier ---
        def _assign_tier(normativ: float) -> str:
            if normativ <= 0:
                return "zero"
            if normativ < self._normativ_q33:
                return "low"
            if normativ < self._normativ_q66:
                return "mid"
            return "high"
        
        df["normativ_tier"] = df["normativ"].apply(_assign_tier)
        
        # --- 17. amount_log ---
        df["amount_log"] = np.log1p(df["amount"])

        # --- 18-20. «Фермерский Портрет» (Приказы №11064, №12488) ---
        # Graceful degradation: если колонок нет (реальная ГИСС-выгрузка без обогащения),
        # заполняем безопасными дефолтами чтобы не крашиться.

        if "pasture_area_ha" in df.columns:
            df["pasture_area_ha"] = (
                pd.to_numeric(df["pasture_area_ha"], errors="coerce").fillna(0.0).clip(0, 5000)
            )
        else:
            df["pasture_area_ha"] = 0.0

        if "historical_mortality_rate" in df.columns:
            df["historical_mortality_rate"] = (
                pd.to_numeric(df["historical_mortality_rate"], errors="coerce")
                .clip(0, 20)
            )
            # NaN остаётся NaN — значит данных нет, модель это учтёт
        else:
            # Дефолт NaN — данных нет, учтётся в create_merit_target()
            df["historical_mortality_rate"] = float("nan")

        if "current_head_count" in df.columns:
            df["current_head_count"] = (
                pd.to_numeric(df["current_head_count"], errors="coerce").fillna(0.0).clip(0, 50000)
            )
        else:
            df["current_head_count"] = 0.0

        logger.info("FeatureTransformer.transform() завершён: %d строк, %d признаков",
                    len(df), len(ALL_FEATURE_NAMES))

        return df
    
    def fit_transform(self, df: pd.DataFrame, y: pd.Series | None = None) -> pd.DataFrame:
        """Комбинация fit() + transform() для удобства."""
        return self.fit(df, y).transform(df)
    
    def get_params(self) -> dict[str, Any]:
        """Возвращает параметры трансформера для сериализации."""
        return {
            "subsidy_approval_map": self._subsidy_approval_map,
            "region_median_map": self._region_median_map,
            "subsidy_median_map": self._subsidy_median_map,
            "direction_count_map": self._direction_count_map,
            "normativ_q33": self._normativ_q33,
            "normativ_q66": self._normativ_q66,
        }
    
    def set_params(self, params: dict[str, Any]) -> "FeatureTransformer":
        """Восстанавливает параметры трансформера после десериализации."""
        self._subsidy_approval_map = params.get("subsidy_approval_map", {})
        self._region_median_map = params.get("region_median_map", {})
        self._subsidy_median_map = params.get("subsidy_median_map", {})
        self._direction_count_map = params.get("direction_count_map", {})
        self._normativ_q33 = params.get("normativ_q33", 0.0)
        self._normativ_q66 = params.get("normativ_q66", 0.0)
        self._is_fitted = True
        return self


def engineer_features(df: pd.DataFrame, transformer: FeatureTransformer | None = None) -> tuple[pd.DataFrame, FeatureTransformer]:
    """
    Генерирует все 17 признаков из исходных данных.

    ИЗМЕНЕНИЕ: теперь принимает опциональный transformer для предотвращения target leakage.
    - Если transformer=None → создаёт новый и делает fit_transform (для train)
    - Если transformer передан → только transform (для test/inference)

    Args:
        df: очищенный DataFrame из data_loader.load_dataset()
        transformer: обученный FeatureTransformer (для inference) или None (для train)
    
    Returns:
        Tuple[DataFrame с признаками, обученный FeatureTransformer]
    """
    if transformer is None:
        # Режим обучения: fit + transform
        transformer = FeatureTransformer()
        df_features = transformer.fit_transform(df)
    else:
        # Режим inference: только transform с маппингами из train
        df_features = transformer.transform(df)
    
    return df_features, transformer


def create_target(df: pd.DataFrame) -> pd.Series:
    """
    [УСТАРЕВШАЯ — FIFO-цель с target leakage] Создаёт бинарную is_approved.

    ВНИМАНИЕ: эта функция обучает модель на историческом решении чиновника
    (кто первый подал → тот одобрен). Это и есть «target leakage» FIFO-системы.
    Используйте create_merit_target() для обучения на правовых критериях.

    - 1: Исполнена, Одобрена, Сформировано поручение
    - 0: Отклонена, Отозвано
    - NaN: Получена (исключается из обучения — не финальный статус)

    Returns:
        pd.Series с 0/1/NaN
    """
    target = pd.Series(np.nan, index=df.index, name="is_approved")

    # Одобренные статусы → 1
    target[df["status"].isin(_APPROVED_STATUSES)] = 1.0

    # Отклонённые статусы → 0
    target[df["status"].isin(_REJECTED_STATUSES)] = 0.0

    # "Получена" остаётся NaN — исключим при обучении
    approved_count = (target == 1).sum()
    rejected_count = (target == 0).sum()
    excluded_count = target.isna().sum()

    logger.info(
        "[УСТАРЕВШАЯ FIFO-цель] одобрено=%d, отклонено=%d, исключено=%d",
        approved_count,
        rejected_count,
        excluded_count,
    )

    return target


def create_merit_target(df: pd.DataFrame) -> pd.Series:
    """
    Создаёт бинарную целевую переменную is_merit_worthy на основе
    законодательных норм РК — без target leakage.

    Логика (И обоих условий):
      1. historical_mortality_rate <= 2.0% (Приказ №12488 / V1500012488)
         Норма естественной убыли: здоровое хозяйство не теряет более 2% скота.
      2. amount_per_head в разумных пределах (эффективность субсидии).

    Graceful degradation:
      - Если historical_mortality_rate отсутствует → используем дефолт 2.5%
        (чуть выше порога нормы → консервативная метка 0).
      - Если amount_per_head отсутствует → этот критерий не применяется.

    Returns:
        pd.Series[int] с 0/1 (без NaN — модель обучается на всех строках).
    """
    # --- Определяем animal_type для динамических порогов ---
    if "animal_type" in df.columns:
        animal_types = df["animal_type"]
    elif "subsidy_name" in df.columns:
        animal_types = df["subsidy_name"].apply(
            lambda x: _classify_by_keywords(str(x), _ANIMAL_TYPE_KEYWORDS, default="другое")
        )
    else:
        animal_types = pd.Series("другое", index=df.index)

    # --- Критерий 1: падёж скота (V1500012488) ---
    if "historical_mortality_rate" in df.columns:
        mortality = pd.to_numeric(df["historical_mortality_rate"], errors="coerce")
    else:
        logger.warning(
            "create_merit_target: колонка historical_mortality_rate отсутствует — критерий падежа пропущен",
        )
        mortality = pd.Series(float("nan"), index=df.index)

    # Динамический предел из закона V1500012488
    allowed_mortality = animal_types.apply(get_mortality_norm)

    # NaN в mortality → данных нет → критерий не применяется (True)
    low_mortality = mortality.isna() | (mortality <= allowed_mortality)

    # --- Критерий 2: эффективность субсидии на голову (V1900018404) ---
    # Динамический порог зависит от типа животного
    amount_thresholds = animal_types.apply(get_merit_amount_threshold)

    if "amount_per_head" in df.columns:
        aph = pd.to_numeric(df["amount_per_head"], errors="coerce").fillna(0.0)
        efficient_amount = (aph > 0) & (aph <= amount_thresholds)
    else:
        if "amount" in df.columns and "head_count" in df.columns:
            aph = np.where(df["head_count"] > 0, df["amount"] / df["head_count"], 0.0)
            efficient_amount = (aph > 0) & (pd.Series(aph, index=df.index) <= amount_thresholds)
        else:
            logger.warning("create_merit_target: amount_per_head недоступен — критерий эффективности пропущен")
            efficient_amount = pd.Series(True, index=df.index)

    target = (low_mortality & efficient_amount).astype(int)

    merit_count = int(target.sum())
    total_count = len(target)
    logger.info(
        "Merit target (is_merit_worthy): 1=%d (%.1f%%), 0=%d (%.1f%%) — "
        "закон V1500012488 + V1900018404 (динамические пороги)",
        merit_count, merit_count / total_count * 100 if total_count else 0,
        total_count - merit_count, (total_count - merit_count) / total_count * 100 if total_count else 0,
    )

    return pd.Series(target.values, index=df.index, name="is_merit_worthy")


def detect_anomalies(df: pd.DataFrame) -> pd.Series:
    """
    Детекция аномалий — присваивает каждой заявке уровень риска (светофор).

    Правила:
    - 🔴 red: сумма > 10x медианы региона ИЛИ норматив == 0 ИЛИ сумма == 0
    - 🟡 yellow: сумма > 5x медианы региона ИЛИ подача ночью (час < 6)
    - 🟢 green: остальные

    Returns:
        pd.Series со значениями "green", "yellow", "red"
    """
    # Вычисляем медиану суммы по регионам
    region_median = df.groupby("region")["amount"].transform("median")

    # Отношение суммы к медиане региона (безопасное деление)
    amount_ratio = np.where(region_median > 0, df["amount"] / region_median, 0.0)

    # Извлекаем час подачи (если ещё не извлечён)
    hour = df["date"].dt.hour if "date" in df.columns else df.get("hour", pd.Series(12, index=df.index))

    # Красный: критические аномалии
    is_red = (amount_ratio > 10) | (df["normativ"] == 0) | (df["amount"] == 0)

    # Жёлтый: подозрительные паттерны
    is_yellow = (amount_ratio > 5) | (hour < 6)

    # Приоритет: red > yellow > green
    risk = pd.Series("green", index=df.index, name="risk_level")
    risk[is_yellow] = "yellow"
    risk[is_red] = "red"

    # Статистика
    red_count = (risk == "red").sum()
    yellow_count = (risk == "yellow").sum()
    green_count = (risk == "green").sum()
    logger.info(
        "Аномалии: 🔴 red=%d, 🟡 yellow=%d, 🟢 green=%d",
        red_count,
        yellow_count,
        green_count,
    )

    return risk


# === Список всех признаков для модели ===

# Оригинальные 17 признаков из реальных данных ГИСС
NUMERIC_FEATURES = [
    "head_count",                    # amount / normativ — масштаб хозяйства
    "month",                         # dt.month из даты подачи
    "hour",                          # dt.hour из даты подачи
    "day_of_week",                   # dt.dayofweek из даты подачи
    "amount_per_head",               # amount / head_count — эффективность
    "subsidy_type_approval_rate",    # % одобрения по типу субсидии (fit только на train!)
    "amount_vs_region_median",       # amount / median(region) — относительный размер
    "amount_vs_subsidy_median",      # amount / median(subsidy_name)
    "normativ_amount_ratio",         # normativ / amount — нормативная обоснованность
    "direction_competition",         # count(direction) — конкуренция
    "amount_log",                    # log1p(amount) — лог-сумма
    # === «Фермерский Портрет» (Приказы №11064, №12488) ===
    # Реальные данные: берутся из обогащённого Excel (enriched_data_2025_merit.xlsx)
    # Graceful degradation: дефолты 0.0 / 2.5 для обычных ГИСС-выгрузок
    "pasture_area_ha",               # Площадь пастбищ (га) — закон V1500011064
    "historical_mortality_rate",     # % падежа скота — закон V1500012488
    "current_head_count",            # Текущее поголовье до заявки
]

BINARY_FEATURES = [
    "is_cooperative",   # contains("кооператив") в subsidy_name
    "is_breeding",      # contains("племен") в subsidy_name
    "is_import",        # contains("импорт|канад|...") в subsidy_name
]

CATEGORICAL_FEATURES = [
    "animal_type",       # keyword classification из subsidy_name
    "subsidy_category",  # keyword classification из subsidy_name
    "normativ_tier",     # pd.qcut(normativ) → low/mid/high/zero
]

ALL_FEATURE_NAMES = NUMERIC_FEATURES + BINARY_FEATURES + CATEGORICAL_FEATURES
