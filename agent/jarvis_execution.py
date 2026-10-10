"""Verified, profile-scoped receipts for the small Jarvis read workflow."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
import shlex
from time import time
from typing import Any

from hermes_constants import get_hermes_home


def jarvis_execution_enabled(config: dict[str, Any]) -> bool:
    """Jarvis remains opt-in: the skill configuration marks its owning profile."""
    skills = config.get("skills") if isinstance(config, dict) else None
    skill_config = skills.get("config") if isinstance(skills, dict) else None
    auto_load = skills.get("auto_load") if isinstance(skills, dict) else None
    return (
        isinstance(skill_config, dict) and "jarvis.task_source" in skill_config
    ) or (isinstance(auto_load, list) and "jarvis-assistant" in auto_load)


def tool_execution_receipt(tool_name: str, raw_result: Any) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Only a parseable, error-free native tool payload can complete work."""
    receipt = {"tool": tool_name, "status": "failed", "created_at": time()}
    if not isinstance(raw_result, str):
        receipt["error"] = "Tool returned a non-string result."
        return receipt, None
    try:
        result = json.loads(raw_result)
    except json.JSONDecodeError:
        receipt["error"] = "Tool returned invalid JSON."
        return receipt, None
    if not isinstance(result, dict):
        receipt["error"] = "Tool returned a non-object JSON result."
        return receipt, None
    if result.get("error") is not None or result.get("success") is False:
        receipt["error"] = "Tool reported unsuccessful execution."
        return receipt, result
    receipt["status"] = "completed"
    receipt["result_keys"] = sorted(str(key) for key in result)[:20]
    if isinstance(result.get("count"), int):
        receipt["count"] = result["count"]
    return receipt, result


def persist_execution_receipt(receipt: dict[str, Any], *, home: Path | None = None) -> None:
    """Store only receipt metadata, never the task payload returned by Kanban."""
    path = (home or Path(get_hermes_home())) / "jarvis" / "executions.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(receipt, ensure_ascii=False, sort_keys=True) + "\n")


def begin_verified_daily_briefing_turn(agent: Any, turn_id: str) -> None:
    """Clear ephemeral briefing data before each native agent turn."""
    if not getattr(agent, "_jarvis_execution_enabled", False):
        return
    agent._jarvis_daily_briefing = {
        "turn_id": turn_id,
        "profile_home": None,
        "calendar": None,
        "tasks": None,
    }


def _briefing_text(value: Any) -> str:
    return " ".join(str(value or "").split())[:240]


def _daily_briefing_state(agent: Any, home: Path) -> dict[str, Any]:
    """Bind ephemeral source data to the active profile before retaining it."""
    state = getattr(agent, "_jarvis_daily_briefing", None)
    if not isinstance(state, dict):
        state = {"turn_id": None, "profile_home": None, "calendar": None, "tasks": None}
        agent._jarvis_daily_briefing = state
    home_key = str(home)
    if state.get("profile_home") not in (None, home_key):
        state.update(profile_home=home_key, calendar=None, tasks=None)
    else:
        state["profile_home"] = home_key
    return state


def _terminal_output(raw_result: Any) -> dict[str, Any] | None:
    """Extract a successful terminal JSON payload without retaining the envelope."""
    if not isinstance(raw_result, str):
        return None
    try:
        terminal = json.loads(raw_result)
        output = terminal.get("output") if isinstance(terminal, dict) and terminal.get("exit_code") == 0 else None
        payload = json.loads(output) if isinstance(output, str) else None
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def _calendar_daily_source(raw_result: Any, receipt: dict[str, Any]) -> dict[str, Any]:
    """Keep only calendar fields the deterministic briefing may show to the user."""
    if receipt.get("status") != "completed":
        return {"status": "unverified", "reason": receipt.get("error", "Calendar check failed.")}
    payload = _terminal_output(raw_result)
    calendar = payload.get("calendar") if isinstance(payload, dict) else None
    window = payload.get("time_window") if isinstance(payload, dict) else None
    if not isinstance(calendar, dict) or not isinstance(window, dict) or window.get("name") != "today":
        return {"status": "unverified", "reason": "Calendar result could not be verified."}
    events = calendar.get("events")
    if not isinstance(events, list):
        return {"status": "unverified", "reason": "Calendar result could not be verified."}
    return {
        "status": "verified",
        "window": {key: _briefing_text(window.get(key)) for key in ("start", "end", "timezone")},
        "events": [
            {
                "summary": _briefing_text(event.get("summary")),
                "start": _briefing_text(event.get("start")),
                "end": _briefing_text(event.get("end")),
                "timezone": _briefing_text(event.get("timezone")),
                "all_day": bool(event.get("all_day")),
            }
            for event in events[:20] if isinstance(event, dict)
        ],
    }


