"""Jarvis briefings are visible output, never a replacement agent response."""

from types import SimpleNamespace

import pytest


_BRIEFING = {
    "sources": {"calendar": "verified", "tasks": "unverified"},
    "text": "Tagesübersicht\nQuellenstatus: Kalender verified; Aufgaben unverified\n\nTermine\n- 10:00 Planung\n\nAufgaben\n- Nicht verifiziert: Kanban nicht erreichbar.",
}


@pytest.fixture
def cli_stub(monkeypatch):
    from cli import HermesCLI
    import cli as climod

    cli = HermesCLI.__new__(HermesCLI)
    cli.final_response_markdown = "raw"
    cli._reset_stream_state()
    cli._last_turn_interrupted = False
    printed = []
    monkeypatch.setattr(climod, "_cprint", printed.append)
    monkeypatch.setattr(HermesCLI, "_scrollback_box_width", lambda self: 74)
    return cli, printed


def test_unstreamed_briefing_is_appended_without_mutating_final_response(cli_stub, monkeypatch):
    from cli import HermesCLI
    import cli as climod

    cli, _ = cli_stub
    rendered = []
    panels = []
    monkeypatch.setattr(climod, "_render_final_assistant_content", lambda text, **_kwargs: rendered.append(text) or text)
    monkeypatch.setattr(climod, "ChatConsole", lambda: SimpleNamespace(print=panels.append))
    result = {"final_response": "Hier ist dein Tag.", "verified_daily_briefing": _BRIEFING}
    turn = SimpleNamespace(use_streaming_tts=False, box_opened=False, result=result)

    HermesCLI._chat_print_response_panel(cli, turn, result["final_response"])

    assert result["final_response"] == "Hier ist dein Tag."
    assert rendered == ["Hier ist dein Tag.\n\n" + _BRIEFING["text"]]
    assert len(panels) == 1


def test_streamed_briefing_is_a_single_suffix_not_a_second_response(cli_stub, monkeypatch):
    from cli import HermesCLI
    import cli as climod

    cli, printed = cli_stub
    cli._stream_started = True
    cli._stream_box_opened = True
    monkeypatch.setattr(climod, "_post_stream_transform_output", lambda *_args: "")
    result = {"final_response": "Hier ist dein Tag.", "verified_daily_briefing": _BRIEFING}
    turn = SimpleNamespace(use_streaming_tts=False, box_opened=False, result=result)

    HermesCLI._chat_print_response_panel(cli, turn, result["final_response"])

    assert printed == ["\n\n" + _BRIEFING["text"]]


def test_existing_briefing_in_model_response_is_not_printed_twice(cli_stub, monkeypatch):
    from cli import HermesCLI
    import cli as climod

    cli, printed = cli_stub
    cli._stream_started = True
    cli._stream_box_opened = True
    monkeypatch.setattr(climod, "_post_stream_transform_output", lambda *_args: "")
    response = "Hier ist dein Tag.\n\n" + _BRIEFING["text"]
    turn = SimpleNamespace(use_streaming_tts=False, box_opened=False,
                           result={"final_response": response, "verified_daily_briefing": _BRIEFING})

    HermesCLI._chat_print_response_panel(cli, turn, response)

    assert printed == []


def test_invalid_or_absent_briefing_is_not_rendered():
    from agent.jarvis_execution import response_with_verified_daily_briefing

    response = "Unveränderte Antwort."
    assert response_with_verified_daily_briefing({"final_response": response}, response) == response
    assert response_with_verified_daily_briefing(
        {"verified_daily_briefing": {"sources": {"calendar": "verified"}, "text": "Injected"}}, response
    ) == response


def test_partial_source_failure_remains_visible_as_unverified():
    from agent.jarvis_execution import response_with_verified_daily_briefing

    visible = response_with_verified_daily_briefing(
        {"final_response": "Hier ist dein Tag.", "verified_daily_briefing": _BRIEFING}, "Hier ist dein Tag."
    )

    assert "Aufgaben unverified" in visible
    assert "Nicht verifiziert: Kanban nicht erreichbar." in visible
