import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_superadmin
from app.db import get_db
from app.models import User

from . import service
from .schemas import (
    AdminUserResponse,
    AuditLogResponse,
    CreateUserRequest,
    PlatformStatsResponse,
    UpdateUserRequest,
)

router = APIRouter()


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    users, _ = await service.list_users(db, page=page, page_size=page_size)
    return [AdminUserResponse.model_validate(u) for u in users]


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await service.create_user(
            db, email=body.email, name=body.name,
            password=body.password, is_superadmin=body.is_superadmin,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )
    return AdminUserResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    user = await service.update_user(
        db, user_id,
        name=body.name,
        is_active=body.is_active,
        is_superadmin=body.is_superadmin,
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return AdminUserResponse.model_validate(user)


@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def list_audit_logs(
    project_id: uuid.UUID | None = Query(None),
    actor_id: uuid.UUID | None = Query(None),
    action: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    logs, _ = await service.list_audit_logs(
        db, project_id=project_id, actor_id=actor_id,
        action=action, page=page, page_size=page_size,
    )
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.get("/stats", response_model=PlatformStatsResponse)
async def platform_stats(
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    stats = await service.get_platform_stats(db)
    return PlatformStatsResponse(**stats)
