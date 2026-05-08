"""Конфигурация приложения — загрузка переменных окружения через Pydantic BaseSettings."""

import secrets
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Все настройки загружаются из .env файла или переменных окружения."""

    # --- База данных ---
    DATABASE_URL: str = "postgresql+asyncpg://k0t1k:k0t1k_local@localhost:5432/k0t1k"

    # --- Кэш ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- LLM API (Qwen 3.5 через alem.plus) ---
    LLM_BASE_URL: str = "https://llm.alem.ai/v1"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "qwen3"

    # --- Embedder API (text-1024 через alem.plus) ---
    EMBEDDER_URL: str = "https://llm.alem.ai/v1"
    EMBEDDER_API_KEY: str = ""
    EMBEDDER_MODEL: str = "text-1024"

    # --- Score API / Reranker (alem.plus) ---
    SCORE_API_URL: str = "https://reranker-llm.alem.ai/v1"
    SCORE_API_KEY: str = ""

    # --- Auth ---
    # Генерируется рандомный ключ если не задан в .env (безопасный дефолт)
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 часа
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # --- PostgreSQL credentials (используются docker-compose) ---
    POSTGRES_DB: str = "k0t1k"
    POSTGRES_USER: str = "k0t1k"
    POSTGRES_PASSWORD: str = "k0t1k_local"

    # --- CORS ---
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # --- Cloudflare Tunnel ---
    CLOUDFLARE_TUNNEL_TOKEN: str = ""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Если JWT_SECRET_KEY не задан — генерируем безопасный рандомный ключ
        # (каждый перезапуск = новый ключ → старые токены инвалидируются)
        if not self.JWT_SECRET_KEY:
            object.__setattr__(self, "JWT_SECRET_KEY", secrets.token_urlsafe(64))

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Ленивый синглтон настроек — создаётся при первом вызове."""
    return Settings()


# Для обратной совместимости — прямой доступ через settings
settings = get_settings()
