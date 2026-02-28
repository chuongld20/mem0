import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import log_audit
from app.auth.deps import get_current_principal
from app.db import get_db
from app.models import Project, ProjectMember, User
from app.projects import service
from app.projects.deps import require_project_access
from app.projects.schemas import (
    AddMemberRequest,
    CreateProjectRequest,
    MemberResponse,
    ProjectConfigResponse,
    ProjectListResponse,
    ProjectResponse,
    UpdateMemberRequest,
    UpdateProjectConfigRequest,
    UpdateProjectRequest,
)

router = APIRouter()


def _project_response(project: Project, role: str) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        slug=project.slug,
        name=project.name,
        description=project.description,
        qdrant_collection=project.qdrant_collection,
        neo4j_database=project.neo4j_database,
        is_archived=project.is_archived,
        created_at=project.created_at,
        updated_at=project.updated_at,
        role=role,
    )


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    user: User = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    rows = await service.list_projects(db, user)
    items = [_project_response(r["project"], r["role"]) for r in rows]
    return ProjectListResponse(items=items, total=len(items))


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: CreateProjectRequest,
    user: User = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    project = await service.create_project(
        db, user, name=body.name, slug=body.slug, description=body.description
    )
    await log_audit(
        db, actor_id=user.id, project_id=project.id,
        action="project.created", target_type="project", target_id=str(project.id),
    )
    return _project_response(project, "owner")


@router.get("/{slug}", response_model=ProjectResponse)
async def get_project(
    access: tuple[Project, ProjectMember] = Depends(require_project_access("viewer")),
):
    project, membership = access
    return _project_response(project, membership.role)


@router.patch("/{slug}", response_model=ProjectResponse)
async def update_project(
    body: UpdateProjectRequest,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    db: AsyncSession = Depends(get_db),
):
    project, membership = access
    updated = await service.update_project(db, project, body)
    await log_audit(
        db, actor_id=membership.user_id, project_id=project.id,
        action="project.updated", target_type="project", target_id=str(project.id),
    )
    return _project_response(updated, membership.role)


@router.delete("/{slug}", status_code=204)
async def archive_project(
    access: tuple[Project, ProjectMember] = Depends(require_project_access("owner")),
    db: AsyncSession = Depends(get_db),
):
    project, membership = access
    await service.archive_project(db, project)
    await log_audit(
        db, actor_id=membership.user_id, project_id=project.id,
        action="project.archived", target_type="project", target_id=str(project.id),
    )


# --- Members ---


@router.get("/{slug}/members", response_model=list[MemberResponse])
async def list_members(
    access: tuple[Project, ProjectMember] = Depends(require_project_access("viewer")),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    return await service.list_members(db, project)


@router.post("/{slug}/members", response_model=MemberResponse, status_code=201)
async def add_member(
    body: AddMemberRequest,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    db: AsyncSession = Depends(get_db),
):
    project, membership = access
    member = await service.add_member(db, project, body.email, body.role, membership.user_id)
    await log_audit(
        db, actor_id=membership.user_id, project_id=project.id,
        action="member.added", target_type="member", target_id=str(member.user_id),
        payload={"email": body.email, "role": body.role},
    )
    # Reload with user relation for response
    members = await service.list_members(db, project)
    return next(m for m in members if m.id == member.id)


@router.patch("/{slug}/members/{user_id}", response_model=MemberResponse)
async def update_member(
    user_id: uuid.UUID,
    body: UpdateMemberRequest,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    db: AsyncSession = Depends(get_db),
):
    project, membership = access
    await service.update_member(db, project, user_id, body.role)
    await log_audit(
        db, actor_id=membership.user_id, project_id=project.id,
        action="member.updated", target_type="member", target_id=str(user_id),
        payload={"role": body.role},
    )
    members = await service.list_members(db, project)
    return next(m for m in members if m.user_id == user_id)


@router.delete("/{slug}/members/{user_id}", status_code=204)
async def remove_member(
    user_id: uuid.UUID,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    db: AsyncSession = Depends(get_db),
):
    project, membership = access
    await service.remove_member(db, project, user_id)
    await log_audit(
        db, actor_id=membership.user_id, project_id=project.id,
        action="member.removed", target_type="member", target_id=str(user_id),
    )


# --- Config ---


@router.get("/{slug}/config", response_model=ProjectConfigResponse)
async def get_config(
    access: tuple[Project, ProjectMember] = Depends(require_project_access("viewer")),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    return await service.get_config(db, project)


@router.put("/{slug}/config", response_model=ProjectConfigResponse)
async def replace_config(
    body: UpdateProjectConfigRequest,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    db: AsyncSession = Depends(get_db),
):
    project, membership = access
    result = await service.update_config(db, project, body, partial=False)
    await log_audit(
        db, actor_id=membership.user_id, project_id=project.id,
        action="config.updated", target_type="config", target_id=str(project.id),
    )
    return result


@router.patch("/{slug}/config", response_model=ProjectConfigResponse)
async def patch_config(
    body: UpdateProjectConfigRequest,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    db: AsyncSession = Depends(get_db),
):
    project, membership = access
    result = await service.update_config(db, project, body, partial=True)
    await log_audit(
        db, actor_id=membership.user_id, project_id=project.id,
        action="config.updated", target_type="config", target_id=str(project.id),
    )
    return result


@router.post("/{slug}/config/test")
async def test_config_connection(
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    config = await service.get_config(db, project)
    return await service.test_connection(config)
