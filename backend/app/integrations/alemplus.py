"""Клиент для внешних API alem.plus — Qwen 3.5 (LLM), Score API (Reranker), Embedder."""

import json
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.laws import FEATURE_NAMES_RU

logger = logging.getLogger("_k0t1k.alemplus")


class AlemPlusClient:
    """
    Единый клиент для всех API alem.plus:
    - Qwen 3.5 — генерация текстовых объяснений
    - Score API — семантическая проверка соответствия регламенту
    - Embedder — векторизация текста (1024-dim)

    Все методы обёрнуты в try/except с graceful fallback —
    приложение продолжает работать если API недоступен.
    """

    def __init__(self) -> None:
        """Инициализация клиента с таймаутом 10 секунд."""
        self._timeout = httpx.Timeout(10.0, connect=5.0)
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Ленивая инициализация HTTP-клиента (переиспользуется)."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    async def close(self) -> None:
        """Закрытие HTTP-клиента при завершении приложения."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    # ================================================================
    # Qwen 3.5 — генерация объяснений
    # ================================================================

    async def generate_explanation(
        self,
        score: float,
        shap_values: dict[str, float],
        application_data: dict[str, Any],
        lang: str = "ru",
    ) -> str:
        """
        Генерирует текстовое объяснение скоринга через Qwen 3.5.

        Промпт строится из SHAP-значений: топ-3 положительных и отрицательных факторов.
        LLM получает роль «аналитик МСХ РК» и запрет на принятие решений.

        Args:
            score: балл заявки (0-100)
            shap_values: SHAP-значения {фича: значение}
            application_data: данные заявки (регион, сумма, направление и т.д.)
            lang: язык объяснения ("ru" или "kz")

        Returns:
            Текст объяснения (3-4 предложения) или fallback при ошибке
        """
        # Проверяем наличие API-ключа
        if not settings.LLM_API_KEY:
            logger.debug("LLM_API_KEY не задан — используем fallback объяснение")
            return self._fallback_explanation(score, shap_values)

        # Формируем топ-факторы из SHAP
        sorted_shap = sorted(shap_values.items(), key=lambda x: x[1], reverse=True)
        top_positive = [(k, v) for k, v in sorted_shap if v > 0][:3]
        top_negative = [(k, v) for k, v in sorted_shap if v < 0][:3]

        positive_text = ", ".join(f"{k} (+{v:.3f})" for k, v in top_positive) or "нет"
        negative_text = ", ".join(f"{k} ({v:.3f})" for k, v in top_negative) or "нет"

        # Контекст заявки
        region = application_data.get("region", "не указан")
        direction = application_data.get("direction", "не указано")

        # === Перевод технических имён признаков в человекочитаемые ===

        # Конвертируем SHAP → % от суммарного абсолютного влияния
        total_abs = sum(abs(v) for v in shap_values.values()) or 1.0
        shap_pct = {k: (v / total_abs * 100) for k, v in shap_values.items()}

        sorted_shap = sorted(shap_pct.items(), key=lambda x: abs(x[1]), reverse=True)

        # Строим строки с переводёнными именами + %
        shap_lines = "\n".join(
            f"  - {FEATURE_NAMES_RU.get(k, k)}: {'+' if v > 0 else ''}{v:.1f}% влияния "
            f"({'увеличил' if v > 0 else 'уменьшил'} шанс одобрения)"
            for k, v in sorted_shap[:7]
        )

        # Промпты — строгие но человекочитаемые, с цитированием законов
        # Законодательная база:
        # - Приказ №11064 (V1500011064) — нагрузка на пастбища
        # - Приказ №12488 (V1500012488) — нормы убыли скота
        # - Приказ №108 (V1900018404) — правила субсидирования
        
        legal_context_ru = (
            "\n\nЗАКОНОДАТЕЛЬНАЯ БАЗА (цитируй приказы при упоминании соответствующих факторов):\n"
            "- Площадь пастбищ, поголовье → Приказ МСХ РК №11064\n"
            "- Падёж, смертность → Приказ МСХ РК №12488\n"
            "- Норматив, сумма → Приказ МСХ РК №108"
        )
        legal_context_kz = (
            "\n\nЗАҢНАМАЛЫҚ БАЗА (сәйкес факторларды атағанда бұйрықтарға сілтеме жаса):\n"
            "- Жайылым ауданы, мал басы → ҚР АШМ №11064 бұйрығы\n"
            "- Мал өлімі, шығын → ҚР АШМ №12488 бұйрығы\n"
            "- Норматив, сома → ҚР АШМ №108 бұйрығы"
        )
        
        if lang == "kz":
            system_prompt = (
                "Сен ауыл шаруашылығы субсидияларының AI-анализаторысың. "
                "Мына пайыздық мәндерді ҚАЗАҚ ТІЛІНДЕ нақты сөйлемдерге аудар.\n"
                "\n"
                "ЕРЕЖЕЛЕР:\n"
                "1. Тек берілген деректерді пайдалан — ешнәрсе ойлап шығарма.\n"
                "2. 'мақұлдау', 'бас тарту', 'ұсынамыз' сөздерін жазба.\n"
                "3. Максимум 4-5 сөйлем. Әр сөйлем бір белгіге арналған.\n"
                "4. Факторлардың баллға әсерін табиғи тілде түсіндіріп жаз.\n"
                "5. Заң бұйрықтарына сілтеме жаса (№11064, №12488, №108).\n"
                f"\nАнализ деректері ({score:.1f}/100 балл):\n{shap_lines}\n"
                f"Аймақ: {region}, Бағыт: {direction}."
                f"{legal_context_kz}"
            )
            user_content = f"Өтінім #{application_data.get('application_number', 'N/A')}, балл: {score:.1f}/100. AI-анализды заң сілтемелерімен жаз."
        else:
            system_prompt = (
                "Ты — AI-аналитик субсидий Министерства сельского хозяйства РК. "
                "Объясни результат скоринга простыми словами, опираясь строго на данные ниже.\n"
                "\n"
                "ПРАВИЛА:\n"
                "1. Используй только предоставленные данные — никакого домысливания.\n"
                "2. Запрещено: 'одобрить', 'отклонить', 'рекомендуем', 'вероятно'.\n"
                "3. Напиши 4-5 коротких предложений. Каждое — об одном факторе.\n"
                "4. Опиши влияние факторов естественным языком, объясняя как они увеличили или уменьшили итоговый балл.\n"
                "5. Ссылайся на законодательные акты (Приказы №11064, №12488, №108) где уместно.\n"
                "6. В конце — одно итоговое предложение с баллом.\n"
                f"\nДанные анализа (итог: {score:.1f}/100 баллов):\n{shap_lines}\n"
                f"Регион: {region}, Направление субсидии: {direction}."
                f"{legal_context_ru}"
            )
            user_content = f"Заявка #{application_data.get('application_number', 'N/A')}, балл: {score:.1f}/100. Напиши AI-анализ с цитированием законов."


        try:
            client = await self._get_client()
            response = await client.post(
                f"{settings.LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.LLM_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    "max_tokens": 1000,
                    "temperature": 0.3,
                    # Qwen 3 — reasoning модель, отключаем цепочку рассуждений
                    # чтобы ответ был в content, а не в reasoning_content
                    "chat_template_kwargs": {"enable_thinking": False},
                },
            )
            response.raise_for_status()
            data = response.json()

            # Парсим ответ OpenAI-совместимого API
            # Qwen 3 может вернуть content=null, а текст в reasoning_content
            message = data["choices"][0]["message"]
            content = message.get("content") or message.get("reasoning_content") or ""
            if not content.strip():
                logger.warning("Qwen вернул пустой ответ — используем fallback")
                return self._fallback_explanation(score, shap_values)
            logger.info("Qwen объяснение сгенерировано для заявки %s", application_data.get("application_number"))
            return content.strip()

        except httpx.TimeoutException:
            logger.warning("Qwen API таймаут (10s) — используем fallback")
            return self._fallback_explanation(score, shap_values)
        except httpx.HTTPStatusError as e:
            logger.warning("Qwen API HTTP ошибка %d: %s", e.response.status_code, e.response.text[:200])
            return self._fallback_explanation(score, shap_values)
        except Exception as e:
            logger.warning("Qwen API неизвестная ошибка: %s", e)
            return self._fallback_explanation(score, shap_values)

    # ================================================================
    # Qwen 3.5 — стриминг объяснений (SSE)
    # ================================================================

    async def stream_explanation(
        self,
        score: float,
        shap_values: dict[str, float],
        application_data: dict[str, Any],
        lang: str = "ru",
    ):
        """
        Стриминг текстового объяснения через Qwen 3.5 (Server-Sent Events).

        Возвращает async-генератор чанков текста для SSE.
        При ошибке — yield fallback целиком.
        """
        if not settings.LLM_API_KEY:
            yield self._fallback_explanation(score, shap_values)
            return

        region = application_data.get("region", "не указан")
        direction = application_data.get("direction", "не указано")

        # Словарь перевода — single source of truth из laws.py

        total_abs = sum(abs(v) for v in shap_values.values()) or 1.0
        shap_pct = {k: (v / total_abs * 100) for k, v in shap_values.items()}
        sorted_shap = sorted(shap_pct.items(), key=lambda x: abs(x[1]), reverse=True)

        shap_lines = "\n".join(
            f"  - {FEATURE_NAMES_RU.get(k, k)}: {'+' if v > 0 else ''}{v:.1f}% влияния "
            f"({'увеличил' if v > 0 else 'уменьшил'} шанс одобрения)"
            for k, v in sorted_shap[:7]
        )


        # Строгий anti-hallucination промпт с цитированием законов
        # Законодательная база:
        # - Приказ №11064 (V1500011064) — нагрузка на пастбища (га/голова)
        # - Приказ №12488 (V1500012488) — нормы естественной убыли скота (падёж %)
        # - Приказ №108 (V1900018404) — правила субсидирования
        
        legal_context_ru = (
            "\n\nЗАКОНОДАТЕЛЬНАЯ БАЗА (обязательно цитируй при упоминании соответствующих факторов):\n"
            "- Площадь пастбищ, поголовье → Приказ МСХ РК №11064 (нагрузка на пастбища: КРС 6 га/гол, лошади 12 га/гол, МРС 1.5 га/гол)\n"
            "- Падёж, смертность скота → Приказ МСХ РК №12488 (нормы убыли: КРС ≤2.5%, лошади ≤3%, МРС ≤5%, свиньи ≤12.5%)\n"
            "- Норматив, сумма субсидии → Приказ МСХ РК №108 (правила субсидирования племенного животноводства)\n"
            "В конце объяснения добавь раздел «📜 Правовое основание:» с перечислением релевантных приказов."
        )
        
        legal_context_kz = (
            "\n\nЗАҢНАМАЛЫҚ БАЗА (сәйкес факторларды атағанда міндетті түрде дәйексөз келтір):\n"
            "- Жайылым ауданы, мал басы → ҚР АШМ №11064 бұйрығы (жайылымға жүктеме: ІРҚ 6 га/бас, жылқы 12 га/бас, ҰРҚ 1.5 га/бас)\n"
            "- Мал өлімі, шығын → ҚР АШМ №12488 бұйрығы (шығын нормалары: ІРҚ ≤2.5%, жылқы ≤3%, ҰРҚ ≤5%, шошқа ≤12.5%)\n"
            "- Норматив, субсидия сомасы → ҚР АШМ №108 бұйрығы (асыл тұқымды мал шаруашылығын субсидиялау ережелері)\n"
            "Түсіндірменің соңында «📜 Құқықтық негіз:» бөлімін қос, онда қатысты бұйрықтарды тізімде."
        )
        
        if lang == "kz":
            system_prompt = (
                "Сен математикалық аудармашысың. Тек SHAP сандарын қазақ тіліндегі қарапайым сөйлемдерге аударасың.\n"
                "\n"
                "ҚАТАҢ ЕРЕЖЕЛЕР:\n"
                "1. ТЫЙЫМ: ұсыныстар, кеңестер, бағалау пікірлері жазуға болмайды.\n"
                "2. ТЫЙЫМ: 'мүмкін', 'ұсынамыз', 'мақұлдау', 'бас тарту' сөздерін қолдануға болмайды.\n"
                "3. ТЫЙЫМ: берілген SHAP деректерінен тыс қорытынды жасауға болмайды.\n"
                "4. Факторлардың баллға әсерін табиғи тілде түсіндіріп жаз.\n"
                "5. Максимум 5 сөйлем — үздік белгілер бойынша.\n"
                "6. Заң бұйрықтарын сілтеме ретінде қолдан (№11064, №12488, №108).\n"
                f"\nSHAP деректері (тек осы мәндерді пайдалануға рұқсат):\n{shap_lines}\n"
                f"Жалпы балл: {score:.1f}/100."
                f"{legal_context_kz}"
            )
            user_content = f"Өтінім #{application_data.get('application_number', 'N/A')}, балл: {score:.1f}/100. SHAP аудармасын жаз, заң сілтемелерімен."
        else:
            system_prompt = (
                "Ты — математический транслятор. Твоя единственная задача — перевести числа SHAP в простые русские предложения.\n"
                "\n"
                "СТРОГИЕ ПРАВИЛА:\n"
                "1. ЗАПРЕЩЕНО делать выводы, советы, рекомендации или оценочные суждения.\n"
                "2. ЗАПРЕЩЕНО использовать слова: 'вероятно', 'возможно', 'следует', 'рекомендуем', 'одобрить', 'отклонить'.\n"
                "3. ЗАПРЕЩЕНО выходить за рамки предоставленных SHAP-данных.\n"
                "4. Опиши влияние факторов естественным языком, объясняя как они увеличили или уменьшили итоговый балл.\n"
                "5. Максимум 5 предложений — по одному на каждый признак из топа.\n"
                "6. Ссылайся на законодательные акты (Приказы №11064, №12488, №108) где уместно.\n"
                f"\nДанные SHAP (только эти значения разрешено использовать):\n{shap_lines}\n"
                f"Итоговая оценка: {score:.1f}/100."
                f"{legal_context_ru}"
            )
            user_content = f"Заявка #{application_data.get('application_number', 'N/A')}, балл: {score:.1f}/100. Напишите SHAP-перевод с цитированием законов."


        try:
            # Стриминг-запрос к Qwen (OpenAI-совместимый stream=true)
            stream_timeout = httpx.Timeout(30.0, connect=5.0)
            async with httpx.AsyncClient(timeout=stream_timeout) as client:
                async with client.stream(
                    "POST",
                    f"{settings.LLM_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.LLM_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.LLM_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_content},
                        ],
                        "max_tokens": 1000,
                        "temperature": 0.3,
                        "stream": True,
                        "chat_template_kwargs": {"enable_thinking": False},
                    },
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        payload = line[6:]
                        if payload.strip() == "[DONE]":
                            break
                        try:
                            import json as _json
                            chunk = _json.loads(payload)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content") or delta.get("reasoning_content") or ""
                            if content:
                                yield content
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue

        except Exception as e:
            logger.warning("Qwen stream ошибка: %s — используем fallback", e)
            yield self._fallback_explanation(score, shap_values)

    # ================================================================
    # Score API — семантическая проверка соответствия регламенту
    # ================================================================

    async def check_rule_compliance(self, subsidy_text: str, rule_text: str) -> float:
        """
        Проверяет семантическое соответствие текста заявки регламенту МСХ РК.

        Используется как жёсткий фильтр Этапа 1:
        - score > 0.3 → заявка соответствует
        - score <= 0.3 → заявка не проходит

        Args:
            subsidy_text: текст наименования субсидирования
            rule_text: текст критерия из регламента

        Returns:
            Оценка релевантности (0.0-1.0), при ошибке — 0.5 (нейтральная, не блокирует)
        """
        # Проверяем наличие API-ключа
        if not settings.SCORE_API_KEY:
            logger.debug("SCORE_API_KEY не задан — возвращаем нейтральную оценку 0.5")
            return 0.5

        try:
            client = await self._get_client()
            response = await client.post(
                f"{settings.SCORE_API_URL}/score",
                headers={
                    "Authorization": f"Bearer {settings.SCORE_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "text_1": subsidy_text,
                    "text_2": rule_text,
                },
            )
            response.raise_for_status()
            data = response.json()

            # Score API возвращает score в разных форматах — обрабатываем оба
            relevance = data.get("score", data.get("similarity", 0.5))
            relevance = float(relevance)

            logger.debug("Score API: '%s' vs правило → %.3f", subsidy_text[:50], relevance)
            return relevance

        except httpx.TimeoutException:
            logger.warning("Score API таймаут (10s) — возвращаем нейтральную оценку 0.5")
            return 0.5
        except httpx.HTTPStatusError as e:
            logger.warning("Score API HTTP ошибка %d: %s", e.response.status_code, e.response.text[:200])
            return 0.5
        except Exception as e:
            logger.warning("Score API неизвестная ошибка: %s", e)
            return 0.5

    # ================================================================
    # Embedder — векторизация текста
    # ================================================================

    async def get_embedding(self, text: str) -> list[float]:
        """
        Получает эмбеддинг текста (1024-dim вектор) через Embedder API.

        Используется для ML-фичей: семантическое представление наименования субсидирования.

        Args:
            text: текст для векторизации

        Returns:
            Список из 1024 float-значений, при ошибке — нулевой вектор
        """
        zero_vector = [0.0] * 1024

        # Проверяем наличие API-ключа
        if not settings.EMBEDDER_API_KEY:
            logger.debug("EMBEDDER_API_KEY не задан — возвращаем нулевой вектор")
            return zero_vector

        try:
            client = await self._get_client()
            response = await client.post(
                f"{settings.EMBEDDER_URL}/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.EMBEDDER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.EMBEDDER_MODEL,
                    "input": text,
                },
            )
            response.raise_for_status()
            data = response.json()

            # OpenAI-совместимый формат: data[0].embedding
            embedding = data["data"][0]["embedding"]

            if len(embedding) != 1024:
                logger.warning("Embedder вернул вектор размера %d вместо 1024", len(embedding))

            logger.debug("Embedder: получен вектор для '%s' (dim=%d)", text[:50], len(embedding))
            return embedding

        except httpx.TimeoutException:
            logger.warning("Embedder API таймаут (10s) — возвращаем нулевой вектор")
            return zero_vector
        except httpx.HTTPStatusError as e:
            logger.warning("Embedder API HTTP ошибка %d: %s", e.response.status_code, e.response.text[:200])
            return zero_vector
        except Exception as e:
            logger.warning("Embedder API неизвестная ошибка: %s", e)
            return zero_vector

    # ================================================================
    # Fallback объяснение (без LLM)
    # ================================================================

    @staticmethod
    def _fallback_explanation(score: float, shap_values: dict[str, float]) -> str:
        """Генерирует базовое объяснение без LLM — на основе SHAP-значений."""
        # Маппинг имён признаков на русский
        names_ru = FEATURE_NAMES_RU

        if not shap_values:
            return f"Детальный анализ временно недоступен. Оценка: {score:.1f}/100."

        sorted_shap = sorted(shap_values.items(), key=lambda x: x[1], reverse=True)
        positive = [(k, v) for k, v in sorted_shap if v > 0][:3]
        negative = [(k, v) for k, v in sorted_shap if v < 0][:3]

        parts = [f"Заявка получила {score:.1f} баллов из 100."]

        if positive:
            factors = ", ".join(names_ru.get(k, k) for k, _ in positive)
            parts.append(f"Положительные факторы: {factors}.")

        if negative:
            factors = ", ".join(names_ru.get(k, k) for k, _ in negative)
            parts.append(f"Факторы снижения: {factors}.")

        return " ".join(parts)

    # ================================================================
    # AI-ассистент для граждан — ответы на вопросы о субсидиях
    # ================================================================

    async def chat_response(
        self,
        message: str,
        history: list[dict[str, str]] | None = None,
        lang: str = "ru",
    ) -> str:
        """
        AI-ассистент для граждан — отвечает на вопросы о субсидиях.

        Args:
            message: вопрос пользователя
            history: история диалога [{role: "user"/"assistant", content: "..."}]
            lang: язык ответа ("ru" или "kz")

        Returns:
            Ответ от Qwen или fallback при ошибке
        """
        if not settings.LLM_API_KEY:
            logger.debug("LLM_API_KEY не задан — используем fallback ответ")
            return self._fallback_chat_response(message, lang)

        # Системный промпт для AI-ассистента
        if lang == "kz":
            system_prompt = """Сен ҚР Ауыл шаруашылығы министрлігінің субсидиялар бойынша AI-көмекшісісің.

