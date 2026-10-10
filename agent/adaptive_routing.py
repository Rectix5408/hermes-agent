"""Deterministic per-turn routing metadata without changing a live session route.

The classification is advisory.  It deliberately never selects a provider/model,
rebuilds a system prompt, or stores the request text.  Existing provider resolution
and fallback policy remain the sole source of an executable runtime route.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import logging
import re
from typing import Any


TaskType = str
logger = logging.getLogger(__name__)

_INTENT_PATTERNS: tuple[tuple[TaskType, tuple[str, ...]], ...] = (
    ("automation", ("automate", "automation", "schedule", "cron", "wiederkehr", "workflow")),
    ("coding", ("code", "debug", "bug", "test", "typescript", "python", "refactor", "implement")),
    ("research", ("research", "recherche", "investigate", "vergleich", "compare", "quelle", "source")),
    ("agent_task", ("agent", "email", "e-mail", "calendar", "kalender", "browser", "tool")),
    ("writing", ("write", "draft", "rewrite", "summarize", "schreib", "entwurf", "umschreib", "zusammenfass")),
)
_TOOL_HINTS = ("browser", "search", "datei", "file", "terminal", "tool", "email", "kalender")
_RESEARCH_HINTS = ("research", "recherche", "compare", "vergleich", "source", "quelle")
_AGENT_HINTS = ("agent", "automate", "automation", "workflow", "schedule", "cron")
_STEP_HINTS = (" then ", " danach ", " anschließend ", " zuerst ", " danach", " and then ", " first ")


@dataclass(frozen=True)
class AdaptiveRoute:
    task_type: TaskType
    complexity_score: int
    preferred_profile: str
    reason: str
    confidence_score: float

    @property
    def recommended_profile(self) -> str:
        """Policy recommendation; existing profile resolution remains authoritative."""
        return self.preferred_profile

    @property
    def routing_reason(self) -> str:
        """Human-readable explanation for the advisory recommendation."""
        return self.reason

    def metadata(self, *, success: bool | None = None) -> dict[str, Any]:
        value = asdict(self)
        # Keep the original fields while exposing the explicit advisory names for
        # consumers that distinguish a recommendation from an active route.
        value["recommended_profile"] = self.recommended_profile
        value["routing_reason"] = self.routing_reason
        if success is not None:
            value["success"] = success
        return value


def classify_intent(message: str) -> TaskType:
    """Classify a request from fixed keyword families; no model call is made."""
    normalized = _normalize(message)
    for task_type, patterns in _INTENT_PATTERNS:
        if any(pattern in normalized for pattern in patterns):
            return task_type
    return "simple_chat"


def complexity_score(message: str, task_type: TaskType | None = None) -> int:
    """Return a bounded 1–10 score using only deterministic request signals."""
    normalized = _normalize(message)
    task_type = task_type or classify_intent(normalized)
    score = 1
    if task_type in {"writing", "coding"}:
        score += 2
    if task_type == "research":
        score += 3
    if task_type in {"agent_task", "automation"}:
        score += 4
    if any(hint in normalized for hint in _TOOL_HINTS):
        score += 1
    if any(hint in normalized for hint in _RESEARCH_HINTS):
        score += 1
    if any(hint in normalized for hint in _AGENT_HINTS):
        score += 1
    score += min(2, sum(normalized.count(hint) for hint in _STEP_HINTS))
    if len(normalized.split()) > 80:
        score += 1
    return max(1, min(10, score))


def recommend_profile(task_type: TaskType, score: int) -> tuple[str, str]:
    """Return a policy label, never a provider/model identifier or executable route."""
    if task_type == "coding":
        return "coding", "Coding task; retain the configured coding profile if one is selected."
    if task_type == "research":
        return "smart", "Research request; prefer the existing smart policy for grounded multi-step work."
    if task_type in {"agent_task", "automation"}:
        if score >= 9:
            return "high_reasoning", "Complex agent work; prefer an explicitly configured high-reasoning policy."
        return "smart", "Agent-oriented work; prefer the existing smart policy."
    if task_type == "writing":
        return "fast", "Writing request; prefer a configured fast or default profile."
    if score <= 3:
        return "local_first", "Low-complexity request; prefer the existing local-first policy."
    if score <= 6:
        return "fast", "Moderate complexity; a configured fast profile is preferred."
    if score <= 9:
        return "smart", "Multi-step or tool-oriented work; a configured smart profile is preferred."
    return "high_reasoning", "High deterministic complexity; require an explicitly configured reasoning route."


def analyze_request(message: str) -> AdaptiveRoute:
    """Create safe metadata for one request without retaining its contents."""
    task_type = classify_intent(message)
    score = complexity_score(message, task_type)
    profile, reason = recommend_profile(task_type, score)
    return AdaptiveRoute(task_type, score, profile, reason, _confidence_score(task_type, score))


def usage_task(route: AdaptiveRoute) -> str:
    """Stable existing ``session_model_usage.task`` dimension for non-voice main-loop usage."""
    return f"adaptive:{route.task_type}"


def begin_adaptive_turn(agent: Any, message: str) -> AdaptiveRoute:
    """Attach and persist metadata after a session row exists; request text is never persisted."""
    route = analyze_request(message)
    agent._adaptive_route = route
    agent._adaptive_usage_task = usage_task(route)
    _patch_metadata(agent, route.metadata())
    return route


def complete_adaptive_turn(agent: Any, *, success: bool) -> None:
    """Persist the outcome bit alongside the current turn's non-sensitive metadata."""
    route = getattr(agent, "_adaptive_route", None)
    if isinstance(route, AdaptiveRoute):
        _patch_metadata(agent, route.metadata(success=success))


def _patch_metadata(agent: Any, metadata: dict[str, Any]) -> None:
    session_id = str(getattr(agent, "session_id", "") or "")
    patcher = getattr(getattr(agent, "_session_db", None), "patch_session_model_config", None)
    if session_id and callable(patcher) and not getattr(agent, "_persist_disabled", False):
        try:
            patcher(session_id, {"adaptive_routing": metadata})
        except Exception:
            # Usage metadata must never obstruct the real turn or existing persistence.
            logger.debug("Adaptive routing metadata persistence skipped", exc_info=True)
            return


def _normalize(message: str) -> str:
    return re.sub(r"\s+", " ", str(message or "").casefold()).strip()


def _confidence_score(task_type: TaskType, score: int) -> float:
    """Return deterministic classifier confidence without retaining request content."""
    base = {
        "simple_chat": 0.65,
        "writing": 0.82,
        "coding": 0.95,
        "research": 0.92,
        "agent_task": 0.88,
        "automation": 0.9,
    }.get(task_type, 0.6)
    return min(0.99, base + (0.04 if score >= 8 else 0.0))


__all__ = [
    "AdaptiveRoute", "analyze_request", "begin_adaptive_turn", "classify_intent",
    "complete_adaptive_turn", "complexity_score", "recommend_profile", "usage_task",
]
