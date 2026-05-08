"""Auth роутер — вход по email/пароль, Google OAuth, смена пароля, /me, stream-ticket."""

import json
import logging
import secrets

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_access_token,
    get_authenticated_user,
    get_current_user,
    hash_password,
    verify_password,
)
from app.core.config import settings
from app.core.redis import get_redis
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import (
    ChangePasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

logger = logging.getLogger("_k0t1k.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


# ================================================================
# POST /auth/register — регистрация нового пользователя
# ================================================================

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Регистрация нового пользователя по email, паролю и имени. Возвращает JWT токен."""
    # Проверяем что email не занят
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    # Создаём пользователя (is_active=False — ждёт одобрения админа)
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        auth_provider="local",
        is_active=False,
    )
    db.add(user)
    await db.flush()

    logger.info("Зарегистрирован новый пользователь: %s", body.email)

    token = create_access_token(user.id, user.email)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
    )


# ================================================================
# POST /auth/login — вход по email + пароль
# ================================================================

@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Аутентификация по email и паролю. Возвращает JWT токен."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль")

    if user.auth_provider != "local":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Аккаунт зарегистрирован через {user.auth_provider} — используйте соответствующий вход",
        )

    if not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль")

    token = create_access_token(user.id, user.email)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
    )


# ================================================================
# POST /auth/google — вход через Google OAuth (id_token)
# ================================================================

@router.post("/google", response_model=TokenResponse)
async def google_auth(
    body: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Вход через Google OAuth.

    Фронтенд получает id_token от Google Sign-In и отправляет сюда.
    Бэкенд верифицирует токен через Google API и создаёт/находит пользователя.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth не настроен — задайте GOOGLE_CLIENT_ID в .env",
        )

    # Верифицируем id_token через Google tokeninfo endpoint
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": body.id_token},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный Google токен")

        google_data = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google API недоступен")

    # Проверяем audience (client_id)
    if google_data.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный Google Client ID")

    google_sub = google_data["sub"]
    email = google_data.get("email", "")
    name = google_data.get("name", "")

    # Ищем пользователя по google_sub или email
    result = await db.execute(
        select(User).where((User.google_sub == google_sub) | (User.email == email))
    )
    user = result.scalar_one_or_none()

    if user is None:
        # Новый пользователь — создаём (регистрация через OAuth автоматическая)
        user = User(
            email=email,
            full_name=name,
            auth_provider="google",
            google_sub=google_sub,
            hashed_password=None,
            is_active=False,
        )
        db.add(user)
        await db.flush()
        logger.info("Новый Google-пользователь: %s (%s)", email, google_sub)
    elif user.auth_provider == "local" and not user.google_sub:
        # Пользователь существует с email-паролем — привязываем Google
        user.google_sub = google_sub
        user.auth_provider = "google"
        await db.flush()
        logger.info("Привязан Google к существующему аккаунту: %s", email)

    token = create_access_token(user.id, user.email)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
    )


# ================================================================
# GET /auth/me — текущий пользователь
# ================================================================

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_authenticated_user)) -> UserResponse:
    """
    Возвращает информацию о текущем пользователе (даже если аккаунт не одобрен).

    Фронтенд использует это для определения: показывать дашборд или страницу ожидания.
    """
    return UserResponse.model_validate(user)


# ================================================================
# POST /auth/change-password — смена пароля
# ================================================================

@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Смена пароля для local-пользователей."""
    if user.auth_provider != "local":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Смена пароля доступна только для email-аккаунтов",
        )

    if not user.hashed_password or not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Текущий пароль неверный")

    user.hashed_password = hash_password(body.new_password)
    await db.flush()

    logger.info("Пароль изменён для %s", user.email)
    return {"detail": "Пароль успешно изменён"}


# ================================================================
# POST /auth/stream-ticket — одноразовый токен для SSE
# ================================================================

# TTL stream ticket в секундах (60 секунд)
_STREAM_TICKET_TTL = 60


@router.post("/stream-ticket")
async def create_stream_ticket(
    user: User = Depends(get_current_user),
) -> dict:
    """
    Создаёт одноразовый stream ticket для SSE-эндпоинтов.
    
    БЕЗОПАСНОСТЬ: Решает проблему передачи JWT в query-параметрах SSE.
    EventSource API не поддерживает кастомные заголовки, поэтому JWT
    приходилось передавать в URL, где он логируется серверами и браузерами.
    
    Stream ticket:
    - Действителен 60 секунд
    - Одноразовый (удаляется после первого использования)
    - Хранится в Redis
    - Содержит только user_id (минимум данных)
    
    Использование:
    1. Клиент вызывает POST /auth/stream-ticket (с Bearer JWT)
    2. Получает ticket
    3. Передаёт ticket в SSE URL: /applications/{id}/explain-stream?ticket=...
    4. SSE эндпоинт валидирует и удаляет ticket
    
    Returns:
        {"ticket": "...", "expires_in": 60}
    """
    r = await get_redis()
    if not r:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis недоступен — stream ticket требует Redis",
        )

    # Генерируем криптографически безопасный токен
    ticket = secrets.token_urlsafe(32)
    ticket_key = f"stream_ticket:{ticket}"

    # Сохраняем в Redis с TTL
    ticket_data = json.dumps({"user_id": user.id, "email": user.email})
    await r.setex(ticket_key, _STREAM_TICKET_TTL, ticket_data)

    logger.debug("Stream ticket создан для user=%d", user.id)

    return {
        "ticket": ticket,
        "expires_in": _STREAM_TICKET_TTL,
    }
