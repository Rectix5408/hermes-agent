"""Behaviour contracts for session-start workspace-context budgeting."""

from types import SimpleNamespace
from unittest.mock import patch

from agent.capability_profiles import (
    apply_capability_profile,
    resolve_capabilities,
    resolve_capabilities_for_request,
)
from agent.context_budget import (
    ContextBudgetDecision,
    apply_context_budget,
    resolve_workspace_context_for_request,
)
from agent.model_metadata import estimate_tokens_rough
from agent.system_prompt import build_system_prompt
from gateway.capability_session import initial_context_budget


_WORKSPACE_CONTEXT = "## Project Context\n\n" + ("Follow this workspace rule. " * 240)


def _agent():
    patches: list[dict] = []
    return SimpleNamespace(
        load_soul_identity=False,
        skip_context_files=False,
        valid_tool_names=[],
        tools=[],
        _task_completion_guidance=False,
        _tool_use_enforcement=False,
        _environment_probe=False,
        _kanban_worker_guidance="",
        _memory_store=None,
        _memory_manager=None,
        _memory_enabled=False,
        _user_profile_enabled=False,
        model="",
        provider="",
        platform="",
        pass_session_id=False,
        session_id="budget-session",
        _persist_disabled=False,
        _session_db=SimpleNamespace(patch_session_model_config=lambda _id, patch: patches.append(patch)),
        _emit_diagnostic_status=lambda *_args, **_kwargs: None,
        _budget_patches=patches,
    )


def _build_for(message: str):
    profile = resolve_capabilities_for_request(message)
    decision = resolve_workspace_context_for_request(message, profile)
    agent = _agent()
    apply_capability_profile(agent, profile)
    apply_context_budget(agent, decision)
    with (
        patch("agent.prompt_builder.load_soul_md", return_value=""),
        patch("agent.prompt_builder.build_environment_hints", return_value=""),
        patch("agent.prompt_builder.build_context_files_prompt", return_value=_WORKSPACE_CONTEXT) as context_builder,
    ):
        prompt = build_system_prompt(agent)
    return agent, decision, prompt, context_builder


def test_simple_chat_omits_workspace_context_and_records_real_token_delta():
    agent, decision, prompt, context_builder = _build_for("Hello, how are you?")

    metadata = agent._capability_metadata
    assert decision.workspace_context == "unnecessary"
    context_builder.assert_not_called()
    assert "Follow this workspace rule." not in prompt
    assert metadata["workspace_context_loaded"] is False
    assert metadata["estimated_prompt_tokens_after"] == estimate_tokens_rough(prompt)
    assert metadata["estimated_prompt_tokens_before"] > metadata["estimated_prompt_tokens_after"]


def test_writing_without_project_reference_omits_workspace_context():
    _agent_value, decision, prompt, context_builder = _build_for("Write a concise thank-you note.")

    assert decision.workspace_context == "unnecessary"
    context_builder.assert_not_called()
    assert "Follow this workspace rule." not in prompt


def test_workspace_suppression_reduces_the_actual_assembled_prompt_tokens():
    profile = resolve_capabilities("simple_chat", 1)
    loaded_agent, skipped_agent = _agent(), _agent()
    apply_capability_profile(loaded_agent, profile)
    apply_capability_profile(skipped_agent, profile)
    apply_context_budget(loaded_agent, ContextBudgetDecision("required", "comparison baseline"))
    apply_context_budget(skipped_agent, ContextBudgetDecision("unnecessary", "budgeted session"))
    with (
        patch("agent.prompt_builder.load_soul_md", return_value=""),
        patch("agent.prompt_builder.build_environment_hints", return_value=""),
        patch("agent.prompt_builder.build_context_files_prompt", return_value=_WORKSPACE_CONTEXT),
    ):
        loaded_prompt = build_system_prompt(loaded_agent)
        skipped_prompt = build_system_prompt(skipped_agent)

    assert estimate_tokens_rough(loaded_prompt) > estimate_tokens_rough(skipped_prompt)


def test_coding_with_file_reference_keeps_workspace_context():
    agent, decision, prompt, context_builder = _build_for("Debug the error in this file and update the repository.")

    metadata = agent._capability_metadata
    assert decision.workspace_context == "required"
    context_builder.assert_called_once()
    assert "Follow this workspace rule." in prompt
    assert metadata["workspace_context_loaded"] is True
    assert metadata["estimated_prompt_tokens_before"] == metadata["estimated_prompt_tokens_after"]


def test_agent_task_keeps_workspace_context():
    _agent_value, decision, prompt, context_builder = _build_for("Use the email agent to review the inbox.")

    assert decision.workspace_context == "required"
    context_builder.assert_called_once()
    assert "Follow this workspace rule." in prompt


def test_session_resume_keeps_original_context_decision():
    original = ContextBudgetDecision("required", "original session posture")
    agent = _agent()
    apply_context_budget(agent, original)
    resumed = SimpleNamespace(history=[{"role": "user", "content": "earlier"}], message="Hello")

    assert initial_context_budget(resumed, resolve_capabilities("simple_chat", 1)) is None
    apply_context_budget(agent, None)
    assert agent._workspace_context_decision is original


def test_running_session_is_not_reassessed_for_a_new_message():
    existing = SimpleNamespace(history=[{"role": "user", "content": "earlier"}], message="Debug this file")

    assert initial_context_budget(existing, resolve_capabilities("coding", 4)) is None
