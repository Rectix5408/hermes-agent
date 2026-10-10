"""Capability selection for a fresh gateway conversation only."""

from __future__ import annotations

from typing import Any


def initial_capability_profile(ctx: Any):
    """Return a profile before construction, never for a session with history."""
    if getattr(ctx, "history", None) or not isinstance(getattr(ctx, "message", None), str):
        return None
    from agent.capability_profiles import resolve_capabilities_for_request
    return resolve_capabilities_for_request(ctx.message)


def initial_context_budget(ctx: Any, capability_profile=None):
    """Return a budget decision only for a fresh conversation."""
    if getattr(ctx, "history", None) or not isinstance(getattr(ctx, "message", None), str):
        return None
    from agent.context_budget import resolve_workspace_context_for_request
    return resolve_workspace_context_for_request(ctx.message, capability_profile)
