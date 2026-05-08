"""Тесты инженерии признаков — feature engineering, целевая переменная, аномалии."""

import numpy as np
import pandas as pd
import pytest

from app.ml.features import (
    _classify_by_keywords,
    create_target,
    detect_anomalies,
    engineer_features,
    FeatureTransformer,
    ALL_FEATURE_NAMES,
    NUMERIC_FEATURES,
    BINARY_FEATURES,
    CATEGORICAL_FEATURES,
)


# ================================================================
# Вспомогательная фабрика для тестовых DataFrame
# ================================================================


def _make_df(
    n: int = 10,
    amount: float = 1_000_000,
    normativ: float = 50_000,
    status: str = "Исполнена",
    region: str = "Алматинская",
    district: str = "Талгар",
    direction: str = "скотоводство",
    subsidy_name: str = "Субсидирование приобретения КРС",
    date: str = "2025-03-15 10:00:00",
) -> pd.DataFrame:
    """Создаёт минимальный DataFrame для тестирования feature engineering."""
    return pd.DataFrame({
        "amount": [amount] * n,
        "normativ": [normativ] * n,
        "status": [status] * n,
        "region": [region] * n,
        "district": [district] * n,
        "direction": [direction] * n,
        "subsidy_name": [subsidy_name] * n,
        "date": pd.to_datetime([date] * n),
    })


# ================================================================
# _classify_by_keywords
# ================================================================


class TestClassifyByKeywords:
    """Тесты классификации текста по ключевым словам."""

    def test_krs_detected(self):
        """КРС определяется по ключевому слову."""
        from app.ml.features import _ANIMAL_TYPE_KEYWORDS
        assert _classify_by_keywords("Приобретение КРС молочного направления", _ANIMAL_TYPE_KEYWORDS) == "КРС"

    def test_milk_detected(self):
        from app.ml.features import _ANIMAL_TYPE_KEYWORDS
        assert _classify_by_keywords("Субсидия на молочную продукцию", _ANIMAL_TYPE_KEYWORDS) == "молоко"

    def test_poultry_detected(self):
        from app.ml.features import _ANIMAL_TYPE_KEYWORDS
        assert _classify_by_keywords("Птицеводство бройлерное", _ANIMAL_TYPE_KEYWORDS) == "птица"

    def test_sheep_detected(self):
        from app.ml.features import _ANIMAL_TYPE_KEYWORDS
        assert _classify_by_keywords("Овцеводство мериносовое", _ANIMAL_TYPE_KEYWORDS) == "овцы"

    def test_default_for_unknown(self):
        from app.ml.features import _ANIMAL_TYPE_KEYWORDS
        assert _classify_by_keywords("Какой-то неизвестный текст", _ANIMAL_TYPE_KEYWORDS) == "другое"

    def test_case_insensitive(self):
        from app.ml.features import _ANIMAL_TYPE_KEYWORDS
        assert _classify_by_keywords("ЛОШАДИ породистые", _ANIMAL_TYPE_KEYWORDS) == "лошади"

    def test_subsidy_category_acquisition(self):
        from app.ml.features import _SUBSIDY_CATEGORY_KEYWORDS
        assert _classify_by_keywords("Приобретение племенного скота", _SUBSIDY_CATEGORY_KEYWORDS) == "приобретение"

    def test_subsidy_category_feed(self):
        from app.ml.features import _SUBSIDY_CATEGORY_KEYWORDS
        assert _classify_by_keywords("Удешевление комбикормов", _SUBSIDY_CATEGORY_KEYWORDS) == "удешевление"


# ================================================================
# engineer_features
# ================================================================


