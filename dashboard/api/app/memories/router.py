import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import log_audit
from app.auth.deps import get_current_principal
from app.db import async_session, get_db
from app.models import Project, ProjectConfig, ProjectMember, User
from app.projects.deps import require_project_access
from app.webhooks.service import fire_webhook

from . import service
from .schemas import (
    AddMemoryRequest,
    BulkDeleteRequest,
    ExportFormat,
    MemoryHistoryResponse,
    MemoryListResponse,
    MemoryResponse,
    SearchMemoryRequest,
    SearchResultResponse,
    UpdateMemoryRequest,
)

router = APIRouter(prefix="/{slug}/memories", tags=["memories"])


async def _fire_webhook_bg(project_id: uuid.UUID, event: str, payload: dict):
    async with async_session() as db:
        await fire_webhook(db, project_id, event, payload)


async def _get_project_config(
    db: AsyncSession, project: Project
) -> ProjectConfig | None:
    result = await db.execute(
        select(ProjectConfig).where(ProjectConfig.project_id == project.id)
    )
    return result.scalar_one_or_none()


@router.get("", response_model=MemoryListResponse)
async def list_memories(
    user_id: str | None = Query(None),
    agent_id: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    items, total = await service.list_memories(
        db,
        project_id=project.id,
        user_id=user_id,
        agent_id=agent_id,
        search_text=search,
        page=page,
        page_size=page_size,
    )
    return MemoryListResponse(
        items=[MemoryResponse.model_validate(m) for m in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def add_memory(
    body: AddMemoryRequest,
    background_tasks: BackgroundTasks,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("member")),
    principal: User = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await _get_project_config(db, project)
    row = await service.add_memory(
        db,
        project=project,
        config=config,
        messages=body.messages,
        user_id=body.user_id,
        agent_id=body.agent_id,
        run_id=body.run_id,
        metadata=body.metadata,
    )
    await log_audit(
        db, actor_id=principal.id, project_id=project.id,
        action="memory.created", target_type="memory", target_id=str(row.id),
    )
    background_tasks.add_task(
        _fire_webhook_bg, project.id, "memory.created",
        {"memory_id": str(row.id), "content": row.content},
    )
    return MemoryResponse.model_validate(row)


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(
    memory_id: uuid.UUID,
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    row = await service.get_memory(db, project.id, memory_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    return MemoryResponse.model_validate(row)


@router.patch("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: uuid.UUID,
    body: UpdateMemoryRequest,
    background_tasks: BackgroundTasks,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("member")),
    principal: User = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await _get_project_config(db, project)
    row = await service.update_memory(
        db,
        project=project,
        config=config,
        memory_id=memory_id,
        content=body.content,
        changed_by=principal.id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    await log_audit(
        db, actor_id=principal.id, project_id=project.id,
        action="memory.updated", target_type="memory", target_id=str(memory_id),
    )
    background_tasks.add_task(
        _fire_webhook_bg, project.id, "memory.updated",
        {"memory_id": str(memory_id), "content": row.content},
    )
    return MemoryResponse.model_validate(row)


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("member")),
    principal: User = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await _get_project_config(db, project)
    deleted = await service.delete_memory(db, project, config, memory_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    await log_audit(
        db, actor_id=principal.id, project_id=project.id,
        action="memory.deleted", target_type="memory", target_id=str(memory_id),
    )
    background_tasks.add_task(
        _fire_webhook_bg, project.id, "memory.deleted",
        {"memory_id": str(memory_id)},
    )


@router.post("/search", response_model=list[SearchResultResponse])
async def search_memories(
    body: SearchMemoryRequest,
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await _get_project_config(db, project)
    results = await service.search_memories(
        project=project,
        config=config,
        query=body.query,
        user_id=body.user_id,
        agent_id=body.agent_id,
        limit=body.limit,
        filters=body.filters,
    )
    return [SearchResultResponse(**r) for r in results]


@router.post("/bulk-delete")
async def bulk_delete(
    body: BulkDeleteRequest,
    background_tasks: BackgroundTasks,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    principal: User = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    if not body.ids and not body.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either ids or user_id",
        )
    config = await _get_project_config(db, project)
    count = await service.bulk_delete(
        db, project, config, ids=body.ids, user_id=body.user_id
    )
    await log_audit(
        db, actor_id=principal.id, project_id=project.id,
        action="memory.bulk_deleted", target_type="memory",
        payload={"count": count},
    )
    background_tasks.add_task(
        _fire_webhook_bg, project.id, "memory.deleted",
        {"bulk": True, "count": count},
    )
    return {"deleted": count}


@router.post("/export")
async def export_memories(
    format: ExportFormat = Query(ExportFormat.jsonl),
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access

    if format == ExportFormat.csv:
        media_type = "text/csv"
        filename = f"{project.slug}_memories.csv"
    else:
        media_type = "application/x-ndjson"
        filename = f"{project.slug}_memories.jsonl"

    generator = service.export_memories(db, project.id, format=format.value)
    return StreamingResponse(
        generator,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import")
async def import_memories(
    file: UploadFile,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await _get_project_config(db, project)

    content = await file.read()
    text = content.decode("utf-8")
    lines = text.splitlines()

    result = await service.import_memories(db, project, config, lines)
    return result


@router.get("/{memory_id}/history", response_model=list[MemoryHistoryResponse])
async def get_history(
    memory_id: uuid.UUID,
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    # Verify the memory belongs to this project
    row = await service.get_memory(db, project.id, memory_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    items = await service.get_history(db, memory_id)
    return [MemoryHistoryResponse.model_validate(h) for h in items]
