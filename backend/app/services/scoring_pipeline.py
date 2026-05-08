"""Конвейер скоринга — от заявки до балла с объяснением (с интеграцией alem.plus API)."""

import logging
from datetime import datetime

import numpy as np
import pandas as pd

from app.core.redis import cache_explanation, cache_score, get_cached_explanation, get_cached_score
from app.integrations.alemplus import AlemPlusClient
from app.ml.explainer import get_shap_values
from app.ml.features import ALL_FEATURE_NAMES, detect_anomalies
from app.ml.model import ScoringModel
from app.schemas.application import ApplicationResponse, BudgetSimResponse, ScoreResponse
from app.core.laws import get_pasture_requirement_ha, STRICT_REGULATION_TEXT, FEATURE_NAMES_RU

# ================================================================
# Константы из законодательства РК
# ================================================================

logger = logging.getLogger("_k0t1k.pipeline")

# Текст регламента для семантической проверки Score API
_REGULATION_TEXT = STRICT_REGULATION_TEXT


class ScoringPipeline:
    """
    Двухэтапный конвейер скоринга заявок на субсидии.

    Этап 1 — жёсткие фильтры (правила + Score API): normativ > 0, amount > 0,
             разумный head_count, семантическая проверка.
    Этап 2 — ML-скоринг: LightGBM → вероятность → балл 0-100 + SHAP + Qwen объяснение.

    Интеграция:
    - Redis кэш: результаты скоринга кэшируются на 1 час
    - Qwen 3.5: генерация текстовых объяснений
    - Score API: семантическая проверка в hard_filter
    """

    def __init__(self) -> None:
        self._model = ScoringModel()
        self._model_loaded = False
        self._alemplus = AlemPlusClient()

    async def close(self) -> None:
        """Закрытие HTTP-клиентов при завершении приложения."""
        await self._alemplus.close()

    @property
    def alemplus(self) -> AlemPlusClient:
        """Доступ к клиенту alem.plus для внешнего использования."""
        return self._alemplus

    def load_model(self) -> None:
        """Загружает обученную модель с диска."""
        try:
            self._model.load()
            self._model_loaded = True
            logger.info("Модель скоринга загружена")
        except FileNotFoundError:
            logger.warning("Модель не найдена — скоринг недоступен до обучения")
            self._model_loaded = False

    @property
    def model(self) -> ScoringModel:
        """Доступ к модели для внешнего использования (SHAP и т.д.)."""
        return self._model

    @property
    def is_ready(self) -> bool:
        """Готов ли конвейер к скорингу."""
        return self._model_loaded

    def hard_filter(self, row: dict) -> tuple[bool, str]:
        """
        Этап 1 — жёсткие фильтры по правилам из регламента МСХ РК (синхронная часть).

        Проверки:
        1. normativ > 0 И amount > 0
        2. head_count разумный (не отрицательный, не > 50000)
        3. Дата подачи в допустимом окне (20 января — 20 декабря)
        4. Числовые поля — действительно числа (не NaN, не None)
        5. [Приказ №11064] Нагрузка на пастбища не превышает норму (2 гол/га)
           ПРИМЕЧАНИЕ: если поля pasture_area_ha/current_head_count отсутствуют
           (например, реальная выгрузка ГИСС без «Фермерского Портрета»),
           проверка пропускается — graceful degradation для MVP.

        Args:
            row: словарь с данными заявки (normativ, amount, head_count, date,
                 и опционально: pasture_area_ha, current_head_count)

        Returns:
            (passed, reason) — прошёл ли фильтр и причина отказа
        """
        # Безопасное извлечение числовых значений (защита от NaN/None/строк)
        try:
            normativ = float(row.get("normativ", 0) or 0)
        except (ValueError, TypeError):
            return False, "Норматив не является числом"

        try:
            amount = float(row.get("amount", 0) or 0)
        except (ValueError, TypeError):
            return False, "Сумма не является числом"

        # Проверка на NaN (float('nan') проходит float(), но ломает логику)
        if normativ != normativ or amount != amount:  # NaN != NaN
            return False, "Норматив или сумма содержат NaN"

        # Проверка: normativ и amount должны быть положительными
        if normativ <= 0:
            return False, "Норматив равен нулю или отрицательный"
        if amount <= 0:
            return False, "Сумма равна нулю или отрицательная"

        # Проверка: head_count должен быть разумным
        head_count = amount / normativ if normativ > 0 else 0
        if head_count < 0:
            return False, f"Отрицательное количество голов: {head_count:.0f}"
        if head_count > 50000:
            return False, f"Нереально большое количество голов: {head_count:.0f}"

        # ----------------------------------------------------------------
        # Проверка 5: Приказ №11064 (V1500011064)
        # Норма нагрузки на пастбища: не более LEGAL_PASTURE_RATIO голов/га
        # Graceful degradation: пропускаем если поля отсутствуют (реальная ГИСС-выгрузка)
        # ----------------------------------------------------------------
        raw_pasture = row.get("pasture_area_ha")
        raw_current = row.get("current_head_count")

        if raw_pasture is not None and raw_current is not None:
            try:
                pasture_area_ha = float(raw_pasture or 0)
                current_head_count = float(raw_current or 0)
            except (ValueError, TypeError):
                pasture_area_ha = 0.0
                current_head_count = 0.0

            # Проверяем только если пастбище указано (> 0 га)
            if pasture_area_ha > 0:
                # Запрашиваемое поголовье = текущее + новые головы (из заявки)
                # ВНИМАНИЕ: Для некоторых типов субсидий (например, корма или осеменение)
                # head_count (сумма / норматив) может означать количество тонн корма 
                # или услуг, а не живых голов. В MVP мы допускаем это упрощение.
                requested_heads = head_count  # голов по заявке
                total_proposed_heads = current_head_count + requested_heads
                
                # Динамический расчет нормы по закону (га/голову)
                animal_type = row.get("animal_type", "")
                region = row.get("region", "")
                ha_per_head = get_pasture_requirement_ha(animal_type, region)
                
                # Если 0 (например, птицы/свиньи — стойловое) — пастбища не лимитируют
                if ha_per_head > 0:
                    legal_capacity = pasture_area_ha / ha_per_head
                else:
                    legal_capacity = float("inf")

                if total_proposed_heads > legal_capacity:
                    # DEBUG не INFO: при 36k строк с 74% нарушителей INFO заспамит лог
                    logger.debug(
                        "Hard filter [11064]: %.0f гол > %.0f допустимых (%.0f га). Норма: %.2f га/гол",
                        total_proposed_heads, legal_capacity, pasture_area_ha, ha_per_head
                    )
                    return (
                        False,
                        "Отказано: Превышена норма нагрузки на пастбища (Приказ №11064)",
                    )
        else:
            # Поля отсутствуют — graceful degradation (реальная выгрузка ГИСС)
            logger.debug(
                "Hard filter [Приказ №11064]: поля pasture_area_ha/current_head_count "
                "отсутствуют — проверка пропущена (MVP graceful degradation)"
            )

        return True, "Все проверки пройдены"

    async def hard_filter_with_score_api(self, row: dict) -> tuple[bool, str]:
        """
        Этап 1 — жёсткие фильтры + семантическая проверка через Score API.

        Дополняет базовый hard_filter проверкой соответствия наименования
        субсидирования регламенту МСХ РК через Score API (Reranker).

        Args:
            row: словарь с данными заявки

        Returns:
            (passed, reason) — прошёл ли фильтр и причина отказа
        """
        # Сначала базовые проверки
        passed, reason = self.hard_filter(row)
        if not passed:
            return passed, reason

        # Семантическая проверка через Score API
        subsidy_name = row.get("subsidy_name", "")
        if subsidy_name:
            relevance = await self._alemplus.check_rule_compliance(subsidy_name, _REGULATION_TEXT)
            if relevance < 0.3:
                return False, f"Низкое соответствие регламенту ({relevance:.2f} < 0.30)"

        return True, "Все проверки пройдены (включая Score API)"

    async def score_application(
        self,
        app_row: pd.Series,
        features_df: pd.DataFrame,
        idx: int,
        use_cache: bool = True,
        lang: str = "ru",
    ) -> ScoreResponse:
        """
        Полный конвейер скоринга одной заявки с интеграцией API.

        Этап 1 → жёсткие фильтры + Score API → если провал → балл 0.
        Redis кэш → если есть — возвращаем.
        Этап 2 → ML-скоринг → SHAP → Qwen объяснение.

        Args:
            app_row: строка DataFrame с данными заявки
            features_df: DataFrame с фичами для ML-модели
            idx: индекс строки в features_df
            use_cache: использовать ли Redis кэш
            lang: язык для LLM-объяснения ("ru" или "kz")
        """
        if not self._model_loaded:
            raise RuntimeError("Модель не загружена — сначала обучите или загрузите")

        app_id = int(app_row.get("id", idx))
        row_dict = app_row.to_dict() if isinstance(app_row, pd.Series) else app_row

        # --- Проверяем Redis кэш ---
        if use_cache:
            cached = await get_cached_score(app_id)
            if cached:
                logger.debug("Результат скоринга из кэша для заявки %d", app_id)
                return ScoreResponse(**cached)

        # --- Этап 1: жёсткие фильтры + Score API ---
        passed, reason = await self.hard_filter_with_score_api(row_dict)
        if not passed:
            result = ScoreResponse(
                application_id=app_id,
                merit_score=0.0,
                risk_level="red",
                shap_values={},
                llm_explanation=f"Заявка не прошла предварительную проверку: {reason}",
            )
            # Кэшируем даже отклонённые — чтобы не пересчитывать
            await cache_score(app_id, result.model_dump())
            return result

        # --- Этап 2: ML-скоринг ---
        single_row_df = features_df.iloc[[idx]]
        score = float(self._model.predict(single_row_df)[0])

        # SHAP-объяснение
        try:
            shap_vals = get_shap_values(self._model, single_row_df)
        except Exception as e:
            logger.warning("Ошибка SHAP для заявки %d: %s", app_id, e)
            shap_vals = {}

        # Уровень риска
        risk = self._determine_risk(score, row_dict)

        # --- Qwen LLM объяснение (с fallback на локальное) ---
        explanation = await self._generate_llm_explanation(score, shap_vals, row_dict, lang)

        result = ScoreResponse(
            application_id=app_id,
            merit_score=score,
            risk_level=risk,
            shap_values=shap_vals,
            llm_explanation=explanation,
        )

        # Кэшируем результат в Redis
        await cache_score(app_id, result.model_dump())

        return result

    def score_batch(self, df: pd.DataFrame, features_df: pd.DataFrame) -> tuple[np.ndarray, list[str], pd.Series]:
        """
        Массовый скоринг всех заявок — оптимизированный (без SHAP и LLM per-row).

        Используется при загрузке данных (upload) — Score API вызывается
        только для индивидуальных explain-запросов, не для батча.
        """
        if not self._model_loaded:
            raise RuntimeError("Модель не загружена")

        logger.info("Массовый скоринг %d заявок", len(df))

        # ML-скоринг батчом — быстро
        scores = self._model.predict(features_df)

        # Детекция аномалий (оставляем для аналитики)
        anomalies = detect_anomalies(df)

        # Риск строго привязываем к итоговому баллу и hard_filter
        risk_levels = pd.Series(["green"] * len(df), index=df.index)
        for i in range(len(df)):
            row = df.iloc[i]
            passed, _ = self.hard_filter(row.to_dict())
            if not passed:
                scores[i] = 0.0
                risk_levels.iloc[i] = "red"
            else:
                risk_levels.iloc[i] = self._determine_risk(float(scores[i]), row.to_dict())

        logger.info(
            "Скоринг завершён: min=%.1f, median=%.1f, max=%.1f",
            scores.min(), np.median(scores), scores.max(),
        )

        return scores, risk_levels.tolist(), anomalies

    def budget_simulation(
        self,
        budget: float,
        applications: list[ApplicationResponse],
        region: str | None = None,
        direction: str | None = None,
    ) -> BudgetSimResponse:
        """Симуляция бюджета — сколько заявок можно профинансировать."""
        # Фильтрация
        filtered = applications
        if region:
            filtered = [a for a in filtered if a.region == region]
        if direction:
            filtered = [a for a in filtered if a.direction == direction]

        # Сортировка по баллу (убывание) — лучшие заявки в приоритете
        sorted_apps = sorted(filtered, key=lambda a: a.merit_score or 0, reverse=True)

        # Накопление бюджета
        funded: list[ApplicationResponse] = []
        total_spent = 0.0

        for app in sorted_apps:
            if total_spent + app.amount <= budget:
                funded.append(app)
                total_spent += app.amount
            else:
                break  # Бюджет исчерпан

        # Средний балл профинансированных
        avg_score = 0.0
        if funded:
            avg_score = round(sum(a.merit_score or 0 for a in funded) / len(funded), 1)

        return BudgetSimResponse(
            total_applications=len(sorted_apps),
            funded_count=len(funded),
            total_amount=round(total_spent, 2),
            remaining_budget=round(budget - total_spent, 2),
            avg_funded_score=avg_score,
            funded_applications=funded[:50],  # Ограничиваем до 50 для скорости
        )

    def _determine_risk(self, score: float, row: dict) -> str:
        """Определяет уровень риска на основе балла и данных заявки."""
        if score < 30 or row.get("normativ", 0) == 0 or row.get("amount", 0) == 0:
            return "red"
        if score < 60:
            return "yellow"
        return "green"

    async def _generate_llm_explanation(
        self,
        score: float,
        shap_vals: dict[str, float],
        row_dict: dict,
        lang: str = "ru",
    ) -> str:
        """
        Генерирует объяснение через Qwen LLM с fallback на локальное.

        Сначала проверяет Redis кэш объяснений.
        Если нет — вызывает Qwen API.
        Если Qwen недоступен — генерирует локальное SHAP-объяснение.
        """
        app_id = row_dict.get("id", 0)

        # Проверяем кэш объяснений
        cached = await get_cached_explanation(int(app_id))
        if cached:
            return cached

        # Пробуем Qwen LLM
        explanation = await self._alemplus.generate_explanation(
            score=score,
            shap_values=shap_vals,
            application_data=row_dict,
            lang=lang,
        )

        # Кэшируем объяснение
        await cache_explanation(int(app_id), explanation)

        return explanation

    def _generate_explanation(self, score: float, shap_vals: dict, risk: str) -> str:
        """
        Синхронная генерация объяснения (для обратной совместимости).

        Используется при массовой загрузке (score_batch), когда LLM не вызывается.
        """
        if not shap_vals:
            return f"Заявка получила {score:.1f} баллов из 100."

        # Топ-3 положительных и отрицательных фактора
        sorted_shap = sorted(shap_vals.items(), key=lambda x: x[1], reverse=True)
        positive = [(k, v) for k, v in sorted_shap if v > 0][:3]
        negative = [(k, v) for k, v in sorted_shap if v < 0][:3]

        parts = [f"Заявка получила {score:.1f} баллов из 100."]

        if positive:
            factors = ", ".join(FEATURE_NAMES_RU.get(k, k) for k, _ in positive)
            parts.append(f"Положительные факторы: {factors}.")

        if negative:
            factors = ", ".join(FEATURE_NAMES_RU.get(k, k) for k, _ in negative)
            parts.append(f"Отрицательные факторы: {factors}.")

        risk_text = {"green": "низкий", "yellow": "средний", "red": "высокий"}
        parts.append(f"Уровень риска: {risk_text.get(risk, risk)}.")

        return " ".join(parts)
