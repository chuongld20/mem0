import logging
from typing import Any

from mem0 import Memory as Mem0Memory

from app.models import Project, ProjectConfig

logger = logging.getLogger(__name__)


def _build_mem0_config(project: Project, config: ProjectConfig | None) -> dict:
    """Build mem0 config dict from project and its config."""
    m0_config: dict[str, Any] = {}

    if config and config.llm_config:
        m0_config["llm"] = config.llm_config

    if config and config.embedder_config:
        m0_config["embedder"] = config.embedder_config

    if config and config.vector_store_config:
        m0_config["vector_store"] = config.vector_store_config
    else:
        m0_config["vector_store"] = {
            "provider": "qdrant",
            "config": {"collection_name": project.qdrant_collection},
        }

    if config and config.graph_store_config:
        m0_config["graph_store"] = config.graph_store_config

    return m0_config


def _get_mem0(project: Project, config: ProjectConfig | None) -> Mem0Memory:
    m0_config = _build_mem0_config(project, config)
    return Mem0Memory.from_config(config_dict=m0_config)


async def add_memories(
    project: Project, config: ProjectConfig | None, text: str, user_id: str
) -> list[dict]:
    m = _get_mem0(project, config)
    result = m.add(text, user_id=user_id)
    return result if isinstance(result, list) else [result]


async def search_memories(
    project: Project,
    config: ProjectConfig | None,
    query: str,
    user_id: str,
    limit: int = 10,
) -> list[dict]:
    m = _get_mem0(project, config)
    results = m.search(query, user_id=user_id, limit=limit)
    return results if isinstance(results, list) else []


async def get_all_memories(
    project: Project, config: ProjectConfig | None, user_id: str
) -> list[dict]:
    m = _get_mem0(project, config)
    results = m.get_all(user_id=user_id)
    return results if isinstance(results, list) else []


async def delete_memory(
    project: Project, config: ProjectConfig | None, memory_id: str
) -> bool:
    m = _get_mem0(project, config)
    m.delete(memory_id)
    return True
