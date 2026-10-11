"""Metadata-only, profile-scoped projection of Hermes' existing learning graph.

The projection deliberately has no persistence of its own.  It derives visual
nodes and edges from ``agent.learning_graph`` and keeps only redacted metadata
in a short-lived, per-Hermes-home cache.  Memory bodies are read again only for
an explicit detail request.
"""

from __future__ import annotations

import base64
import hashlib
import json
import threading
import time
from collections import Counter
from dataclasses import dataclass
from typing import Any, Optional

from hermes_constants import get_hermes_home, profile_name_for_home


MAX_PAGE_SIZE = 100
_CACHE_TTL_SECONDS = 5.0
_CACHE_MAX_PROFILES = 8


@dataclass(frozen=True)
class MemoryUniverseSource:
    """Redacted graph data held in the bounded in-process cache."""

    profile: str
    nodes: tuple[dict[str, Any], ...]
    edges: tuple[dict[str, Any], ...]
    clusters: tuple[dict[str, Any], ...]
    raw_memory_ids: dict[str, str]
    created_at: float


_cache_lock = threading.Lock()
_cache: dict[str, MemoryUniverseSource] = {}


def _profile_label() -> str:
    return profile_name_for_home(get_hermes_home()) or "default"


def _cache_key() -> str:
    return str(get_hermes_home().resolve())


def _opaque_id(kind: str, *parts: str) -> str:
    raw = "\0".join(("hermes-memory-universe-v1", kind, *parts))
    return f"mu_{kind[0]}_{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:24]}"


def _cluster_id(category: str) -> str:
    return _opaque_id("cluster", category)


def _memory_identity(raw_id: str, duplicate_count: Counter[tuple[str, str]]) -> tuple[str, str, int]:
    """Return ``(source, fingerprint, occurrence)`` from a legacy memory node id."""
    _, source, _index, fingerprint = raw_id.split(":", 3)
    key = (source, fingerprint)
    occurrence = duplicate_count[key]
    duplicate_count[key] += 1
    return source, fingerprint, occurrence


def _sort_key(node: dict[str, Any]) -> tuple[str, str, str]:
    return (str(node["category"]), str(node["kind"]), str(node["id"]))


