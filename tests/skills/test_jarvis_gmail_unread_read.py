"""Read-only Jarvis unread Gmail helper contracts."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace


SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "skills/productivity/jarvis-assistant/scripts/jarvis_gmail_unread_read.py"
)


def _module():
    spec = importlib.util.spec_from_file_location("jarvis_gmail_unread_read_test", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_unread_gmail_uses_only_the_installed_read_command(monkeypatch, tmp_path):
    module = _module()
    google_api = tmp_path / "google_api.py"
    google_api.write_text("# mocked\n", encoding="utf-8")
    commands = []
    monkeypatch.setattr(module, "_google_api_path", lambda: google_api)
    monkeypatch.setattr(
        module.subprocess,
        "run",
        lambda command, **kwargs: commands.append(command) or SimpleNamespace(
            returncode=0,
            stdout=json.dumps([
                {"from": "Ada", "subject": "Status", "date": "today", "snippet": "Do not expose"},
            ]),
            stderr="",
        ),
    )

    result = module.unread_gmail()

    assert result == {
        "workflow": "jarvis_gmail_unread_read",
        "success": True,
        "gmail": {"messages": [{"from": "Ada", "subject": "Status", "date": "today"}]},
    }
    assert commands[0][2:] == ["gmail", "search", "is:unread", "--max", "20"]
    assert not any(
        action in part for command in commands for part in command
        for action in ("send", "modify", "create", "delete", "trash")
    )


def test_unread_gmail_handles_empty_inbox_and_unavailable_authorization(monkeypatch, tmp_path):
    module = _module()
    google_api = tmp_path / "google_api.py"
    google_api.write_text("# mocked\n", encoding="utf-8")
    monkeypatch.setattr(module, "_google_api_path", lambda: google_api)
    monkeypatch.setattr(
        module.subprocess, "run", lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="[]", stderr=""),
    )
    assert module.unread_gmail()["gmail"] == {"messages": []}

    monkeypatch.setattr(
        module.subprocess, "run", lambda *args, **kwargs: SimpleNamespace(returncode=1, stdout="", stderr="No auth"),
    )
    assert module.unread_gmail()["success"] is False

    monkeypatch.setattr(
        module.subprocess, "run", lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="not json", stderr=""),
    )
    assert module.unread_gmail()["success"] is False
