import hashlib
import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.db import get_db
from app.models import ApiKey, Project, ProjectConfig, User

from . import service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/{slug}")

MCP_TOOLS = [
    {
        "name": "add_memories",
        "description": "Add memories from text for a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Text to create memories from"},
                "user_id": {"type": "string", "description": "User ID to associate memories with"},
            },
            "required": ["text", "user_id"],
        },
    },
    {
        "name": "search_memories",
        "description": "Search memories by query",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "user_id": {"type": "string", "description": "User ID to search memories for"},
                "limit": {"type": "integer", "description": "Max results", "default": 10},
            },
            "required": ["query", "user_id"],
        },
    },
    {
        "name": "get_all_memories",
        "description": "Get all memories for a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "User ID"},
            },
            "required": ["user_id"],
        },
    },
    {
        "name": "delete_memory",
        "description": "Delete a specific memory by ID",
        "inputSchema": {
            "type": "object",
            "properties": {
                "memory_id": {"type": "string", "description": "Memory ID to delete"},
            },
            "required": ["memory_id"],
        },
    },
]


async def _authenticate_and_get_project(
    slug: str, api_key: str | None, db: AsyncSession
) -> tuple[Project, ProjectConfig | None]:
    """Authenticate via API key and resolve project."""
    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key required")

    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    result = await db.execute(select(ApiKey).where(ApiKey.key_hash == key_hash))
    ak = result.scalar_one_or_none()
    if ak is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    result = await db.execute(
        select(Project).where(Project.slug == slug, Project.is_archived.is_(False))
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    result = await db.execute(
        select(ProjectConfig).where(ProjectConfig.project_id == project.id)
    )
    config = result.scalar_one_or_none()

    return project, config


@router.get("/sse")
async def sse_endpoint(
    slug: str,
    api_key: str | None = Query(None, alias="api_key"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    header_key = request.headers.get("X-API-Key") if request else None
    resolved_key = api_key or header_key

    project, config = await _authenticate_and_get_project(slug, resolved_key, db)

    async def event_generator():
        # Send server info
        yield {
            "event": "message",
            "data": json.dumps({
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {
                    "serverInfo": {"name": f"sidmemo-{project.slug}", "version": "1.0.0"},
                    "capabilities": {"tools": {}},
                },
            }),
        }

        # Send tool list
        yield {
            "event": "message",
            "data": json.dumps({
                "jsonrpc": "2.0",
                "method": "notifications/tools/list",
                "params": {"tools": MCP_TOOLS},
            }),
        }

    return EventSourceResponse(event_generator())


@router.post("/messages")
async def handle_message(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    header_key = request.headers.get("X-API-Key")
    project, config = await _authenticate_and_get_project(slug, header_key, db)

    body = await request.json()
    method = body.get("method", "")
    msg_id = body.get("id")
    params = body.get("params", {})

    if method == "tools/list":
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {"tools": MCP_TOOLS},
        })

    if method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})
        result = await _dispatch_tool(project, config, tool_name, arguments)
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {"content": [{"type": "text", "text": json.dumps(result, default=str)}]},
        })

    return JSONResponse({
        "jsonrpc": "2.0",
        "id": msg_id,
        "error": {"code": -32601, "message": f"Method not found: {method}"},
    })


async def _dispatch_tool(
    project: Project, config: ProjectConfig | None, tool_name: str, arguments: dict
) -> Any:
    if tool_name == "add_memories":
        return await service.add_memories(
            project, config, arguments["text"], arguments["user_id"]
        )
    elif tool_name == "search_memories":
        return await service.search_memories(
            project, config, arguments["query"], arguments["user_id"],
            limit=arguments.get("limit", 10),
        )
    elif tool_name == "get_all_memories":
        return await service.get_all_memories(project, config, arguments["user_id"])
    elif tool_name == "delete_memory":
        return await service.delete_memory(project, config, arguments["memory_id"])
    else:
        raise HTTPException(status_code=400, detail=f"Unknown tool: {tool_name}")
