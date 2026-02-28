import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AddMemoryRequest(BaseModel):
    messages: list[dict] = Field(..., min_length=1)
    user_id: str
    agent_id: str | None = None
    run_id: str | None = None
    metadata: dict | None = None


class SearchMemoryRequest(BaseModel):
    query: str
    user_id: str | None = None
    agent_id: str | None = None
    limit: int = Field(default=10, ge=1, le=100)
    filters: dict | None = None


class UpdateMemoryRequest(BaseModel):
    content: str


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID] | None = None
    user_id: str | None = None


class MemoryResponse(BaseModel):
    id: uuid.UUID
    content: str
    mem0_user_id: str
    mem0_agent_id: str | None = None
    mem0_run_id: str | None = None
    metadata_: dict | None = Field(default=None, alias="metadata_")
    categories: list[str] = []
    score: float | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class MemoryListResponse(BaseModel):
    items: list[MemoryResponse]
    total: int
    page: int
    page_size: int


class MemoryHistoryResponse(BaseModel):
    id: uuid.UUID
    content: str
    metadata_: dict | None = Field(default=None, alias="metadata_")
    changed_by: uuid.UUID | None = None
    changed_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class SearchResultResponse(BaseModel):
    id: str
    content: str
    score: float | None = None
    mem0_user_id: str | None = None
    metadata_: dict | None = None


class ExportFormat(str, Enum):
    jsonl = "jsonl"
    csv = "csv"
