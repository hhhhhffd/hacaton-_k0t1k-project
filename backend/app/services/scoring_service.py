"""ScoringService — потокобезопасная обёртка для ML-модели и кэша фичей.

Решает проблему глобального состояния в многопроцессорных деплоях (Gunicorn/Uvicorn).
Один экземпляр создаётся при старте приложения через lifespan и хранится в app.state.
"""

import logging
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.integrations.alemplus import AlemPlusClient
from app.ml.model import ScoringModel
from app.services.scoring_pipeline import ScoringPipeline

logger = logging.getLogger("_k0t1k.scoring_service")

# Пути для артефактов модели
_MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"
_FEATURES_CACHE_PATH = _MODELS_DIR / "features_cache.joblib"
_ACTIVE_MODEL_PATH = _MODELS_DIR / "active_model.txt"

# Максимальный размер кэша фичей в RAM (100к строк — ~500MB при 22 фичах)
FEATURES_CACHE_MAX_ROWS = 100_000


class ScoringService:
    """
    Сервис скоринга — единая точка доступа к ML-модели и кэшам.
    
    Безопасен для использования в многопроцессорных деплоях:
    - Загружает модель с диска при инициализации
    - Хранит DataFrame с фичами в RAM (с лимитом размера)
    - Используется через FastAPI Depends() из app.state
    
    Lifecycle:
    - Создаётся в lifespan() при старте приложения
    - Закрывается в lifespan() при завершении
    """

    def __init__(self) -> None:
        self._pipeline = ScoringPipeline()
        self._features_cache: pd.DataFrame | None = None
        self._global_shap_cache: dict[str, float] | None = None
        self._model_metrics_cache: dict[str, float] | None = None
        self._stats_cache: dict[str, Any] = {"data": None, "ts": 0.0}
        self._budget_rows_cache: dict[str, Any] = {"rows": None, "ts": 0.0}
        self._active_model_filename: str | None = None

    async def initialize(self) -> None:
        """
        Инициализация при старте приложения.
        
        Загружает сохранённую модель и кэш фичей с диска.
        Вызывается из lifespan().
        """
        # Загружаем модель (если есть active_model.txt — используем её)
        try:
            self._load_active_model()
        except FileNotFoundError:
            logger.info("Сохранённая модель не найдена — загрузите данные через /api/data/upload")

        # Загружаем кэш фичей
        self._load_features_cache()

    async def close(self) -> None:
        """Закрытие ресурсов при завершении приложения."""
        await self._pipeline.close()
        logger.info("ScoringService закрыт")

    def _load_active_model(self) -> None:
        """Загружает активную модель на основе active_model.txt."""
        if _ACTIVE_MODEL_PATH.exists():
            self._active_model_filename = _ACTIVE_MODEL_PATH.read_text().strip()
            model_path = _MODELS_DIR / self._active_model_filename
            if model_path.exists():
                self._pipeline._model.load_from_path(model_path)
                self._pipeline._model_loaded = True
                logger.info("Модель загружена: %s", self._active_model_filename)
                return

        # Fallback: legacy модель без версионирования
        self._pipeline.load_model()
        self._active_model_filename = "lgbm_scoring.joblib"

    def _load_features_cache(self) -> None:
        """Загружает кэш фичей с диска."""
        if _FEATURES_CACHE_PATH.exists():
            try:
                self._features_cache = joblib.load(_FEATURES_CACHE_PATH)
                logger.info("Кэш фичей загружен: %d строк", len(self._features_cache))
            except Exception as e:
                logger.warning("Ошибка загрузки кэша фичей: %s", e)
                self._features_cache = None
        else:
            logger.info("Кэш фичей не найден — /explain и /global-shap недоступны до загрузки данных")

    # ================================================================
    # Свойства для доступа к внутренним компонентам
    # ================================================================

    @property
    def pipeline(self) -> ScoringPipeline:
        """Доступ к пайплайну скоринга."""
        return self._pipeline

    @property
    def model(self) -> ScoringModel:
        """Доступ к ML-модели."""
        return self._pipeline._model

    @property
    def alemplus(self) -> AlemPlusClient:
        """Доступ к клиенту alem.plus."""
        return self._pipeline.alemplus

    @property
    def is_ready(self) -> bool:
        """Готов ли сервис к скорингу (модель загружена)."""
        return self._pipeline.is_ready

    @property
    def features_cache(self) -> pd.DataFrame | None:
        """DataFrame с фичами для SHAP-объяснений."""
        return self._features_cache

    @features_cache.setter
    def features_cache(self, df: pd.DataFrame | None) -> None:
        """Установка кэша фичей (с проверкой размера)."""
        if df is not None and len(df) > FEATURES_CACHE_MAX_ROWS:
            logger.warning(
                "Датасет слишком большой для RAM-кэша: %d строк (лимит %d) — кэшируем подвыборку",
                len(df), FEATURES_CACHE_MAX_ROWS,
            )
            self._features_cache = df.sample(n=FEATURES_CACHE_MAX_ROWS, random_state=42)
        else:
            self._features_cache = df

    @property
    def global_shap_cache(self) -> dict[str, float] | None:
        """Кэш глобальных SHAP importances."""
        return self._global_shap_cache

    @global_shap_cache.setter
    def global_shap_cache(self, cache: dict[str, float] | None) -> None:
        self._global_shap_cache = cache

    @property
    def model_metrics_cache(self) -> dict[str, float] | None:
        """Метрики модели (accuracy, f1, roc_auc)."""
        return self._model_metrics_cache

    @model_metrics_cache.setter
    def model_metrics_cache(self, metrics: dict[str, float] | None) -> None:
        self._model_metrics_cache = metrics

    @property
    def stats_cache(self) -> dict[str, Any]:
        """Кэш агрегированной статистики."""
        return self._stats_cache

    @property
    def budget_rows_cache(self) -> dict[str, Any]:
        """Кэш строк для бюджетной симуляции."""
        return self._budget_rows_cache

    @property
    def active_model_filename(self) -> str | None:
        """Имя файла активной модели."""
        return self._active_model_filename

    # ================================================================
    # Методы для работы с моделями
    # ================================================================

    def save_features_cache(self, df: pd.DataFrame) -> None:
        """Сохраняет кэш фичей на диск и в RAM."""
        self.features_cache = df
        try:
            _FEATURES_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump(df, _FEATURES_CACHE_PATH)
            logger.info("Кэш фичей сохранён: %s", _FEATURES_CACHE_PATH)
        except Exception as e:
            logger.warning("Не удалось сохранить кэш фичей: %s", e)

    def activate_model(self, filename: str) -> None:
        """
        Активирует модель по имени файла.
        
        Загружает модель с диска и обновляет active_model.txt.
        """
        model_path = _MODELS_DIR / filename
        if not model_path.exists():
            raise FileNotFoundError(f"Модель не найдена: {model_path}")

        self._pipeline._model.load_from_path(model_path)
        self._pipeline._model_loaded = True
        self._active_model_filename = filename

        # Сохраняем в active_model.txt
        _ACTIVE_MODEL_PATH.write_text(filename)
        logger.info("Модель активирована: %s", filename)

    def invalidate_caches(self) -> None:
        """Сбрасывает все in-memory кэши (при загрузке новых данных)."""
        self._global_shap_cache = None
        self._stats_cache = {"data": None, "ts": 0.0}
        self._budget_rows_cache = {"rows": None, "ts": 0.0}
        logger.debug("In-memory кэши сброшены")

    def list_models(self) -> list[dict[str, Any]]:
        """
        Возвращает список доступных версий моделей.
        
        Returns:
            Список словарей с filename, created_at, is_active
        """
        models = []
        _MODELS_DIR.mkdir(parents=True, exist_ok=True)

        for path in sorted(_MODELS_DIR.glob("lgbm_*.joblib"), reverse=True):
            stat = path.stat()
            models.append({
                "filename": path.name,
                "created_at": stat.st_mtime,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "is_active": path.name == self._active_model_filename,
            })

        # Добавляем legacy-модель если есть
        legacy_path = _MODELS_DIR / "lgbm_scoring.joblib"
        if legacy_path.exists() and not any(m["filename"] == "lgbm_scoring.joblib" for m in models):
            stat = legacy_path.stat()
            models.append({
                "filename": "lgbm_scoring.joblib",
                "created_at": stat.st_mtime,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "is_active": self._active_model_filename == "lgbm_scoring.joblib",
            })

        return models
