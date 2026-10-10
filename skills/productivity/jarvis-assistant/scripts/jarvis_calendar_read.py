#!/usr/bin/env python3
"""Read bounded Calendar metadata through the installed Google Workspace skill."""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Any

from hermes_time import get_timezone_name, now


_WORKFLOW = "jarvis_calendar_read"
_MAX_EVENTS = 20
_TEXT_LIMIT = 240
_WINDOWS = {"today", "tomorrow", "week", "next"}


def _google_api_path() -> Path | None:
    """Find the existing Google Workspace wrapper in the active profile first."""
    home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
    candidates = (
        home / "skills" / "productivity" / "google-workspace" / "scripts" / "google_api.py",
        Path(__file__).resolve().parents[2] / "google-workspace" / "scripts" / "google_api.py",
    )
    return next((path for path in candidates if path.is_file()), None)


def _text(value: Any) -> str:
    """Bound output size before it enters the model context."""
    return str(value or "").strip()[:_TEXT_LIMIT]


def _failure(error: str) -> dict[str, Any]:
    return {"workflow": _WORKFLOW, "success": False, "error": error}


def _time_window(name: str, current: datetime) -> tuple[datetime, datetime]:
    """Resolve a named local, half-open calendar window."""
    local_midnight = current.replace(hour=0, minute=0, second=0, microsecond=0)
    if name == "today":
        return local_midnight, local_midnight + timedelta(days=1)
    if name == "tomorrow":
        start = local_midnight + timedelta(days=1)
        return start, start + timedelta(days=1)
    if name == "week":
        start = local_midnight - timedelta(days=local_midnight.weekday())
        return start, start + timedelta(days=7)
    if name == "next":
        return current, current + timedelta(days=7)
    raise ValueError("Unsupported calendar window.")


def read_calendar(window_name: str) -> dict[str, Any]:
    """Run only an explicit, bounded read of the primary calendar."""
    if window_name not in _WINDOWS:
        return _failure("Unsupported calendar window.")
    google_api = _google_api_path()
    if google_api is None:
        return _failure("Google Workspace skill is not installed for this profile.")
    current = now()
    start, end = _time_window(window_name, current)
    timezone = get_timezone_name() or (current.tzname() or "local")
    try:
        completed = subprocess.run(
            [
                sys.executable,
                str(google_api),
                "calendar",
                "list",
                "--start",
                start.isoformat(),
                "--end",
                end.isoformat(),
                "--max",
                str(_MAX_EVENTS),
                "--calendar",
                "primary",
            ],
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return _failure("Calendar retrieval could not be completed.")
    if completed.returncode != 0:
        return _failure("Calendar retrieval was rejected or failed.")
    try:
        events = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return _failure("Google Workspace returned an invalid calendar response.")
    if not isinstance(events, list):
        return _failure("Google Workspace returned an invalid calendar response.")
    return {
        "workflow": _WORKFLOW,
        "success": True,
        "time_window": {
            "name": window_name,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "timezone": timezone,
        },
        "calendar": {
            "events": [
                {
                    "summary": _text(event.get("summary")),
                    "start": _text(event.get("start")),
                    "end": _text(event.get("end")),
                    "timezone": _text(event.get("timeZone") or event.get("timezone")),
                    "all_day": "T" not in _text(event.get("start")),
                }
                for event in events[:_MAX_EVENTS]
                if isinstance(event, dict)
            ]
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--window", choices=sorted(_WINDOWS), required=True)
    args = parser.parse_args()
    print(json.dumps(read_calendar(args.window), ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
