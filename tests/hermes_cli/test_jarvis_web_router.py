"""Contracts for Jarvis dashboard routes."""

from __future__ import annotations

import asyncio
from contextlib import contextmanager
from dataclasses import asdict, dataclass
import json
from types import SimpleNamespace
from typing import Any

import pytest

from hermes_cli.web_models import (
    JarvisApprovalDecision,
    JarvisKanbanListRequest,
    JarvisOpenTasksRequest,
    JarvisOrchestrationRequest,
)
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


def test_jarvis_cron_jobs_filters_the_requested_profile(monkeypatch):
    from hermes_cli.web_routers import cron

    requested_profiles = []
    monkeypatch.setattr(
        cron,
        "_list_cron_jobs_sync",
        lambda profile: requested_profiles.append(profile) or [
            {"id": "jarvis", "skills": ["jarvis-assistant"]},
            {"id": "other", "skills": ["other-skill"]},
        ],
    )

    assert jarvis._jarvis_cron_jobs("work") == [{"id": "jarvis", "skills": ["jarvis-assistant"]}]
    assert requested_profiles == ["work"]


def test_jarvis_cron_jobs_preserves_empty_scheduler_result(monkeypatch):
    from hermes_cli.web_routers import cron

    monkeypatch.setattr(cron, "_list_cron_jobs_sync", lambda _profile: [])

    assert jarvis._jarvis_cron_jobs("default") == []


@pytest.mark.parametrize("failure", [OSError("scheduler unavailable"), RuntimeError("unexpected scheduler failure")])
def test_jarvis_cron_jobs_logs_failures_and_keeps_dashboard_fallback(monkeypatch, caplog, failure):
    from hermes_cli.web_routers import cron

    def _raise(_profile):
        raise failure

    monkeypatch.setattr(cron, "_list_cron_jobs_sync", _raise)

    assert jarvis._jarvis_cron_jobs("work") == []
    assert any(
        record.getMessage() == "Jarvis cron status is unavailable" and record.exc_info
        for record in caplog.records
    )


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


def test_model_inventory_logs_failure_and_preserves_fallback(monkeypatch, caplog):
    import hermes_cli.inventory as inventory

    monkeypatch.setattr(inventory, "load_picker_context", lambda: {})
    monkeypatch.setattr(
        inventory,
        "build_model_options_payload",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError("inventory unavailable")),
    )

    result = jarvis._model_inventory("work")

    assert result["available"] is False
    assert result["local"] == [] and result["cloud"] == []
    assert any(
        record.getMessage() == "Jarvis model inventory is unavailable" and record.exc_info
        for record in caplog.records
    )


def test_status_logs_orchestrator_failure_and_preserves_schema(monkeypatch, caplog):
    monkeypatch.setattr(jarvis, "_orchestrator_module", lambda: (_ for _ in ()).throw(RuntimeError("unavailable")))
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "load_config", lambda: {})
    monkeypatch.setattr(jarvis, "load_env", lambda: {})
    monkeypatch.setattr(jarvis, "_model_inventory", lambda _profile: {"available": False})
    monkeypatch.setattr(jarvis, "_recent_runs", lambda: [])
    monkeypatch.setattr(jarvis, "_jarvis_cron_jobs", lambda _profile: [])

    status = jarvis._status_sync("work")

    assert status["ok"] is True
    assert status["orchestrator"]["available"] is False
    assert status["agents"] == []
    assert any(
        record.getMessage() == "Jarvis orchestrator is unavailable" and record.exc_info
        for record in caplog.records
    )


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


def test_jarvis_storage_readers_accept_utf8_bom(tmp_path, monkeypatch):
    monkeypatch.setattr(jarvis, "get_hermes_home", lambda: tmp_path)
    store = tmp_path / "jarvis"
    store.mkdir()
    (store / "approvals.json").write_text(
        '[{"id": "approval-1", "status": "pending"}]', encoding="utf-8-sig"
    )
    (store / "runs.jsonl").write_text(
        '{"kind": "run", "status": "completed"}\n', encoding="utf-8-sig"
    )

    assert jarvis._load_approvals() == [{"id": "approval-1", "status": "pending"}]
    assert jarvis._recent_runs() == [{"kind": "run", "status": "completed"}]


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