def _build_source() -> MemoryUniverseSource:
    """Build a redacted projection from the existing learning graph.

    ``build_learning_graph`` is the existing data authority.  Its returned
    memory bodies remain local to this function and are never copied into this
    projection or its cache.
    """
    from agent.learning_graph import build_learning_graph

    raw = build_learning_graph()
    profile = _profile_label()
    raw_to_public: dict[str, str] = {}
    raw_memory_ids: dict[str, str] = {}
    duplicate_count: Counter[tuple[str, str]] = Counter()
    nodes: list[dict[str, Any]] = []

    for raw_node in raw.get("nodes", []):
        raw_id = str(raw_node.get("id") or "")
        kind = str(raw_node.get("kind") or "")
        category = str(raw_node.get("category") or "general")
        if not raw_id or kind not in {"memory", "skill"}:
            continue
        if kind == "memory":
            try:
                source, fingerprint, occurrence = _memory_identity(raw_id, duplicate_count)
            except ValueError:
                continue
            public_id = _opaque_id("memory", source, fingerprint, str(occurrence))
            # A memory title can itself be private.  Keep the overview useful
            # without exposing the first line from MEMORY.md / USER.md.
            label = f"{source.title()} memory"
            raw_memory_ids[public_id] = raw_id
            project = None
        else:
            public_id = _opaque_id("skill", raw_id)
            label = str(raw_node.get("label") or "Skill")[:120]
            project = None
        raw_to_public[raw_id] = public_id
        nodes.append({
            "id": public_id,
            "kind": kind,
            "label": label,
            "category": category,
            "profile": profile,
            "project": project,
            "timestamp": raw_node.get("timestamp"),
            "connection_count": 0,
            "visual": {"cluster_id": _cluster_id(category), "tier": "detail"},
        })

    edge_rows: list[dict[str, Any]] = []
    seen_edges: set[tuple[str, str]] = set()
    raw_kind = {str(node.get("id")): str(node.get("kind")) for node in raw.get("nodes", [])}
    for raw_edge in raw.get("edges", []):
        source = raw_to_public.get(str(raw_edge.get("source") or ""))
        target = raw_to_public.get(str(raw_edge.get("target") or ""))
        if not source or not target or source == target:
            continue
        pair = tuple(sorted((source, target)))
        if pair in seen_edges:
            continue
        seen_edges.add(pair)
        source_kind = raw_kind.get(str(raw_edge.get("source") or ""))
        target_kind = raw_kind.get(str(raw_edge.get("target") or ""))
        relation = "related_skill" if source_kind == target_kind == "skill" else "memory_skill_overlap"
        edge_rows.append({"source_id": pair[0], "target_id": pair[1], "relation": relation, "weight": 1})

    connection_counts: Counter[str] = Counter()
    for edge in edge_rows:
        connection_counts[edge["source_id"]] += 1
        connection_counts[edge["target_id"]] += 1
    for node in nodes:
        node["connection_count"] = connection_counts[node["id"]]
        node["visual"] = {**node["visual"], "weight": connection_counts[node["id"]]}

    category_counts = Counter(str(node["category"]) for node in nodes)
    clusters = tuple({
        "id": _cluster_id(category),
        "parent_id": "root",
        "kind": "category",
        "label": category,
        "node_count": count,
        "project_count": 0,
    } for category, count in sorted(category_counts.items()))
    return MemoryUniverseSource(
        profile=profile,
        nodes=tuple(sorted(nodes, key=_sort_key)),
        edges=tuple(sorted(edge_rows, key=lambda edge: (edge["source_id"], edge["target_id"]))),
        clusters=clusters,
        raw_memory_ids=raw_memory_ids,
        created_at=time.monotonic(),
    )


def get_memory_universe_source(*, refresh: bool = False) -> MemoryUniverseSource:
    """Return a bounded, short-lived cache for the active profile only."""
    key = _cache_key()
    now = time.monotonic()
    with _cache_lock:
        existing = _cache.get(key)
        if not refresh and existing is not None and now - existing.created_at < _CACHE_TTL_SECONDS:
            return existing
    source = _build_source()
    with _cache_lock:
        if len(_cache) >= _CACHE_MAX_PROFILES and key not in _cache:
            oldest_key = min(_cache, key=lambda item: _cache[item].created_at)
            _cache.pop(oldest_key, None)
        _cache[key] = source
    return source


def clear_memory_universe_cache() -> None:
    """Test and lifecycle seam; never writes or changes Hermes memory."""
    with _cache_lock:
        _cache.clear()


