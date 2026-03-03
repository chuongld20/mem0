import uuid
from datetime import datetime

from pydantic import BaseModel


class CreateApiKeyRequest(BaseModel):
    name: str
    scopes: list[str] = []
    expires_in_days: int | None = None


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    scopes: list[str]
    last_used_at: datetime | None
    expires_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreatedResponse(ApiKeyResponse):
    key: str
