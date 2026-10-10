"""Contracts for verified Jarvis receipts emitted by regular AIAgent tool turns."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from agent import jarvis_execution
from agent.agent_init import _configure_jarvis_execution


def _tool_call(name: str, arguments: str = "{}"):
    return SimpleNamespace(
        id=f"call-{name}", type="function", function=SimpleNamespace(name=name, arguments=arguments),
    )


class _RegularChatProvider:
    def __init__(self, calls: list[str | tuple[str, dict] | None], final_response: str = "Hier sind die offenen Aufgaben."):
        self.calls = iter(calls)
        self.requests: list[dict] = []
        self.final_response = final_response

    def create(self, **kwargs):
        self.requests.append(kwargs)
        call = next(self.calls)
        if call:
            name, arguments = call if isinstance(call, tuple) else (call, {})
            message = SimpleNamespace(
                content=None, reasoning=None, tool_calls=[_tool_call(name, json.dumps(arguments))]
            )
            return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="tool_calls")], usage=None)
        message = SimpleNamespace(content=self.final_response, reasoning=None, tool_calls=[])
        return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="stop")], usage=None)


def _regular_chat_agent(monkeypatch, tool_calls: list[str | tuple[str, dict] | None], tool_names=None):
    from run_agent import AIAgent

    provider = _RegularChatProvider(tool_calls)
    client = SimpleNamespace(chat=SimpleNamespace(completions=provider))
    monkeypatch.setattr("agent.process_bootstrap.OpenAI", lambda **kwargs: client)
    tool_names = tool_names or ["skill_view", "kanban_list"]
    monkeypatch.setattr(
        "model_tools.get_tool_definitions",
        lambda *args, **kwargs: [
            {"type": "function", "function": {"name": name, "parameters": {"type": "object"}}}
            for name in tool_names
        ],
    )
    agent = AIAgent(
        model="test-model", api_key="test-key", base_url="http://localhost:8080/v1", provider="custom",
        platform="cli", quiet_mode=True, max_iterations=3, skip_context_files=True, skip_memory=True,
        enabled_toolsets=["skills", "kanban"], session_db=None,
    )
    agent._disable_streaming = True
    agent._jarvis_execution_enabled = True
    return agent, provider


def test_regular_chat_uses_skill_then_native_kanban_loop(tmp_path, monkeypatch):
    import model_tools

    agent, provider = _regular_chat_agent(monkeypatch, ["skill_view", "kanban_list", None])
    dispatched: list[str] = []
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(
        model_tools, "handle_function_call",
        lambda name, *args, **kwargs: dispatched.append(name) or (
            '{"success": true}' if name == "skill_view" else '{"count": 1, "tasks": []}'
        ),
    )

    turn = agent.run_conversation("Jarvis, welche Aufgaben sind offen?")

    assert dispatched == ["skill_view", "kanban_list"]
    assert provider.requests[0]["tools"] == agent.tools
    assert turn["final_response"] == "Hier sind die offenen Aufgaben."
    assert agent._jarvis_execution_receipts[-1]["status"] == "completed"


@pytest.mark.parametrize("tool_calls, tool_result", [
    ([None], None),
    (["skill_view", "kanban_list", None], '{"error": "board unavailable"}'),
])
def test_regular_chat_never_confirms_fabricated_or_failed_task_checks(tmp_path, monkeypatch, tool_calls, tool_result):
    import model_tools

    agent, _provider = _regular_chat_agent(monkeypatch, tool_calls)
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    if tool_result is not None:
        monkeypatch.setattr(
            model_tools, "handle_function_call",
            lambda name, *args, **kwargs: '{"success": true}' if name == "skill_view" else tool_result,
        )

    agent.run_conversation("Welche Aufgaben sind offen?")

    statuses = [receipt["status"] for receipt in agent._jarvis_execution_receipts]
    assert statuses == ([] if tool_result is None else ["failed"])


def test_regular_chat_provider_failure_does_not_create_a_task_receipt(tmp_path, monkeypatch):
    agent, provider = _regular_chat_agent(monkeypatch, [None])
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    provider.create = lambda **kwargs: (_ for _ in ()).throw(ValueError("provider unavailable"))

    turn = agent.run_conversation("Guten Morgen, Jarvis.")

    assert turn["failed"] is True
    assert agent._jarvis_execution_receipts == []


def _google_read_terminal_result(payload, exit_code=0):
    return json.dumps({"exit_code": exit_code, "output": json.dumps(payload)})


def test_regular_chat_verifies_native_google_read_after_terminal_execution(tmp_path, monkeypatch):
    import model_tools

    command = "python /tmp/jarvis_google_workspace_read.py"
    agent, _provider = _regular_chat_agent(
        monkeypatch, [("skill_view", {}), ("terminal", {"command": command}), None],
        tool_names=["skill_view", "terminal"],
    )
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    result = {
        "workflow": "jarvis_google_workspace_read", "success": True,
        "gmail": {"messages": [{"from": "Ada", "subject": "Status"}]},
        "calendar": {"events": [{"summary": "Planung", "start": "2026-10-10T09:00:00Z"}]},
    }
    dispatched = []
    monkeypatch.setattr(
        model_tools, "handle_function_call",
        lambda name, *args, **kwargs: dispatched.append(name) or (
            '{"success": true}' if name == "skill_view" else _google_read_terminal_result(result)
        ),
    )

    agent.run_conversation("Jarvis, zeige mir ungelesene E-Mails und meine naechsten Termine.")

    assert dispatched == ["skill_view", "terminal"]
    receipt = agent._jarvis_execution_receipts[-1]
    assert receipt["status"] == "completed"
    assert receipt["gmail_count"] == receipt["calendar_count"] == 1
    stored = (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")
    assert "Ada" not in stored and "Planung" not in stored


def test_regular_chat_verifies_native_unread_gmail_after_terminal_execution(tmp_path, monkeypatch):
    import model_tools

    command = "python /tmp/jarvis_gmail_unread_read.py"
    agent, _provider = _regular_chat_agent(
        monkeypatch, [("skill_view", {}), ("terminal", {"command": command}), None],
        tool_names=["skill_view", "terminal"],
    )
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    result = {
        "workflow": "jarvis_gmail_unread_read", "success": True,
        "gmail": {"messages": [{"from": "Ada", "subject": "Status", "date": "today"}]},
    }
    dispatched = []
    monkeypatch.setattr(
        model_tools, "handle_function_call",
        lambda name, *args, **kwargs: dispatched.append(name) or (
            '{"success": true}' if name == "skill_view" else _google_read_terminal_result(result)
        ),
    )

    agent.run_conversation("Jarvis, welche E-Mails sind ungelesen?")

    assert dispatched == ["skill_view", "terminal"]
    receipt = agent._jarvis_execution_receipts[-1]
    assert receipt["status"] == "completed"
    assert receipt["workflow"] == "gmail_unread_read"
    assert receipt["gmail_count"] == 1
    stored = (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")
    assert "Ada" not in stored and "Status" not in stored


def test_regular_chat_verifies_native_calendar_read_after_terminal_execution(tmp_path, monkeypatch):
    import model_tools

    command = "python /tmp/jarvis_calendar_read.py --window tomorrow"
    agent, _provider = _regular_chat_agent(
        monkeypatch, [("skill_view", {}), ("terminal", {"command": command}), None],
        tool_names=["skill_view", "terminal"],
    )
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    result = {
        "workflow": "jarvis_calendar_read", "success": True,
        "time_window": {
            "name": "tomorrow", "start": "2026-10-11T00:00:00+02:00",
            "end": "2026-10-12T00:00:00+02:00", "timezone": "Europe/Berlin",
        },
        "calendar": {"events": [{"summary": "Planung", "start": "2026-10-11T09:00:00+02:00"}]},
    }
    dispatched = []
    monkeypatch.setattr(
        model_tools, "handle_function_call",
        lambda name, *args, **kwargs: dispatched.append(name) or (
            '{"success": true}' if name == "skill_view" else _google_read_terminal_result(result)
        ),
    )

    agent.run_conversation("Jarvis, welche Termine habe ich morgen?")

    assert dispatched == ["skill_view", "terminal"]
    receipt = agent._jarvis_execution_receipts[-1]
    assert receipt["status"] == "completed"
    assert receipt["workflow"] == "calendar_read"
    assert receipt["window"] == "tomorrow"
    assert receipt["calendar_count"] == 1
    stored = (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")
    assert "Planung" not in stored and "2026-10-11" not in stored


def test_regular_chat_verifies_daily_plan_sources_independently(tmp_path, monkeypatch):
    import model_tools

    command = "python /tmp/jarvis_calendar_read.py --window today"
    agent, _provider = _regular_chat_agent(
        monkeypatch,
        [("skill_view", {}), ("terminal", {"command": command}), ("kanban_list", {"limit": 20}), None],
        tool_names=["skill_view", "terminal", "kanban_list"],
    )
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    calendar = {
        "workflow": "jarvis_calendar_read", "success": True,
        "time_window": {
            "name": "today", "start": "2026-10-10T00:00:00+02:00",
            "end": "2026-10-11T00:00:00+02:00", "timezone": "Europe/Berlin",
        },
        "calendar": {"events": []},
    }
    tasks = {"count": 2, "tasks": [{"title": "Angebot", "priority": 3}, {"title": "Recherche", "priority": 1}]}
    dispatched = []
    monkeypatch.setattr(
        model_tools, "handle_function_call",
        lambda name, *args, **kwargs: dispatched.append(name) or (
            '{"success": true}' if name == "skill_view" else _google_read_terminal_result(calendar)
            if name == "terminal" else json.dumps(tasks)
        ),
    )

    turn = agent.run_conversation("Jarvis, plane meinen heutigen Tag.")

    assert dispatched == ["skill_view", "terminal", "kanban_list"]
    receipts = agent._jarvis_execution_receipts
    assert [(receipt.get("workflow", receipt["tool"]), receipt["status"]) for receipt in receipts] == [
        ("calendar_read", "completed"),
        ("kanban_list", "completed"),
    ]
    stored = (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")
    assert "Angebot" not in stored and "Recherche" not in stored
    briefing = turn["verified_daily_briefing"]
    assert briefing["sources"] == {"calendar": "verified", "tasks": "verified"}
    assert "Angebot (Priorität 3)" in briefing["text"]
    assert briefing["text"].index("Angebot") < briefing["text"].index("Recherche")


def test_regular_chat_records_partial_daily_plan_source_failure(tmp_path, monkeypatch):
    import model_tools

    command = "python /tmp/jarvis_calendar_read.py --window today"
    agent, _provider = _regular_chat_agent(
        monkeypatch,
        [("skill_view", {}), ("terminal", {"command": command}), ("kanban_list", {"limit": 20}), None],
        tool_names=["skill_view", "terminal", "kanban_list"],
    )
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    failed_calendar = {"workflow": "jarvis_calendar_read", "success": False, "error": "Not authorized"}
    monkeypatch.setattr(
        model_tools, "handle_function_call",
        lambda name, *args, **kwargs: (
            '{"success": true}' if name == "skill_view" else _google_read_terminal_result(failed_calendar)
            if name == "terminal" else '{"count": 0, "tasks": []}'
        ),
    )

    turn = agent.run_conversation("Gib mir mein Tagesbriefing.")

    assert [(receipt.get("workflow", receipt["tool"]), receipt["status"])
            for receipt in agent._jarvis_execution_receipts] == [
                ("calendar_read", "failed"), ("kanban_list", "completed")]
    briefing = turn["verified_daily_briefing"]
    assert briefing["sources"] == {"calendar": "unverified", "tasks": "verified"}
    assert "Termine\n- Nicht verifiziert" in briefing["text"]
    assert "Keine offenen Aufgaben" in briefing["text"]


def test_regular_chat_verifies_empty_daily_plan_sources(tmp_path, monkeypatch):
    import model_tools

    command = "python /tmp/jarvis_calendar_read.py --window today"
    agent, _provider = _regular_chat_agent(
        monkeypatch,
        [("skill_view", {}), ("terminal", {"command": command}), ("kanban_list", {"limit": 20}), None],
        tool_names=["skill_view", "terminal", "kanban_list"],
    )
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    calendar = {
        "workflow": "jarvis_calendar_read", "success": True,
        "time_window": {
            "name": "today", "start": "2026-10-10T00:00:00+00:00",
            "end": "2026-10-11T00:00:00+00:00", "timezone": "UTC",
        },
        "calendar": {"events": []},
    }
    monkeypatch.setattr(
        model_tools, "handle_function_call",
        lambda name, *args, **kwargs: (
            '{"success": true}' if name == "skill_view" else _google_read_terminal_result(calendar)
            if name == "terminal" else '{"count": 0, "tasks": []}'
        ),
    )

    turn = agent.run_conversation("Was habe ich heute vor?")

    assert [receipt["status"] for receipt in agent._jarvis_execution_receipts] == ["completed", "completed"]
    assert agent._jarvis_execution_receipts[0]["calendar_count"] == 0
    assert agent._jarvis_execution_receipts[1]["count"] == 0
    assert "Keine Termine im geprüften Zeitfenster." in turn["verified_daily_briefing"]["text"]
    assert "Keine offenen Aufgaben im geprüften Kanban-Ergebnis." in turn["verified_daily_briefing"]["text"]


@pytest.mark.parametrize("terminal_result", [
    _google_read_terminal_result({"workflow": "jarvis_google_workspace_read", "success": False,
                                  "error": "Google authorization is unavailable."}),
    _google_read_terminal_result("invalid JSON output"),
    _google_read_terminal_result({"workflow": "other", "success": True}, exit_code=1),
])
def test_google_read_receipt_rejects_tool_and_authorization_failures(tmp_path, monkeypatch, terminal_result):
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])

    receipt = jarvis_execution.record_agent_tool_result(
        agent, "terminal", terminal_result,
        function_args={"command": "python /tmp/jarvis_google_workspace_read.py"},
    )

    assert receipt["status"] == "failed"
    assert '"status": "completed"' not in (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")


def test_google_read_receipt_ignores_unrelated_terminal_commands():
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])

    receipt = jarvis_execution.record_agent_tool_result(
        agent, "terminal", '{"exit_code": 0, "output": "{}"}', function_args={"command": "echo hello"}
    )

    assert receipt is None


@pytest.mark.parametrize("terminal_result", [
    _google_read_terminal_result({"workflow": "jarvis_gmail_unread_read", "success": False}),
    _google_read_terminal_result({"workflow": "jarvis_gmail_unread_read", "success": True, "gmail": {}}),
    _google_read_terminal_result({"workflow": "jarvis_gmail_unread_read", "success": True,
                                  "gmail": {"messages": []}}, exit_code=1),
])
def test_gmail_read_receipt_rejects_failed_or_invalid_terminal_results(tmp_path, monkeypatch, terminal_result):
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])

    receipt = jarvis_execution.record_agent_tool_result(
        agent, "terminal", terminal_result,
        function_args={"command": "python /tmp/jarvis_gmail_unread_read.py"},
    )

    assert receipt["status"] == "failed"
    assert '"status": "completed"' not in (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")


def test_gmail_read_receipt_rejects_fabricated_or_write_commands(tmp_path, monkeypatch):
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    result = _google_read_terminal_result({
        "workflow": "jarvis_gmail_unread_read", "success": True, "gmail": {"messages": []},
    })
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])

    assert jarvis_execution.record_agent_tool_result(agent, "terminal", result, function_args={
        "command": "python /tmp/jarvis_gmail_unread_read.py && google_api.py gmail send",
    }) is None
    assert jarvis_execution.record_agent_tool_result(agent, "terminal", result, function_args={
        "command": "python /tmp/google_api.py gmail send",
    }) is None
    assert jarvis_execution.record_agent_tool_result(
        SimpleNamespace(_jarvis_execution_enabled=False, _jarvis_execution_receipts=[]),
        "terminal", result, function_args={"command": "python /tmp/jarvis_gmail_unread_read.py"},
    ) is None
    assert not (tmp_path / "jarvis" / "executions.jsonl").exists()


def test_gmail_read_receipts_follow_the_active_profile_home(tmp_path, monkeypatch):
    active_home = tmp_path / "default"
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: active_home)
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])
    result = _google_read_terminal_result({
        "workflow": "jarvis_gmail_unread_read", "success": True, "gmail": {"messages": []},
    })
    args = {"command": "python /tmp/jarvis_gmail_unread_read.py"}

    jarvis_execution.record_agent_tool_result(agent, "terminal", result, function_args=args)
    active_home = tmp_path / "profiles" / "work"
    jarvis_execution.record_agent_tool_result(agent, "terminal", result, function_args=args)

    assert (tmp_path / "default" / "jarvis" / "executions.jsonl").is_file()
    assert (tmp_path / "profiles" / "work" / "jarvis" / "executions.jsonl").is_file()


@pytest.mark.parametrize("terminal_result", [
    _google_read_terminal_result({"workflow": "jarvis_calendar_read", "success": False}),
    _google_read_terminal_result({
        "workflow": "jarvis_calendar_read", "success": True,
        "time_window": {"name": "tomorrow", "start": "invalid", "end": "invalid", "timezone": "UTC"},
        "calendar": {"events": []},
    }),
    _google_read_terminal_result({
        "workflow": "jarvis_calendar_read", "success": True,
        "time_window": {
            "name": "week", "start": "2026-10-11T00:00:00+00:00",
            "end": "2026-10-18T00:00:00+00:00", "timezone": "UTC",
        },
        "calendar": {"events": []},
    }),
    _google_read_terminal_result({
        "workflow": "jarvis_calendar_read", "success": True,
        "time_window": {
            "name": "tomorrow", "start": "2026-10-11T00:00:00+00:00",
            "end": "2026-10-12T00:00:00+00:00", "timezone": "UTC",
        },
        "calendar": {"events": []},
    }, exit_code=1),
])
def test_calendar_read_receipt_rejects_failed_or_invalid_terminal_results(tmp_path, monkeypatch, terminal_result):
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])

    receipt = jarvis_execution.record_agent_tool_result(
        agent, "terminal", terminal_result,
        function_args={"command": "python /tmp/jarvis_calendar_read.py --window tomorrow"},
    )

    assert receipt["status"] == "failed"
    assert '"status": "completed"' not in (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")


def test_calendar_read_receipt_rejects_fabricated_write_and_other_profile(tmp_path, monkeypatch):
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    result = _google_read_terminal_result({
        "workflow": "jarvis_calendar_read", "success": True,
        "time_window": {
            "name": "tomorrow", "start": "2026-10-11T00:00:00+00:00",
            "end": "2026-10-12T00:00:00+00:00", "timezone": "UTC",
        },
        "calendar": {"events": []},
    })
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])

    assert jarvis_execution.record_agent_tool_result(agent, "terminal", result, function_args={
        "command": "python /tmp/jarvis_calendar_read.py --window tomorrow && google_api.py calendar create",
    }) is None
    assert jarvis_execution.record_agent_tool_result(agent, "terminal", result, function_args={
        "command": "python /tmp/google_api.py calendar create",
    }) is None
    assert jarvis_execution.record_agent_tool_result(
        SimpleNamespace(_jarvis_execution_enabled=False, _jarvis_execution_receipts=[]),
        "terminal", result, function_args={"command": "python /tmp/jarvis_calendar_read.py --window tomorrow"},
    ) is None
    assert not (tmp_path / "jarvis" / "executions.jsonl").exists()


def test_calendar_read_receipts_follow_the_active_profile_home(tmp_path, monkeypatch):
    active_home = tmp_path / "default"
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: active_home)
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])
    result = _google_read_terminal_result({
        "workflow": "jarvis_calendar_read", "success": True,
        "time_window": {
            "name": "next", "start": "2026-10-10T12:00:00+00:00",
            "end": "2026-10-17T12:00:00+00:00", "timezone": "UTC",
        },
        "calendar": {"events": []},
    })
    args = {"command": "python /tmp/jarvis_calendar_read.py --window next"}

    jarvis_execution.record_agent_tool_result(agent, "terminal", result, function_args=args)
    active_home = tmp_path / "profiles" / "work"
    jarvis_execution.record_agent_tool_result(agent, "terminal", result, function_args=args)

    assert (tmp_path / "default" / "jarvis" / "executions.jsonl").is_file()
    assert (tmp_path / "profiles" / "work" / "jarvis" / "executions.jsonl").is_file()


def test_regular_chat_does_not_confirm_calendar_results_without_a_tool_call(tmp_path, monkeypatch):
    agent, _provider = _regular_chat_agent(monkeypatch, [None], tool_names=["skill_view", "terminal"])
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)

    turn = agent.run_conversation("Welche Termine habe ich morgen?")

    assert agent._jarvis_execution_receipts == []
    assert "verified_daily_briefing" not in turn


def test_verified_daily_briefing_isolated_from_another_profile(tmp_path, monkeypatch):
    active_home = tmp_path / "default"
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: active_home)
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])
    jarvis_execution.begin_verified_daily_briefing_turn(agent, "turn-default")
    calendar = _google_read_terminal_result({
        "workflow": "jarvis_calendar_read", "success": True,
        "time_window": {
            "name": "today", "start": "2026-10-10T00:00:00+00:00",
            "end": "2026-10-11T00:00:00+00:00", "timezone": "UTC",
        },
        "calendar": {"events": []},
    })
    jarvis_execution.record_agent_tool_result(
        agent, "terminal", calendar,
        function_args={"command": "python /tmp/jarvis_calendar_read.py --window today"},
    )
    jarvis_execution.record_agent_tool_result(agent, "kanban_list", '{"count": 0, "tasks": []}')

    assert jarvis_execution.verified_daily_briefing(agent) is not None
    active_home = tmp_path / "profiles" / "work"
    assert jarvis_execution.verified_daily_briefing(agent) is None


def test_google_read_receipts_follow_the_active_profile_home(tmp_path, monkeypatch):
    active_home = tmp_path / "default"
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: active_home)
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])
    result = _google_read_terminal_result({
        "workflow": "jarvis_google_workspace_read", "success": True,
        "gmail": {"messages": []}, "calendar": {"events": []},
    })
    args = {"command": "python /tmp/jarvis_google_workspace_read.py"}

    jarvis_execution.record_agent_tool_result(agent, "terminal", result, function_args=args)
    active_home = tmp_path / "profiles" / "work"
    jarvis_execution.record_agent_tool_result(agent, "terminal", result, function_args=args)

    assert (tmp_path / "default" / "jarvis" / "executions.jsonl").is_file()
    assert (tmp_path / "profiles" / "work" / "jarvis" / "executions.jsonl").is_file()


def test_regular_chat_receipt_requires_real_tool_success(tmp_path, monkeypatch):
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])

    receipt = jarvis_execution.record_agent_tool_result(agent, "kanban_list", '{"count": 2, "tasks": []}')

    assert receipt["status"] == "completed"
    assert agent._jarvis_execution_receipts == [receipt]
    stored = json.loads((tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8"))
    assert stored["count"] == 2
    assert "tasks" not in stored


def test_regular_chat_receipt_does_not_complete_error_or_non_jarvis_profile(tmp_path, monkeypatch):
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])

    failed = jarvis_execution.record_agent_tool_result(agent, "kanban_list", '{"error": "unavailable"}')
    skipped = jarvis_execution.record_agent_tool_result(
        SimpleNamespace(_jarvis_execution_enabled=False, _jarvis_execution_receipts=[]),
        "kanban_list", '{"count": 1}',
    )

    assert failed["status"] == "failed"
    assert skipped is None
    assert '"status": "completed"' not in (tmp_path / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")


def test_regular_chat_receipt_never_completes_a_blocked_tool_call(tmp_path, monkeypatch):
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: tmp_path)
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])

    receipt = jarvis_execution.record_agent_tool_result(
        agent, "kanban_list", '{"count": 2}', blocked=True
    )

    assert receipt["status"] == "failed"
    assert receipt["error"] == "Tool execution was blocked."


def test_jarvis_profile_activation_uses_skill_configuration_only():
    assert jarvis_execution.jarvis_execution_enabled({"skills": {"config": {"jarvis.task_source": "kanban"}}})
    assert not jarvis_execution.jarvis_execution_enabled({"skills": {"config": {}}})


def test_receipts_are_isolated_by_the_active_profile_home(tmp_path, monkeypatch):
    active_home = tmp_path / "default"
    monkeypatch.setattr(jarvis_execution, "get_hermes_home", lambda: active_home)
    agent = SimpleNamespace(_jarvis_execution_enabled=True, _jarvis_execution_receipts=[])

    jarvis_execution.record_agent_tool_result(agent, "kanban_list", '{"count": 1}')
    active_home = tmp_path / "profiles" / "work"
    jarvis_execution.record_agent_tool_result(agent, "kanban_list", '{"count": 2}')

    default_receipt = (tmp_path / "default" / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")
    work_receipt = (tmp_path / "profiles" / "work" / "jarvis" / "executions.jsonl").read_text(encoding="utf-8")
    assert '"count": 1' in default_receipt
    assert '"count": 2' in work_receipt


def test_agent_initialization_enables_receipts_only_for_the_jarvis_skill_profile():
    agent = SimpleNamespace()

    _configure_jarvis_execution(agent, {"skills": {"config": {"jarvis.task_source": "kanban"}}})

    assert agent._jarvis_execution_enabled is True
    assert agent._jarvis_execution_receipts == []
