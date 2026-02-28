import uuid
from datetime import datetime
from ipaddress import IPv4Address, IPv6Address
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, EmailStr


def _coerce_ip(v: object) -> str | None:
    if v is None:
        return None
    if isinstance(v, (IPv4Address, IPv6Address)):
        return str(v)
    return str(v)


CoercedIP = Annotated[str | None, BeforeValidator(_coerce_ip)]


class AdminUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    is_active: bool
    is_superadmin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str
    password: str
    is_superadmin: bool = False


class UpdateUserRequest(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    is_superadmin: bool | None = None


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None
    actor_type: str
    project_id: uuid.UUID | None
    action: str
    target_type: str | None
    target_id: str | None
    payload: dict | None
    ip_address: CoercedIP = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PlatformStatsResponse(BaseModel):
    total_users: int
    active_users: int
    total_projects: int
    total_memories: int
    total_api_calls: int
