import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import log_audit
from app.auth.deps import get_current_user
from app.db import get_db
from app.models import User

from . import service
from .schemas import ApiKeyCreatedResponse, ApiKeyResponse, CreateApiKeyRequest

router = APIRouter()


@router.get("", response_model=list[ApiKeyResponse])
async def list_api_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_api_keys(db, user.id)


@router.post("", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    body: CreateApiKeyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    api_key, plain_key = await service.create_api_key(db, user.id, body)
    await log_audit(
        db,
        actor_id=user.id,
        action="api_key.created",
        target_type="api_key",
        target_id=str(api_key.id),
        payload={"name": body.name},
    )
    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        scopes=api_key.scopes,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at,
        key=plain_key,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await service.delete_api_key(db, user.id, key_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    await log_audit(
        db,
        actor_id=user.id,
        action="api_key.deleted",
        target_type="api_key",
        target_id=str(key_id),
    )