def _kanban_daily_source(raw_result: Any, receipt: dict[str, Any]) -> dict[str, Any]:
    """Keep only open-task summary fields needed for a verified daily briefing."""
    if receipt.get("status") != "completed" or not isinstance(raw_result, str):
        return {"status": "unverified", "reason": receipt.get("error", "Task check failed.")}
    try:
        payload = json.loads(raw_result)
    except json.JSONDecodeError:
        payload = None
    tasks = payload.get("tasks") if isinstance(payload, dict) else None
    if not isinstance(tasks, list) or not isinstance(payload.get("count"), int):
        return {"status": "unverified", "reason": "Task result could not be verified."}
    visible = []
    for task in tasks[:20]:
        if not isinstance(task, dict) or task.get("status") in {"done", "archived"}:
            continue
        priority = task.get("priority")
        visible.append({
            "title": _briefing_text(task.get("title")),
            "status": _briefing_text(task.get("status")),
            "priority": priority if isinstance(priority, int) else None,
        })
    visible.sort(key=lambda task: task["priority"] if task["priority"] is not None else -1, reverse=True)
    return {"status": "verified", "tasks": visible, "count": len(visible)}


def _record_daily_briefing_source(agent: Any, tool_name: str, raw_result: Any, receipt: dict[str, Any], home: Path) -> None:
    """Record only verified daily-briefing source summaries in the live agent."""
    state = _daily_briefing_state(agent, home)
    if receipt.get("workflow") == "calendar_read" and receipt.get("window") == "today":
        state["calendar"] = _calendar_daily_source(raw_result, receipt)
    elif tool_name == "kanban_list":
        state["tasks"] = _kanban_daily_source(raw_result, receipt)


def verified_daily_briefing(agent: Any) -> dict[str, Any] | None:
    """Return a deterministic briefing only for both sources of the active profile turn."""
    state = getattr(agent, "_jarvis_daily_briefing", None)
    if not isinstance(state, dict) or not state.get("calendar") or not state.get("tasks"):
        return None
    if state.get("profile_home") != str(Path(get_hermes_home())):
        return None
    calendar, tasks = state["calendar"], state["tasks"]
    sources = {"calendar": calendar["status"], "tasks": tasks["status"]}
    lines = ["Tagesübersicht", f"Quellenstatus: Kalender {sources['calendar']}; Aufgaben {sources['tasks']}", "", "Termine"]
    if calendar["status"] != "verified":
        lines.append(f"- Nicht verifiziert: {calendar['reason']}")
    elif not calendar["events"]:
        lines.append("- Keine Termine im geprüften Zeitfenster.")
    else:
        for event in calendar["events"]:
            timing = "Ganztägig" if event["all_day"] else " - ".join(filter(None, (event["start"], event["end"])))
            lines.append(f"- {event['summary'] or '(ohne Titel)'}{f': {timing}' if timing else ''}")
    lines.extend(("", "Aufgaben"))
    if tasks["status"] != "verified":
        lines.append(f"- Nicht verifiziert: {tasks['reason']}")
    elif not tasks["tasks"]:
        lines.append("- Keine offenen Aufgaben im geprüften Kanban-Ergebnis.")
    else:
        for task in tasks["tasks"]:
            priority = f"Priorität {task['priority']}" if task["priority"] is not None else "Priorität nicht angegeben"
            suffix = f", {task['status']}" if task["status"] else ""
            lines.append(f"- {task['title'] or '(ohne Titel)'} ({priority}{suffix})")
    lines.extend(("", "Offene Daten", "- Fristen, Aufgabenzeitfenster und VIRUS EVENT-Daten sind nicht aus den geprüften Quellen verfügbar."))
    return {"sources": sources, "text": "\n".join(lines)}


