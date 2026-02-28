from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_principal
from app.db import get_db
from app.models import Project, ProjectMember, User

ROLE_HIERARCHY = {"owner": 4, "admin": 3, "member": 2, "viewer": 1}


def check_role_level(user_role: str, min_role: str) -> bool:
    return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY.get(min_role, 0)


def require_project_access(min_role: str = "viewer"):
    async def _dependency(
        slug: str,
        request: Request,
        user: User = Depends(get_current_principal),
        db: AsyncSession = Depends(get_db),
    ) -> tuple[Project, ProjectMember]:
        result = await db.execute(
            select(Project).where(Project.slug == slug, Project.is_archived.is_(False))
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == user.id,
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a project member")

        if not check_role_level(membership.role, min_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires at least '{min_role}' role",
            )

        request.state.project_id = project.id
        request.state.user_id = user.id

        return project, membership

    return _dependency