Сенің рөлің:
- Фермерлерге субсидия алу туралы ҚАЗАҚ ТІЛІНДЕ түсінікті сұрақтарға жауап беру
- Қажетті құжаттар туралы түсіндіру
- Өтінім беру процесін түсіндіру
- Merit-скоринг жүйесі туралы түсіндіру

Негізгі ақпарат:
- Субсидиялар ендігі "Кім бірінші — соның" принципімен емес, Merit-скоринг арқылы таратылады
- Merit-скоринг шаруашылықтың тиімділігін бағалайды (мал басы, өнімділік, жабдықтар)
- AI тек ұсыныс береді, түпкілікті шешімді комиссия қабылдайды
- Өтінім subsidy.plem.kz порталы арқылы беріледі

Жауапты 2-4 сөйлеммен бер. Сыпайы және қол жетімді бол."""
        else:
            system_prompt = """Ты AI-ассистент Министерства сельского хозяйства РК по вопросам субсидий.

Твоя роль:
- Отвечать на вопросы фермеров о получении субсидий простым языком
- Объяснять какие документы нужны
- Объяснять процесс подачи заявки
- Рассказывать о системе Merit-скоринга

Ключевая информация:
- Субсидии теперь распределяются НЕ по принципу «кто первый подал», а по Merit-скорингу
- Merit-скоринг оценивает эффективность хозяйства (поголовье, продуктивность, оборудование)
- AI только даёт рекомендации, финальное решение принимает комиссия
- Заявка подаётся через портал subsidy.plem.kz

