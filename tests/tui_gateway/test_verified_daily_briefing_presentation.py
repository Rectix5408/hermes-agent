"""The TUI renders a verified Jarvis briefing without changing transcript receipts."""

import contextlib
from types import SimpleNamespace

import tui_gateway.server as srv


def test_complete_payload_appends_briefing_but_keeps_persisted_response(monkeypatch):
    monkeypatch.setattr(srv, "_get_usage", lambda _agent: {})
    monkeypatch.setattr(srv, "render_message", lambda text, _cols: f"rendered:{text}")
    monkeypatch.setattr(srv, "_clear_inflight_turn", lambda _session: None)
    raw = "Hier ist dein Tag."
    briefing = {
        "sources": {"calendar": "verified", "tasks": "unverified"},
        "text": "Tagesübersicht\nAufgaben\n- Nicht verifiziert: Kanban nicht erreichbar.",
    }
    agent = SimpleNamespace(_session_title_hint="Scratch")
    st = SimpleNamespace(
        result={"final_response": raw, "verified_daily_briefing": briefing}, agent=agent,
        terminal_callback=None, receipt_committed=True, receipt_attempted=False,
        marker_key="", error_retained=False, error_detail="", prompt_text="plane meinen Tag",
    )
    session = {"pending_title": None, "session_key": "k", "history_lock": contextlib.nullcontext(), "agent": agent}
    persisted_raw = []
    monkeypatch.setattr(srv, "_persisted_turn_receipt", lambda _st, text, _status: persisted_raw.append(text) or None)

    payload, returned_raw, status = srv._complete_turn_payload(session, st, None, 80)

    assert status == "complete"
    assert returned_raw == raw
    assert persisted_raw == [raw]
    assert payload["text"] == raw + "\n\n" + briefing["text"]
    assert payload["rendered"] == "rendered:" + payload["text"]
