"""Behaviour contracts for session-start capability profiles."""

from types import SimpleNamespace

from agent.capability_profiles import (
    apply_capability_profile,
    persist_capability_metadata,
    record_capability_prompt_estimate,
    resolve_capabilities,
)


def test_simple_chat_uses_only_the_minimal_existing_capability():
    profile = resolve_capabilities("simple_chat", 1)

    assert profile.name == "simple_chat"
    assert profile.toolsets == ("clarify",)
    assert profile.prompt_modules == ("core",)
    assert profile.memory_required is False


def test_coding_and_agent_tasks_choose_their_existing_toolsets():
    coding = resolve_capabilities("coding", 4)
    agent_task = resolve_capabilities("agent_task", 7)

    assert coding.toolsets == ("coding",)
    assert {"coding", "memory", "execution"} <= set(coding.prompt_modules)
    assert agent_task.toolsets == ("delegation", "clarify")
    assert {"agent", "delegation", "memory", "execution"} <= set(agent_task.prompt_modules)


def test_simple_profile_has_no_unrelated_toolsets():
    profile = resolve_capabilities("simple_chat", 1)

    assert set(profile.toolsets).isdisjoint({"coding", "web", "delegation", "cronjob", "memory"})


def test_measurement_metadata_has_no_request_content_or_provider_fields():
    patches: list[dict] = []
    agent = SimpleNamespace(
        session_id="session-1",
        _persist_disabled=False,
        _session_db=SimpleNamespace(patch_session_model_config=lambda _id, patch: patches.append(patch)),
        tools=[{"function": {"name": "clarify", "description": "Ask a question"}}],
        _memory_enabled=False,
        _user_profile_enabled=False,
    )
    profile = resolve_capabilities("simple_chat", 1)

    toolsets, skips_memory = apply_capability_profile(agent, profile)
    record_capability_prompt_estimate(agent, "Core prompt only")
    persist_capability_metadata(agent)

    metadata = patches[-1]["capability_profile"]
    assert toolsets == ["clarify"]
    assert skips_memory is True
    assert metadata["capability_name"] == "simple_chat"
    assert metadata["loaded_toolsets"] == ["clarify"]
    assert metadata["prompt_modules"] == ["core"]
    assert metadata["memory_enabled"] is False
    assert metadata["prompt_context_estimate"] > 0
    assert metadata["estimated_context_tokens"] > metadata["prompt_context_estimate"]
    assert "provider" not in metadata
    assert "model" not in metadata
