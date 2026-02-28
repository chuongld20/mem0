import logging
from typing import Any

from app.config import settings
from app.models import Project, ProjectConfig

logger = logging.getLogger(__name__)


def _get_neo4j_driver(project: Project, config: ProjectConfig | None):
    """Create a Neo4j driver for the project's graph database."""
    uri = settings.NEO4J_URI
    if config and config.graph_store_config:
        uri = config.graph_store_config.get("config", {}).get("url", uri)

    if not uri:
        return None

    try:
        from neo4j import GraphDatabase
    except ImportError:
        logger.warning("neo4j package not installed")
        return None

    username = settings.NEO4J_USERNAME
    password = settings.NEO4J_PASSWORD

    if config and config.graph_store_config:
        cfg = config.graph_store_config.get("config", {})
        username = cfg.get("username", username)
        password = cfg.get("password", password)

    return GraphDatabase.driver(uri, auth=(username, password))


def _get_database_name(project: Project) -> str:
    return project.neo4j_database or "neo4j"


async def list_entities(
    project: Project,
    config: ProjectConfig | None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    driver = _get_neo4j_driver(project, config)
    if driver is None:
        return [], 0

    db_name = _get_database_name(project)

    with driver.session(database=db_name) as session:
        count_query = "MATCH (n) "
        if search:
            count_query += "WHERE n.name CONTAINS $search "
        count_query += "RETURN count(n) AS total"

        total = session.run(count_query, search=search).single()["total"]

        query = "MATCH (n) "
        if search:
            query += "WHERE n.name CONTAINS $search "
        query += """
            OPTIONAL MATCH (n)-[r]-()
            WITH n, count(r) AS rel_count
            RETURN n.name AS name, labels(n) AS labels, properties(n) AS props, rel_count
            ORDER BY n.name
            SKIP $skip LIMIT $limit
        """

        skip = (page - 1) * page_size
        result = session.run(query, search=search, skip=skip, limit=page_size)

        entities = []
        for record in result:
            labels = record["labels"]
            entities.append({
                "name": record["name"] or "",
                "type": labels[0] if labels else None,
                "properties": {k: v for k, v in record["props"].items() if k != "name"},
                "relation_count": record["rel_count"],
            })

    driver.close()
    return entities, total


async def get_entity(
    project: Project,
    config: ProjectConfig | None,
    entity_name: str,
) -> dict | None:
    driver = _get_neo4j_driver(project, config)
    if driver is None:
        return None

    db_name = _get_database_name(project)

    with driver.session(database=db_name) as session:
        result = session.run(
            "MATCH (n {name: $name}) RETURN labels(n) AS labels, properties(n) AS props",
            name=entity_name,
        )
        record = result.single()
        if record is None:
            driver.close()
            return None

        labels = record["labels"]
        props = record["props"]

        rel_result = session.run(
            """
            MATCH (n {name: $name})-[r]-(m)
            RETURN elementId(r) AS id, n.name AS source, m.name AS target,
                   type(r) AS rel_type, properties(r) AS rel_props
            """,
            name=entity_name,
        )

        relations = []
        for rel in rel_result:
            relations.append({
                "id": rel["id"],
                "source": rel["source"],
                "target": rel["target"],
                "type": rel["rel_type"],
                "properties": rel["rel_props"] or {},
            })

    driver.close()
    return {
        "name": entity_name,
        "type": labels[0] if labels else None,
        "properties": {k: v for k, v in props.items() if k != "name"},
        "relations": relations,
    }


async def list_relations(
    project: Project,
    config: ProjectConfig | None,
    source: str | None = None,
    target: str | None = None,
    rel_type: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict], int]:
    driver = _get_neo4j_driver(project, config)
    if driver is None:
        return [], 0

    db_name = _get_database_name(project)

    with driver.session(database=db_name) as session:
        where_clauses = []
        params: dict[str, Any] = {}

        if source:
            where_clauses.append("a.name = $source")
            params["source"] = source
        if target:
            where_clauses.append("b.name = $target")
            params["target"] = target
        if rel_type:
            where_clauses.append("type(r) = $rel_type")
            params["rel_type"] = rel_type

        where = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        count_q = f"MATCH (a)-[r]->(b) {where} RETURN count(r) AS total"
        total = session.run(count_q, **params).single()["total"]

        skip = (page - 1) * page_size
        params["skip"] = skip
        params["limit"] = page_size

        query = f"""
            MATCH (a)-[r]->(b) {where}
            RETURN elementId(r) AS id, a.name AS source, b.name AS target,
                   type(r) AS rel_type, properties(r) AS props
            ORDER BY a.name, type(r)
            SKIP $skip LIMIT $limit
        """

        result = session.run(query, **params)
        relations = []
        for record in result:
            relations.append({
                "id": record["id"],
                "source": record["source"],
                "target": record["target"],
                "type": record["rel_type"],
                "properties": record["props"] or {},
            })

    driver.close()
    return relations, total


