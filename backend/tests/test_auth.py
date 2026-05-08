"""Тесты модуля аутентификации — хеширование, JWT, валидация."""

import time
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.core.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


# ================================================================
# Хеширование паролей (bcrypt)
# ================================================================


class TestPasswordHashing:
    """Тесты bcrypt хеширования паролей."""

    def test_hash_returns_string(self):
        """Хеш — строка (не байты)."""
        hashed = hash_password("mypassword123")
        assert isinstance(hashed, str)

    def test_hash_not_plaintext(self):
        """Хеш не равен исходному паролю."""
        password = "mypassword123"
        hashed = hash_password(password)
        assert hashed != password

    def test_verify_correct_password(self):
        """Правильный пароль проходит проверку."""
        password = "SuperSecret!99"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_wrong_password(self):
        """Неправильный пароль не проходит проверку."""
        hashed = hash_password("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_different_hashes_for_same_password(self):
        """Два хеша одного пароля различаются (разные salt)."""
        password = "same_password"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2
        # Но оба валидны
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True

    def test_unicode_password(self):
        """Unicode пароль (кириллица) корректно хешируется."""
        password = "ПарольНаРусском123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_empty_password(self):
        """Пустой пароль — хешируется и верифицируется (валидация на уровне Pydantic)."""
        hashed = hash_password("")
        assert verify_password("", hashed) is True
        assert verify_password("notempty", hashed) is False


# ================================================================
# JWT токены
# ================================================================


class TestJWT:
    """Тесты создания и декодирования JWT."""

    def test_create_and_decode_token(self):
        """Созданный токен корректно декодируется."""
        token = create_access_token(user_id=42, email="test@example.com")
        payload = decode_access_token(token)
        assert payload["sub"] == "42"
        assert payload["email"] == "test@example.com"
        assert "exp" in payload

    def test_token_is_string(self):
        """Токен — строка."""
        token = create_access_token(user_id=1, email="a@b.com")
        assert isinstance(token, str)
        assert len(token) > 20  # JWT достаточно длинный

    def test_different_users_different_tokens(self):
        """Разные пользователи получают разные токены."""
        t1 = create_access_token(user_id=1, email="user1@test.com")
        t2 = create_access_token(user_id=2, email="user2@test.com")
        assert t1 != t2

    def test_decode_invalid_token_raises(self):
        """Невалидный токен вызывает HTTPException 401."""
        with pytest.raises(HTTPException) as exc_info:
            decode_access_token("invalid.jwt.token")
        assert exc_info.value.status_code == 401

    def test_decode_tampered_token_raises(self):
        """Изменённый токен не проходит верификацию."""
        token = create_access_token(user_id=1, email="a@b.com")
        # Портим последний символ
        tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
        with pytest.raises(HTTPException) as exc_info:
            decode_access_token(tampered)
        assert exc_info.value.status_code == 401

    def test_expired_token_raises(self):
        """Истёкший токен отклоняется."""
        # Патчим время жизни токена на 0 минут
        with patch("app.core.auth.settings") as mock_settings:
            mock_settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 0
            mock_settings.JWT_SECRET_KEY = "change-me-in-production-please"
            mock_settings.JWT_ALGORITHM = "HS256"
            token = create_access_token(user_id=1, email="a@b.com")

        # Ждём чуть-чуть чтобы токен точно истёк
        time.sleep(1)

        with pytest.raises(HTTPException) as exc_info:
            decode_access_token(token)
        assert exc_info.value.status_code == 401


# ================================================================
# Pydantic-схемы авторизации
# ================================================================


class TestAuthSchemas:
    """Тесты Pydantic-моделей для auth."""

    def test_login_request_valid(self):
        from app.schemas.auth import LoginRequest

        req = LoginRequest(email="test@mail.com", password="123456")
        assert req.email == "test@mail.com"
        assert req.password == "123456"

    def test_login_request_short_password_rejected(self):
        """Пароль короче 6 символов отклоняется."""
        from pydantic import ValidationError

        from app.schemas.auth import LoginRequest

        with pytest.raises(ValidationError):
            LoginRequest(email="test@mail.com", password="12345")

    def test_login_request_invalid_email_rejected(self):
        """Невалидный email отклоняется."""
        from pydantic import ValidationError

        from app.schemas.auth import LoginRequest

        with pytest.raises(ValidationError):
            LoginRequest(email="not-an-email", password="123456")

    def test_change_password_request_valid(self):
        from app.schemas.auth import ChangePasswordRequest

        req = ChangePasswordRequest(current_password="old123", new_password="new456")
        assert req.current_password == "old123"
        assert req.new_password == "new456"

    def test_token_response_defaults(self):
        from app.schemas.auth import TokenResponse

        resp = TokenResponse(
            access_token="xxx", user_id=1, email="a@b.com", full_name="Test"
        )
        assert resp.token_type == "bearer"

    def test_user_response_from_attributes(self):
        """UserResponse поддерживает from_attributes (для SQLAlchemy моделей)."""
        from app.schemas.auth import UserResponse

        assert UserResponse.model_config.get("from_attributes") is True