Отвечай в 2-4 предложениях. Будь вежливым и доступным."""

        # Формируем сообщения для LLM
        messages = [{"role": "system", "content": system_prompt}]

        # Добавляем историю диалога (последние 10 сообщений)
        if history:
            for msg in history[-10:]:
                messages.append({"role": msg["role"], "content": msg["content"]})

        # Текущий вопрос
        messages.append({"role": "user", "content": message})

        try:
            client = await self._get_client()
            response = await client.post(
                f"{settings.LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.LLM_MODEL,
                    "messages": messages,
                    "max_tokens": 500,
                    "temperature": 0.5,
                    "chat_template_kwargs": {"enable_thinking": False},
                },
            )
            response.raise_for_status()
            data = response.json()

            message_content = data["choices"][0]["message"]
            content = message_content.get("content") or message_content.get("reasoning_content") or ""
            if not content.strip():
                logger.warning("Qwen вернул пустой ответ для чата — используем fallback")
                return self._fallback_chat_response(message, lang)

            logger.info("AI-ассистент ответил на вопрос: '%s'", message[:50])
            return content.strip()

        except httpx.TimeoutException:
            logger.warning("Qwen API таймаут (10s) для чата — используем fallback")
            return self._fallback_chat_response(message, lang)
        except httpx.HTTPStatusError as e:
            logger.warning("Qwen API HTTP ошибка %d: %s", e.response.status_code, e.response.text[:200])
            return self._fallback_chat_response(message, lang)
        except Exception as e:
            logger.warning("Qwen API неизвестная ошибка для чата: %s", e)
            return self._fallback_chat_response(message, lang)

    async def stream_chat_response(
        self,
        message: str,
        history: list[dict[str, str]] | None = None,
        lang: str = "ru",
    ):
        """
        Стриминг ответа AI-ассистента через SSE.

        Yields:
            Чанки текста ответа
        """
        if not settings.LLM_API_KEY:
            yield self._fallback_chat_response(message, lang)
            return

        # Системный промпт (копия из chat_response)
        if lang == "kz":
            system_prompt = """Сен ҚР Ауыл шаруашылығы министрлігінің субсидиялар бойынша AI-көмекшісісің.
