"""Session-start workspace-context policy.

The decision is deterministic and intentionally applies only before an agent is
constructed.  It neither retains request text nor permits a live session's
cached system prompt to be changed.
"""

from __future__ import annotations

from dataclasses import dataclass
import re


# Phase 4's measured local workspace/context tier.  It is a conservative
# metadata fallback, not a context-file read; skipped sessions must not scan
# project instructions merely to quantify the bytes they avoided sending.
DEFAULT_WORKSPACE_CONTEXT_ESTIMATE = 3_379

_PROJECT_REFERENCE = re.compile(
    r"\b(?:project|repository|repo|workspace|worktree|codebase|code base|"
    r"this file|these files|file|path|directory|folder|branch|"
    r"projekt|repository|arbeitsbereich|datei|ordner|pfad|diesem projekt|dieser datei)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ContextBudgetDecision:
    """Frozen workspace-context decision for one new session."""

    workspace_context: str
    reason: str
    estimated_workspace_tokens: int = DEFAULT_WORKSPACE_CONTEXT_ESTIMATE

    @property
    def load_workspace_context(self) -> bool:
        """Only required context is automatically included in a new prompt."""
        return self.workspace_context == "required"

    def metadata(self) -> dict[str, int | bool | str]:
        """Content-free values suitable for session metadata."""
        return {
            "workspace_context": self.workspace_context,
            "workspace_context_loaded": self.load_workspace_context,
        }


def resolve_workspace_context(message: str, task_type: str, capability_name: str = "") -> ContextBudgetDecision:
    """Classify workspace need from transient request signals.

    ``optional`` is intentionally not auto-loaded: adding a context block
    later would violate the prompt-prefix invariant, while loading it by
    default defeats this controller's token-saving purpose.  An explicit
    project signal upgrades it to ``required`` before session creation.
    """
    del capability_name  # Kept at the seam for future profile-specific policy.
    normalized_type = str(task_type or "simple_chat")
    has_project_reference = bool(_PROJECT_REFERENCE.search(str(message or "")))
    if normalized_type == "simple_chat":
        return ContextBudgetDecision("unnecessary", "general conversation has no workspace signal")
    if normalized_type == "writing":
        if has_project_reference:
            return ContextBudgetDecision("required", "writing request explicitly references project context")
        return ContextBudgetDecision("unnecessary", "writing request has no project reference")
    if normalized_type == "coding":
        if has_project_reference:
            return ContextBudgetDecision("required", "coding request explicitly references workspace state")
        return ContextBudgetDecision("optional", "general coding request has no workspace reference")
    if normalized_type == "research":
        if has_project_reference:
            return ContextBudgetDecision("required", "research request explicitly references project context")
        return ContextBudgetDecision("optional", "research request has no workspace reference")
    if normalized_type in {"agent_task", "automation"}:
        return ContextBudgetDecision("required", "agent-oriented work retains workspace context")
    return ContextBudgetDecision("optional", "unclassified work has no explicit workspace reference")


def resolve_workspace_context_for_request(message: str, capability_profile=None) -> ContextBudgetDecision:
    """Reuse adaptive classification without persisting the request."""
    from agent.adaptive_routing import analyze_request

    route = analyze_request(message)
    profile_name = str(getattr(capability_profile, "name", "") or "")
    return resolve_workspace_context(message, route.task_type, profile_name)


def apply_context_budget(agent, decision: ContextBudgetDecision | None) -> None:
    """Freeze a fresh session's decision on its agent before prompt assembly."""
    if decision is None:
        return
    if not isinstance(decision, ContextBudgetDecision):
        raise TypeError("context_budget must be a ContextBudgetDecision")
    agent._workspace_context_decision = decision


__all__ = [
    "ContextBudgetDecision", "DEFAULT_WORKSPACE_CONTEXT_ESTIMATE", "apply_context_budget",
    "resolve_workspace_context", "resolve_workspace_context_for_request",
]
