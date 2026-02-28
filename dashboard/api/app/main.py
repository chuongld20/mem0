from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.projects.router import router as projects_router
from app.memories.router import router as memories_router
from app.analytics.router import router as analytics_router
from app.webhooks.router import router as webhooks_router
from app.mcp.router import router as mcp_router
from app.graph.router import router as graph_router
from app.admin.router import router as admin_router
from app.middleware import AnalyticsMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="SidMemo API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AnalyticsMiddleware)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(projects_router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(memories_router, prefix="/api/v1/projects", tags=["memories"])
app.include_router(analytics_router, prefix="/api/v1/projects", tags=["analytics"])
app.include_router(webhooks_router, prefix="/api/v1/projects", tags=["webhooks"])
app.include_router(graph_router, prefix="/api/v1/projects", tags=["graph"])
app.include_router(mcp_router, prefix="/mcp", tags=["mcp"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])


@app.get("/health")
async def health():
    return {"status": "ok"}