Сенің рөлің:
- Фермерлерге субсидия алу туралы ҚАЗАҚ ТІЛІНДЕ түсінікті сұрақтарға жауап беру
- Қажетті құжаттар туралы түсіндіру
- Өтінім беру процесін түсіндіру
- Merit-скоринг жүйесі туралы түсіндіру
Жауапты 2-4 сөйлеммен бер. Сыпайы және қол жетімді бол."""
        else:
            system_prompt = """Ты AI-ассистент Министерства сельского хозяйства РК по вопросам субсидий.
Твоя роль:
- Отвечать на вопросы фермеров о получении субсидий простым языком
- Объяснять какие документы нужны
- Объяснять процесс подачи заявки
- Рассказывать о системе Merit-скоринга
Отвечай в 2-4 предложениях. Будь вежливым и доступным."""

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for msg in history[-10:]:
                messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": message})

        try:
            client = await self._get_client()
            async with client.stream(
                "POST",
                f"{settings.LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.LLM_MODEL,
                    "messages": messages,
                    "max_tokens": 500,
                    "temperature": 0.5,
                    "stream": True,
                    "chat_template_kwargs": {"enable_thinking": False},
                },
                timeout=30.0,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload.strip() == "[DONE]":
                        break
                    try:
                        import json
                        chunk = json.loads(payload)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content") or delta.get("reasoning_content") or ""
                        if content:
                            yield content
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

        except Exception as e:
            logger.warning("Qwen chat stream ошибка: %s — используем fallback", e)
            yield self._fallback_chat_response(message, lang)

    @staticmethod
    def _fallback_chat_response(message: str, lang: str = "ru") -> str:
        """Fallback-ответ когда LLM недоступен."""
        message_lower = message.lower()

        # Простые паттерны для частых вопросов
        if lang == "kz":
            if any(w in message_lower for w in ["құжат", "керек", "қажет"]):
                return "Субсидия алу үшін: 1) ЖСН/БСН, 2) Жер учаскесі құжаттары, 3) Мал санағы анықтамасы қажет. Толық тізімді subsidy.plem.kz порталынан қараңыз."
            if any(w in message_lower for w in ["merit", "балл", "скоринг"]):
                return "Merit-скоринг — шаруашылықтың тиімділігін бағалайтын жүйе. Мал басы көп болған сайын, өнімділік жоғары болған сайын — балл жоғары. AI тек ұсыныс береді, шешімді комиссия қабылдайды."
            if any(w in message_lower for w in ["өтінім", "беру", "қалай"]):
                return "Өтінім subsidy.plem.kz порталы арқылы беріледі. ЭЦҚ арқылы кіріп, «Жаңа өтінім» батырмасын басыңыз. Барлық өрістерді толтырып, құжаттарды тіркеңіз."
            return "Мен субсидиялар бойынша сұрақтарға жауап беремін. Құжаттар, өтінім беру немесе Merit-скоринг туралы сұрақтарыңыз болса, сұраңыз!"
        else:
            if any(w in message_lower for w in ["документ", "нужн", "треб"]):
                return "Для получения субсидии нужны: 1) ИИН/БИН, 2) Документы на землю, 3) Справка о поголовье скота. Полный список на портале subsidy.plem.kz."
            if any(w in message_lower for w in ["merit", "балл", "скоринг"]):
                return "Merit-скоринг — система оценки эффективности хозяйства. Чем больше поголовье и выше продуктивность — тем выше балл. AI только даёт рекомендации, решение принимает комиссия."
            if any(w in message_lower for w in ["заявк", "подать", "как"]):
                return "Заявка подаётся через портал subsidy.plem.kz. Войдите через ЭЦП, нажмите «Новая заявка», заполните все поля и прикрепите документы."
            return "Я помогаю с вопросами о субсидиях. Спросите о документах, подаче заявки или системе Merit-скоринга!"

    # ================================================================
    # Qwen 3.5 — генерация публичного отчёта для СМИ (Task 5)
    # ================================================================

    async def generate_transparency_report(
        self,
        stats: dict[str, Any],
        lang: str = "ru",
    ) -> str:
        """
        Генерирует публичный пресс-релиз на основе агрегированной статистики платформы.

        Args:
            stats: агрегированные данные (total, avg_score, funded, top_regions и т.д.)
            lang: язык отчёта ("ru" или "kz")

        Returns:
            Текст пресс-релиза или fallback при ошибке
        """
        if not settings.LLM_API_KEY:
            return self._fallback_transparency_report(stats, lang)

        total = stats.get("total_applications", 0)
        avg_score = stats.get("avg_score", 0)
        green_pct = stats.get("green_pct", 0)
        red_pct = stats.get("red_pct", 0)
        top_regions = stats.get("top_regions", [])
        top_directions = stats.get("top_directions", [])
        total_budget = stats.get("total_budget_requested", 0)

        regions_str = ", ".join(r["region"] for r in top_regions[:3]) if top_regions else "не указано"
        directions_str = ", ".join(d["direction"] for d in top_directions[:3]) if top_directions else "не указано"
        budget_bln = round(total_budget / 1_000_000_000, 2)

        if lang == "kz":
            system_prompt = (
                "Сен ҚР Ауыл шаруашылығы министрлігінің баспасөз хатшысысың. "
                "Берілген деректер негізінде ҚАЗАҚ ТІЛІНДЕ ресми баспасөз мәлімдемесін жаз. "
                "Тон: ресми, оптимистік, фактілерге негізделген. "
                "Ұзындығы: 4-6 абзац. Нақты сандарды пайдалан."
            )
            user_content = (
                f"Субсидиялар платформасының есебі:\n"
                f"- Жалпы өтінімдер: {total:,}\n"
                f"- Орташа Merit-балл: {avg_score:.1f}/100\n"
                f"- Төмен тәуекелді өтінімдер: {green_pct:.1f}%\n"
                f"- Жоғары тәуекелді өтінімдер: {red_pct:.1f}%\n"
                f"- Жетекші өңірлер: {regions_str}\n"
                f"- Жетекші бағыттар: {directions_str}\n"
                f"- Жалпы сұралған бюджет: {budget_bln} млрд теңге\n\n"
                "Осы деректер негізінде ресми баспасөз мәлімдемесін жаз."
            )
        else:
            system_prompt = (
                "Ты — пресс-секретарь Министерства сельского хозяйства РК. "
                "На основе предоставленных данных напиши официальный пресс-релиз. "
                "Тон: официальный, оптимистичный, основанный на фактах. "
                "Длина: 4-6 абзацев. Используй конкретные цифры."
            )
            user_content = (
                f"Отчёт платформы субсидирования:\n"
                f"- Всего заявок: {total:,}\n"
                f"- Средний Merit-балл: {avg_score:.1f}/100\n"
                f"- Заявки низкого риска: {green_pct:.1f}%\n"
                f"- Аномальные заявки: {red_pct:.1f}%\n"
                f"- Топ регионы: {regions_str}\n"
                f"- Топ направления: {directions_str}\n"
                f"- Общий запрошенный бюджет: {budget_bln} млрд тенге\n\n"
                "На основе этих данных напиши официальный пресс-релиз."
            )

        try:
            client = await self._get_client()
            response = await client.post(
                f"{settings.LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.LLM_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    "max_tokens": 1200,
                    "temperature": 0.4,
                    "chat_template_kwargs": {"enable_thinking": False},
                },
                timeout=20.0,
            )
            response.raise_for_status()
            data = response.json()
            message = data["choices"][0]["message"]
            content = message.get("content") or message.get("reasoning_content") or ""
            if not content.strip():
                return self._fallback_transparency_report(stats, lang)
            logger.info("Transparency report сгенерирован, lang=%s", lang)
            return content.strip()
        except Exception as e:
            logger.warning("Qwen transparency report ошибка: %s", e)
            return self._fallback_transparency_report(stats, lang)

    @staticmethod
    def _fallback_transparency_report(stats: dict[str, Any], lang: str = "ru") -> str:
        """Fallback пресс-релиз когда LLM недоступен."""
        total = stats.get("total_applications", 0)
        avg_score = stats.get("avg_score", 0)
        green_pct = stats.get("green_pct", 0)
        if lang == "kz":
            return (
                f"БАСПАСӨЗ МӘЛІМДЕМЕСІ\n\n"
                f"ҚР Ауыл шаруашылығы министрлігі субсидиялар берудің ашықтығын қамтамасыз ету мақсатында "
                f"_k0t1k AI-платформасының нәтижелерін жариялайды.\n\n"
                f"Жалпы {total:,} өтінім Merit-скоринг жүйесі арқылы бағаланды. "
                f"Орташа балл — {avg_score:.1f}/100. "
                f"Өтінімдердің {green_pct:.1f}%-ы төмен тәуекел санатына жатады.\n\n"
                f"AI жүйесі шешім қабылдамайды — барлық шешімдерді комиссия бекітеді."
            )
        return (
            f"ПРЕСС-РЕЛИЗ\n\n"
            f"Министерство сельского хозяйства РК публикует результаты работы платформы субсидирования "
            f"_k0t1k для обеспечения прозрачности распределения государственных средств.\n\n"
            f"Всего оценено {total:,} заявок через систему Merit-скоринга. "
            f"Средний балл составил {avg_score:.1f}/100. "
            f"{green_pct:.1f}% заявок отнесены к категории низкого риска.\n\n"
            f"AI-система не принимает решений — все решения утверждаются комиссией."
        )
