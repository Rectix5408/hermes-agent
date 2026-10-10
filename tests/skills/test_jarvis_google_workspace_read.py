"""Read-only Jarvis Google Workspace helper contracts."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace


SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "skills/productivity/jarvis-assistant/scripts/jarvis_google_workspace_read.py"
)


def _module():
    spec = importlib.util.spec_from_file_location("jarvis_google_workspace_read_test", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_read_helper_runs_only_existing_google_read_commands(monkeypatch, tmp_path):
    module = _module()
    google_api = tmp_path / "google_api.py"
    google_api.write_text("# mocked\n", encoding="utf-8")
    commands = []
    monkeypatch.setattr(module, "_google_api_path", lambda: google_api)
    monkeypatch.setattr(
        module.subprocess, "run",
        lambda command, **kwargs: commands.append(command) or SimpleNamespace(
            returncode=0,
            stdout=json.dumps([
                {"from": "Ada", "subject": "Status", "date": "today", "snippet": "Read this"},
            ] if "gmail" in command else [
                {"summary": "Planung", "start": "2026-10-10T09:00:00Z", "end": "2026-10-10T10:00:00Z"},
            ]), stderr="",
        ),
    )

    overview = module.build_overview(10, 10)

    assert overview["success"] is True
    assert overview["gmail"]["messages"][0]["from"] == "Ada"
    assert overview["calendar"]["events"][0]["summary"] == "Planung"
    assert commands[0][2:6] == ["gmail", "search", "is:unread", "--max"]
    assert commands[1][2:5] == ["calendar", "list", "--max"]
    assert not any(action in part for command in commands for part in command for action in ("send", "modify", "create", "delete"))


def test_read_helper_accepts_empty_results_and_reports_invalid_or_missing_auth(monkeypatch, tmp_path):
    module = _module()
    google_api = tmp_path / "google_api.py"
    google_api.write_text("# mocked\n", encoding="utf-8")
    monkeypatch.setattr(module, "_google_api_path", lambda: google_api)
    monkeypatch.setattr(
        module.subprocess, "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="[]", stderr=""),
    )
    assert module.build_overview(1, 1) == {
        "workflow": "jarvis_google_workspace_read", "success": True,
        "gmail": {"messages": []}, "calendar": {"events": []},
    }

    monkeypatch.setattr(
        module.subprocess, "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=1, stdout="", stderr="Not authenticated"),
    )
    assert module.build_overview(1, 1)["error"] == "Google authorization is unavailable."

    monkeypatch.setattr(
        module.subprocess, "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="not json", stderr=""),
    )
    assert module.build_overview(1, 1)["error"] == "Google Workspace returned invalid JSON."