class TestEngineerFeatures:
    """Тесты генерации 17 признаков из данных."""

    def test_head_count_calculated(self):
        """head_count = amount / normativ."""
        df = _make_df(n=20, amount=500_000, normativ=100_000)
        # Разнообразим нормативы чтобы pd.cut не падал на одинаковых bin edges
        df["normativ"] = np.linspace(50_000, 200_000, 20)
        df["amount"] = df["normativ"] * 5  # head_count == 5
        result, _ = engineer_features(df)
        assert np.allclose(result["head_count"], 5.0)

    def test_head_count_zero_normativ(self):
        """head_count = 0 если normativ == 0 (защита от деления на ноль)."""
        df = _make_df(normativ=0)
        result, _ = engineer_features(df)
        assert (result["head_count"] == 0).all()

    def test_is_cooperative_flag(self):
        """Флаг кооператива определяется по ключевому слову."""
        df = _make_df(subsidy_name="Кооператив молочный")
        result, _ = engineer_features(df)
        assert (result["is_cooperative"] == 1).all()

    def test_not_cooperative(self):
        """Обычная заявка — не кооператив."""
        df = _make_df(subsidy_name="Приобретение КРС")
        result, _ = engineer_features(df)
        assert (result["is_cooperative"] == 0).all()

    def test_animal_type_column_created(self):
        """Колонка animal_type создаётся."""
        df = _make_df()
        result, _ = engineer_features(df)
        assert "animal_type" in result.columns

    def test_temporal_features(self):
        """Временные признаки (month, hour, day_of_week) извлекаются корректно."""
        df = _make_df(date="2025-06-15 14:30:00")  # Воскресенье
        result, _ = engineer_features(df)
        assert (result["month"] == 6).all()
        assert (result["hour"] == 14).all()
        assert "day_of_week" in result.columns

    def test_amount_per_head_non_negative(self):
        """amount_per_head >= 0 для всех заявок."""
        df = _make_df(n=20)
        df.loc[:9, "status"] = "Исполнена"
        df.loc[10:, "status"] = "Отклонена"
        result, _ = engineer_features(df)
        assert (result["amount_per_head"] >= 0).all()

    def test_subsidy_type_approval_rate_range(self):
        """subsidy_type_approval_rate в диапазоне [0, 1]."""
        df = _make_df(n=20)
        df.loc[:9, "status"] = "Исполнена"
        df.loc[10:, "status"] = "Отклонена"
        result, _ = engineer_features(df)
        assert (result["subsidy_type_approval_rate"] >= 0).all()
        assert (result["subsidy_type_approval_rate"] <= 1).all()

    def test_is_breeding_flag(self):
        """Племенное хозяйство определяется."""
        df = _make_df(subsidy_name="Племенной скот импортный")
        result, _ = engineer_features(df)
        assert (result["is_breeding"] == 1).all()

    def test_is_import_flag(self):
        """Импортный скот определяется."""
        df = _make_df(subsidy_name="Импортные нетели из Канады")
        result, _ = engineer_features(df)
        assert (result["is_import"] == 1).all()

    def test_amount_log_positive(self):
        """Логарифм суммы положительный для положительных сумм."""
        df = _make_df(amount=1_000_000)
        result, _ = engineer_features(df)
        assert (result["amount_log"] > 0).all()

    def test_normativ_tier_created(self):
        """Колонка normativ_tier создаётся."""
        df = _make_df(n=30)
        # Разные нормативы для квантилей
        df["normativ"] = np.linspace(10_000, 500_000, 30)
        result, _ = engineer_features(df)
        assert "normativ_tier" in result.columns
        assert set(result["normativ_tier"].unique()).issubset({"zero", "low", "mid", "high"})

    def test_all_17_features_present(self):
        """Все 17 признаков создаются."""
        df = _make_df(n=20)
        df.loc[:9, "status"] = "Исполнена"
        df.loc[10:, "status"] = "Отклонена"
        result, _ = engineer_features(df)
        expected = [
            "head_count", "is_cooperative", "animal_type", "subsidy_category",
            "month", "hour", "day_of_week", "amount_per_head",
            "subsidy_type_approval_rate", "amount_vs_region_median",
            "amount_vs_subsidy_median", "is_breeding", "is_import",
            "normativ_amount_ratio", "direction_competition", "normativ_tier",
            "amount_log",
        ]
        for feat in expected:
            assert feat in result.columns, f"Отсутствует признак: {feat}"

    def test_no_nans_in_numeric_features(self):
        """Числовые признаки не содержат NaN."""
        df = _make_df(n=20)
        df.loc[:9, "status"] = "Исполнена"
        df.loc[10:, "status"] = "Отклонена"
        result, _ = engineer_features(df)
        for col in ["head_count", "amount_log", "amount_per_head", "subsidy_type_approval_rate"]:
            assert not result[col].isna().any(), f"NaN в {col}"

    def test_returns_tuple_with_transformer(self):
        """engineer_features возвращает tuple (DataFrame, FeatureTransformer)."""
        df = _make_df(n=20)
        result = engineer_features(df)
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], pd.DataFrame)
        assert isinstance(result[1], FeatureTransformer)

    def test_transformer_is_fitted(self):
        """Возвращённый FeatureTransformer должен быть обучен."""
        df = _make_df(n=20)
        df.loc[:9, "status"] = "Исполнена"
        df.loc[10:, "status"] = "Отклонена"
        _, transformer = engineer_features(df)
        assert transformer._is_fitted

    def test_transform_only_mode(self):
        """Режим transform-only (передан обученный transformer)."""
        df = _make_df(n=20)
        df.loc[:9, "status"] = "Исполнена"
        df.loc[10:, "status"] = "Отклонена"
        _, transformer = engineer_features(df)
        
        # Новые данные — только transform
        df_new = _make_df(n=5)
        result, returned_transformer = engineer_features(df_new, transformer=transformer)
        
        # Должен вернуть тот же transformer
        assert returned_transformer is transformer
        # Все признаки должны быть
        assert "subsidy_type_approval_rate" in result.columns


