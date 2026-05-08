"""Модель скоринга — LightGBM классификатор с SHAP-объяснениями."""

import logging
from pathlib import Path
from typing import Any

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.preprocessing import LabelEncoder

from app.ml.features import ALL_FEATURE_NAMES, CATEGORICAL_FEATURES, FeatureTransformer

logger = logging.getLogger("k0t1k.model")

# Путь для сохранения артефактов модели
_MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"


class ScoringModel:
    """
    LightGBM-классификатор для скоринга заявок на субсидии.

    Обучается на бинарной целевой переменной is_approved.
    Выдаёт вероятность одобрения, масштабированную в балл 0-100.
    
    ИЗМЕНЕНИЕ: теперь хранит FeatureTransformer для предотвращения target leakage.
    """

    def __init__(self) -> None:
        self._model: lgb.LGBMClassifier | None = None
        self._label_encoders: dict[str, LabelEncoder] = {}
        self._feature_names: list[str] = ALL_FEATURE_NAMES.copy()
        # Трансформер признаков с маппингами, вычисленными на train данных
        self._feature_transformer: FeatureTransformer | None = None

    @property
    def feature_transformer(self) -> FeatureTransformer | None:
        """Доступ к трансформеру для inference."""
        return self._feature_transformer
    
    @feature_transformer.setter
    def feature_transformer(self, transformer: FeatureTransformer) -> None:
        """Установка трансформера после обучения."""
        self._feature_transformer = transformer

    def _encode_categoricals(self, df: pd.DataFrame, fit: bool = False) -> pd.DataFrame:
        """
        Кодирует категориальные признаки через LabelEncoder.

        Args:
            df: DataFrame с признаками
            fit: True при обучении (fit_transform), False при предсказании (transform)
        """
        df = df.copy()
        for col in CATEGORICAL_FEATURES:
            if col not in df.columns:
                continue
            df[col] = df[col].astype(str).fillna("unknown")
            if fit:
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col])
                self._label_encoders[col] = le
            else:
                le = self._label_encoders.get(col)
                if le is None:
                    raise ValueError(f"LabelEncoder для '{col}' не найден — сначала обучите модель")
                # Обработка невиданных категорий: присваиваем -1
                known_classes = set(le.classes_)
                df[col] = df[col].apply(lambda x: x if x in known_classes else "unknown")
                # Если "unknown" не в классах, добавляем
                if "unknown" not in known_classes:
                    le.classes_ = np.append(le.classes_, "unknown")
                df[col] = le.transform(df[col])
        return df

    def _prepare_features(self, df: pd.DataFrame, fit: bool = False) -> pd.DataFrame:
        """Подготавливает матрицу признаков: выбирает нужные колонки и кодирует категории."""
        # Проверяем наличие всех признаков
        missing = [f for f in self._feature_names if f not in df.columns]
        if missing:
            raise ValueError(f"Отсутствуют признаки в DataFrame: {missing}")

        X = df[self._feature_names].copy()
        X = self._encode_categoricals(X, fit=fit)

        # Заполняем оставшиеся NaN нулями
        X = X.fillna(0)

        return X

    def train(self, X_df: pd.DataFrame, y: pd.Series) -> dict[str, float]:
        """
        Обучает LightGBM-классификатор на данных.

        Args:
            X_df: DataFrame с признаками (должен содержать все колонки из ALL_FEATURE_NAMES)
            y: бинарная целевая переменная (0/1)

        Returns:
            Словарь с метриками на тестовой выборке
        """
        logger.info("Начинаем обучение модели на %d строках", len(X_df))

        # Убираем строки с NaN в целевой переменной
        valid_mask = y.notna()
        X_df = X_df[valid_mask].reset_index(drop=True)
        y = y[valid_mask].reset_index(drop=True)

        logger.info("После фильтрации NaN: %d строк (одобрено: %d, отклонено: %d)",
                     len(y), (y == 1).sum(), (y == 0).sum())

        # Подготовка признаков
        X = self._prepare_features(X_df, fit=True)

        # Разбиение на обучение и тест
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y,
        )

        # Вес классов для баланса (отклонённых меньше, чем одобренных)
        n_pos = (y_train == 1).sum()
        n_neg = (y_train == 0).sum()
        scale_pos_weight = n_neg / n_pos if n_pos > 0 else 1.0

        # Параметры LightGBM
        self._model = lgb.LGBMClassifier(
            n_estimators=500,
            max_depth=7,
            learning_rate=0.05,
            num_leaves=63,
            min_child_samples=50,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=scale_pos_weight,
            random_state=42,
            verbose=-1,
            n_jobs=2,          # Ограничиваем потоки — контейнер не зависает (API/DB тоже нужны ядра)
        )

        # Обучение с ранней остановкой
        self._model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            callbacks=[
                lgb.early_stopping(stopping_rounds=50, verbose=True),
                lgb.log_evaluation(period=50),
            ],
        )

        # Метрики на отложенной тестовой выборке
        from sklearn.metrics import accuracy_score, f1_score, roc_auc_score

        y_pred = self._model.predict(X_test)
        y_proba = self._model.predict_proba(X_test)[:, 1]

        metrics = {
            "accuracy": round(accuracy_score(y_test, y_pred), 4),
            "f1": round(f1_score(y_test, y_pred), 4),
            "roc_auc": round(roc_auc_score(y_test, y_proba), 4),
            "train_size": len(X_train),
            "test_size": len(X_test),
        }

        logger.info("Модель обучена. Hold-out метрики: %s", metrics)

        # 5-fold StratifiedKFold cross-validation для валидации отсутствия переобучения
        # 5-fold StratifiedKFold CV для доказательства отсутствия переобучения
        logger.info("Запускаем 5-fold StratifiedKFold CV для проверки обобщающей способности...")
        # n_estimators: используем best_iteration_ (early stopping) или макс 200
        # Чтобы CV не запускал 500 деревьев × 5 фолдов
        best_iters = getattr(self._model, "best_iteration_", None) or 300
        cv_iters = min(best_iters, 200)  # не более 200 для CV

        cv_model = lgb.LGBMClassifier(
            n_estimators=cv_iters,
            max_depth=7,
            learning_rate=0.05,
            num_leaves=63,
            min_child_samples=50,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=scale_pos_weight,
            random_state=42,
            verbose=-1,
            n_jobs=2,  # Ограничение потоков на фоль
        )

        try:
            cv_results = cross_validate(
                cv_model,
                X,
                y,
                cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
                scoring=["accuracy", "f1", "roc_auc"],
                n_jobs=1,  # Фолды последовательно — иначе 5×n_jobs_lgbm = взрыв CPU
            )

            cv_metrics = {
                "cv_accuracy_mean": round(float(cv_results["test_accuracy"].mean()), 4),
                "cv_accuracy_std": round(float(cv_results["test_accuracy"].std()), 4),
                "cv_f1_mean": round(float(cv_results["test_f1"].mean()), 4),
                "cv_f1_std": round(float(cv_results["test_f1"].std()), 4),
                "cv_roc_auc_mean": round(float(cv_results["test_roc_auc"].mean()), 4),
                "cv_roc_auc_std": round(float(cv_results["test_roc_auc"].std()), 4),
                "cv_folds": 5,
            }
            metrics.update(cv_metrics)

            logger.info(
                "5-fold CV: accuracy=%.4f±%.4f  f1=%.4f±%.4f  roc_auc=%.4f±%.4f",
                cv_metrics["cv_accuracy_mean"], cv_metrics["cv_accuracy_std"],
                cv_metrics["cv_f1_mean"], cv_metrics["cv_f1_std"],
                cv_metrics["cv_roc_auc_mean"], cv_metrics["cv_roc_auc_std"],
            )

        except Exception as e:
            logger.warning("Ошибка CV (non-fatal): %s — метрики hold-out достаточны", e)

        # Сохраняем модель и энкодеры
        self.save()

        return metrics

    def predict(self, X_df: pd.DataFrame) -> np.ndarray:
        """
        Предсказывает балл скоринга (0-100) для каждой заявки.

        Вероятность одобрения (predict_proba) масштабируется в диапазон 0-100.

        Args:
            X_df: DataFrame с признаками

        Returns:
            numpy array с баллами 0-100
        """
        if self._model is None:
            raise RuntimeError("Модель не загружена — вызовите load() или train()")

        X = self._prepare_features(X_df, fit=False)

        # Вероятность класса 1 (одобрено) → масштаб 0-100
        probabilities = self._model.predict_proba(X)[:, 1]
        scores = np.round(probabilities * 100, 1)

        logger.info(
            "Скоринг %d заявок: min=%.1f, median=%.1f, max=%.1f",
            len(scores), scores.min(), np.median(scores), scores.max(),
        )

        return scores

    def save(self, versioned: bool = False) -> Path:
        """
        Сохраняет модель, LabelEncoder'ы и FeatureTransformer на диск.
        
        Args:
            versioned: Если True — сохраняет с timestamp (lgbm_{timestamp}.joblib)
                       Если False — перезаписывает legacy-файл (lgbm_scoring.joblib)
        
        Returns:
            Путь к сохранённому файлу модели
        """
        if self._model is None:
            raise RuntimeError("Нечего сохранять — модель не обучена")

        _MODELS_DIR.mkdir(parents=True, exist_ok=True)

        if versioned:
            # Версионированное имя: lgbm_20240101_120000.joblib
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            model_path = _MODELS_DIR / f"lgbm_{timestamp}.joblib"
            encoders_path = _MODELS_DIR / f"encoders_{timestamp}.joblib"
            transformer_path = _MODELS_DIR / f"transformer_{timestamp}.joblib"
        else:
            # Legacy-имена для обратной совместимости
            model_path = _MODELS_DIR / "lgbm_scoring.joblib"
            encoders_path = _MODELS_DIR / "label_encoders.joblib"
            transformer_path = _MODELS_DIR / "feature_transformer.joblib"

        joblib.dump(self._model, model_path)
        joblib.dump(self._label_encoders, encoders_path)
        
        # Сохраняем FeatureTransformer для предотвращения target leakage при inference
        if self._feature_transformer is not None:
            joblib.dump(self._feature_transformer.get_params(), transformer_path)
            logger.info("FeatureTransformer сохранён: %s", transformer_path)

        logger.info("Модель сохранена: %s", model_path)
        return model_path

    def load(self) -> None:
        """Загружает модель, LabelEncoder'ы и FeatureTransformer с диска (legacy-путь)."""
        model_path = _MODELS_DIR / "lgbm_scoring.joblib"
        self.load_from_path(model_path)

    def load_from_path(self, model_path: Path) -> None:
        """
        Загружает модель из указанного пути.
        
        Артефакты (encoders, transformer) загружаются из той же директории.
        Поддерживает версионированные модели (lgbm_{timestamp}.joblib).
        
        Args:
            model_path: Полный путь к файлу модели
        """
        if not model_path.exists():
            raise FileNotFoundError(f"Файл модели не найден: {model_path}")

        model_dir = model_path.parent
        
        # Определяем базовое имя для артефактов
        # Версионированные: lgbm_20240101_120000.joblib → encoders_20240101_120000.joblib
        # Legacy: lgbm_scoring.joblib → label_encoders.joblib
        stem = model_path.stem
        if stem.startswith("lgbm_") and stem != "lgbm_scoring":
            timestamp = stem[5:]  # Убираем "lgbm_"
            encoders_path = model_dir / f"encoders_{timestamp}.joblib"
            transformer_path = model_dir / f"transformer_{timestamp}.joblib"
        else:
            encoders_path = model_dir / "label_encoders.joblib"
            transformer_path = model_dir / "feature_transformer.joblib"

        self._model = joblib.load(model_path)
        
        if encoders_path.exists():
            self._label_encoders = joblib.load(encoders_path)
        
        # Загружаем FeatureTransformer (если есть)
        if transformer_path.exists():
            transformer_params = joblib.load(transformer_path)
            self._feature_transformer = FeatureTransformer()
            self._feature_transformer.set_params(transformer_params)
            logger.info("FeatureTransformer загружен из %s", transformer_path)

        logger.info("Модель загружена из %s", model_path)

    def get_feature_names(self) -> list[str]:
        """Возвращает список имён признаков, используемых моделью."""
        return self._feature_names.copy()