def verified_daily_briefing_text(result: Any, final_response: Any = "") -> str:
    """Return a display-only briefing attached by this completed Jarvis turn.

    The finalizer adds this value only after the active profile check.  Renderers
    deliberately consume the result object of their own turn, never agent state,
    so a briefing cannot cross a session or profile boundary after finalization.
    """
    if not isinstance(result, dict):
        return ""
    briefing = result.get("verified_daily_briefing")
    if not isinstance(briefing, dict):
        return ""
    sources = briefing.get("sources")
    text = briefing.get("text")
    if (
        not isinstance(sources, dict)
        or set(sources) != {"calendar", "tasks"}
        or any(status not in {"verified", "unverified"} for status in sources.values())
        or not isinstance(text, str)
    ):
        return ""
    text = text.strip()
    if not text or len(text) > 6000:
        return ""
    response = final_response if isinstance(final_response, str) else ""
    if " ".join(text.split()) in " ".join(response.split()):
        return ""
    return text


def response_with_verified_daily_briefing(result: Any, final_response: Any = "") -> str:
    """Append the verified briefing for presentation without mutating agent output."""
    response = final_response if isinstance(final_response, str) else ""
    briefing = verified_daily_briefing_text(result, response)
    if not briefing:
        return response
    return f"{response}\n\n{briefing}" if response else briefing


def _read_helper_command(function_args: Any, helper_name: str) -> bool:
    """Require a direct invocation of a fixed, read-only Jarvis helper."""
    command = function_args.get("command") if isinstance(function_args, dict) else None
    if not isinstance(command, str):
        return False
    try:
        parts = shlex.split(command)
    except ValueError:
        return False
    if len(parts) != 2 or Path(parts[1]).name != helper_name:
        return False
    executable = Path(parts[0]).name
    return executable in {"python", "python3"} or executable.startswith("python3.")


def _google_read_command(function_args: Any) -> bool:
    """Only the fixed Jarvis helper is eligible for a Google read receipt."""
    return _read_helper_command(function_args, "jarvis_google_workspace_read.py")


def _gmail_read_command(function_args: Any) -> bool:
    """Only the fixed unread-Gmail helper is eligible for a read receipt."""
    return _read_helper_command(function_args, "jarvis_gmail_unread_read.py")


def _calendar_read_window(function_args: Any) -> str | None:
    """Return the fixed calendar window only for a direct helper invocation."""
    command = function_args.get("command") if isinstance(function_args, dict) else None
    if not isinstance(command, str):
        return None
    try:
        parts = shlex.split(command)
    except ValueError:
        return None
    if len(parts) != 4 or Path(parts[1]).name != "jarvis_calendar_read.py":
        return None
    executable = Path(parts[0]).name
    if executable not in {"python", "python3"} and not executable.startswith("python3."):
        return None
    if parts[2] != "--window" or parts[3] not in {"today", "tomorrow", "week", "next"}:
        return None
    return parts[3]


