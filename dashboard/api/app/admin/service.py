import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import pwd_context
from app.models import ApiEvent, AuditLog, Memory, Project, User


async def list_users(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[User], int]:
    total = (
        await db.execute(select(func.count()).select_from(User))
    ).scalar_one()

    query = (
        select(User)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(query)).scalars().all()
    return list(rows), total


async def create_user(
    db: AsyncSession,
    email: str,
    name: str,
    password: str,
    is_superadmin: bool = False,
) -> User:
    user = User(
        email=email,
        name=name,
        password_hash=pwd_context.hash(password),
        is_superadmin=is_superadmin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    name: str | None = None,
    is_active: bool | None = None,
    is_superadmin: bool | None = None,
) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return None

    if name is not None:
        user.name = name
    if is_active is not None:
        user.is_active = is_active
    if is_superadmin is not None:
        user.is_superadmin = is_superadmin

    await db.commit()
    await db.refresh(user)
    return user


async def list_audit_logs(
    db: AsyncSession,
    project_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
    action: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[AuditLog], int]:
    base = select(AuditLog)

    if project_id:
        base = base.where(AuditLog.project_id == project_id)
    if actor_id:
        base = base.where(AuditLog.actor_id == actor_id)
    if action:
        base = base.where(AuditLog.action == action)

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()

    query = base.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(query)).scalars().all()
    return list(rows), total


async def get_platform_stats(db: AsyncSession) -> dict:
    total_users = (
        await db.execute(select(func.count()).select_from(User))
    ).scalar_one()

    active_users = (
        await db.execute(
            select(func.count()).select_from(User).where(User.is_active.is_(True))
        )
    ).scalar_one()

    total_projects = (
        await db.execute(
            select(func.count()).select_from(Project).where(Project.is_archived.is_(False))
        )
    ).scalar_one()

    total_memories = (
        await db.execute(select(func.count()).select_from(Memory))
    ).scalar_one()

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    total_api_calls = (
        await db.execute(
            select(func.count()).select_from(ApiEvent).where(ApiEvent.created_at >= week_ago)
        )
    ).scalar_one()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_projects": total_projects,
        "total_memories": total_memories,
        "total_api_calls": total_api_calls,
    }
