import csv
import io
import json
import logging
import uuid

from mem0 import Memory
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Memory as MemoryModel, MemoryHistory, Project, ProjectConfig

logger = logging.getLogger(__name__)


def _build_provider_block(cfg: dict | None, default_model: str) -> dict:
    """Build a mem0 provider config block (LLM or embedder).

    If cfg contains an api_key, connect directly to the provider.
    Otherwise fall back to the LiteLLM proxy.
    """
    model = default_model
    if cfg:
        model = cfg.get("model", model)

    api_key = cfg.get("api_key") if cfg else None
    if not api_key:
        return {
            "provider": "openai",
            "config": {
                "model": model,
                "openai_base_url": settings.LITELLM_BASE_URL,
                "api_key": settings.LITELLM_MASTER_KEY,
            },
        }

    provider = cfg.get("provider", "openai")
    block_config: dict = {"model": model, "api_key": api_key}

    base_url = cfg.get("api_base_url")
    if provider == "openai" and base_url:
        block_config["openai_base_url"] = base_url
    elif provider == "ollama":
        block_config.pop("api_key", None)
        if base_url:
            block_config["ollama_base_url"] = base_url

    return {"provider": provider, "config": block_config}


def build_mem0_client(project: Project, config: ProjectConfig | None) -> Memory:
    llm_cfg = config.llm_config if config else None
    embedder_cfg = config.embedder_config if config else None

    mem0_config: dict = {
        "llm": _build_provider_block(llm_cfg, settings.DEFAULT_LLM_MODEL),
        "embedder": _build_provider_block(embedder_cfg, settings.DEFAULT_EMBED_MODEL),
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "host": settings.QDRANT_HOST,
                "port": settings.QDRANT_PORT,
                "collection_name": project.qdrant_collection,
            },
        },
    }

    if config and config.graph_store_config:
        mem0_config["graph_store"] = config.graph_store_config

    return Memory.from_config(config_dict=mem0_config)


