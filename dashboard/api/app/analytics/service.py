import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import Float, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ApiEvent, Memory

from .schemas import (
    OverviewResponse,
    RetrievalResponse,
    TopUser,
    UsagePoint,
    UsageResponse,
)


async def get_overview(db: AsyncSession, project_id: uuid.UUID) -> OverviewResponse:
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    total_memories = (
        await db.execute(
            select(func.count()).select_from(Memory).where(Memory.project_id == project_id)
        )
    ).scalar_one()

    total_users = (
        await db.execute(
            select(func.count(func.distinct(Memory.mem0_user_id))).where(
                Memory.project_id == project_id
            )
        )
    ).scalar_one()

    this_week = (
        await db.execute(
            select(func.count()).select_from(Memory).where(
                Memory.project_id == project_id,
                Memory.created_at >= week_ago,
            )
        )
    ).scalar_one()

    last_week = (
        await db.execute(
            select(func.count()).select_from(Memory).where(
                Memory.project_id == project_id,
                Memory.created_at >= two_weeks_ago,
                Memory.created_at < week_ago,
            )
        )
    ).scalar_one()

    growth_rate = ((this_week - last_week) / last_week * 100) if last_week > 0 else 0.0

    top_rows = (
        await db.execute(
            select(Memory.mem0_user_id, func.count().label("cnt"))
            .where(Memory.project_id == project_id)
            .group_by(Memory.mem0_user_id)
            .order_by(func.count().desc())
            .limit(5)
        )
    ).all()

    top_users = [TopUser(user_id=row[0], memory_count=row[1]) for row in top_rows]

    return OverviewResponse(
        total_memories=total_memories,
        total_users=total_users,
        growth_rate_7d=round(growth_rate, 2),
        top_users=top_users,
    )


async def get_usage(
    db: AsyncSession, project_id: uuid.UUID, interval: str = "day", days: int = 30
) -> UsageResponse:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    if interval == "hour":
        trunc = func.date_trunc("hour", ApiEvent.created_at)
    elif interval == "week":
        trunc = func.date_trunc("week", ApiEvent.created_at)
    else:
        trunc = func.date_trunc("day", ApiEvent.created_at)

    rows = (
        await db.execute(
            select(
                trunc.label("bucket"),
                ApiEvent.action,
                func.count().label("cnt"),
            )
            .where(ApiEvent.project_id == project_id, ApiEvent.created_at >= since)
            .group_by("bucket", ApiEvent.action)
            .order_by("bucket")
        )
    ).all()

    data = [
        UsagePoint(date=row[0].isoformat(), count=row[2], action=row[1]) for row in rows
    ]

    return UsageResponse(data=data, interval=interval)


async def get_retrieval_stats(
    db: AsyncSession, project_id: uuid.UUID, days: int = 30
) -> RetrievalResponse:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    base = select(ApiEvent.latency_ms).where(
        ApiEvent.project_id == project_id,
        ApiEvent.action == "memory.search",
        ApiEvent.created_at >= since,
    )

    total_searches = (
        await db.execute(
            select(func.count()).select_from(base.subquery())
        )
    ).scalar_one()

    if total_searches == 0:
        return RetrievalResponse(
            avg_latency_ms=0, p50_latency_ms=0, p95_latency_ms=0, total_searches=0
        )

    avg_latency = (
        await db.execute(
            select(func.avg(cast(ApiEvent.latency_ms, Float))).where(
                ApiEvent.project_id == project_id,
                ApiEvent.action == "memory.search",
                ApiEvent.created_at >= since,
            )
        )
    ).scalar_one()

    p50 = (
        await db.execute(
            select(
                func.percentile_cont(0.5).within_group(ApiEvent.latency_ms)
            ).where(
                ApiEvent.project_id == project_id,
                ApiEvent.action == "memory.search",
                ApiEvent.created_at >= since,
            )
        )
    ).scalar_one()

    p95 = (
        await db.execute(
            select(
                func.percentile_cont(0.95).within_group(ApiEvent.latency_ms)
            ).where(
                ApiEvent.project_id == project_id,
                ApiEvent.action == "memory.search",
                ApiEvent.created_at >= since,
            )
        )
    ).scalar_one()

    return RetrievalResponse(
        avg_latency_ms=round(float(avg_latency or 0), 2),
        p50_latency_ms=round(float(p50 or 0), 2),
        p95_latency_ms=round(float(p95 or 0), 2),
        total_searches=total_searches,
    )
