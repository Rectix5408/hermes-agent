"""Read-only Jarvis Calendar helper contracts."""

from __future__ import annotations

from datetime import datetime
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo


SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "skills/productivity/jarvis-assistant/scripts/jarvis_calendar_read.py"
)


def _module():
    spec = importlib.util.spec_from_file_location("jarvis_calendar_read_test", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_calendar_read_uses_profile_timezone_and_only_bounded_list(monkeypatch, tmp_path):
    module = _module()
    google_api = tmp_path / "google_api.py"
    google_api.write_text("# mocked\n", encoding="utf-8")
    current = datetime(2026, 10, 10, 9, 30, tzinfo=ZoneInfo("Europe/Berlin"))
    commands = []
    monkeypatch.setattr(module, "_google_api_path", lambda: google_api)
    monkeypatch.setattr(module, "now", lambda: current)
    monkeypatch.setattr(module, "get_timezone_name", lambda: "Europe/Berlin")
    monkeypatch.setattr(
        module.subprocess,
        "run",
        lambda command, **kwargs: commands.append(command) or SimpleNamespace(
            returncode=0,
            stdout=json.dumps([
                {
                    "summary": "Planung", "start": "2026-10-11T09:00:00+02:00",
                    "end": "2026-10-11T10:00:00+02:00", "timeZone": "Europe/Berlin",
                },
                {"summary": "Urlaub", "start": "2026-10-11", "end": "2026-10-12"},
            ]),
            stderr="",
        ),
    )

    result = module.read_calendar("tomorrow")

    assert result["time_window"] == {
        "name": "tomorrow", "start": "2026-10-11T00:00:00+02:00",
        "end": "2026-10-12T00:00:00+02:00", "timezone": "Europe/Berlin",
    }
    assert result["calendar"]["events"] == [
        {
            "summary": "Planung", "start": "2026-10-11T09:00:00+02:00",
            "end": "2026-10-11T10:00:00+02:00", "timezone": "Europe/Berlin", "all_day": False,
        },
        {"summary": "Urlaub", "start": "2026-10-11", "end": "2026-10-12", "timezone": "", "all_day": True},
    ]
    assert commands[0][2:] == [
        "calendar", "list", "--start", "2026-10-11T00:00:00+02:00", "--end",
        "2026-10-12T00:00:00+02:00", "--max", "20", "--calendar", "primary",
    ]
    assert not any(
        action in part for command in commands for part in command
        for action in ("create", "delete", "update", "insert", "rsvp")
    )


def test_calendar_read_handles_empty_and_invalid_windows(monkeypatch, tmp_path):
    module = _module()
    google_api = tmp_path / "google_api.py"
    google_api.write_text("# mocked\n", encoding="utf-8")
    monkeypatch.setattr(module, "_google_api_path", lambda: google_api)
    monkeypatch.setattr(module, "now", lambda: datetime(2026, 10, 10, tzinfo=ZoneInfo("UTC")))
    monkeypatch.setattr(module, "get_timezone_name", lambda: "UTC")
    monkeypatch.setattr(
        module.subprocess, "run", lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="[]", stderr=""),
    )

    assert module.read_calendar("week")["calendar"] == {"events": []}
    assert module.read_calendar("today")["time_window"] == {
        "name": "today", "start": "2026-10-10T00:00:00+00:00",
        "end": "2026-10-11T00:00:00+00:00", "timezone": "UTC",
    }
    assert module.read_calendar("invalid")["success"] is False


def test_calendar_read_reports_authorization_and_invalid_provider_data(monkeypatch, tmp_path):
    module = _module()
    google_api = tmp_path / "google_api.py"
    google_api.write_text("# mocked\n", encoding="utf-8")
    monkeypatch.setattr(module, "_google_api_path", lambda: google_api)
    monkeypatch.setattr(
        module.subprocess, "run", lambda *args, **kwargs: SimpleNamespace(returncode=1, stdout="", stderr="No auth"),
    )
    assert module.read_calendar("next")["success"] is False

    monkeypatch.setattr(
        module.subprocess, "run", lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="not json", stderr=""),
    )
    assert module.read_calendar("next")["success"] is False


def test_today_window_preserves_local_midnight_across_dst():
    module = _module()
    current = datetime(2026, 3, 29, 12, tzinfo=ZoneInfo("Europe/Berlin"))

    start, end = module._time_window("today", current)

    assert start.isoformat() == "2026-03-29T00:00:00+01:00"
    assert end.isoformat() == "2026-03-30T00:00:00+02:00"
