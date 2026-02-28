from pydantic import BaseModel


class TopUser(BaseModel):
    user_id: str
    memory_count: int


class OverviewResponse(BaseModel):
    total_memories: int
    total_users: int
    growth_rate_7d: float
    top_users: list[TopUser]


class UsagePoint(BaseModel):
    date: str
    count: int
    action: str


class UsageResponse(BaseModel):
    data: list[UsagePoint]
    interval: str


class RetrievalResponse(BaseModel):
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    total_searches: int
