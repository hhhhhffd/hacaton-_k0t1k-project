"""Админ-роутер — управление пользователями и моделями (одобрение/блокировка, версионирование)."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_admin
from app.db.models import User
from app.db.session import get_db
from app.services.scoring_service import ScoringService

logger = logging.getLogger("_k0t1k.admin")

router = APIRouter(prefix="/admin", tags=["admin"])


def get_scoring_service(request: Request) -> ScoringService:
    """Получение ScoringService из app.state."""
    return request.app.state.scoring_service


# ================================================================
# Pydantic-схемы для админки
# ================================================================

class AdminUserResponse(BaseModel):
    """Информация о пользователе для админской таблицы."""
    id: int
    email: str
    full_name: str
    is_active: bool
    is_admin: bool
    auth_provider: str
    created_at: str  # ISO формат

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    """Список пользователей с пагинацией."""
    items: list[AdminUserResponse]
    total: int


class ToggleAccessResponse(BaseModel):
    """Результат переключения доступа."""
    user_id: int
    email: str
    is_active: bool
    message: str


# ================================================================
# GET /admin/users — список всех пользователей
# ================================================================

@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    search: str = Query(default="", max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> AdminUserListResponse:
    """Список пользователей платформы с поиском и пагинацией (только для администраторов)."""
    # Базовый запрос — с опциональной фильтрацией по email/имени
    base_query = select(User)
    if search.strip():
        pattern = f"%{search.strip()}%"
        base_query = base_query.where(
            or_(User.email.ilike(pattern), User.full_name.ilike(pattern))
        )

    # Считаем общее количество после фильтрации
    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar() or 0

    # Загружаем страницу
    result = await db.execute(
        base_query.order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    users = result.scalars().all()

    items = []
    for u in users:
        items.append(AdminUserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            is_active=u.is_active,
            is_admin=u.is_admin,
            auth_provider=u.auth_provider,
            created_at=u.created_at.isoformat() if u.created_at else "",
        ))

    return AdminUserListResponse(items=items, total=total)


# ================================================================
# POST /admin/users/{user_id}/toggle-active — включить/выключить доступ
# ================================================================

@router.post("/users/{user_id}/toggle-active", response_model=ToggleAccessResponse)
async def toggle_user_access(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> ToggleAccessResponse:
    """Переключить доступ пользователя (is_active). Нельзя деактивировать самого себя."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя деактивировать свой аккаунт",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    user.is_active = not user.is_active
    await db.flush()

    action = "одобрен" if user.is_active else "заблокирован"
    logger.info("Админ %s %s пользователя %s", admin.email, action, user.email)

    return ToggleAccessResponse(
        user_id=user.id,
        email=user.email,
        is_active=user.is_active,
        message=f"Пользователь {user.email} {action}",
    )


# ================================================================
# POST /admin/users/{user_id}/toggle-admin — назначить/снять админа
# ================================================================

@router.post("/users/{user_id}/toggle-admin", response_model=ToggleAccessResponse)
async def toggle_user_admin(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> ToggleAccessResponse:
    """Назначить/снять права администратора. Нельзя снять с самого себя."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя снять админ-права с самого себя",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    user.is_admin = not user.is_admin
    await db.flush()

    action = "назначен админом" if user.is_admin else "снят с админов"
    logger.info("Админ %s: пользователь %s %s", admin.email, user.email, action)

    return ToggleAccessResponse(
        user_id=user.id,
        email=user.email,
        is_active=user.is_active,
        message=f"Пользователь {user.email} {action}",
    )


# ================================================================
# /admin/models — управление версиями моделей
# ================================================================

class ModelVersionResponse(BaseModel):
    """Информация о версии модели."""
    filename: str
    created_at: str  # ISO формат
    size_mb: float
    is_active: bool


class ModelListResponse(BaseModel):
    """Список доступных версий моделей."""
    models: list[ModelVersionResponse]
    active_model: str | None


class ActivateModelResponse(BaseModel):
    """Результат активации модели."""
    filename: str
    message: str


@router.get("/models", response_model=ModelListResponse)
async def list_models(
    admin: User = Depends(get_current_admin),
    scoring: ScoringService = Depends(get_scoring_service),
) -> ModelListResponse:
    """
    Список всех доступных версий моделей.
    
    Возвращает файлы lgbm_*.joblib из директории models/
    с датой создания, размером и флагом активности.
    """
    models = scoring.list_models()
    
    items = []
    for m in models:
        items.append(ModelVersionResponse(
            filename=m["filename"],
            created_at=datetime.fromtimestamp(m["created_at"]).isoformat(),
            size_mb=m["size_mb"],
            is_active=m["is_active"],
        ))
    
    return ModelListResponse(
        models=items,
        active_model=scoring.active_model_filename,
    )


@router.post("/models/{filename}/activate", response_model=ActivateModelResponse)
async def activate_model(
    filename: str,
    admin: User = Depends(get_current_admin),
    scoring: ScoringService = Depends(get_scoring_service),
) -> ActivateModelResponse:
    """
    Активирует указанную версию модели.
    
    Загружает модель с диска и обновляет active_model.txt.
    Полезно для отката к предыдущей версии при ошибках.
    
    Args:
        filename: Имя файла модели (например, lgbm_20240101_120000.joblib)
    """
    # Защита от path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимое имя файла",
        )
    
    try:
        scoring.activate_model(filename)
        logger.info("Админ %s активировал модель %s", admin.email, filename)
        
        return ActivateModelResponse(
            filename=filename,
            message=f"Модель {filename} успешно активирована",
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Модель {filename} не найдена",
        )
    except Exception as e:
        logger.exception("Ошибка при активации модели %s", filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при активации модели: {str(e)}",
        )
