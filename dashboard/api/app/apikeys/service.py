import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ApiKey

from .schemas import CreateApiKeyRequest


async def create_api_key(
    db: AsyncSession, user_id: uuid.UUID, data: CreateApiKeyRequest
) -> tuple[ApiKey, str]:
    """Create an API key. Returns (db_row, plain_key)."""
    plain_key = secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(plain_key.encode()).hexdigest()
    key_prefix = plain_key[:8]

    expires_at = None
    if data.expires_in_days is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)

    api_key = ApiKey(
        user_id=user_id,
        name=data.name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        scopes=data.scopes,
        expires_at=expires_at,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return api_key, plain_key


async def list_api_keys(db: AsyncSession, user_id: uuid.UUID) -> list[ApiKey]:
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.created_at.desc())
    )
    return list(result.scalars().all())


async def delete_api_key(db: AsyncSession, user_id: uuid.UUID, key_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id)
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        return False
    await db.delete(api_key)
    await db.commit()
    return True