def test_kanban_read_completion_requires_native_tool_success(tmp_path, monkeypatch):
    import model_tools

    monkeypatch.setattr(jarvis, "get_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(model_tools, "handle_function_call", lambda *args, **kwargs: '{"count": 2, "tasks": []}')

    output = asyncio.run(jarvis.execute_jarvis_kanban_list(JarvisKanbanListRequest(limit=100), profile="default"))

    assert output["ok"] is True
    assert output["receipt"]["status"] == "completed"
    assert output["receipt"]["count"] == 2
    assert output["result"] == {"count": 2, "tasks": []}
    assert '"status": "completed"' in (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")


def test_kanban_read_never_marks_tool_error_completed(tmp_path, monkeypatch):
    import model_tools

    monkeypatch.setattr(jarvis, "get_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(model_tools, "handle_function_call", lambda *args, **kwargs: '{"error": "board unavailable"}')

    output = asyncio.run(jarvis.execute_jarvis_kanban_list(JarvisKanbanListRequest(), profile="default"))

    assert output["ok"] is False
    assert output["receipt"]["status"] == "failed"
    assert output["result"] == {"error": "board unavailable"}
    assert '"status": "completed"' not in (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")


def _tool_call(name: str):
    return SimpleNamespace(
        id="call-1", type="function", function=SimpleNamespace(name=name, arguments="{}"),
    )


class _OpenTasksProvider:
    def __init__(self, first_tool: str | None):
        self.first_tool = first_tool
        self.calls: list[dict[str, Any]] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if len(self.calls) == 1 and self.first_tool:
            message = SimpleNamespace(content=None, reasoning=None, tool_calls=[_tool_call(self.first_tool)])
            return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="tool_calls")], usage=None)
        message = SimpleNamespace(content="Die Aufgaben sind erledigt.", reasoning=None, tool_calls=[])
        return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="stop")], usage=None)


def _real_open_tasks_agent(monkeypatch, first_tool: str | None):
    from run_agent import AIAgent

    provider = _OpenTasksProvider(first_tool)
    client = SimpleNamespace(chat=SimpleNamespace(completions=provider))
    monkeypatch.setattr("agent.process_bootstrap.OpenAI", lambda **kwargs: client)
    monkeypatch.setattr(
        "model_tools.get_tool_definitions",
        lambda *args, **kwargs: [
            {"type": "function", "function": {"name": "kanban_list", "parameters": {"type": "object"}}},
            {"type": "function", "function": {"name": "kanban_complete", "parameters": {"type": "object"}}},
        ],
    )
    agent = AIAgent(
        model="test-model", api_key="test-key", base_url="http://localhost:8080/v1", provider="custom",
        platform="dashboard", quiet_mode=True, max_iterations=2, skip_context_files=True, skip_memory=True,
        enabled_toolsets=["kanban"], session_db=None,
    )
    agent._disable_streaming = True
    jarvis._restrict_open_tasks_tools(agent)
    return agent, provider