def _google_workspace_read_receipt(raw_result: Any) -> dict[str, Any]:
    """Validate the fixed helper's terminal envelope without retaining account data."""
    receipt = {
        "tool": "terminal",
        "workflow": "google_workspace_read",
        "status": "failed",
        "created_at": time(),
    }
    if not isinstance(raw_result, str):
        receipt["error"] = "Terminal returned a non-string result."
        return receipt
    try:
        terminal_result = json.loads(raw_result)
    except json.JSONDecodeError:
        receipt["error"] = "Terminal returned invalid JSON."
        return receipt
    if not isinstance(terminal_result, dict) or terminal_result.get("exit_code") != 0:
        receipt["error"] = "Google Workspace read command failed."
        return receipt
    output = terminal_result.get("output")
    if not isinstance(output, str):
        receipt["error"] = "Google Workspace read returned no JSON output."
        return receipt
    try:
        payload = json.loads(output)
    except json.JSONDecodeError:
        receipt["error"] = "Google Workspace read returned invalid JSON."
        return receipt
    if not isinstance(payload, dict) or payload.get("workflow") != "jarvis_google_workspace_read":
        receipt["error"] = "Terminal output was not a Jarvis Google read result."
        return receipt
    if payload.get("success") is not True:
        receipt["error"] = "Google Workspace read was unsuccessful."
        return receipt
    gmail, calendar = payload.get("gmail"), payload.get("calendar")
    if not isinstance(gmail, dict) or not isinstance(calendar, dict):
        receipt["error"] = "Google Workspace read had an invalid result shape."
        return receipt
    if not isinstance(gmail.get("messages"), list) or not isinstance(calendar.get("events"), list):
        receipt["error"] = "Google Workspace read had an invalid result shape."
        return receipt
    receipt["status"] = "completed"
    receipt["gmail_count"] = len(gmail["messages"])
    receipt["calendar_count"] = len(calendar["events"])
    return receipt


def _gmail_unread_read_receipt(raw_result: Any) -> dict[str, Any]:
    """Validate unread Gmail metadata without retaining any message details."""
    receipt = {
        "tool": "terminal",
        "workflow": "gmail_unread_read",
        "status": "failed",
        "created_at": time(),
    }
    if not isinstance(raw_result, str):
        receipt["error"] = "Terminal returned a non-string result."
        return receipt
    try:
        terminal_result = json.loads(raw_result)
    except json.JSONDecodeError:
        receipt["error"] = "Terminal returned invalid JSON."
        return receipt
    if not isinstance(terminal_result, dict) or terminal_result.get("exit_code") != 0:
        receipt["error"] = "Unread Gmail read command failed."
        return receipt
    output = terminal_result.get("output")
    if not isinstance(output, str):
        receipt["error"] = "Unread Gmail read returned no JSON output."
        return receipt
    try:
        payload = json.loads(output)
    except json.JSONDecodeError:
        receipt["error"] = "Unread Gmail read returned invalid JSON."
        return receipt
    if not isinstance(payload, dict) or payload.get("workflow") != "jarvis_gmail_unread_read":
        receipt["error"] = "Terminal output was not an unread Gmail result."
        return receipt
    gmail = payload.get("gmail")
    if payload.get("success") is not True or not isinstance(gmail, dict):
        receipt["error"] = "Unread Gmail read was unsuccessful."
        return receipt
    if not isinstance(gmail.get("messages"), list):
        receipt["error"] = "Unread Gmail read had an invalid result shape."
        return receipt
    receipt["status"] = "completed"
    receipt["gmail_count"] = len(gmail["messages"])
    return receipt


