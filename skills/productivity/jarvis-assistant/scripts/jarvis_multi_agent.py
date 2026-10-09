#!/usr/bin/env python3
"""Jarvis phase-3 multi-agent orchestration helper.

This module is intentionally dependency-free and side-effect-free: it plans,
routes, drafts, and consolidates. Hermes tools, skills, Kanban, cron, and
delegation perform any real external work after the user approves it.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Callable


SCHEMA_VERSION = "jarvis.multi_agent.v1"


@dataclass(frozen=True)
class AgentSpec:
    agent_id: str
    title: str
    scope: str
    skills: tuple[str, ...] = ()
    toolsets: tuple[str, ...] = ()
    permissions: tuple[str, ...] = ()
    max_steps: int = 4
    max_input_chars: int = 6000


@dataclass(frozen=True)
class OrchestrationLimits:
    max_agents: int = 3
    max_parallel: int = 2
    max_steps_per_agent: int = 4
    max_total_tasks: int = 6
    max_input_chars: int = 12000
    cost_tier: str = "low"
    max_estimated_cost_usd: float = 0.0
    routing_mode: str = "local_first"
    max_prompt_tokens: int = 4000
    max_completion_tokens: int = 1200

    def normalized(self) -> "OrchestrationLimits":
        return OrchestrationLimits(
            max_agents=max(1, min(int(self.max_agents), 5)),
            max_parallel=max(1, min(int(self.max_parallel), 3)),
            max_steps_per_agent=max(1, min(int(self.max_steps_per_agent), 8)),
            max_total_tasks=max(1, min(int(self.max_total_tasks), 12)),
            max_input_chars=max(500, min(int(self.max_input_chars), 50000)),
            cost_tier=self.cost_tier if self.cost_tier in {"local", "low", "standard", "high"} else "low",
            max_estimated_cost_usd=max(0.0, float(self.max_estimated_cost_usd)),
            routing_mode=(
                self.routing_mode
                if self.routing_mode in {"local_only", "local_first", "smart", "cloud"}
                else "local_first"
            ),
            max_prompt_tokens=max(256, min(int(self.max_prompt_tokens), 128000)),
            max_completion_tokens=max(128, min(int(self.max_completion_tokens), 32000)),
        )


@dataclass
class AgentTask:
    agent_id: str
    objective: str
    input_summary: str
    expected_output: str
    skills: list[str]
    toolsets: list[str]
    permissions: list[str]
    max_steps: int
    context_budget_chars: int
    estimated_prompt_tokens: int
    token_budget: dict[str, int]
    routing_decision: dict[str, Any]
    model_route: str = "jarvis.specialist_model"
    may_delegate: bool = False


@dataclass
class AgentResult:
    agent_id: str
    status: str
    summary: str
    structured: dict[str, Any] = field(default_factory=dict)
    approval_required: list[dict[str, Any]] = field(default_factory=list)
    missing_integrations: list[str] = field(default_factory=list)
    handoff: list[dict[str, Any]] = field(default_factory=list)


AGENTS: dict[str, AgentSpec] = {
    "instagram": AgentSpec(
        agent_id="instagram",
        title="Instagram Agent",
        scope="Content ideas, editorial planning, captions, hashtags, post/reel/story drafts, and account-stat review.",
        skills=("jarvis-assistant",),
        toolsets=("web", "memory"),
        permissions=("draft_content", "read_stats_if_configured"),
        max_steps=4,
    ),
    "email": AgentSpec(
        agent_id="email",
        title="Email Agent",
        scope="Thread analysis, priority, reply drafts, follow-up detection, and safe email action batches.",
        skills=("email-inbox-triage", "google-workspace", "himalaya"),
        toolsets=("memory",),
        permissions=("read_email_if_configured", "draft_replies", "approval_before_send"),
        max_steps=4,
    ),
    "research": AgentSpec(
        agent_id="research",
        title="Research Agent",
        scope="Web research planning, source comparison, citation-ready summaries, and controlled handoff to other agents.",
        skills=("grounded-citations",),
        toolsets=("web", "browser", "session_search"),
        permissions=("read_web", "summarize_sources"),
        max_steps=5,
    ),
    "business": AgentSpec(
        agent_id="business",
        title="Business Agent",
        scope="Project planning, task coordination, deadlines, decision briefs, and repeatable workflow preparation.",
        skills=("weekly-review-planning", "meeting-action-items", "jarvis-assistant"),
        toolsets=("kanban", "cronjob", "memory"),
        permissions=("plan_projects", "draft_workflows", "approval_before_scheduling"),
        max_steps=5,
    ),
}


INTENT_PATTERNS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("instagram", ("instagram", "reel", "story", "stories", "caption", "hashtag", "content kalender", "redaktionsplan")),
    ("email", ("e-mail", "email", "gmail", "inbox", "postfach", "nachricht", "thread", "antwort", "follow-up")),
    ("research", ("recherche", "research", "quelle", "quellen", "web", "vergleich", "analyse", "markt", "wettbewerb")),
    ("business", ("business", "projekt", "deadline", "aufgabe", "kanban", "workflow", "prozess", "planung", "entscheidung")),
)


def _compact(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "..."


def classify_intents(request: str) -> list[str]:
    lowered = request.lower()
    scores: dict[str, int] = {}
    for agent_id, terms in INTENT_PATTERNS:
        score = sum(1 for term in terms if term in lowered)
        if score:
            scores[agent_id] = score
    if not scores:
        return ["business"]
    return [agent_id for agent_id, _score in sorted(scores.items(), key=lambda item: (-item[1], item[0]))]


def build_plan(request: str, payload: dict[str, Any] | None = None,
               limits: OrchestrationLimits | None = None) -> dict[str, Any]:
    limits = (limits or OrchestrationLimits()).normalized()
    payload = payload or {}
    request_summary = _compact(request, limits.max_input_chars)
    selected = classify_intents(request_summary)[: limits.max_agents]
    tasks: list[AgentTask] = []

    for agent_id in selected:
        spec = AGENTS[agent_id]
        context_budget_chars = min(
            spec.max_input_chars,
            max(1000, limits.max_input_chars // max(1, len(selected))),
            limits.max_prompt_tokens * 4,
        )
        estimated_prompt_tokens = _estimate_tokens(request_summary)
        routing_decision = _routing_decision(agent_id, request_summary, payload, limits)
        tasks.append(AgentTask(
            agent_id=agent_id,
            objective=_objective_for(agent_id, request_summary),
            input_summary=request_summary,
            expected_output=_expected_output_for(agent_id),
            skills=list(spec.skills),
            toolsets=list(spec.toolsets),
            permissions=list(spec.permissions),
            max_steps=min(spec.max_steps, limits.max_steps_per_agent),
            context_budget_chars=context_budget_chars,
            estimated_prompt_tokens=min(estimated_prompt_tokens, limits.max_prompt_tokens),
            token_budget={
                "prompt": min(limits.max_prompt_tokens, max(256, context_budget_chars // 4)),
                "completion": limits.max_completion_tokens,
            },
            routing_decision=routing_decision,
            model_route=routing_decision["model_route"],
            may_delegate=False,
        ))

    tasks = tasks[: limits.max_total_tasks]
    return {
        "schema": SCHEMA_VERSION,
        "status": "planned",
        "request": request_summary,
        "limits": asdict(limits),
        "parallel_groups": _parallel_groups(tasks, limits.max_parallel),
        "tasks": [asdict(task) for task in tasks],
        "handoff_policy": {
            "share_only": "summaries, decisions, IDs, approved drafts, and source links",
            "do_not_share": "raw inboxes, full calendars, secrets, tokens, or unnecessary transcript context",
        },
        "model_policy": _model_policy(limits),
        "token_policy": _token_policy(tasks, limits),
        "memory_policy": _memory_policy(limits),
        "safety": {
            "external_writes": "approval_required",
            "publishing": "disabled_without_explicit_approval",
            "loop_guard": "no agent may spawn another agent from this helper",
        },
        "missing_integrations": _missing_integrations(selected, payload),
    }


def orchestrate(request: str, payload: dict[str, Any] | None = None,
                limits: OrchestrationLimits | None = None) -> dict[str, Any]:
    plan = build_plan(request, payload, limits)
    payload = payload or {}
    results = [run_agent(task["agent_id"], request, payload) for task in plan["tasks"]]
    consolidated = consolidate_results(results)
    return {
        **plan,
        "status": "completed",
        "results": [asdict(result) for result in results],
        "consolidated": consolidated,
    }


def run_agent(agent_id: str, request: str, payload: dict[str, Any] | None = None) -> AgentResult:
    payload = payload or {}
    handlers: dict[str, Callable[[str, dict[str, Any]], AgentResult]] = {
        "instagram": run_instagram_agent,
        "email": run_email_agent,
        "research": run_research_agent,
        "business": run_business_agent,
    }
    if agent_id not in handlers:
        return AgentResult(agent_id=agent_id, status="error", summary=f"Unknown agent: {agent_id}")
    return handlers[agent_id](request, payload)


def run_instagram_agent(request: str, payload: dict[str, Any]) -> AgentResult:
    brand = _compact(payload.get("brand") or payload.get("project") or "Jarvis-Projekt", 80)
    audience = _compact(payload.get("audience") or "deutschsprachige Interessenten", 100)
    topics = _list(payload.get("topics")) or _keywords(request, fallback=("Produktivitaet", "KI-Assistent", "Automatisierung"))
    stats = payload.get("instagram_stats") if isinstance(payload.get("instagram_stats"), dict) else {}

    ideas = [
        {"format": "post", "idea": f"Problem-Loesung-Post zu {topic}", "goal": "Speichern und Teilen"}
        for topic in topics[:3]
    ]
    reels = [
        {"hook": f"3 Wege, wie {brand} bei {topics[0]} hilft", "beats": ["Problem", "Demo", "klarer Nutzen"]}
    ]
    caption = (
        f"{brand} macht {topics[0]} greifbar: kurz planen, sauber umsetzen, messbar lernen. "
        f"Fuer {audience}."
    )
    hashtags = _dedupe(["#ki", "#automation", "#produktivitaet", *[f"#{_slug(t)}" for t in topics]])[:10]
    calendar = _content_calendar(topics)

    structured = {
        "ideas": ideas,
        "reels": reels,
        "stories": [{"frame": 1, "text": f"Was blockiert dich bei {topics[0]}?"}, {"frame": 2, "text": "Antworten sammeln und Content daraus bauen."}],
        "caption_draft": caption,
        "hashtags": hashtags,
        "content_calendar": calendar,
        "stats_summary": _instagram_stats_summary(stats),
    }
    return AgentResult(
        agent_id="instagram",
        status="drafted",
        summary="Instagram-Entwuerfe und Redaktionsplan vorbereitet; keine Veroeffentlichung ausgefuehrt.",
        structured=structured,
        approval_required=[{
            "action": "publish_or_schedule_instagram_content",
            "reason": "External content changes require explicit approval and Meta credentials.",
            "status": "not_executed",
        }],
        missing_integrations=[] if payload.get("instagram_api_configured") else ["instagram_meta_api"],
    )


def run_email_agent(request: str, payload: dict[str, Any]) -> AgentResult:
    messages = payload.get("messages") if isinstance(payload.get("messages"), list) else []
    threads = [_normalize_message(msg, idx) for idx, msg in enumerate(messages[:20], 1)]
    if not threads:
        return AgentResult(
            agent_id="email",
            status="blocked",
            summary="Keine E-Mail-Daten uebergeben; Gmail oder IMAP muss verbunden oder ein Payload bereitgestellt werden.",
            missing_integrations=["google-workspace_or_himalaya"],
        )

    prioritized = sorted(threads, key=lambda item: (-_email_priority(item), item["id"]))
    drafts = [_reply_draft(item) for item in prioritized if item["needs_reply"]][:5]
    followups = [item for item in prioritized if item["follow_up"]]
    return AgentResult(
        agent_id="email",
        status="drafted",
        summary=f"{len(prioritized)} Thread(s) priorisiert, {len(drafts)} Antwortentwurf/Entwuerfe vorbereitet.",
        structured={"prioritized_threads": prioritized, "reply_drafts": drafts, "followups": followups},
        approval_required=[{
            "action": "send_or_modify_email",
            "items": [draft["thread_id"] for draft in drafts],
            "status": "draft_only",
        }],
    )


def run_research_agent(request: str, payload: dict[str, Any]) -> AgentResult:
    sources = payload.get("sources") if isinstance(payload.get("sources"), list) else []
    normalized = [_normalize_source(src, idx) for idx, src in enumerate(sources[:12], 1)]
    if not normalized:
        return AgentResult(
            agent_id="research",
            status="planned",
            summary="Rechercheplan erstellt; fuer echte Webrecherche Hermes `web_search`/`web_extract` verwenden.",
            structured={
                "queries": _research_queries(request),
                "source_requirements": ["mindestens 3 unabhaengige Quellen", "Datum und Herausgeber pruefen", "Widersprueche markieren"],
            },
            handoff=[{"to": "business", "content": "research_questions", "allowed": True}],
        )

    comparison = {
        "sources": normalized,
        "agreements": _source_agreements(normalized),
        "conflicts": _source_conflicts(normalized),
        "summary": _compact(" ".join(src["claim"] for src in normalized), 700),
    }
    return AgentResult(
        agent_id="research",
        status="summarized",
        summary=f"{len(normalized)} Quelle(n) verglichen und fuer Handoff zusammengefasst.",
        structured=comparison,
        handoff=[{"to": "business", "content": "summary_and_source_links", "allowed": True}],
    )


def run_business_agent(request: str, payload: dict[str, Any]) -> AgentResult:
    deadlines = _list(payload.get("deadlines"))
    tasks = _list(payload.get("tasks")) or _keywords(request, fallback=("Ziel klaeren", "Naechste Schritte planen", "Review einplanen"))
    plan = []
    for idx, task in enumerate(tasks[:6], 1):
        plan.append({
            "id": f"biz-{idx}",
            "task": task,
            "owner": "Jarvis/User",
            "status": "proposal",
            "deadline": deadlines[idx - 1] if idx - 1 < len(deadlines) else "",
        })
    workflows = [{
        "name": "weekly-business-review",
        "primitive": "cronjob + kanban",
        "status": "proposal_only",
        "prompt_boundary": "read-only summary unless approved",
    }]
    return AgentResult(
        agent_id="business",
        status="planned",
        summary=f"Business-Plan mit {len(plan)} vorgeschlagenen Aufgabe(n) erstellt.",
        structured={"project_plan": plan, "decision_brief": _decision_brief(request, payload), "workflow_proposals": workflows},
        approval_required=[{"action": "create_kanban_or_cron_entries", "status": "proposal_only"}],
    )


def consolidate_results(results: list[AgentResult]) -> dict[str, Any]:
    completed = [r for r in results if r.status not in {"error", "blocked"}]
    approvals = [item for r in results for item in r.approval_required]
    missing = _dedupe(item for r in results for item in r.missing_integrations)
    handoff = [item for r in results for item in r.handoff]
    return {
        "summary": " | ".join(r.summary for r in results) or "Keine Ergebnisse.",
        "completed_agents": [r.agent_id for r in completed],
        "blocked_agents": [r.agent_id for r in results if r.status == "blocked"],
        "approval_required": approvals,
        "missing_integrations": missing,
        "handoff": handoff,
        "external_actions_executed": False,
    }


def _objective_for(agent_id: str, request: str) -> str:
    return {
        "instagram": "Prepare safe Instagram content drafts and editorial plan.",
        "email": "Analyze messages, prioritize threads, and draft replies without sending.",
        "research": "Plan or summarize research with source-aware handoff.",
        "business": "Create project plan, coordination steps, and workflow proposals.",
    }[agent_id] + f" Request: {_compact(request, 300)}"


def _expected_output_for(agent_id: str) -> str:
    return {
        "instagram": "ideas, captions, hashtags, content calendar, stats summary, approval needs",
        "email": "prioritized threads, reply drafts, follow-ups, approval needs",
        "research": "queries or compared sources, summary, conflicts, handoff package",
        "business": "project plan, decision brief, task/workflow proposals",
    }[agent_id]


def _parallel_groups(tasks: list[AgentTask], max_parallel: int) -> list[list[str]]:
    return [[task.agent_id for task in tasks[i:i + max_parallel]] for i in range(0, len(tasks), max_parallel)]


def _missing_integrations(agent_ids: list[str], payload: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if "instagram" in agent_ids and not payload.get("instagram_api_configured"):
        missing.append("instagram_meta_api")
    if "email" in agent_ids and not (payload.get("gmail_configured") or payload.get("imap_configured") or payload.get("messages")):
        missing.append("google-workspace_or_himalaya")
    if "business" in agent_ids and not payload.get("kanban_configured"):
        missing.append("kanban_or_task_source")
    return missing


def _model_policy(limits: OrchestrationLimits) -> dict[str, Any]:
    preference = {
        "local": "local_model_preferred",
        "low": "cheap_or_existing_route",
        "standard": "balanced_route",
        "high": "quality_route_allowed",
    }[limits.cost_tier]
    return {
        "routing_mode": limits.routing_mode,
        "cost_tier": limits.cost_tier,
        "preference": preference,
        "max_estimated_cost_usd": limits.max_estimated_cost_usd,
        "cloud_fallback": limits.routing_mode in {"local_first", "smart", "cloud"},
        "paid_cloud_requires_config": True,
        "note": "Planning metadata only; concrete Hermes model routing remains profile/config controlled.",
    }


def _token_policy(tasks: list[AgentTask], limits: OrchestrationLimits) -> dict[str, Any]:
    estimated_prompt = sum(task.estimated_prompt_tokens for task in tasks)
    return {
        "estimated_prompt_tokens": estimated_prompt,
        "max_prompt_tokens": limits.max_prompt_tokens,
        "max_completion_tokens": limits.max_completion_tokens,
        "within_prompt_budget": estimated_prompt <= limits.max_prompt_tokens,
        "compression_hint": "summarize_or_reduce_sources" if estimated_prompt > limits.max_prompt_tokens else "none",
        "accounting": "rough_estimate_chars_div_4; no provider billing call performed",
    }


def _memory_policy(limits: OrchestrationLimits) -> dict[str, Any]:
    budget = max(128, min(800, limits.max_prompt_tokens // 8))
    return {
        "use": "selective",
        "max_memory_tokens": budget,
        "dedupe": True,
        "sensitive_data": "do_not_store_without_explicit_approval",
    }


def _routing_decision(agent_id: str, request: str, payload: dict[str, Any],
                      limits: OrchestrationLimits) -> dict[str, Any]:
    complexity = _task_complexity(agent_id, request, payload)
    deterministic = _deterministic_possible(agent_id, payload)
    needs_tools = agent_id in {"research", "email"} and not deterministic

    if deterministic:
        route = "deterministic"
        fallback = "none"
    elif limits.routing_mode == "local_only":
        route = "local"
        fallback = "blocked_if_local_unavailable"
    elif limits.routing_mode == "cloud":
        route = "cloud"
        fallback = "none"
    elif limits.routing_mode == "smart" and (complexity == "high" or needs_tools):
        route = "cloud_capable"
        fallback = "local_summary_if_cloud_unavailable"
    else:
        route = "local"
        fallback = "cloud_if_configured_and_approved"

    return {
        "mode": limits.routing_mode,
        "complexity": complexity,
        "deterministic": deterministic,
        "needs_tool_calling": needs_tools,
        "privacy": "keep_local_preferred" if route != "cloud" else "cloud_allowed_by_mode",
        "model_route": "jarvis.specialist_model" if route != "deterministic" else "none",
        "selected_route": route,
        "fallback": fallback,
    }


def _task_complexity(agent_id: str, request: str, payload: dict[str, Any]) -> str:
    signals = 0
    lowered = request.lower()
    signals += int(len(request) > 1200)
    signals += int(any(term in lowered for term in ("strategie", "vergleich", "analyse", "research", "entscheidung", "konzept")))
    signals += int(bool(payload.get("sources")) and len(payload.get("sources") or []) > 4)
    signals += int(bool(payload.get("messages")) and len(payload.get("messages") or []) > 10)
    signals += int(agent_id == "research")
    if signals >= 3:
        return "high"
    if signals >= 1:
        return "medium"
    return "low"


def _deterministic_possible(agent_id: str, payload: dict[str, Any]) -> bool:
    if agent_id == "email":
        return bool(payload.get("messages"))
    if agent_id == "research":
        return bool(payload.get("sources"))
    if agent_id == "business":
        return bool(payload.get("tasks") or payload.get("deadlines"))
    if agent_id == "instagram":
        return bool(payload.get("topics"))
    return False


def _estimate_tokens(value: Any) -> int:
    text = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value or "")
    return max(1, (len(text) + 3) // 4)


def _list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [_compact(v, 120) for v in value if str(v).strip()]
    if isinstance(value, str) and value.strip():
        return [_compact(part, 120) for part in re.split(r"[,;\n]+", value) if part.strip()]
    return []


def _keywords(text: str, fallback: tuple[str, ...]) -> list[str]:
    words = re.findall(r"[A-Za-zÄÖÜäöüß0-9][A-Za-zÄÖÜäöüß0-9-]{3,}", text)
    filtered = [w.strip("-") for w in words if w.lower() not in {"jarvis", "bitte", "eine", "einen", "mein", "meine", "fuer", "und"}]
    return _dedupe(filtered)[:5] or list(fallback)


def _dedupe(items) -> list:
    seen = set()
    out = []
    for item in items:
        key = str(item).lower()
        if key and key not in seen:
            seen.add(key)
            out.append(item)
    return out


def _slug(text: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9ÄÖÜäöüß]+", "", text).lower()
    return cleaned or "jarvis"


def _content_calendar(topics: list[str]) -> list[dict[str, Any]]:
    start = date.today()
    rows = []
    formats = ("post", "reel", "story")
    for idx, topic in enumerate(topics[:6]):
        rows.append({
            "date": (start + timedelta(days=idx * 2)).isoformat(),
            "format": formats[idx % len(formats)],
            "topic": topic,
            "status": "draft",
        })
    return rows


def _instagram_stats_summary(stats: dict[str, Any]) -> dict[str, Any]:
    if not stats:
        return {"available": False, "note": "Keine Account-Statistiken uebergeben oder Meta API nicht konfiguriert."}
    keys = {k: stats.get(k) for k in ("followers", "reach", "engagement_rate", "top_post") if k in stats}
    return {"available": True, "metrics": keys, "note": "Nur uebergebene Statistikdaten ausgewertet."}


def _normalize_message(msg: Any, idx: int) -> dict[str, Any]:
    data = msg if isinstance(msg, dict) else {"subject": str(msg)}
    subject = _compact(data.get("subject") or f"Thread {idx}", 160)
    body = _compact(data.get("body") or data.get("snippet") or "", 500)
    sender = _compact(data.get("from") or data.get("sender") or "unknown", 120)
    text = f"{subject} {body}".lower()
    needs_reply = any(term in text for term in ("?", "bitte", "please", "antwort", "reply", "freigabe", "approval"))
    follow_up = any(term in text for term in ("follow-up", "nachfassen", "waiting", "warte", "deadline", "frist"))
    return {
        "id": str(data.get("id") or idx),
        "from": sender,
        "subject": subject,
        "snippet": body,
        "needs_reply": needs_reply,
        "follow_up": follow_up,
        "priority": _email_priority_text(text),
    }


def _email_priority(item: dict[str, Any]) -> int:
    return {"urgent": 3, "high": 2, "normal": 1}.get(item.get("priority"), 0)


def _email_priority_text(text: str) -> str:
    if any(term in text for term in ("urgent", "dringend", "deadline", "frist", "blocker", "kunde", "customer")):
        return "urgent"
    if any(term in text for term in ("bitte", "please", "frage", "approval", "freigabe")):
        return "high"
    return "normal"


def _reply_draft(thread: dict[str, Any]) -> dict[str, Any]:
    return {
        "thread_id": thread["id"],
        "to": thread["from"],
        "subject": f"Re: {thread['subject']}",
        "body": (
            "Danke fuer die Nachricht. Ich pruefe die Punkte und melde mich mit einer belastbaren "
            "Rueckmeldung. Falls es eine harte Frist gibt, gib mir bitte kurz Bescheid."
        ),
        "status": "draft_only",
    }


def _normalize_source(src: Any, idx: int) -> dict[str, Any]:
    data = src if isinstance(src, dict) else {"claim": str(src)}
    return {
        "id": str(data.get("id") or idx),
        "title": _compact(data.get("title") or f"Quelle {idx}", 160),
        "url": _compact(data.get("url") or "", 300),
        "claim": _compact(data.get("claim") or data.get("summary") or data.get("text") or "", 500),
        "date": _compact(data.get("date") or "", 40),
    }


def _research_queries(request: str) -> list[str]:
    kws = _keywords(request, fallback=("Jarvis Multi Agent", "Hermes Agent automation"))
    return [f"{' '.join(kws[:3])} overview", f"{' '.join(kws[:3])} comparison", f"{' '.join(kws[:3])} risks"]


def _source_agreements(sources: list[dict[str, Any]]) -> list[str]:
    claims = [src["claim"] for src in sources if src["claim"]]
    if len(claims) < 2:
        return []
    return ["Mehrere Quellen behandeln dasselbe Thema; Details muessen mit Webquellen verifiziert werden."]


def _source_conflicts(sources: list[dict[str, Any]]) -> list[str]:
    text = " ".join(src["claim"].lower() for src in sources)
    conflicts = []
    if "not" in text or "kein" in text or "aber" in text:
        conflicts.append("Moeglicher Widerspruch oder Einschraenkung in den Quellen markiert.")
    return conflicts


def _decision_brief(request: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "decision": _compact(payload.get("decision") or request, 240),
        "known_constraints": _list(payload.get("constraints")),
        "recommended_next_step": "Naechsten konkreten Schritt bestaetigen und als Kanban-Aufgabe anlegen.",
    }


def _load_payload(raw: str | None, path: str | None) -> dict[str, Any]:
    if path:
        raw = Path(path).read_text(encoding="utf-8")
    if not raw:
        return {}
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise SystemExit("--payload must be a JSON object")
    return data


def _limits_from_args(args: argparse.Namespace) -> OrchestrationLimits:
    return OrchestrationLimits(
        max_agents=args.max_agents,
        max_parallel=args.max_parallel,
        max_steps_per_agent=args.max_steps,
        max_total_tasks=args.max_total_tasks,
        max_input_chars=args.max_input_chars,
        cost_tier=args.cost_tier,
        max_estimated_cost_usd=args.max_cost_usd,
        routing_mode=args.routing_mode,
        max_prompt_tokens=args.max_prompt_tokens,
        max_completion_tokens=args.max_completion_tokens,
    ).normalized()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Jarvis multi-agent orchestration helper")
    sub = parser.add_subparsers(dest="cmd", required=True)

    def add_common(p: argparse.ArgumentParser) -> None:
        p.add_argument("--request", required=True)
        p.add_argument("--payload", default="")
        p.add_argument("--payload-file", default="")
        p.add_argument("--max-agents", type=int, default=3)
        p.add_argument("--max-parallel", type=int, default=2)
        p.add_argument("--max-steps", type=int, default=4)
        p.add_argument("--max-total-tasks", type=int, default=6)
        p.add_argument("--max-input-chars", type=int, default=12000)
        p.add_argument("--cost-tier", default="low", choices=["local", "low", "standard", "high"])
        p.add_argument("--max-cost-usd", type=float, default=0.0)
        p.add_argument("--routing-mode", default="local_first", choices=["local_only", "local_first", "smart", "cloud"])
        p.add_argument("--max-prompt-tokens", type=int, default=4000)
        p.add_argument("--max-completion-tokens", type=int, default=1200)

    add_common(sub.add_parser("plan", help="classify intent and build a bounded agent plan"))
    add_common(sub.add_parser("orchestrate", help="run local draft/analyze handlers and consolidate"))
    run = sub.add_parser("run-agent", help="run one local draft/analyze handler")
    run.add_argument("agent_id", choices=sorted(AGENTS))
    run.add_argument("--request", required=True)
    run.add_argument("--payload", default="")
    run.add_argument("--payload-file", default="")

    args = parser.parse_args(argv)
    payload = _load_payload(getattr(args, "payload", ""), getattr(args, "payload_file", ""))

    if args.cmd == "plan":
        output = build_plan(args.request, payload, _limits_from_args(args))
    elif args.cmd == "orchestrate":
        output = orchestrate(args.request, payload, _limits_from_args(args))
    else:
        output = asdict(run_agent(args.agent_id, args.request, payload))

    json.dump(output, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
