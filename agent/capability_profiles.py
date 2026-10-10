"""Session-start capability profiles built from Hermes' existing toolsets.

Profiles are advisory data selected before an ``AIAgent`` is constructed.  They
never mutate a live agent's tool surface or system prompt, and do not name a
provider or model.  Callers that cannot make a decision before construction
must leave the profile unset and retain their current session behavior.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import logging
from typing import Any


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CapabilityProfile:
    """A small session-start posture expressed through existing toolset names."""

    name: str
    toolsets: tuple[str, ...]
    prompt_modules: tuple[str, ...]
    memory_required: bool

    def metadata(self) -> dict[str, Any]:
        """Content-free fields suitable for session metadata and usage analysis."""
        return {
            "capability_name": self.name,
            "loaded_toolsets": list(self.toolsets),
            "prompt_modules": list(self.prompt_modules),
            "memory_enabled": self.memory_required,
            "prompt_context_estimate": None,
            "estimated_context_tokens": None,
        }


_PROFILES: dict[str, CapabilityProfile] = {
    "simple_chat": CapabilityProfile("simple_chat", ("clarify",), ("core",), False),
    "writing": CapabilityProfile("writing", ("clarify",), ("core",), False),
    "coding": CapabilityProfile("coding", ("coding",), ("core", "coding", "memory", "execution"), True),
    "research": CapabilityProfile("research", ("web", "clarify"), ("core", "research", "memory", "execution"), True),
    "agent_task": CapabilityProfile("agent_task", ("delegation", "clarify"), ("core", "agent", "memory", "delegation", "execution"), True),
    "automation": CapabilityProfile("automation", ("cronjob", "clarify"), ("core", "automation", "memory", "execution"), True),
}


def resolve_capabilities(task_type: str, complexity: int) -> CapabilityProfile:
    """Resolve a deterministic capability profile without loading schemas.

    ``complexity`` is accepted as part of the stable public seam.  Current
    profiles are task-led; future refinement may use it only at a new-session
    boundary.
    """
    del complexity
    return _PROFILES.get(str(task_type or ""), _PROFILES["simple_chat"])


def resolve_capabilities_for_request(message: str) -> CapabilityProfile:
    """Reuse adaptive classification before agent construction without persisting text."""
    from agent.adaptive_routing import analyze_request

    route = analyze_request(message)
    return resolve_capabilities(route.task_type, route.complexity_score)


def apply_capability_profile(agent: Any, profile: CapabilityProfile) -> tuple[list[str], bool]:
    """Attach profile metadata and return existing-toolset inputs for agent setup."""
    agent._capability_profile = profile
    agent._capability_metadata = profile.metadata()
    return list(profile.toolsets), not profile.memory_required


def apply_requested_capability_profile(
    agent: Any, enabled_toolsets: list[str] | None, skip_memory: bool,
) -> tuple[list[str] | None, bool]:
    """Apply a profile stashed by ``AIAgent`` before normal tool initialization."""
    profile = getattr(agent, "_requested_capability_profile", None)
    if profile is None:
        return enabled_toolsets, skip_memory
    if not isinstance(profile, CapabilityProfile):
        raise TypeError("capability_profile must be a CapabilityProfile")
    selected_toolsets, profile_skips_memory = apply_capability_profile(agent, profile)
    return selected_toolsets, bool(skip_memory or profile_skips_memory)


def record_capability_prompt_estimate(agent: Any, prompt: str, *, stable_prompt: str = "") -> None:
    """Record only prompt/schema counts; prompt bytes and user content never persist."""
    profile = getattr(agent, "_capability_profile", None)
    metadata = getattr(agent, "_capability_metadata", None)
    if not isinstance(profile, CapabilityProfile) or not isinstance(metadata, dict):
        return
    from agent.model_metadata import estimate_tokens_rough

    prompt_tokens = estimate_tokens_rough(prompt)
    tool_tokens = estimate_tokens_rough(json.dumps(getattr(agent, "tools", None) or [], ensure_ascii=False))
    metadata["loaded_toolsets"] = list(profile.toolsets)
    metadata["memory_enabled"] = bool(getattr(agent, "_memory_enabled", False) or getattr(agent, "_user_profile_enabled", False))
    metadata["prompt_context_estimate"] = prompt_tokens
    metadata["estimated_context_tokens"] = prompt_tokens + tool_tokens
    manifest = getattr(agent, "_stable_prompt_manifest", None)
    if manifest is not None:
        metadata["prompt_manifest_modules"] = list(manifest.module_names)
        metadata["estimated_stable_tokens_before"] = manifest.legacy_stable_token_estimate
        metadata["estimated_stable_tokens_after"] = estimate_tokens_rough(stable_prompt)
    decision = getattr(agent, "_workspace_context_decision", None)
    if decision is not None:
        workspace_loaded = bool(decision.load_workspace_context)
        metadata.update(decision.metadata())
        metadata["workspace_context_loaded"] = workspace_loaded
        metadata["estimated_prompt_tokens_after"] = prompt_tokens
        metadata["estimated_prompt_tokens_before"] = (
            prompt_tokens if workspace_loaded else prompt_tokens + decision.estimated_workspace_tokens
        )
    # Fresh sessions do not have a row yet; that harmlessly no-ops here and
    # turn_context persists it after row creation. Compression rebuilds do.
    persist_capability_metadata(agent)


def persist_capability_metadata(agent: Any) -> None:
    """Persist content-free session metadata after the session row exists."""
    metadata = getattr(agent, "_capability_metadata", None)
    session_id = str(getattr(agent, "session_id", "") or "")
    patcher = getattr(getattr(agent, "_session_db", None), "patch_session_model_config", None)
    if isinstance(metadata, dict) and session_id and callable(patcher) and not getattr(agent, "_persist_disabled", False):
        try:
            patcher(session_id, {"capability_profile": dict(metadata)})
        except Exception:
            logger.debug("Capability metadata persistence skipped", exc_info=True)
            return


__all__ = [
    "CapabilityProfile", "apply_capability_profile", "apply_requested_capability_profile", "persist_capability_metadata",
    "record_capability_prompt_estimate", "resolve_capabilities", "resolve_capabilities_for_request",
]