def _encode_cursor(filters: dict[str, str], after: Optional[tuple[str, str, str]]) -> Optional[str]:
    if after is None:
        return None
    payload = json.dumps({"v": 1, "filters": filters, "after": after}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")


def _decode_cursor(cursor: Optional[str], filters: dict[str, str]) -> Optional[tuple[str, str, str]]:
    if not cursor:
        return None
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
        after = payload["after"]
        if payload.get("v") != 1 or payload.get("filters") != filters or not isinstance(after, list) or len(after) != 3:
            raise ValueError
        return tuple(str(value) for value in after)
    except (KeyError, TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
        raise ValueError("invalid cursor") from None


def _limit(value: int) -> int:
    return max(1, min(int(value), MAX_PAGE_SIZE))


def list_clusters() -> dict[str, Any]:
    source = get_memory_universe_source()
    return {
        "profile": source.profile,
        "root": {"id": "root", "kind": "universe", "label": "Hermes Memory", "node_count": len(source.nodes)},
        "clusters": list(source.clusters),
    }


def list_nodes(*, cluster_id: Optional[str] = None, kind: Optional[str] = None, query: Optional[str] = None,
               limit: int = 50, cursor: Optional[str] = None) -> dict[str, Any]:
    source = get_memory_universe_source()
    normalized_kind = (kind or "").strip().lower()
    normalized_query = (query or "").strip().lower()
    filters = {"cluster_id": cluster_id or "", "kind": normalized_kind, "query": normalized_query}
    if normalized_kind and normalized_kind not in {"memory", "skill"}:
        raise ValueError("invalid node kind")
    after = _decode_cursor(cursor, filters)
    nodes = sorted((node for node in source.nodes if (
        (not cluster_id or node["visual"]["cluster_id"] == cluster_id)
        and (not normalized_kind or node["kind"] == normalized_kind)
        and (not normalized_query or normalized_query in node["label"].lower() or normalized_query in node["category"].lower())
    )), key=_sort_key)
    if cluster_id and not any(cluster["id"] == cluster_id for cluster in source.clusters):
        raise LookupError("cluster not found")
    if after is not None:
        nodes = [node for node in nodes if _sort_key(node) > after]
    page_size = _limit(limit)
    page = nodes[:page_size]
    next_after = _sort_key(page[-1]) if len(nodes) > page_size and page else None
    return {"profile": source.profile, "nodes": page, "next_cursor": _encode_cursor(filters, next_after), "has_more": next_after is not None}


def get_node(node_id: str) -> dict[str, Any]:
    source = get_memory_universe_source()
    for node in source.nodes:
        if node["id"] == node_id:
            return {"profile": source.profile, "node": node}
    raise LookupError("node not found")


def list_edges(*, node_id: str, limit: int = 50, cursor: Optional[str] = None) -> dict[str, Any]:
    source = get_memory_universe_source()
    if not any(node["id"] == node_id for node in source.nodes):
        raise LookupError("node not found")
    filters = {"node_id": node_id}
    after = _decode_cursor(cursor, filters)
    rows = [edge for edge in source.edges if node_id in (edge["source_id"], edge["target_id"])]
    if after is not None:
        rows = [edge for edge in rows if (edge["source_id"], edge["target_id"], edge["relation"]) > after]
    page_size = _limit(limit)
    page = rows[:page_size]
    next_after = ((page[-1]["source_id"], page[-1]["target_id"], page[-1]["relation"])
                  if len(rows) > page_size and page else None)
    return {"profile": source.profile, "edges": page, "next_cursor": _encode_cursor(filters, next_after), "has_more": next_after is not None}


def get_stats() -> dict[str, Any]:
    source = get_memory_universe_source()
    counts = Counter(node["kind"] for node in source.nodes)
    return {
        "profile": source.profile,
        "nodes": len(source.nodes),
        "edges": len(source.edges),
        "clusters": len(source.clusters),
        "by_kind": dict(sorted(counts.items())),
        "cache_ttl_seconds": _CACHE_TTL_SECONDS,
    }


def get_memory_content(node_id: str) -> dict[str, Any]:
    """Read one built-in memory entry only after the caller selected its public id."""
    source = get_memory_universe_source()
    raw_id = source.raw_memory_ids.get(node_id)
    if raw_id is None:
        raise LookupError("node not found")
    try:
        _, wanted_source, _index, wanted_fingerprint = raw_id.split(":", 3)
    except ValueError:
        raise LookupError("node not found") from None
    from agent.learning_graph import memory_fingerprint
    from tools.memory_tool import MemoryStore

    path = get_hermes_home() / "memories" / ("MEMORY.md" if wanted_source == "memory" else "USER.md")
    for entry in MemoryStore._read_file(path):
        if memory_fingerprint(entry) == wanted_fingerprint:
            return {"profile": source.profile, "node_id": node_id, "content": entry}
    raise LookupError("node not found")
