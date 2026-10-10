"""Frozen stable-prompt module manifests for capability-profile sessions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


_LEGACY_STABLE_TOKEN_ESTIMATE = 3_263
_CAPABILITY_MODULES = frozenset({"coding", "agent", "memory", "research", "automation", "delegation"})


@dataclass(frozen=True)
class StablePromptManifest:
    """Content-free selection fixed before a session's first prompt build."""

    core_always: tuple[str, ...]
    capability_modules: tuple[str, ...]
    execution_modules: tuple[str, ...]

    @property
    def module_names(self) -> tuple[str, ...]:
        return (*self.core_always, *self.capability_modules, *self.execution_modules)

    def includes(self, name: str) -> bool:
        return name in self.module_names

    @property
    def legacy_stable_token_estimate(self) -> int:
        return _LEGACY_STABLE_TOKEN_ESTIMATE


def freeze_stable_prompt_manifest(agent: Any) -> StablePromptManifest | None:
    """Freeze a profiled session's stable modules after normal tool setup."""
    existing = getattr(agent, "_stable_prompt_manifest", None)
    if isinstance(existing, StablePromptManifest):
        return existing
    profile = getattr(agent, "_capability_profile", None)
    if profile is None:
        return None
    requested = tuple(getattr(profile, "prompt_modules", ()) or ())
    capabilities = tuple(name for name in requested if name in _CAPABILITY_MODULES)
    execution = ("parallel", "steering", "tool_use", "model_execution") if "execution" in requested else ()
    manifest = StablePromptManifest(
        core_always=("identity", "hermes_help", "completion"),
        capability_modules=capabilities,
        execution_modules=execution,
    )
    agent._stable_prompt_manifest = manifest
    return manifest


__all__ = ["StablePromptManifest", "freeze_stable_prompt_manifest"]
