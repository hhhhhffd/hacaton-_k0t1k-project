"""Точка входа FastAPI-приложения _k0t1k Project."""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.admin_router import router as admin_router
from app.api.auth_router import router as auth_router
from app.api.endpoints import router
from app.core.config import settings
from app.services.scoring_service import ScoringService

# Rate limiter — по IP-адресу клиента
limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger("_k0t1k")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Жизненный цикл приложения — инициализация и завершение."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )
    logger.info("_k0t1k backend started (v0.3.0 — ScoringService refactor)")

    # --- Создаём и инициализируем ScoringService ---
    scoring_service = ScoringService()
    app.state.scoring_service = scoring_service

    # --- Проверяем подключение к PostgreSQL и запускаем миграции ---
    try:
        from app.db.session import engine
        from sqlalchemy import text

        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("PostgreSQL — OK")

        # Применяем Alembic миграции (через subprocess — избегаем конфликт event loop)
        import subprocess
        result = subprocess.run(
            ["python", "-m", "alembic", "upgrade", "head"],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            logger.info("Alembic миграции применены (upgrade head)")
        else:
            logger.warning("Alembic миграции — ошибка: %s", result.stderr[:500])
    except Exception as e:
        logger.warning("PostgreSQL / миграции недоступны: %s (продолжаем без БД)", e)

    # --- Проверяем подключение к Redis ---
    try:
        from app.core.redis import get_redis
        r = await get_redis()
        if r:
            logger.info("Redis — OK (кэширование включено)")
        else:
            logger.info("Redis — не настроен (работаем без кэша)")
    except Exception as e:
        logger.warning("Redis недоступен: %s (работаем без кэша)", e)

    # --- Проверяем наличие API-ключей alem.plus ---
    if settings.LLM_API_KEY:
        logger.info("Qwen 3.5 API — ключ задан")
    else:
        logger.info("Qwen 3.5 API — ключ НЕ задан (объяснения на основе SHAP)")

    if settings.SCORE_API_KEY:
        logger.info("Score API — ключ задан")
    else:
        logger.info("Score API — ключ НЕ задан (семантическая проверка отключена)")

    if settings.EMBEDDER_API_KEY:
        logger.info("Embedder API — ключ задан")
    else:
        logger.info("Embedder API — ключ НЕ задан (эмбеддинги отключены)")

    # --- Инициализируем ScoringService (загрузка модели и кэша) ---
    try:
        await scoring_service.initialize()
    except Exception as e:
        logger.warning("Ошибка инициализации ScoringService: %s", e)

    yield

    # --- Завершение: закрываем соединения ---
    logger.info("Завершение работы — закрываем соединения...")

    # Закрываем ScoringService (включая alem.plus клиент)
    try:
        await scoring_service.close()
    except Exception as e:
        logger.warning("Ошибка при закрытии ScoringService: %s", e)

    # Закрываем Redis
    try:
        from app.core.redis import close_redis
        await close_redis()
    except Exception as e:
        logger.warning("Ошибка при закрытии Redis: %s", e)

    logger.info("_k0t1k backend stopped")


app = FastAPI(
    title="_k0t1k Project — AI Scoring Platform",
    description="Меритократический скоринг заявок на сельскохозяйственные субсидии",
    version="0.3.0",
    lifespan=lifespan,
)

# Rate limiting — ограничение частоты запросов
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — разрешаем запросы от фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Логирование всех HTTP-запросов с временем выполнения."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start

    # Логируем только не-health запросы чтобы не спамить
    if request.url.path != "/api/health":
        logger.info(
            "%s %s → %d (%.2fs)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed,
        )

    return response


# Подключение роутеров
app.include_router(router, prefix="/api", tags=["api"])
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(admin_router, prefix="/api", tags=["admin"])
