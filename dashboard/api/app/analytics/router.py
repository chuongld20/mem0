from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Project, ProjectMember
from app.projects.deps import require_project_access

from . import service
from .schemas import OverviewResponse, RetrievalResponse, UsageResponse

router = APIRouter(prefix="/{slug}/analytics")


@router.get("/overview", response_model=OverviewResponse)
async def overview(
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    return await service.get_overview(db, project.id)


@router.get("/usage", response_model=UsageResponse)
async def usage(
    interval: str = Query("day", pattern="^(hour|day|week)$"),
    days: int = Query(30, ge=1, le=365),
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    return await service.get_usage(db, project.id, interval=interval, days=days)


@router.get("/retrieval", response_model=RetrievalResponse)
async def retrieval(
    days: int = Query(30, ge=1, le=365),
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    return await service.get_retrieval_stats(db, project.id, days=days)