def test_open_tasks_uses_real_agent_loop_and_verified_tool_result(tmp_path, monkeypatch):
    import model_tools
    from agent import jarvis_execution

    agent, provider = _real_open_tasks_agent(monkeypatch, "kanban_list")
    monkeypatch.setattr(jarvis, "get_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "_build_open_tasks_agent", lambda: agent)
    monkeypatch.setattr(
        model_tools, "handle_function_call",
        lambda name, args, task_id=None, **kwargs: json.dumps({"count": 1, "tasks": []}),
    )
    agent._jarvis_execution_enabled = True

    output = asyncio.run(jarvis.execute_jarvis_open_tasks(JarvisOpenTasksRequest(request="Jarvis, welche Aufgaben sind offen?")))

    assert output["ok"] is True
    assert output["receipt"]["status"] == "completed"
    assert provider.calls[0]["tools"] == agent.tools
    assert agent.valid_tool_names == {"kanban_list"}
    assert len((tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8").splitlines()) == 1


def test_open_tasks_rejects_fabricated_or_disallowed_agent_results(tmp_path, monkeypatch):
    import model_tools

    agent, _provider = _real_open_tasks_agent(monkeypatch, "kanban_complete")
    tool_calls: list[str] = []
    monkeypatch.setattr(jarvis, "get_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "_build_open_tasks_agent", lambda: agent)
    monkeypatch.setattr(model_tools, "handle_function_call", lambda name, *args, **kwargs: tool_calls.append(name) or "{}")

    output = asyncio.run(jarvis.execute_jarvis_open_tasks(JarvisOpenTasksRequest(request="Welche Aufgaben sind offen?")))

    assert output["ok"] is False
    assert output["receipt"]["error"] == "Agent did not call kanban_list."
    assert tool_calls == []
    assert '"status": "completed"' not in (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")


def test_open_tasks_requires_a_confirmed_tool_result(tmp_path, monkeypatch):
    agent, _provider = _real_open_tasks_agent(monkeypatch, None)
    monkeypatch.setattr(jarvis, "get_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "_build_open_tasks_agent", lambda: agent)

    output = asyncio.run(jarvis.execute_jarvis_open_tasks(JarvisOpenTasksRequest(request="Welche Aufgaben sind offen?")))

    assert output["ok"] is False
    assert output["receipt"]["status"] == "failed"


def test_open_tasks_marks_native_tool_errors_failed(tmp_path, monkeypatch):
    import model_tools

    agent, _provider = _real_open_tasks_agent(monkeypatch, "kanban_list")
    monkeypatch.setattr(jarvis, "get_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "_build_open_tasks_agent", lambda: agent)
    monkeypatch.setattr(
        model_tools, "handle_function_call",
        lambda name, args, task_id=None, **kwargs: '{"error": "board unavailable"}',
    )

    output = asyncio.run(jarvis.execute_jarvis_open_tasks(JarvisOpenTasksRequest(request="Welche Aufgaben sind offen?")))

    assert output["ok"] is False
    assert output["receipt"]["status"] == "failed"
    assert output["result"] == {"error": "board unavailable"}


def test_open_tasks_marks_provider_failures_failed(tmp_path, monkeypatch, caplog):
    class FailingAgent:
        def run_conversation(self, *_args, **_kwargs):
            raise RuntimeError("provider unavailable")

    monkeypatch.setattr(jarvis, "get_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "_build_open_tasks_agent", FailingAgent)

    output = asyncio.run(jarvis.execute_jarvis_open_tasks(JarvisOpenTasksRequest(request="Welche Aufgaben sind offen?")))

    assert output["ok"] is False
    assert output["receipt"]["error"] == "Agent loop failed."
    assert '"status": "completed"' not in (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")
    assert any(
        record.getMessage() == "Jarvis open-tasks agent loop failed" and record.exc_info
        for record in caplog.records
    )


def test_open_tasks_rejects_unrelated_requests():
    with pytest.raises(Exception) as exc:
        asyncio.run(jarvis.execute_jarvis_open_tasks(JarvisOpenTasksRequest(request="Sende eine E-Mail")))

    assert getattr(exc.value, "status_code", None) == 400


def test_unknown_agent_returns_404(monkeypatch):
    monkeypatch.setattr(jarvis, "_orchestrator_module", lambda: FakeModule)
    monkeypatch.setattr(jarvis, "_config_profile_scope", null_scope)
    monkeypatch.setattr(jarvis, "_persist_run_record", lambda kind, output: None)

    body = JarvisOrchestrationRequest(request="Test")

    with pytest.raises(Exception) as exc:
        asyncio.run(jarvis.run_jarvis_agent("missing", body))

    assert getattr(exc.value, "status_code", None) == 404
