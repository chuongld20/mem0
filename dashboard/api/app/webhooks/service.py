import hashlib
import hmac
import json
import logging
import secrets
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Webhook, WebhookDelivery

logger = logging.getLogger(__name__)


async def create_webhook(
    db: AsyncSession, project_id: uuid.UUID, data: "CreateWebhookRequest"
) -> Webhook:
    webhook = Webhook(
        project_id=project_id,
        url=str(data.url),
        events=data.events,
        is_active=data.is_active,
        secret=secrets.token_urlsafe(32),
    )
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)
    return webhook


async def list_webhooks(db: AsyncSession, project_id: uuid.UUID) -> list[Webhook]:
    result = await db.execute(
        select(Webhook).where(Webhook.project_id == project_id).order_by(Webhook.created_at.desc())
    )
    return list(result.scalars().all())


async def get_webhook(db: AsyncSession, webhook_id: uuid.UUID) -> Webhook | None:
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    return result.scalar_one_or_none()


async def update_webhook(
    db: AsyncSession, webhook_id: uuid.UUID, data: "UpdateWebhookRequest"
) -> Webhook | None:
    webhook = await get_webhook(db, webhook_id)
    if webhook is None:
        return None
    if data.url is not None:
        webhook.url = str(data.url)
    if data.events is not None:
        webhook.events = data.events
    if data.is_active is not None:
        webhook.is_active = data.is_active
    await db.commit()
    await db.refresh(webhook)
    return webhook


async def delete_webhook(db: AsyncSession, webhook_id: uuid.UUID) -> bool:
    webhook = await get_webhook(db, webhook_id)
    if webhook is None:
        return False
    await db.delete(webhook)
    await db.commit()
    return True


def _sign_payload(payload_bytes: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()


async def _deliver(
    client: httpx.AsyncClient, webhook: Webhook, event: str, payload: dict, db: AsyncSession
) -> WebhookDelivery:
    payload_bytes = json.dumps(payload, default=str).encode()
    signature = _sign_payload(payload_bytes, webhook.secret)

    delivery = WebhookDelivery(
        webhook_id=webhook.id,
        event=event,
        payload=payload,
        attempt_count=1,
    )

    try:
        resp = await client.post(
            webhook.url,
            content=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "X-Webhook-Signature": signature,
                "X-Webhook-Event": event,
            },
            timeout=10.0,
        )
        delivery.status_code = resp.status_code
        delivery.response_body = resp.text[:2000] if resp.text else None
        if 200 <= resp.status_code < 300:
            delivery.delivered_at = datetime.now(timezone.utc)
    except httpx.HTTPError as exc:
        logger.warning("Webhook delivery failed for %s: %s", webhook.id, exc)
        delivery.response_body = str(exc)[:2000]

    webhook.last_triggered_at = datetime.now(timezone.utc)
    webhook.last_status_code = delivery.status_code

    db.add(delivery)
    await db.commit()
    await db.refresh(delivery)
    return delivery


async def fire_webhook(
    db: AsyncSession, project_id: uuid.UUID, event: str, payload: dict
) -> list[WebhookDelivery]:
    result = await db.execute(
        select(Webhook).where(
            Webhook.project_id == project_id,
            Webhook.is_active.is_(True),
        )
    )
    webhooks = list(result.scalars().all())
    matching = [w for w in webhooks if event in w.events or "*" in w.events]

    deliveries = []
    async with httpx.AsyncClient() as client:
        for wh in matching:
            delivery = await _deliver(client, wh, event, payload, db)
            deliveries.append(delivery)
    return deliveries


async def test_webhook(db: AsyncSession, webhook_id: uuid.UUID) -> WebhookDelivery | None:
    webhook = await get_webhook(db, webhook_id)
    if webhook is None:
        return None

    test_payload = {"event": "webhook.test", "webhook_id": str(webhook.id)}
    async with httpx.AsyncClient() as client:
        return await _deliver(client, webhook, "webhook.test", test_payload, db)


async def list_deliveries(
    db: AsyncSession, webhook_id: uuid.UUID
) -> list[WebhookDelivery]:
    result = await db.execute(
        select(WebhookDelivery)
        .where(WebhookDelivery.webhook_id == webhook_id)
        .order_by(WebhookDelivery.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())


async def retry_failed_deliveries(db: AsyncSession) -> int:
    result = await db.execute(
        select(WebhookDelivery).where(
            WebhookDelivery.delivered_at.is_(None),
            WebhookDelivery.attempt_count < 3,
        )
    )
    deliveries = list(result.scalars().all())
    retried = 0

    async with httpx.AsyncClient() as client:
        for delivery in deliveries:
            wh_result = await db.execute(
                select(Webhook).where(Webhook.id == delivery.webhook_id)
            )
            webhook = wh_result.scalar_one_or_none()
            if webhook is None or not webhook.is_active:
                continue

            payload_bytes = json.dumps(delivery.payload, default=str).encode()
            signature = _sign_payload(payload_bytes, webhook.secret)

            delivery.attempt_count += 1
            try:
                resp = await client.post(
                    webhook.url,
                    content=payload_bytes,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Signature": signature,
                        "X-Webhook-Event": delivery.event,
                    },
                    timeout=10.0,
                )
                delivery.status_code = resp.status_code
                delivery.response_body = resp.text[:2000] if resp.text else None
                if 200 <= resp.status_code < 300:
                    delivery.delivered_at = datetime.now(timezone.utc)
                    retried += 1
            except httpx.HTTPError as exc:
                delivery.response_body = str(exc)[:2000]

            webhook.last_triggered_at = datetime.now(timezone.utc)
            webhook.last_status_code = delivery.status_code

    await db.commit()
    return retried
