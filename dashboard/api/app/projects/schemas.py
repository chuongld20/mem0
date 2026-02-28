import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class CreateProjectRequest(BaseModel):
    name: str
    slug: str | None = None
    description: str | None = None


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    description: str | None
    qdrant_collection: str
    neo4j_database: str | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    role: str

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int


class AddMemberRequest(BaseModel):
    email: EmailStr
    role: str


class UpdateMemberRequest(BaseModel):
    role: str


class MemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectConfigResponse(BaseModel):
    llm_config: dict
    embedder_config: dict
    vector_store_config: dict
    graph_store_config: dict
    updated_at: datetime

    model_config = {"from_attributes": True}


class UpdateProjectConfigRequest(BaseModel):
    llm_config: dict | None = None
    embedder_config: dict | None = None
    vector_store_config: dict | None = None
    graph_store_config: dict | None = None
