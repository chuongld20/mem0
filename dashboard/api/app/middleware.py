import logging
import re
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.db import async_session
from app.models import ApiEvent

logger = logging.getLogger(__name__)

# Map (method, path_pattern) → action name
_ACTION_PATTERNS: list[tuple[str, str, str]] = [
    ("POST", r"/api/v1/projects/[^/]+/memories/search$", "memory.search"),
    ("POST", r"/api/v1/projects/[^/]+/memories/bulk-delete$", "memory.bulk_delete"),
    ("POST", r"/api/v1/projects/[^/]+/memories/export$", "memory.export"),
    ("POST", r"/api/v1/projects/[^/]+/memories/import$", "memory.import"),
    ("POST", r"/api/v1/projects/[^/]+/memories$", "memory.add"),
    ("GET", r"/api/v1/projects/[^/]+/memories$", "memory.list"),
    ("GET", r"/api/v1/projects/[^/]+/memories/[^/]+$", "memory.get"),
    ("PATCH", r"/api/v1/projects/[^/]+/memories/[^/]+$", "memory.update"),
    ("DELETE", r"/api/v1/projects/[^/]+/memories/[^/]+$", "memory.delete"),
    ("GET", r"/api/v1/projects/[^/]+/graph$", "graph.get"),
    ("POST", r"/api/v1/projects/[^/]+/graph$", "graph.add"),
    ("GET", r"/api/v1/projects/[^/]+/webhooks$", "webhook.list"),
    ("POST", r"/api/v1/projects/[^/]+/webhooks$", "webhook.create"),
    ("PATCH", r"/api/v1/projects/[^/]+/webhooks/[^/]+$", "webhook.update"),
    ("DELETE", r"/api/v1/projects/[^/]+/webhooks/[^/]+$", "webhook.delete"),
]

# Paths to skip (auth, admin, health, static)
_SKIP_PREFIXES = ("/api/v1/auth", "/api/v1/admin", "/health", "/mcp", "/docs", "/openapi")


def _match_action(method: str, path: str) -> str | None:
    for m, pattern, action in _ACTION_PATTERNS:
        if method == m and re.match(pattern, path):
            return action
    return None


class AnalyticsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            return await call_next(request)

        action = _match_action(request.method, path)
        if action is None:
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        latency_ms = int((time.perf_counter() - start) * 1000)

        # Read IDs set by deps (may not exist if auth failed)
        project_id = getattr(request.state, "project_id", None)
        user_id = getattr(request.state, "user_id", None)

        try:
            async with async_session() as db:
                event = ApiEvent(
                    project_id=project_id,
                    user_id=user_id,
                    method=request.method,
                    path=path,
                    action=action,
                    status_code=response.status_code,
                    latency_ms=latency_ms,
                )
                db.add(event)
                await db.commit()
        except Exception:
            logger.exception("Failed to log analytics event")

        return response