async def add_memory(
    db: AsyncSession,
    project: Project,
    config: ProjectConfig | None,
    messages: list[dict],
    user_id: str,
    agent_id: str | None = None,
    run_id: str | None = None,
    metadata: dict | None = None,
) -> MemoryModel:
    client = build_mem0_client(project, config)

    kwargs: dict = {"user_id": user_id}
    if agent_id:
        kwargs["agent_id"] = agent_id
    if run_id:
        kwargs["run_id"] = run_id
    if metadata:
        kwargs["metadata"] = metadata

    result = client.add(messages, **kwargs)

    results = result.get("results", []) if isinstance(result, dict) else result
    if not results:
        raise ValueError("mem0 returned no results from add()")

    first = results[0]
    memory_id = uuid.UUID(first["id"]) if isinstance(first["id"], str) else first["id"]

    row = MemoryModel(
        id=memory_id,
        project_id=project.id,
        mem0_user_id=user_id,
        mem0_agent_id=agent_id,
        mem0_run_id=run_id,
        content=first.get("memory", ""),
        metadata_=metadata or {},
        categories=first.get("categories", []),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def list_memories(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: str | None = None,
    agent_id: str | None = None,
    search_text: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[MemoryModel], int]:
    base = select(MemoryModel).where(MemoryModel.project_id == project_id)

    if user_id:
        base = base.where(MemoryModel.mem0_user_id == user_id)
    if agent_id:
        base = base.where(MemoryModel.mem0_agent_id == agent_id)
    if search_text:
        base = base.where(MemoryModel.content.ilike(f"%{search_text}%"))

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar_one()

    query = base.order_by(MemoryModel.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(query)).scalars().all()

    return list(rows), total


async def get_memory(
    db: AsyncSession,
    project_id: uuid.UUID,
    memory_id: uuid.UUID,
) -> MemoryModel | None:
    result = await db.execute(
        select(MemoryModel).where(
            MemoryModel.id == memory_id,
            MemoryModel.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()


async def update_memory(
    db: AsyncSession,
    project: Project,
    config: ProjectConfig | None,
    memory_id: uuid.UUID,
    content: str,
    changed_by: uuid.UUID | None = None,
) -> MemoryModel | None:
    row = await get_memory(db, project.id, memory_id)
    if row is None:
        return None

    history = MemoryHistory(
        memory_id=row.id,
        content=row.content,
        metadata_=row.metadata_,
        changed_by=changed_by,
    )
    db.add(history)

    client = build_mem0_client(project, config)
    client.update(str(memory_id), content)

    row.content = content
    await db.commit()
    await db.refresh(row)
    return row


async def delete_memory(
    db: AsyncSession,
    project: Project,
    config: ProjectConfig | None,
    memory_id: uuid.UUID,
) -> bool:
    row = await get_memory(db, project.id, memory_id)
    if row is None:
        return False

    client = build_mem0_client(project, config)
    client.delete(str(memory_id))

    await db.delete(row)
    await db.commit()
    return True


async def search_memories(
    project: Project,
    config: ProjectConfig | None,
    query: str,
    user_id: str | None = None,
    agent_id: str | None = None,
    limit: int = 10,
    filters: dict | None = None,
) -> list[dict]:
    client = build_mem0_client(project, config)

    kwargs: dict = {"query": query, "limit": limit}
    if user_id:
        kwargs["user_id"] = user_id
    if agent_id:
        kwargs["agent_id"] = agent_id
    if filters:
        kwargs["filters"] = filters

    result = client.search(**kwargs)

    results = result.get("results", []) if isinstance(result, dict) else result
    out = []
    for r in results:
        out.append(
            {
                "id": r.get("id", ""),
                "content": r.get("memory", ""),
                "score": r.get("score"),
                "mem0_user_id": r.get("user_id"),
                "metadata_": r.get("metadata"),
            }
        )
    return out


async def bulk_delete(
    db: AsyncSession,
    project: Project,
    config: ProjectConfig | None,
    ids: list[uuid.UUID] | None = None,
    user_id: str | None = None,
) -> int:
    if not ids and not user_id:
        return 0

    query = select(MemoryModel).where(MemoryModel.project_id == project.id)
    if ids:
        query = query.where(MemoryModel.id.in_(ids))
    if user_id:
        query = query.where(MemoryModel.mem0_user_id == user_id)

    rows = (await db.execute(query)).scalars().all()
    if not rows:
        return 0

    client = build_mem0_client(project, config)
    for row in rows:
        try:
            client.delete(str(row.id))
        except Exception:
            logger.warning("Failed to delete memory %s from mem0", row.id)

    row_ids = [r.id for r in rows]
    await db.execute(delete(MemoryModel).where(MemoryModel.id.in_(row_ids)))
    await db.commit()
    return len(row_ids)


async def export_memories(
    db: AsyncSession,
    project_id: uuid.UUID,
    format: str = "jsonl",
):
    query = (
        select(MemoryModel)
        .where(MemoryModel.project_id == project_id)
        .order_by(MemoryModel.created_at)
    )
    result = await db.execute(query)
    rows = result.scalars().all()

    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["id", "content", "mem0_user_id", "mem0_agent_id", "mem0_run_id", "metadata", "categories", "created_at"])
        for row in rows:
            writer.writerow([
                str(row.id),
                row.content,
                row.mem0_user_id,
                row.mem0_agent_id or "",
                row.mem0_run_id or "",
                json.dumps(row.metadata_),
                json.dumps(row.categories),
                row.created_at.isoformat(),
            ])
        yield buf.getvalue()
    else:
        for row in rows:
            line = json.dumps(
                {
                    "id": str(row.id),
                    "content": row.content,
                    "mem0_user_id": row.mem0_user_id,
                    "mem0_agent_id": row.mem0_agent_id,
                    "mem0_run_id": row.mem0_run_id,
                    "metadata": row.metadata_,
                    "categories": row.categories,
                    "created_at": row.created_at.isoformat(),
                },
                ensure_ascii=False,
            )
            yield line + "\n"


async def import_memories(
    db: AsyncSession,
    project: Project,
    config: ProjectConfig | None,
    lines: list[str],
) -> dict:
    imported = 0
    skipped = 0
    failed = 0

    client = build_mem0_client(project, config)

    for line in lines:
        line = line.strip()
        if not line:
            skipped += 1
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            failed += 1
            continue

        content = data.get("content", "")
        mem0_user_id = data.get("mem0_user_id", data.get("user_id", ""))
        if not content or not mem0_user_id:
            failed += 1
            continue

        try:
            messages = [{"role": "user", "content": content}]
            kwargs: dict = {"user_id": mem0_user_id}
            agent_id = data.get("mem0_agent_id") or data.get("agent_id")
            run_id = data.get("mem0_run_id") or data.get("run_id")
            if agent_id:
                kwargs["agent_id"] = agent_id
            if run_id:
                kwargs["run_id"] = run_id

            result = client.add(messages, **kwargs)
            results = result.get("results", []) if isinstance(result, dict) else result
            if not results:
                failed += 1
                continue

            first = results[0]
            memory_id = uuid.UUID(first["id"]) if isinstance(first["id"], str) else first["id"]

            row = MemoryModel(
                id=memory_id,
                project_id=project.id,
                mem0_user_id=mem0_user_id,
                mem0_agent_id=agent_id,
                mem0_run_id=run_id,
                content=first.get("memory", content),
                metadata_=data.get("metadata", {}),
                categories=first.get("categories", []),
            )
            db.add(row)
            await db.commit()
            imported += 1
        except Exception:
            logger.exception("Failed to import memory line")
            await db.rollback()
            failed += 1

    return {"imported": imported, "skipped": skipped, "failed": failed}


async def get_history(
    db: AsyncSession,
    memory_id: uuid.UUID,
) -> list[MemoryHistory]:
    result = await db.execute(
        select(MemoryHistory)
        .where(MemoryHistory.memory_id == memory_id)
        .order_by(MemoryHistory.changed_at.desc())
    )
    return list(result.scalars().all())
