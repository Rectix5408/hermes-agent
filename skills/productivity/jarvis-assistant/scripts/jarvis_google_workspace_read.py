#!/usr/bin/env python3
"""Compact, read-only Jarvis overview through the bundled Google Workspace CLI."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

_WORKFLOW = "jarvis_google_workspace_read"
_MAX_ITEMS = 20
_TEXT_LIMIT = 240


def _google_api_path() -> Path:
    profile_copy = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes")) / "skills"
    candidate = profile_copy / "productivity" / "google-workspace" / "scripts" / "google_api.py"
    if candidate.is_file():
        return candidate
    return Path(__file__).resolve().parents[2] / "google-workspace" / "scripts" / "google_api.py"


def _text(value: Any) -> str:
    return " ".join(str(value or "").split())[:_TEXT_LIMIT]


def _failure(stderr: str) -> dict[str, Any]:
    detail = stderr.lower()
    if "not authenticated" in detail or "token" in detail:
        error = "Google authorization is unavailable."
    elif "403" in detail or "insufficient permission" in detail:
        error = "Google authorization lacks the required read permissions."
    else:
        error = "Google Workspace read failed."
    return {"workflow": _WORKFLOW, "success": False, "error": error}


def _run_google(api_path: Path, *args: str) -> list[dict[str, Any]] | dict[str, Any]:
    try:
        completed = subprocess.run(
            [sys.executable, str(api_path), *args], capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=30, check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return _failure("")
    if completed.returncode != 0:
        return _failure(completed.stderr or completed.stdout)
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return {"workflow": _WORKFLOW, "success": False, "error": "Google Workspace returned invalid JSON."}
    return payload if isinstance(payload, list) else {
        "workflow": _WORKFLOW, "success": False, "error": "Google Workspace returned an invalid result shape."
    }


def build_overview(mail_limit: int, calendar_limit: int) -> dict[str, Any]:
    api_path = _google_api_path()
    if not api_path.is_file():
        return {"workflow": _WORKFLOW, "success": False, "error": "Google Workspace skill is unavailable."}
    messages = _run_google(api_path, "gmail", "search", "is:unread", "--max", str(mail_limit))
    if isinstance(messages, dict):
        return messages
    events = _run_google(api_path, "calendar", "list", "--max", str(calendar_limit))
    if isinstance(events, dict):
        return events
    return {
        "workflow": _WORKFLOW,
        "success": True,
        "gmail": {"messages": [
            {key: _text(message.get(key)) for key in ("from", "subject", "date", "snippet")}
            for message in messages[:mail_limit] if isinstance(message, dict)
        ]},
        "calendar": {"events": [
            {key: _text(event.get(key)) for key in ("summary", "start", "end", "location", "status")}
            for event in events[:calendar_limit] if isinstance(event, dict)
        ]},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mail-limit", type=int, default=10)
    parser.add_argument("--calendar-limit", type=int, default=10)
    args = parser.parse_args()
    overview = build_overview(
        max(1, min(args.mail_limit, _MAX_ITEMS)), max(1, min(args.calendar_limit, _MAX_ITEMS))
    )
    print(json.dumps(overview, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
