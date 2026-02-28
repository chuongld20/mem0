import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import log_audit
from app.auth.deps import get_current_principal
from app.db import get_db
from app.models import Project, ProjectMember, User
from app.projects.deps import require_project_access

from . import service
from .schemas import (
    CreateWebhookRequest,
    DeliveryResponse,
    UpdateWebhookRequest,
    WebhookResponse,
)

router = APIRouter(prefix="/{slug}/webhooks")


@router.get("", response_model=list[WebhookResponse])
async def list_webhooks(
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    return await service.list_webhooks(db, project.id)


@router.post("", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    body: CreateWebhookRequest,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    principal: User = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    webhook = await service.create_webhook(db, project.id, body)
    await log_audit(
        db, actor_id=principal.id, project_id=project.id,
        action="webhook.created", target_type="webhook", target_id=str(webhook.id),
        payload={"url": str(body.url), "events": body.events},
    )
    return webhook


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: uuid.UUID,
    body: UpdateWebhookRequest,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    principal: User = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    webhook = await service.get_webhook(db, webhook_id)
    if webhook is None or webhook.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    result = await service.update_webhook(db, webhook_id, body)
    await log_audit(
        db, actor_id=principal.id, project_id=project.id,
        action="webhook.updated", target_type="webhook", target_id=str(webhook_id),
    )
    return result


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: uuid.UUID,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    principal: User = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    webhook = await service.get_webhook(db, webhook_id)
    if webhook is None or webhook.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    await service.delete_webhook(db, webhook_id)
    await log_audit(
        db, actor_id=principal.id, project_id=project.id,
        action="webhook.deleted", target_type="webhook", target_id=str(webhook_id),
    )


@router.post("/{webhook_id}/test", response_model=DeliveryResponse)
async def test_webhook(
    webhook_id: uuid.UUID,
    access: tuple[Project, ProjectMember] = Depends(require_project_access("admin")),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    webhook = await service.get_webhook(db, webhook_id)
    if webhook is None or webhook.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    delivery = await service.test_webhook(db, webhook_id)
    return delivery


@router.get("/{webhook_id}/deliveries", response_model=list[DeliveryResponse])
async def list_deliveries(
    webhook_id: uuid.UUID,
    access: tuple[Project, ProjectMember] = Depends(require_project_access()),
    db: AsyncSession = Depends(get_db),
):
    project, _ = access
    webhook = await service.get_webhook(db, webhook_id)
    if webhook is None or webhook.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    return await service.list_deliveries(db, webhook_id)
