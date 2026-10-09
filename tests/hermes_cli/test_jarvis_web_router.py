"""Contracts for Jarvis dashboard routes."""

from __future__ import annotations

import asyncio
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from typing import Any

import pytest

from hermes_cli.web_models import JarvisApprovalDecision, JarvisOrchestrationRequest
from hermes_cli.web_routers import jarvis


@dataclass(frozen=True)
class FakeLimits:
    max_agents: int = 3
    max_parallel: int = 2
    max_steps_per_agent: int = 4
    max_total_tasks: int = 6
    max_input_chars: int = 12000
    cost_tier: str = "low"
    max_estimated_cost_usd: float = 0
    routing_mode: str = "local_first"
    max_prompt_tokens: int = 4000
    max_completion_tokens: int = 1200

    def normalized(self):
        return self


@dataclass(frozen=True)
class FakeSpec:
    agent_id: str
    title: str
    scope: str
    skills: tuple[str, ...]
    toolsets: tuple[str, ...]
    permissions: tuple[str, ...]
    max_steps: int = 4
    max_input_chars: int = 6000


class FakeModule:
    SCHEMA_VERSION = "jarvis.multi_agent.v1"
    OrchestrationLimits = FakeLimits
    asdict = staticmethod(lambda value: value if isinstance(value, dict) else asdict(value))
    AGENTS = {
        "instagram": FakeSpec(
            "instagram",
            "Instagram Agent",
            "Draft social content.",
            ("jarvis-assistant",),
            ("web",),
            ("draft_content",),
        )
    }

    @staticmethod
    def build_plan(request: str, payload: dict[str, Any], limits: FakeLimits) -> dict[str, Any]:
        return {
            "schema": FakeModule.SCHEMA_VERSION,
            "status": "planned",
            "request": request,
            "payload": payload,
            "limits": asdict(limits),
            "tasks": [{"agent_id": "instagram", "model_route": "jarvis.specialist_model"}],
            "parallel_groups": [["instagram"]],
            "model_policy": {"cost_tier": limits.cost_tier},
            "token_policy": {"estimated_prompt_tokens": 12, "max_prompt_tokens": limits.max_prompt_tokens},
            "missing_integrations": ["instagram_meta_api"],
        }

    @staticmethod
    def orchestrate(request: str, payload: dict[str, Any], limits: FakeLimits) -> dict[str, Any]:
        out = FakeModule.build_plan(request, payload, limits)
        out["status"] = "completed"
        out["consolidated"] = {"external_actions_executed": False}
        return out

    @staticmethod
    def run_agent(agent_id: str, request: str, payload: dict[str, Any]):
        return {
            "agent_id": agent_id,
            "status": "drafted",
            "summary": request,
            "structured": payload,
            "approval_required": [{"action": "publish_or_schedule_instagram_content"}],
            "missing_integrations": ["instagram_meta_api"],
            "handoff": [],
        }


@contextmanager
def null_scope(_profile):
    yield


def test_status_reports_real_availability_without_external_calls(monkeypatch):
    monkeypatch.setattr(jarvis, "_orchestrator_module", lambda: FakeModule)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "load_config", lambda: {"skills": {"config": {"jarvis.cost_tier": "local"}}})
    monkeypatch.setattr(jarvis, "load_env", lambda: {})
    monkeypatch.setattr(jarvis, "_jarvis_cron_jobs", lambda profile: [{"id": "morning", "enabled": False}])
    monkeypatch.setattr(jarvis, "_model_inventory", lambda profile: {"available": True, "local": [], "cloud": [], "fallback_rules": [], "note": ""})
    monkeypatch.setattr(jarvis, "_recent_runs", lambda: [])

    status = jarvis._status_sync("default")

    assert status["orchestrator"]["available"] is True
    assert status["agents"][0]["agent_id"] == "instagram"
    assert status["agents"][0]["model_route"] == "jarvis.specialist_model"
    assert status["config"]["cost_tier"] == "local"
    assert status["models"]["available"] is True
    assert status["runs"] == []
    assert status["automations"]["activation_policy"] == "manual_approval_required"


