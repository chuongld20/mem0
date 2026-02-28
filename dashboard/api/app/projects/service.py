import re
import uuid
import logging

from fastapi import HTTPException, status
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import Project, ProjectConfig, ProjectMember, User
from app.projects.schemas import (
    MemberResponse,
    UpdateProjectConfigRequest,
    UpdateProjectRequest,
)

logger = logging.getLogger(__name__)


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9-]", "", name.lower().replace(" ", "-"))


def _get_qdrant() -> QdrantClient:
    return QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)


async def create_project(
    db: AsyncSession,
    user: User,
    name: str,
    slug: str | None = None,
    description: str | None = None,
) -> Project:
    slug = _slugify(slug) if slug else _slugify(name)
    if not slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid slug generated from name")

    existing = await db.execute(select(Project).where(Project.slug == slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project slug already exists")

    qdrant_collection = f"proj_{slug}_memories"

    project = Project(
        name=name,
        slug=slug,
        description=description,
        owner_id=user.id,
        qdrant_collection=qdrant_collection,
    )
    db.add(project)
    await db.flush()

    # Qdrant collection will be created automatically by mem0 on first memory add
    # with the correct vector dimensions for the configured embedding model

    # Create default config
    config = ProjectConfig(
        project_id=project.id,
        llm_config={"model": settings.DEFAULT_LLM_MODEL},
        embedder_config={"model": settings.DEFAULT_EMBED_MODEL},
        vector_store_config={},
        graph_store_config={},
    )
    db.add(config)

    # Add creator as owner
    membership = ProjectMember(
        project_id=project.id,
        user_id=user.id,
        role="owner",
    )
    db.add(membership)

    await db.commit()
    await db.refresh(project)
    return project


async def list_projects(db: AsyncSession, user: User) -> list[dict]:
    result = await db.execute(
        select(Project, ProjectMember.role)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == user.id, Project.is_archived.is_(False))
        .order_by(Project.created_at.desc())
    )
    rows = result.all()
    return [{"project": row[0], "role": row[1]} for row in rows]


async def get_project(db: AsyncSession, slug: str) -> Project | None:
    result = await db.execute(select(Project).where(Project.slug == slug))
    return result.scalar_one_or_none()


async def update_project(
    db: AsyncSession,
    project: Project,
    data: UpdateProjectRequest,
) -> Project:
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    await db.commit()
    await db.refresh(project)
    return project


async def archive_project(db: AsyncSession, project: Project) -> Project:
    # Delete Qdrant collection
    try:
        client = _get_qdrant()
        client.delete_collection(collection_name=project.qdrant_collection)
    except Exception:
        logger.exception("Failed to delete Qdrant collection %s", project.qdrant_collection)

    project.is_archived = True
    await db.commit()
    await db.refresh(project)
    return project


async def add_member(
    db: AsyncSession,
    project: Project,
    email: str,
    role: str,
    invited_by: uuid.UUID,
) -> ProjectMember:
    result = await db.execute(select(User).where(User.email == email))
    target_user = result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == target_user.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member")

    membership = ProjectMember(
        project_id=project.id,
        user_id=target_user.id,
        role=role,
        invited_by=invited_by,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return membership


async def list_members(db: AsyncSession, project: Project) -> list[MemberResponse]:
    result = await db.execute(
        select(ProjectMember)
        .options(selectinload(ProjectMember.user))
        .where(ProjectMember.project_id == project.id)
        .order_by(ProjectMember.created_at)
    )
    members = result.scalars().all()
    return [
        MemberResponse(
            id=m.id,
            user_id=m.user_id,
            email=m.user.email,
            name=m.user.name,
            role=m.role,
            created_at=m.created_at,
        )
        for m in members
    ]


async def update_member(
    db: AsyncSession,
    project: Project,
    user_id: uuid.UUID,
    role: str,
) -> ProjectMember:
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if membership.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change owner role")

    membership.role = role
    await db.commit()
    await db.refresh(membership)
    return membership


async def remove_member(
    db: AsyncSession,
    project: Project,
    user_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if membership.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove project owner")

    await db.delete(membership)
    await db.commit()
    return True


async def get_config(db: AsyncSession, project: Project) -> ProjectConfig:
    result = await db.execute(
        select(ProjectConfig).where(ProjectConfig.project_id == project.id)
    )
    config = result.scalar_one_or_none()
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project config not found")
    return config


async def update_config(
    db: AsyncSession,
    project: Project,
    data: UpdateProjectConfigRequest,
    partial: bool = False,
) -> ProjectConfig:
    config = await get_config(db, project)

    if partial:
        if data.llm_config is not None:
            config.llm_config = data.llm_config
        if data.embedder_config is not None:
            config.embedder_config = data.embedder_config
        if data.vector_store_config is not None:
            config.vector_store_config = data.vector_store_config
        if data.graph_store_config is not None:
            config.graph_store_config = data.graph_store_config
    else:
        config.llm_config = data.llm_config or {}
        config.embedder_config = data.embedder_config or {}
        config.vector_store_config = data.vector_store_config or {}
        config.graph_store_config = data.graph_store_config or {}

    await db.commit()
    await db.refresh(config)
    return config


async def test_connection(project_config: ProjectConfig) -> dict:
    results: dict[str, dict] = {}

    # Test Qdrant
    try:
        client = _get_qdrant()
        client.get_collections()
        results["vector_store"] = {"status": "ok"}
    except Exception as e:
        results["vector_store"] = {"status": "error", "detail": str(e)}

    # Test LiteLLM
    try:
        import httpx

        async with httpx.AsyncClient(timeout=5.0) as http:
            resp = await http.get(
                f"{settings.LITELLM_BASE_URL}/models",
                headers={"Authorization": f"Bearer {settings.LITELLM_MASTER_KEY}"},
            )
            resp.raise_for_status()
        results["llm"] = {"status": "ok"}
    except Exception as e:
        results["llm"] = {"status": "error", "detail": str(e)}

    # Test Neo4j (if configured)
    if settings.NEO4J_URI:
        try:
            from neo4j import GraphDatabase

            driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
            )
            driver.verify_connectivity()
            driver.close()
            results["graph_store"] = {"status": "ok"}
        except Exception as e:
            results["graph_store"] = {"status": "error", "detail": str(e)}
    else:
        results["graph_store"] = {"status": "not_configured"}

    return results