def _calendar_read_receipt(raw_result: Any, expected_window: str) -> dict[str, Any]:
    """Validate a bounded calendar read without retaining event details."""
    receipt = {
        "tool": "terminal",
        "workflow": "calendar_read",
        "window": expected_window,
        "status": "failed",
        "created_at": time(),
    }
    if not isinstance(raw_result, str):
        receipt["error"] = "Terminal returned a non-string result."
        return receipt
    try:
        terminal_result = json.loads(raw_result)
    except json.JSONDecodeError:
        receipt["error"] = "Terminal returned invalid JSON."
        return receipt
    if not isinstance(terminal_result, dict) or terminal_result.get("exit_code") != 0:
        receipt["error"] = "Calendar read command failed."
        return receipt
    output = terminal_result.get("output")
    if not isinstance(output, str):
        receipt["error"] = "Calendar read returned no JSON output."
        return receipt
    try:
        payload = json.loads(output)
    except json.JSONDecodeError:
        receipt["error"] = "Calendar read returned invalid JSON."
        return receipt
    if not isinstance(payload, dict) or payload.get("workflow") != "jarvis_calendar_read":
        receipt["error"] = "Terminal output was not a Jarvis calendar result."
        return receipt
    calendar, window = payload.get("calendar"), payload.get("time_window")
    if payload.get("success") is not True or not isinstance(calendar, dict) or not isinstance(window, dict):
        receipt["error"] = "Calendar read was unsuccessful."
        return receipt
    if window.get("name") != expected_window or not isinstance(calendar.get("events"), list):
        receipt["error"] = "Calendar read had an invalid result shape."
        return receipt
    start, end, timezone = window.get("start"), window.get("end"), window.get("timezone")
    if not all(isinstance(value, str) and value for value in (start, end, timezone)):
        receipt["error"] = "Calendar read had an invalid time window."
        return receipt
    try:
        start_at = datetime.fromisoformat(start.replace("Z", "+00:00"))
        end_at = datetime.fromisoformat(end.replace("Z", "+00:00"))
    except ValueError:
        receipt["error"] = "Calendar read had an invalid time window."
        return receipt
    if start_at.tzinfo is None or end_at.tzinfo is None or start_at >= end_at:
        receipt["error"] = "Calendar read had an invalid time window."
        return receipt
    if expected_window in {"today", "tomorrow"} and (
        start_at.time().isoformat() != "00:00:00" or end_at.time().isoformat() != "00:00:00"
        or end_at.date() != start_at.date() + timedelta(days=1)
    ):
        receipt["error"] = "Calendar read had an invalid time window."
        return receipt
    if expected_window == "week" and (
        start_at.weekday() != 0 or start_at.time().isoformat() != "00:00:00"
        or end_at.time().isoformat() != "00:00:00" or end_at.date() != start_at.date() + timedelta(days=7)
    ):
        receipt["error"] = "Calendar read had an invalid time window."
        return receipt
    if expected_window == "next" and end_at - start_at != timedelta(days=7):
        receipt["error"] = "Calendar read had an invalid time window."
        return receipt
    receipt["status"] = "completed"
    receipt["calendar_count"] = len(calendar["events"])
    return receipt


def record_agent_tool_result(
    agent: Any, tool_name: str, raw_result: Any, *, function_args: Any = None, blocked: bool = False
) -> dict[str, Any] | None:
    """Record supported, verified Jarvis reads after the native durability fence."""
    if not getattr(agent, "_jarvis_execution_enabled", False):
        return None
    if tool_name == "kanban_list" and blocked:
        receipt = {
            "tool": tool_name,
            "status": "failed",
            "created_at": time(),
            "error": "Tool execution was blocked.",
        }
    elif tool_name == "kanban_list":
        receipt, _result = tool_execution_receipt(tool_name, raw_result)
    elif tool_name == "terminal" and _google_read_command(function_args):
        receipt = _google_workspace_read_receipt(raw_result)
        if blocked:
            receipt["status"] = "failed"
            receipt["error"] = "Tool execution was blocked."
    elif tool_name == "terminal" and _gmail_read_command(function_args):
        receipt = _gmail_unread_read_receipt(raw_result)
        if blocked:
            receipt["status"] = "failed"
            receipt["error"] = "Tool execution was blocked."
    elif tool_name == "terminal" and (window := _calendar_read_window(function_args)):
        receipt = _calendar_read_receipt(raw_result, window)
        if blocked:
            receipt["status"] = "failed"
            receipt["error"] = "Tool execution was blocked."
    else:
        return None
    home = Path(get_hermes_home())
    persist_execution_receipt(receipt, home=home)
    receipts = getattr(agent, "_jarvis_execution_receipts", None)
    if isinstance(receipts, list):
        receipts.append(receipt)
    _record_daily_briefing_source(agent, tool_name, raw_result, receipt, home)
    return receipt