def test_model_inventory_splits_local_and_cloud_rows(monkeypatch):
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "load_picker_context", None, raising=False)

    def fake_payload(_context, **_kwargs):
        return {"providers": [
            {"slug": "llamacpp", "name": "Local", "models": ["tiny.gguf"], "authenticated": True, "auth_type": "local", "source": "local-runtime"},
            {"slug": "openai", "name": "OpenAI", "models": ["gpt-x"], "authenticated": False, "source": "catalog"},
        ]}

    import hermes_cli.inventory as inventory

    monkeypatch.setattr(inventory, "build_model_options_payload", fake_payload)
    monkeypatch.setattr(inventory, "load_picker_context", lambda: {})

    result = jarvis._model_inventory("default")

    assert result["available"] is True
    assert result["local"][0]["provider"] == "llamacpp"
    assert result["cloud"][0]["provider"] == "openai"


def test_persisted_run_records_are_compact_and_do_not_store_payloads(tmp_path, monkeypatch):
    monkeypatch.setattr(jarvis, "get_hermes_home", lambda: tmp_path)
    output = {
        "schema": "jarvis.multi_agent.v1",
        "status": "completed",
        "request": "Bitte bearbeite diese Aufgabe" * 40,
        "payload": {"secret": "must-not-be-written"},
        "tasks": [{"agent_id": "email"}],
        "token_policy": {"estimated_prompt_tokens": 10},
        "missing_integrations": ["google-workspace_or_himalaya"],
        "consolidated": {
            "approval_required": [{"action": "send_or_modify_email"}],
            "external_actions_executed": False,
        },
    }

    jarvis._persist_run_record("run", output)

    rows = jarvis._recent_runs()
    assert rows[0]["kind"] == "run"
    assert rows[0]["agents"] == ["email"]
    assert "payload" not in rows[0]
    assert "must-not-be-written" not in (tmp_path / "jarvis" / "runs.jsonl").read_text(encoding="utf-8")


def test_approval_queue_is_persistent_and_one_time_use(tmp_path, monkeypatch):
    monkeypatch.setattr(jarvis, "get_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    output = {
        "consolidated": {
            "approval_required": [{
                "action": "send_or_modify_email",
                "reason": "External email write",
                "items": ["thread-1"],
            }]
        }
    }

    created = jarvis._enqueue_approvals(output)
    assert len(created) == 1
    assert jarvis._load_approvals()[0]["status"] == "pending"

    decision = JarvisApprovalDecision(decision="deny")
    result = asyncio.run(jarvis.decide_jarvis_approval(created[0]["id"], decision))
    assert result["approval"]["status"] == "denied"
    assert result["executed"] is False

    with pytest.raises(Exception) as exc:
        asyncio.run(jarvis.decide_jarvis_approval(created[0]["id"], decision))
    assert getattr(exc.value, "status_code", None) == 409


def test_plan_endpoint_uses_python_orchestrator_directly(monkeypatch):
    monkeypatch.setattr(jarvis, "_orchestrator_module", lambda: FakeModule)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "_persist_run_record", lambda kind, output: None)

    body = JarvisOrchestrationRequest(
        request="Plane Instagram Content",
        payload={"brand": "Jarvis"},
        limits={"cost_tier": "local", "max_agents": 1},
    )

    output = asyncio.run(jarvis.plan_jarvis_orchestration(body, profile="default"))

    assert output["status"] == "planned"
    assert output["limits"]["cost_tier"] == "local"
    assert output["token_policy"]["max_prompt_tokens"] == 4000
    assert output["tasks"][0]["model_route"] == "jarvis.specialist_model"


def test_run_endpoint_never_executes_external_actions(monkeypatch):
    monkeypatch.setattr(jarvis, "_orchestrator_module", lambda: FakeModule)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "_persist_run_record", lambda kind, output: None)

    body = JarvisOrchestrationRequest(request="Starte Agenten")

    output = asyncio.run(jarvis.run_jarvis_orchestration(body, profile=None))

    assert output["status"] == "completed"
    assert output["consolidated"]["external_actions_executed"] is False


def test_unknown_agent_returns_404(monkeypatch):
    monkeypatch.setattr(jarvis, "_orchestrator_module", lambda: FakeModule)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "_persist_run_record", lambda kind, output: None)

    body = JarvisOrchestrationRequest(request="Test")

    with pytest.raises(Exception) as exc:
        asyncio.run(jarvis.run_jarvis_agent("missing", body))

    assert getattr(exc.value, "status_code", None) == 404
