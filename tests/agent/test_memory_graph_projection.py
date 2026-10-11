"""Behavior contracts for the redacted, cursor-paginated memory universe."""

from __future__ import annotations

import pytest

from agent import memory_graph_projection as projection
from hermes_constants import reset_hermes_home_override, set_hermes_home_override


@pytest.fixture(autouse=True)
def clear_projection_cache():
    projection.clear_memory_universe_cache()
    yield
    projection.clear_memory_universe_cache()


def _home_with_memory(tmp_path, text: str):
    home = tmp_path / ".hermes"
    (home / "memories").mkdir(parents=True)
    (home / "memories" / "MEMORY.md").write_text(text, encoding="utf-8")
    return home


def test_projection_redacts_memory_text_but_explicit_detail_reads_selected_entry(tmp_path):
    home = _home_with_memory(tmp_path, "private project decision\n§\nsecond private note")
    token = set_hermes_home_override(home)
    try:
        page = projection.list_nodes(kind="memory")
        assert len(page["nodes"]) == 2
        assert all("private" not in node["label"].lower() for node in page["nodes"])
        assert all("content" not in node for node in page["nodes"])
        selected = page["nodes"][0]["id"]
        detail = projection.get_memory_content(selected)
    finally:
        reset_hermes_home_override(token)

    assert detail["node_id"] == selected
    assert detail["content"] in {"private project decision", "second private note"}


def test_projection_isolated_between_hermes_homes(tmp_path):
    first = _home_with_memory(tmp_path / "first", "first profile memory")
    second = _home_with_memory(tmp_path / "second", "second profile memory")
    first_token = set_hermes_home_override(first)
    try:
        first_id = projection.list_nodes(kind="memory")["nodes"][0]["id"]
    finally:
        reset_hermes_home_override(first_token)
    second_token = set_hermes_home_override(second)
    try:
        second_page = projection.list_nodes(kind="memory")
        assert second_page["nodes"][0]["id"] != first_id
        with pytest.raises(LookupError):
            projection.get_node(first_id)
    finally:
        reset_hermes_home_override(second_token)


def test_empty_memory_universe_returns_empty_metadata(tmp_path):
    home = tmp_path / ".hermes"
    home.mkdir()
    token = set_hermes_home_override(home)
    try:
        assert projection.list_clusters()["clusters"] == []
        assert projection.list_nodes()["nodes"] == []
        assert projection.get_stats()["nodes"] == 0
    finally:
        reset_hermes_home_override(token)


def test_cursor_is_stable_bounded_and_rejects_filter_changes(monkeypatch):
    nodes = tuple({
        "id": f"node-{index:03d}", "kind": "skill", "label": f"Skill {index}",
        "category": "tools", "profile": "default", "project": None,
        "timestamp": None, "connection_count": 0,
        "visual": {"cluster_id": "cluster-tools", "tier": "detail", "weight": 0},
    } for index in range(2_048))
    source = projection.MemoryUniverseSource(
        profile="default", nodes=nodes, edges=(),
        clusters=({"id": "cluster-tools", "parent_id": "root", "kind": "category", "label": "tools", "node_count": len(nodes), "project_count": 0},),
        raw_memory_ids={}, created_at=0,
    )
    monkeypatch.setattr(projection, "_build_source", lambda: source)

    page = projection.list_nodes(limit=10_000)
    assert len(page["nodes"]) == projection.MAX_PAGE_SIZE
    all_ids = []
    while True:
        all_ids.extend(node["id"] for node in page["nodes"])
        if not page["has_more"]:
            break
        page = projection.list_nodes(limit=projection.MAX_PAGE_SIZE, cursor=page["next_cursor"])
    assert len(all_ids) == 2_048
    assert len(set(all_ids)) == 2_048
    with pytest.raises(ValueError):
        projection.list_nodes(kind="memory", cursor=projection.list_nodes(limit=1)["next_cursor"])


def test_edges_only_reference_visible_nodes_and_paginate(tmp_path):
    home = _home_with_memory(tmp_path, "memory related to no skills")
    token = set_hermes_home_override(home)
    try:
        source = projection.get_memory_universe_source()
        known_ids = {node["id"] for node in source.nodes}
        for node in source.nodes:
            page = projection.list_edges(node_id=node["id"], limit=1)
            assert all(edge["source_id"] in known_ids and edge["target_id"] in known_ids for edge in page["edges"])
        with pytest.raises(LookupError):
            projection.list_edges(node_id="foreign-node")
    finally:
        reset_hermes_home_override(token)
