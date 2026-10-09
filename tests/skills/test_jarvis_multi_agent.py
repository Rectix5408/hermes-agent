"""Unit contracts for the Jarvis multi-agent helper."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "skills"
    / "productivity"
    / "jarvis-assistant"
    / "scripts"
    / "jarvis_multi_agent.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location("jarvis_multi_agent", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_plan_routes_multiple_intents_with_limits():
    jarvis = _load_module()

    plan = jarvis.build_plan(
        "Erstelle Instagram Content, recherchiere Quellen und plane das Business-Projekt",
        limits=jarvis.OrchestrationLimits(max_agents=2, max_parallel=1, max_steps_per_agent=2),
    )

    assert plan["schema"] == jarvis.SCHEMA_VERSION
    assert len(plan["tasks"]) == 2
    assert plan["parallel_groups"] == [[plan["tasks"][0]["agent_id"]], [plan["tasks"][1]["agent_id"]]]
    assert all(task["max_steps"] <= 2 for task in plan["tasks"])
    assert all(task["model_route"] == "jarvis.specialist_model" for task in plan["tasks"])
    assert all("routing_decision" in task for task in plan["tasks"])
    assert plan["token_policy"]["within_prompt_budget"] is True
    assert plan["memory_policy"]["use"] == "selective"
    assert plan["model_policy"]["preference"] == "cheap_or_existing_route"
    assert plan["safety"]["external_writes"] == "approval_required"


def test_routing_modes_prefer_local_and_block_cloud_when_requested():
    jarvis = _load_module()

    plan = jarvis.build_plan(
        "Recherchiere Wettbewerber und fasse Quellen zusammen",
        {"sources": [{"title": "A", "claim": "Local models reduce API cost."}]},
        jarvis.OrchestrationLimits(routing_mode="local_only", max_prompt_tokens=600),
    )

    task = plan["tasks"][0]
    assert plan["model_policy"]["routing_mode"] == "local_only"
    assert task["routing_decision"]["selected_route"] in {"deterministic", "local"}
    assert task["token_budget"]["prompt"] <= 600


def test_instagram_agent_drafts_without_publishing_or_credentials():
    jarvis = _load_module()

    result = jarvis.run_instagram_agent(
        "Plane Reels und Captions fuer den Jarvis Launch",
        {"brand": "Jarvis", "audience": "Gruender", "topics": ["KI Assistenz", "Automatisierung"]},
    )

    assert result.status == "drafted"
    assert "caption_draft" in result.structured
    assert result.approval_required[0]["action"] == "publish_or_schedule_instagram_content"
    assert result.missing_integrations == ["instagram_meta_api"]


def test_email_agent_prioritizes_and_only_drafts_replies():
    jarvis = _load_module()

    result = jarvis.run_email_agent(
        "Triagiere meine Inbox",
        {"messages": [
            {"id": "a", "from": "kunde@example.com", "subject": "Dringend: Freigabe?", "body": "Deadline heute"},
            {"id": "b", "from": "newsletter@example.com", "subject": "Newsletter", "body": "FYI"},
        ]},
    )

    assert result.status == "drafted"
    assert result.structured["prioritized_threads"][0]["id"] == "a"
    assert result.structured["reply_drafts"][0]["status"] == "draft_only"
    assert result.approval_required[0]["action"] == "send_or_modify_email"


def test_email_agent_blocks_without_connector_or_payload():
    jarvis = _load_module()

    result = jarvis.run_email_agent("Triagiere meine Inbox", {})

    assert result.status == "blocked"
    assert "google-workspace_or_himalaya" in result.missing_integrations


def test_research_agent_plans_without_sources_and_compares_sources_when_supplied():
    jarvis = _load_module()

    planned = jarvis.run_research_agent("Recherchiere lokale KI Modelle", {})
    assert planned.status == "planned"
    assert planned.structured["queries"]

    summarized = jarvis.run_research_agent(
        "Vergleiche Quellen",
        {"sources": [
            {"title": "A", "url": "https://example.com/a", "claim": "Local models reduce API cost."},
            {"title": "B", "url": "https://example.com/b", "claim": "Local models help, aber quality varies."},
        ]},
    )
    assert summarized.status == "summarized"
    assert summarized.structured["conflicts"]
    assert summarized.handoff[0]["to"] == "business"


def test_orchestrate_consolidates_approvals_and_never_executes_external_actions():
    jarvis = _load_module()

    output = jarvis.orchestrate(
        "Plane Instagram Content und Business Workflow",
        {"brand": "Jarvis", "tasks": ["Launch planen"], "kanban_configured": True},
        jarvis.OrchestrationLimits(max_agents=3, max_parallel=2),
    )

    assert output["status"] == "completed"
    assert output["consolidated"]["external_actions_executed"] is False
    assert output["consolidated"]["approval_required"]
    assert "instagram_meta_api" in output["consolidated"]["missing_integrations"]
