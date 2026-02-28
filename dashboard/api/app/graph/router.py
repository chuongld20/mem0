from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Project, ProjectConfig, ProjectMember
from app.projects.deps import require_project_access

from . import service
from .schemas import (
    EntityDetailResponse,
    EntityListResponse,
    EntityResponse,
    RelationResponse,
    SubgraphResponse,
)

router = APIRouter(prefix="/{slug}/graph")


async def _get_config(db: AsyncSession, project: Project) -> ProjectConfig | None:
    result = await db.execute(
        select(ProjectConfig).where(ProjectConfig.project_id == project.id)
    )
    return result.scalar_one_or_none()


def _check_graph_enabled(project: Project, config: ProjectConfig | None):
    if not project.neo4j_database and (not config or not config.graph_store_config):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Graph memory is not enabled for this project",
        )


@router.get("/entities", response_model=EntityListResponse)
async def list_entities(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await _get_config(db, project)
    _check_graph_enabled(project, config)

    items, total = await service.list_entities(
        project, config, search=search, page=page, page_size=page_size
    )
    return EntityListResponse(
        items=[EntityResponse(**e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/entities/{entity_name}", response_model=EntityDetailResponse)
async def get_entity(
    entity_name: str,
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await _get_config(db, project)
    _check_graph_enabled(project, config)

    entity = await service.get_entity(project, config, entity_name)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entity not found")
    return EntityDetailResponse(**entity)


@router.get("/relations", response_model=list[RelationResponse])
async def list_relations(
    source: str | None = Query(None),
    target: str | None = Query(None),
    type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await _get_config(db, project)
    _check_graph_enabled(project, config)

    items, _ = await service.list_relations(
        project, config, source=source, target=target, rel_type=type,
        page=page, page_size=page_size,
    )
    return [RelationResponse(**r) for r in items]


@router.delete("/entities/{entity_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entity(
    entity_name: str,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await _get_config(db, project)
    _check_graph_enabled(project, config)

    deleted = await service.delete_entity(project, config, entity_name)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entity not found")


@router.delete("/relations/{rel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_relation(
    rel_id: str,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await _get_config(db, project)
    _check_graph_enabled(project, config)

    deleted = await service.delete_relation(project, config, rel_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Relation not found")


@router.get("/subgraph", response_model=SubgraphResponse)
async def get_subgraph(
    entities: list[str] = Query(..., alias="entities"),
    hops: int = Query(1, ge=1, le=3),
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await _get_config(db, project)
    _check_graph_enabled(project, config)

    result = await service.get_subgraph(project, config, entities, hops=hops)
    return SubgraphResponse(
        entities=[EntityResponse(**e) for e in result["entities"]],
        relations=[RelationResponse(**r) for r in result["relations"]],
    )
