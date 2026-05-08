"""Тесты API — проверка эндпоинтов без реальной БД и внешних сервисов."""

import pytest

from app.core.config import Settings


# ================================================================
# Конфигурация (Settings)
# ================================================================


class TestSettings:
    """Тесты Pydantic Settings — дефолтные значения и типы."""

    def test_default_database_url(self):
        """Дефолтный URL базы данных содержит asyncpg."""
        s = Settings()
        assert "asyncpg" in s.DATABASE_URL

    def test_default_redis_url(self):
        """Дефолтный Redis URL."""
        s = Settings()
        assert s.REDIS_URL.startswith("redis://")

    def test_jwt_defaults(self):
        """JWT настройки имеют дефолты."""
        s = Settings()
        assert s.JWT_ALGORITHM == "HS256"
        assert s.JWT_ACCESS_TOKEN_EXPIRE_MINUTES > 0

    def test_cors_origins_is_list(self):
        """CORS_ORIGINS — список."""
        s = Settings()
        assert isinstance(s.CORS_ORIGINS, list)
        assert len(s.CORS_ORIGINS) > 0

    def test_llm_model_default(self):
        """Модель LLM по умолчанию — qwen3."""
        s = Settings()
        assert s.LLM_MODEL == "qwen3"


# ================================================================
# Whitelist sort_by (защита от SQL инъекций)
# ================================================================


class TestSortByWhitelist:
    """Тесты whitelist для параметра sort_by."""

    def test_sortable_fields_defined(self):
        """Whitelist определён и содержит merit_score."""
        from app.api.endpoints import _SORTABLE_FIELDS
        assert "merit_score" in _SORTABLE_FIELDS
        assert "id" in _SORTABLE_FIELDS
        assert "region" in _SORTABLE_FIELDS

    def test_sql_injection_not_in_whitelist(self):
        """SQL-инъекция не проходит whitelist."""
        from app.api.endpoints import _SORTABLE_FIELDS
        assert "1; DROP TABLE applications" not in _SORTABLE_FIELDS
        assert "merit_score; --" not in _SORTABLE_FIELDS

    def test_whitelist_has_expected_count(self):
        """Whitelist содержит 12 полей."""
        from app.api.endpoints import _SORTABLE_FIELDS
        assert len(_SORTABLE_FIELDS) == 12


# ================================================================
# Санитизация (расширенные тесты)
# ================================================================


class TestSanitizationEdgeCases:
    """Дополнительные edge-case тесты санитизации."""

    def test_data_uri_xss(self):
        """data: URI с base64 скриптом."""
        from app.core.sanitize import sanitize_llm_text
        text = '<a href="data:text/html,<script>alert(1)</script>">click</a>'
        result = sanitize_llm_text(text)
        assert "<script>" not in result
        assert "<a" not in result

    def test_svg_xss(self):
        """SVG с onload."""
        from app.core.sanitize import sanitize_llm_text
        text = '<svg onload=alert(1)>test</svg>'
        result = sanitize_llm_text(text)
        assert "<svg" not in result

    def test_style_tag_removed(self):
        """style тег удаляется."""
        from app.core.sanitize import sanitize_llm_text
        text = '<style>body{display:none}</style>Текст'
        result = sanitize_llm_text(text)
        assert "<style>" not in result
        assert "Текст" in result

    def test_entity_encoding_passthrough(self):
        """HTML-сущности (не теги) проходят."""
        from app.core.sanitize import sanitize_llm_text
        text = "Баллы: 5 &gt; 3 &amp; 2 &lt; 4"
        result = sanitize_llm_text(text)
        # Сущности не являются тегами — должны остаться
        assert "&gt;" in result or ">" in result

    def test_very_long_text(self):
        """Длинный текст обрабатывается без ошибок."""
        from app.core.sanitize import sanitize_llm_text
        text = "Нормальный текст. " * 10_000
        result = sanitize_llm_text(text)
        assert len(result) > 0

    def test_only_tags_returns_empty(self):
        """Текст состоящий только из тегов → пустая строка."""
        from app.core.sanitize import sanitize_llm_text
        text = "<div><span></span></div>"
        result = sanitize_llm_text(text)
        assert result == ""


# ================================================================
# Pydantic-схемы приложений
# ================================================================


class TestApplicationSchemas:
    """Тесты Pydantic-моделей заявок."""

    def test_budget_sim_request(self):
        from app.schemas.application import BudgetSimRequest
        req = BudgetSimRequest(budget=5_000_000_000)
        assert req.budget == 5_000_000_000

    def test_weight_sim_request_with_weights(self):
        """WeightSimRequest принимает словарь весов."""
        from app.schemas.application import WeightSimRequest
        req = WeightSimRequest(weights={"head_count": 80, "is_cooperative": 60})
        assert req.weights["head_count"] == 80
        assert req.top_n == 10  # Дефолт


# ================================================================
# Features cache лимит
# ================================================================


class TestFeaturesCache:
    """Тесты ограничения кэша фичей в RAM."""

    def test_cache_max_rows_defined(self):
        """Лимит кэша определён."""
        from app.services.scoring_service import FEATURES_CACHE_MAX_ROWS
        assert FEATURES_CACHE_MAX_ROWS > 0
        assert FEATURES_CACHE_MAX_ROWS <= 200_000  # Разумный лимит
