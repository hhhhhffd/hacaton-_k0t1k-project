"""SHAP-объяснения — локальные (per-row) и глобальные (feature importance)."""

import logging

import numpy as np
import pandas as pd
import shap

from app.ml.model import ScoringModel

logger = logging.getLogger("k0t1k.explainer")


def get_shap_values(model: ScoringModel, X_single: pd.DataFrame) -> dict[str, float]:
    """
    Вычисляет SHAP-значения для одной заявки.

    Args:
        model: обученная модель ScoringModel (с загруженным _model)
        X_single: DataFrame с одной строкой (все признаки)

    Returns:
        Словарь {имя_признака: shap_значение} — вклад каждого признака в предсказание
    """
    if model._model is None:
        raise RuntimeError("Модель не загружена")

    # Подготавливаем фичи (кодируем категориальные)
    X_prepared = model._prepare_features(X_single, fit=False)

    # TreeExplainer — быстрый и точный для LightGBM
    explainer = shap.TreeExplainer(model._model)
    shap_vals = explainer.shap_values(X_prepared)

    # shap_values возвращает разные структуры в зависимости от версии SHAP:
    # - list [array_class0, array_class1] — старые версии (< 0.42)
    # - shap.Explanation объект с .values — новые версии (>= 0.42)
    # - np.ndarray — некоторые конфигурации
    if hasattr(shap_vals, "values"):
        # shap.Explanation объект (новые версии SHAP)
        raw = shap_vals.values
        values = raw[0] if raw.ndim == 2 else raw
    elif isinstance(shap_vals, list) and len(shap_vals) >= 2:
        # Список массивов [class0, class1] — берём класс 1 (одобрено)
        values = np.array(shap_vals[1])[0]
    elif isinstance(shap_vals, list) and len(shap_vals) == 1:
        values = np.array(shap_vals[0])[0]
    elif isinstance(shap_vals, np.ndarray):
        values = shap_vals[0] if shap_vals.ndim == 2 else shap_vals
    else:
        logger.warning("Неизвестный формат SHAP: %s", type(shap_vals))
        return {}

    # Маппинг имя → значение
    feature_names = model.get_feature_names()
    result = {name: round(float(val), 4) for name, val in zip(feature_names, values)}

    return result


def get_global_shap(model: ScoringModel, X: pd.DataFrame, max_samples: int = 5000) -> dict[str, float]:
    """
    Вычисляет глобальные SHAP-значения — средний |SHAP| по всем (или подвыборке) заявкам.

    Args:
        model: обученная модель ScoringModel
        X: DataFrame с признаками (все заявки)
        max_samples: максимум строк для расчёта (SHAP на 36k строк — медленно)

    Returns:
        Словарь {имя_признака: mean_abs_shap}, отсортированный по убыванию
    """
    if model._model is None:
        raise RuntimeError("Модель не загружена")

    X_prepared = model._prepare_features(X, fit=False)

    # Сэмплируем если слишком много строк (SHAP вычислительно дорог)
    if len(X_prepared) > max_samples:
        X_sample = X_prepared.sample(n=max_samples, random_state=42)
        logger.info("SHAP: сэмплировано %d из %d строк", max_samples, len(X_prepared))
    else:
        X_sample = X_prepared

    explainer = shap.TreeExplainer(model._model)
    shap_vals = explainer.shap_values(X_sample)

    # Извлекаем значения для класса 1 (одобрено) — совместимость с разными версиями SHAP
    if hasattr(shap_vals, "values"):
        values = np.array(shap_vals.values)
    elif isinstance(shap_vals, list) and len(shap_vals) >= 2:
        values = np.array(shap_vals[1])
    elif isinstance(shap_vals, list) and len(shap_vals) == 1:
        values = np.array(shap_vals[0])
    else:
        values = np.array(shap_vals)

    # Средний абсолютный SHAP по каждому признаку
    mean_abs = np.mean(np.abs(values), axis=0)
    feature_names = model.get_feature_names()

    # Словарь, отсортированный по убыванию важности
    importance = {name: round(float(val), 4) for name, val in zip(feature_names, mean_abs)}
    importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))

    logger.info("Глобальный SHAP: топ-5 фич = %s", list(importance.items())[:5])

    return importance
