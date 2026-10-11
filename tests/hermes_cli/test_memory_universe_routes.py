"""Dashboard contracts for the metadata-only memory universe routes."""

from __future__ import annotations

import pytest
from starlette.testclient import TestClient


@pytest.fixture(autouse=True)
def clear_memory_universe_cache():
    from agent.memory_graph_projection import clear_memory_universe_cache
    clear_memory_universe_cache()
    yield
    clear_memory_universe_cache()


@pytest.fixture
def client(_isolate_hermes_home):
    from hermes_cli.web_server import _SESSION_HEADER_NAME, _SESSION_TOKEN, app
    return TestClient(app, headers={_SESSION_HEADER_NAME: _SESSION_TOKEN})


def _write_memory(home, text: str):
    (home / "memories").mkdir(parents=True, exist_ok=True)
    (home / "memories" / "MEMORY.md").write_text(text, encoding="utf-8")


def test_memory_universe_routes_are_authenticated_and_redact_overview(client, _isolate_hermes_home):
    from hermes_constants import get_hermes_home
    from hermes_cli.web_server import app

    _write_memory(get_hermes_home(), "Confidential customer detail")
    unauthenticated = TestClient(app)
    assert unauthenticated.get("/api/memory/universe/stats").status_code == 401

    clusters = client.get("/api/memory/universe/clusters")
    assert clusters.status_code == 200, clusters.text
    nodes = client.get("/api/memory/universe/nodes", params={"kind": "memory", "limit": 1})
    assert nodes.status_code == 200, nodes.text
    node = nodes.json()["nodes"][0]
    assert "Confidential" not in str(node)
    assert "content" not in node

    metadata = client.get(f"/api/memory/universe/nodes/{node['id']}")
    assert metadata.status_code == 200
    content = client.get(f"/api/memory/universe/nodes/{node['id']}/content")
    assert content.status_code == 200
    assert content.json()["content"] == "Confidential customer detail"


def test_memory_universe_cursor_rejects_mismatch_and_foreign_ids(client, _isolate_hermes_home):
    from hermes_constants import get_hermes_home

    _write_memory(get_hermes_home(), "One\n§\nTwo\n§\nThree")
    page = client.get("/api/memory/universe/nodes", params={"kind": "memory", "limit": 1})
    assert page.status_code == 200
    cursor = page.json()["next_cursor"]
    assert cursor
    mismatch = client.get("/api/memory/universe/nodes", params={"kind": "skill", "cursor": cursor})
    assert mismatch.status_code == 400
    search = client.get("/api/memory/universe/search", params={"query": "memory"})
    assert search.status_code == 200
    assert search.json()["nodes"]
    foreign = client.get("/api/memory/universe/nodes/mu_m_not_from_this_profile")
    assert foreign.status_code == 404


def test_memory_universe_profile_scope_keeps_nodes_isolated(client, _isolate_hermes_home, monkeypatch):
    from hermes_constants import get_hermes_home
    from hermes_cli import profiles

    default_home = get_hermes_home()
    worker_home = default_home / "profiles" / "worker_alpha"
    worker_home.mkdir(parents=True)
    (worker_home / "config.yaml").write_text("{}\n", encoding="utf-8")
    monkeypatch.setattr(profiles, "_get_default_hermes_home", lambda: default_home)
    monkeypatch.setattr(profiles, "_get_profiles_root", lambda: default_home / "profiles")
    _write_memory(default_home, "Default only")
    _write_memory(worker_home, "Worker only")

    default_node = client.get("/api/memory/universe/nodes", params={"kind": "memory"}).json()["nodes"][0]["id"]
    worker_response = client.get("/api/memory/universe/nodes", params={"kind": "memory", "profile": "worker_alpha"})
    assert worker_response.status_code == 200, worker_response.text
    worker_node = worker_response.json()["nodes"][0]["id"]
    assert worker_node != default_node
    assert client.get(f"/api/memory/universe/nodes/{worker_node}").status_code == 404
