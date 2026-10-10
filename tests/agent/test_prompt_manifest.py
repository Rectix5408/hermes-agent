"""Contracts for capability-frozen stable prompt manifests."""

from types import SimpleNamespace

from agent.capability_profiles import (
    apply_capability_profile,
    record_capability_prompt_estimate,
    resolve_capabilities,
)
from agent.prompt_manifest import freeze_stable_prompt_manifest
from gateway.capability_session import initial_capability_profile


def _manifest_for(task_type: str):
    agent = SimpleNamespace()
    apply_capability_profile(agent, resolve_capabilities(task_type, 4))
    return agent, freeze_stable_prompt_manifest(agent)


def test_simple_chat_manifest_has_only_the_unconditional_core():
    _agent, manifest = _manifest_for("simple_chat")

    assert manifest.core_always == ("identity", "hermes_help", "completion")
    assert manifest.capability_modules == ()
    assert manifest.execution_modules == ()


def test_coding_manifest_includes_only_coding_memory_and_execution_capabilities():
    _agent, manifest = _manifest_for("coding")

    assert {"coding", "memory"} <= set(manifest.capability_modules)
    assert "agent" not in manifest.capability_modules
    assert "model_execution" in manifest.execution_modules


def test_agent_task_manifest_includes_agent_and_delegation_capabilities():
    _agent, manifest = _manifest_for("agent_task")

    assert {"agent", "memory", "delegation"} <= set(manifest.capability_modules)
    assert "coding" not in manifest.capability_modules


def test_manifest_is_frozen_for_the_session():
    agent, original = _manifest_for("coding")
    agent._capability_profile = resolve_capabilities("simple_chat", 1)

    assert freeze_stable_prompt_manifest(agent) is original


def test_resume_does_not_select_a_replacement_manifest():
    resumed = SimpleNamespace(history=[{"role": "user", "content": "earlier"}], message="Debug this file")

    assert initial_capability_profile(resumed) is None


def test_manifest_metadata_records_only_names_and_token_estimates():
    patches: list[dict] = []
    agent, manifest = _manifest_for("simple_chat")
    agent.session_id = "session-1"
    agent._persist_disabled = False
    agent._memory_enabled = False
    agent._user_profile_enabled = False
    agent.tools = []
    agent._session_db = SimpleNamespace(patch_session_model_config=lambda _id, patch: patches.append(patch))

    record_capability_prompt_estimate(agent, "full prompt", stable_prompt="stable core")

    metadata = patches[-1]["capability_profile"]
    assert metadata["prompt_manifest_modules"] == list(manifest.module_names)
    assert metadata["estimated_stable_tokens_before"] > metadata["estimated_stable_tokens_after"]
    assert "prompt" not in metadata
