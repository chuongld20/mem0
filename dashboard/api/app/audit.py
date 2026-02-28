import uuid
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog

logger = logging.getLogger(__name__)


async def log_audit(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None,
    actor_type: str = "user",
    project_id: uuid.UUID | None = None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    payload: dict | None = None,
    ip_address: str | None = None,
) -> None:
    try:
        entry = AuditLog(
            actor_id=actor_id,
            actor_type=actor_type,
            project_id=project_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            payload=payload,
            ip_address=ip_address,
        )
        db.add(entry)
        await db.commit()
    except Exception:
        logger.exception("Failed to write audit log")
        await db.rollback()
