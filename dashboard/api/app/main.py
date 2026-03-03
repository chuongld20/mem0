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
    await _seed_admin()
    yield


async def _seed_admin():
    """Create default admin user from env vars if no users exist."""
    import logging
    from app.config import settings

    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        return

    from sqlalchemy import func, select
    from app.db import async_session
    from app.models import User
    from app.auth.service import pwd_context

    logger = logging.getLogger(__name__)
    async with async_session() as db:
        count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
        if count > 0:
            return
        user = User(
            email=settings.ADMIN_EMAIL,
            name="Admin",
            password_hash=pwd_context.hash(settings.ADMIN_PASSWORD),
            is_superadmin=True,
        )
        db.add(user)
        await db.commit()
        logger.info("Seeded admin user: %s", settings.ADMIN_EMAIL)


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
