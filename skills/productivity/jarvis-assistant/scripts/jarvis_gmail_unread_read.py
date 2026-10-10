#!/usr/bin/env python3
"""Read compact unread Gmail metadata through the installed Workspace skill."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Any


_WORKFLOW = "jarvis_gmail_unread_read"
_MAX_MESSAGES = 20
_TEXT_LIMIT = 240


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


def unread_gmail() -> dict[str, Any]:
    """Run only the installed read-only unread-message search."""
    google_api = _google_api_path()
    if google_api is None:
        return _failure("Google Workspace skill is not installed for this profile.")
    try:
        completed = subprocess.run(
            [
                sys.executable,
                str(google_api),
                "gmail",
                "search",
                "is:unread",
                "--max",
                str(_MAX_MESSAGES),
            ],
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return _failure("Unread Gmail retrieval could not be completed.")
    if completed.returncode != 0:
        return _failure("Unread Gmail retrieval was rejected or failed.")
    try:
        messages = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return _failure("Google Workspace returned an invalid Gmail response.")
    if not isinstance(messages, list):
        return _failure("Google Workspace returned an invalid Gmail response.")
    return {
        "workflow": _WORKFLOW,
        "success": True,
        "gmail": {
            "messages": [
                {
                    "from": _text(message.get("from")),
                    "subject": _text(message.get("subject")),
                    "date": _text(message.get("date")),
                }
                for message in messages[:_MAX_MESSAGES]
                if isinstance(message, dict)
            ]
        },
    }


def main() -> int:
    print(json.dumps(unread_gmail(), ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
