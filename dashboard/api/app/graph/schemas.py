import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class EntityResponse(BaseModel):
    name: str
    type: str | None = None
    properties: dict = {}
    relation_count: int = 0


class RelationResponse(BaseModel):
    id: str
    source: str
    target: str
    type: str
    properties: dict = {}


class EntityDetailResponse(BaseModel):
    name: str
    type: str | None = None
    properties: dict = {}
    relations: list[RelationResponse] = []


class SubgraphResponse(BaseModel):
    entities: list[EntityResponse]
    relations: list[RelationResponse]


class EntityListResponse(BaseModel):
    items: list[EntityResponse]
    total: int
    page: int
    page_size: int