# ================================================================
# create_target
# ================================================================


class TestCreateTarget:
    """Тесты создания целевой переменной."""

    def test_approved_statuses_map_to_one(self):
        """Исполнена/Одобрена/Сформировано поручение → 1."""
        for status in ["Исполнена", "Одобрена", "Сформировано поручение"]:
            df = _make_df(status=status)
            target = create_target(df)
            assert (target == 1).all()

    def test_rejected_statuses_map_to_zero(self):
        """Отклонена/Отозвано → 0."""
        for status in ["Отклонена", "Отозвано"]:
            df = _make_df(status=status)
            target = create_target(df)
            assert (target == 0).all()

    def test_received_status_is_nan(self):
        """Получена → NaN (исключается из обучения)."""
        df = _make_df(status="Получена")
        target = create_target(df)
        assert target.isna().all()

    def test_mixed_statuses(self):
        """Смешанные статусы корректно маппятся."""
        df = _make_df(n=3)
        df["status"] = ["Исполнена", "Отклонена", "Получена"]
        target = create_target(df)
        assert target.iloc[0] == 1.0
        assert target.iloc[1] == 0.0
        assert pd.isna(target.iloc[2])


# ================================================================
# detect_anomalies
# ================================================================


class TestDetectAnomalies:
    """Тесты детекции аномалий (светофор)."""

    def test_normal_application_is_green(self):
        """Обычная заявка получает зелёный уровень."""
        df = _make_df(n=10, amount=1_000_000, normativ=50_000)
        risk = detect_anomalies(df)
        assert (risk == "green").all()

    def test_zero_normativ_is_red(self):
        """Нулевой норматив → красный."""
        df = _make_df(n=5, normativ=0)
        risk = detect_anomalies(df)
        assert (risk == "red").all()

    def test_zero_amount_is_red(self):
        """Нулевая сумма → красный."""
        df = _make_df(n=5, amount=0, normativ=50_000)
        risk = detect_anomalies(df)
        assert (risk == "red").all()

    def test_night_submission_is_yellow(self):
        """Подача ночью (до 6 утра) → жёлтый."""
        df = _make_df(n=5, date="2025-03-15 03:00:00")
        risk = detect_anomalies(df)
        # Может быть yellow или red (если другие критерии тоже сработали)
        assert (risk.isin(["yellow", "red"])).all()

    def test_huge_amount_is_red(self):
        """Сумма > 10x медианы → красный."""
        df = _make_df(n=10, amount=1_000_000)
        # Одна заявка с суммой в 20x
        df.loc[0, "amount"] = 20_000_000
        risk = detect_anomalies(df)
        assert risk.iloc[0] in ("red",)

    def test_output_only_valid_levels(self):
        """Результат содержит только green/yellow/red."""
        df = _make_df(n=20)
        df["amount"] = np.random.default_rng(42).integers(0, 10_000_000, 20)
        df["normativ"] = np.random.default_rng(42).integers(0, 100_000, 20)
        risk = detect_anomalies(df)
        assert set(risk.unique()).issubset({"green", "yellow", "red"})


# ================================================================
# Константы — списки признаков
# ================================================================


class TestFeatureConstants:
    """Тесты констант со списками признаков."""

    def test_all_features_count(self):
        """Всего 20 признаков."""
        # 14 числовых + 3 бинарных + 3 категориальных = 20
        assert len(ALL_FEATURE_NAMES) == 20

    def test_no_duplicate_features(self):
        """Нет дубликатов в списке признаков."""
        assert len(ALL_FEATURE_NAMES) == len(set(ALL_FEATURE_NAMES))

    def test_all_lists_combined(self):
        """ALL_FEATURE_NAMES = NUMERIC + BINARY + CATEGORICAL."""
        assert ALL_FEATURE_NAMES == NUMERIC_FEATURES + BINARY_FEATURES + CATEGORICAL_FEATURES

    def test_no_synthetic_features(self):
        """Синтетические признаки удалены из списка."""
        synthetic = ["land_area_ha", "infrastructure_score", "production_growth_pct",
                     "years_in_system"]
        for feat in synthetic:
            assert feat not in ALL_FEATURE_NAMES, f"Синтетический признак {feat} не удалён"
