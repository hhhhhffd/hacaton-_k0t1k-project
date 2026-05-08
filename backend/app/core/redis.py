"""Redis-клиент — кэширование результатов скоринга и объяснений."""

import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger("_k0t1k.redis")

# Глобальный пул подключений Redis
_redis_pool: aioredis.Redis | None = None

# TTL кэша в секундах (1 час)
CACHE_TTL = 3600


async def get_redis() -> aioredis.Redis | None:
    """
    Возвращает клиент Redis (ленивая инициализация).

    Если Redis недоступен — возвращает None (приложение работает без кэша).
    """
    global _redis_pool

    if _redis_pool is not None:
        return _redis_pool

    if not settings.REDIS_URL:
        logger.debug("REDIS_URL не настроен — кэширование отключено")
        return None

    try:
        _redis_pool = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=True,
        )
        # Проверяем подключение
        await _redis_pool.ping()
        logger.info("Redis подключён: %s", settings.REDIS_URL[:30] + "...")
        return _redis_pool
    except Exception as e:
        logger.warning("Redis недоступен: %s (работаем без кэша)", e)
        _redis_pool = None
        return None


async def close_redis() -> None:
    """Закрытие соединения с Redis при завершении приложения."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None
        logger.info("Redis соединение закрыто")


# ================================================================
# Функции кэширования результатов скоринга
# ================================================================

async def cache_score(application_id: int, data: dict[str, Any], lang: str = "ru") -> bool:
    """
    Сохраняет результат скоринга в Redis.

    Ключ: score:{application_id}:{lang}
    Значение: JSON с merit_score, risk_level, shap_values, llm_explanation
    TTL: 3600 секунд (1 час)

    Args:
        application_id: ID заявки в БД
        data: словарь с результатами скоринга
        lang: язык объяснения (ru/kz)

    Returns:
        True если сохранено, False если Redis недоступен
    """
    r = await get_redis()
    if r is None:
        return False

    try:
        key = f"score:{application_id}:{lang}"
        await r.setex(key, CACHE_TTL, json.dumps(data, ensure_ascii=False, default=str))
        logger.debug("Кэш записан: %s", key)
        return True
    except Exception as e:
        logger.warning("Ошибка записи в Redis кэш: %s", e)
        return False


async def get_cached_score(application_id: int, lang: str = "ru") -> dict[str, Any] | None:
    """
    Получает кэшированный результат скоринга из Redis.

    Args:
        application_id: ID заявки в БД
        lang: язык объяснения (ru/kz)

    Returns:
        Словарь с результатами или None если не найдено / Redis недоступен
    """
    r = await get_redis()
    if r is None:
        return None

    try:
        key = f"score:{application_id}:{lang}"
        raw = await r.get(key)
        if raw is None:
            return None

        data = json.loads(raw)
        logger.debug("Кэш найден: %s", key)
        return data
    except Exception as e:
        logger.warning("Ошибка чтения из Redis кэша: %s", e)
        return None


async def cache_explanation(application_id: int, explanation: str, lang: str = "ru") -> bool:
    """
    Кэширует LLM-объяснение отдельно (для быстрого доступа).

    Ключ: explain:{application_id}:{lang}
    TTL: 3600 секунд
    """
    r = await get_redis()
    if r is None:
        return False

    try:
        key = f"explain:{application_id}:{lang}"
        await r.setex(key, CACHE_TTL, explanation)
        logger.debug("Кэш объяснения записан: %s", key)
        return True
    except Exception as e:
        logger.warning("Ошибка записи объяснения в Redis: %s", e)
        return False


async def get_cached_explanation(application_id: int, lang: str = "ru") -> str | None:
    """Получает кэшированное LLM-объяснение."""
    r = await get_redis()
    if r is None:
        return None

    try:
        key = f"explain:{application_id}:{lang}"
        return await r.get(key)
    except Exception as e:
        logger.warning("Ошибка чтения объяснения из Redis: %s", e)
        return None


async def invalidate_all_scores() -> int:
    """
    Удаляет все кэшированные результаты скоринга.

    Вызывается при перезагрузке данных (upload).

    Returns:
        Количество удалённых ключей, 0 если Redis недоступен
    """
    r = await get_redis()
    if r is None:
        return 0

    try:
        deleted = 0
        # Удаляем ключи score:* и explain:*
        async for key in r.scan_iter(match="score:*", count=1000):
            await r.delete(key)
            deleted += 1
        async for key in r.scan_iter(match="explain:*", count=1000):
            await r.delete(key)
            deleted += 1

        logger.info("Инвалидировано %d ключей кэша", deleted)
        return deleted
    except Exception as e:
        logger.warning("Ошибка инвалидации Redis кэша: %s", e)
        return 0
