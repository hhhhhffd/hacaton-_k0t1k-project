"""Pydantic-схемы для аутентификации."""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Запрос на регистрацию нового пользователя."""
    email: EmailStr = Field(description="Email пользователя")
    password: str = Field(min_length=6, max_length=128, description="Пароль")
    full_name: str = Field(min_length=1, max_length=255, description="Полное имя")


class LoginRequest(BaseModel):
    """Запрос на вход по email/пароль."""
    email: EmailStr = Field(description="Email пользователя")
    password: str = Field(min_length=6, max_length=128, description="Пароль")


class GoogleAuthRequest(BaseModel):
    """Запрос на вход через Google OAuth (id_token от клиента)."""
    id_token: str = Field(description="Google ID token из фронтенда")


class ChangePasswordRequest(BaseModel):
    """Запрос на смену пароля."""
    current_password: str = Field(min_length=6, max_length=128, description="Текущий пароль")
    new_password: str = Field(min_length=6, max_length=128, description="Новый пароль")


class TokenResponse(BaseModel):
    """Ответ с JWT токеном."""
    access_token: str = Field(description="JWT access token")
    token_type: str = Field(default="bearer")
    user_id: int
    email: str
    full_name: str


class UserResponse(BaseModel):
    """Информация о текущем пользователе."""
    id: int
    email: str
    full_name: str
    is_active: bool
    is_admin: bool
    auth_provider: str

    model_config = {"from_attributes": True}
