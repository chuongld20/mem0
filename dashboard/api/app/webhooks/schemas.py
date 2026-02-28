import uuid
from datetime import datetime

from pydantic import BaseModel, HttpUrl


class CreateWebhookRequest(BaseModel):
    url: HttpUrl
    events: list[str]
    is_active: bool = True


class UpdateWebhookRequest(BaseModel):
    url: HttpUrl | None = None
    events: list[str] | None = None
    is_active: bool | None = None


class WebhookResponse(BaseModel):
    id: uuid.UUID
    url: str
    events: list[str]
    is_active: bool
    last_triggered_at: datetime | None
    last_status_code: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeliveryResponse(BaseModel):
    id: uuid.UUID
    event: str
    payload: dict
    status_code: int | None
    attempt_count: int
    delivered_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