async def delete_entity(
    project: Project,
    config: ProjectConfig | None,
    entity_name: str,
) -> bool:
    driver = _get_neo4j_driver(project, config)
    if driver is None:
        return False

    db_name = _get_database_name(project)

    with driver.session(database=db_name) as session:
        result = session.run(
            "MATCH (n {name: $name}) DETACH DELETE n RETURN count(n) AS deleted",
            name=entity_name,
        )
        deleted = result.single()["deleted"]

    driver.close()
    return deleted > 0


async def delete_relation(
    project: Project,
    config: ProjectConfig | None,
    rel_id: str,
) -> bool:
    driver = _get_neo4j_driver(project, config)
    if driver is None:
        return False

    db_name = _get_database_name(project)

    with driver.session(database=db_name) as session:
        result = session.run(
            """
            MATCH ()-[r]->()
            WHERE elementId(r) = $rel_id
            DELETE r
            RETURN count(r) AS deleted
            """,
            rel_id=rel_id,
        )
        deleted = result.single()["deleted"]

    driver.close()
    return deleted > 0


async def get_subgraph(
    project: Project,
    config: ProjectConfig | None,
    entity_names: list[str],
    hops: int = 1,
) -> dict:
    driver = _get_neo4j_driver(project, config)
    if driver is None:
        return {"entities": [], "relations": []}

    db_name = _get_database_name(project)

    with driver.session(database=db_name) as session:
        query = """
            MATCH path = (n)-[*1..%d]-(m)
            WHERE n.name IN $names
            UNWIND nodes(path) AS node
            UNWIND relationships(path) AS rel
            WITH COLLECT(DISTINCT node) AS all_nodes, COLLECT(DISTINCT rel) AS all_rels
            RETURN all_nodes, all_rels
        """ % min(hops, 3)

        result = session.run(query, names=entity_names)
        record = result.single()

        entities = []
        relations = []

        if record:
            seen_entities = set()
            for node in record["all_nodes"] or []:
                name = node.get("name", "")
                if name and name not in seen_entities:
                    seen_entities.add(name)
                    labels = list(node.labels) if hasattr(node, "labels") else []
                    entities.append({
                        "name": name,
                        "type": labels[0] if labels else None,
                        "properties": {k: v for k, v in dict(node).items() if k != "name"},
                        "relation_count": 0,
                    })

            seen_rels = set()
            for rel in record["all_rels"] or []:
                rel_id = rel.element_id if hasattr(rel, "element_id") else str(id(rel))
                if rel_id not in seen_rels:
                    seen_rels.add(rel_id)
                    start_name = rel.start_node.get("name", "")
                    end_name = rel.end_node.get("name", "")
                    relations.append({
                        "id": rel_id,
                        "source": start_name,
                        "target": end_name,
                        "type": rel.type,
                        "properties": dict(rel) if rel else {},
                    })

    driver.close()
    return {"entities": entities, "relations": relations}
