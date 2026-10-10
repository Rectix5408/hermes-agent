"""Behaviour contracts for deterministic adaptive-routing metadata."""

from types import SimpleNamespace

from agent.adaptive_routing import (
    analyze_request,
    begin_adaptive_turn,
    classify_intent,
    complete_adaptive_turn,
    complexity_score,
    usage_task,
)


def test_classifies_supported_intent_families_without_a_model_call():
    assert classify_intent("Hallo Jarvis") == "simple_chat"
    assert classify_intent("Schreib einen kurzen Entwurf") == "writing"
    assert classify_intent("Debug this Python test") == "coding"
    assert classify_intent("Recherchiere und vergleiche die Quellen") == "research"
    assert classify_intent("Prüfe meine Email mit dem Agent") == "agent_task"
    assert classify_intent("Plane diesen wiederkehrenden Workflow") == "automation"


def test_complexity_is_bounded_and_rewards_explicit_work_signals():
    assert complexity_score("Hallo") == 1
    assert complexity_score("Recherchiere Quellen und vergleiche sie, dann erstelle einen Workflow") >= 7
    assert 1 <= complexity_score("code " * 500) <= 10


def test_route_recommendation_contains_no_model_or_request_text():
    request = "Debug the private customer report in Python"
    route = analyze_request(request)

    assert route.task_type == "coding"
    assert route.preferred_profile == "coding"
    assert route.recommended_profile == "coding"
    assert request not in route.metadata().values()
    assert usage_task(route) == "adaptive:coding"


def test_policy_mapping_is_advisory_and_uses_configured_profile_labels():
    assert analyze_request("Hallo Jarvis").recommended_profile == "local_first"
    assert analyze_request("Prüfe meine Email mit dem Agent").recommended_profile == "smart"
    assert analyze_request("Debug this Python test").recommended_profile == "coding"


def test_adaptive_metadata_does_not_change_the_existing_provider_or_model():
    patches: list[dict] = []
    agent = SimpleNamespace(
        session_id="session-1",
        provider="configured-provider",
        model="configured-model",
        _persist_disabled=False,
        _session_db=SimpleNamespace(patch_session_model_config=lambda _id, patch: patches.append(patch)),
    )

    begin_adaptive_turn(agent, "Debug this Python test")

    metadata = patches[-1]["adaptive_routing"]
    assert agent.provider == "configured-provider"
    assert agent.model == "configured-model"
    assert "provider" not in metadata
    assert "model" not in metadata
    assert 0.0 <= metadata["confidence_score"] <= 1.0


def test_turn_metadata_persists_only_safe_fields_and_outcome():
    patches: list[dict] = []
    agent = SimpleNamespace(
        session_id="session-1",
        _persist_disabled=False,
        _session_db=SimpleNamespace(patch_session_model_config=lambda _id, patch: patches.append(patch)),
    )

    begin_adaptive_turn(agent, "Schreib einen Entwurf für die private Notiz")
    complete_adaptive_turn(agent, success=True)

    assert patches[-1]["adaptive_routing"] == {
        "task_type": "writing",
        "complexity_score": 3,
        "preferred_profile": "fast",
        "reason": "Writing request; prefer a configured fast or default profile.",
        "confidence_score": 0.82,
        "recommended_profile": "fast",
        "routing_reason": "Writing request; prefer a configured fast or default profile.",
        "success": True,
    }
