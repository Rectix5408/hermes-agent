"""Jarvis dashboard routes.

Dashboard endpoints around the skill-local Jarvis helper.

Authentication and per-profile authorization must be enforced by the hosting
application; this module does not define those guards.

They expose plans, safe local orchestration runs, and real availability status;

external writes stay with the existing Hermes approval/tooling paths.

"""
from __future__ import annotations
import asyncio
import os
import tempfile
import fcntl
import uuid
from collections import deque
from contextlib import contextmanager
import hashlib
import importlib.util
import json
import logging
import sys
from functools import lru_cache
from pathlib import Path
from time import time
from typing import Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from hermes_cli.jarvis_dialogue import JarvisIntentRouter
from agent.jarvis_execution import persist_execution_receipt, tool_execution_receipt
from hermes_cli.config import atomic_config_write, get_config_path, load_config, load_env
from hermes_constants import get_hermes_home
from hermes_cli.web_models import (
    JarvisApprovalDecision,
    JarvisKanbanListRequest,
    JarvisOpenTasksRequest,
    JarvisOrchestrationRequest,
    JarvisSettingsUpdate,
)
from hermes_cli.web_routers._common import _CONFIG_MUTATION_LOCK, _config_profile_scope
router = APIRouter()
_MAX_RUN_HISTORY = 100
_MAX_APPROVAL_HISTORY = 200
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_JARVIS_SKILL_DIR = _PROJECT_ROOT / "skills" / "productivity" / "jarvis-assistant"
_ORCHESTRATOR_PATH = _JARVIS_SKILL_DIR / "scripts" / "jarvis_multi_agent.py"


@lru_cache(maxsize=1)
def _orchestrator_module():
    if not _ORCHESTRATOR_PATH.is_file():
        raise FileNotFoundError(str(_ORCHESTRATOR_PATH))
    spec = importlib.util.spec_from_file_location("jarvis_multi_agent_dashboard", _ORCHESTRATOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Jarvis orchestrator could not be loaded")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _limits(module, raw: dict[str, Any]):
    allowed = {
        "max_agents",
        "max_parallel",
        "max_steps_per_agent",
        "max_total_tasks",
        "max_input_chars",
        "cost_tier",
        "max_estimated_cost_usd",
        "routing_mode",
        "max_prompt_tokens",
        "max_completion_tokens",
    }
    values = {key: value for key, value in (raw or {}).items() if key in allowed}
    return module.OrchestrationLimits(**values).normalized()


def _agent_catalog(module) -> list[dict[str, Any]]:
    agents = []
    for spec in module.AGENTS.values():
        agents.append({
            "agent_id": spec.agent_id,
            "title": spec.title,
            "scope": spec.scope,
            "skills": list(spec.skills),
            "toolsets": list(spec.toolsets),
            "permissions": list(spec.permissions),
            "max_steps": spec.max_steps,
            "max_input_chars": spec.max_input_chars,
            "model_route": "jarvis.specialist_model",
        })
    return agents


def _config_value(cfg: dict[str, Any], key: str, default: Any = None) -> Any:
    node: Any = cfg
    for part in key.split("."):
        if not isinstance(node, dict) or part not in node:
            return default
        node = node[part]
    return node


def _jarvis_skill_config(cfg: dict[str, Any]) -> dict[str, Any]:
    skills = cfg.get("skills") if isinstance(cfg.get("skills"), dict) else {}
    skill_cfg = skills.get("config") if isinstance(skills.get("config"), dict) else {}
    return {
        "language": skill_cfg.get("jarvis.language", "de"),
        "timezone": skill_cfg.get("jarvis.timezone", "Europe/Berlin"),
        "task_source": skill_cfg.get("jarvis.task_source", "kanban"),
        "email_mode": skill_cfg.get("jarvis.email_mode", "drafts"),
        "automation_review": skill_cfg.get("jarvis.automation_review", "approve"),
        "max_agents": skill_cfg.get("jarvis.max_agents", 3),
        "max_parallel": skill_cfg.get("jarvis.max_parallel", 2),
        "cost_tier": skill_cfg.get("jarvis.cost_tier", "low"),
        "max_estimated_cost_usd": skill_cfg.get("jarvis.max_estimated_cost_usd", 0),
        "routing_mode": skill_cfg.get("jarvis.routing_mode", "local_first"),
        "max_prompt_tokens": skill_cfg.get("jarvis.max_prompt_tokens", 4000),
        "max_completion_tokens": skill_cfg.get("jarvis.max_completion_tokens", 1200),
        "orchestrator_model": skill_cfg.get("jarvis.orchestrator_model", "local"),
        "specialist_model": skill_cfg.get("jarvis.specialist_model", "local"),
    }


def _voice_status(cfg: dict[str, Any]) -> dict[str, Any]:
    stt_provider = _config_value(cfg, "stt.provider", "") or ""
    tts_provider = _config_value(cfg, "tts.provider", "") or ""
    return {
        "stt": {
            "provider": stt_provider or None,
            "configured": bool(stt_provider),
            "available": "unknown" if stt_provider else "not_configured",
        },
        "tts": {
            "provider": tts_provider or None,
            "configured": bool(tts_provider),
            "available": "unknown" if tts_provider else "not_configured",
        },
        "note": "Voice actions use existing /api/audio endpoints; this status does not perform provider calls.",
    }


def _integration_status(cfg: dict[str, Any]) -> list[dict[str, Any]]:
    env = load_env()
    configured_skills = cfg.get("skills") if isinstance(cfg.get("skills"), dict) else {}
    disabled = set(configured_skills.get("disabled") or [])
    return [
        {
            "id": "google-workspace",
            "label": "Google Workspace",
            "status": "available" if "google-workspace" not in disabled else "disabled",
            "reason": "Skill availability only; OAuth/account state is managed by existing connector setup.",
        },
        {
            "id": "imap-smtp",
            "label": "IMAP/SMTP",
            "status": "configured" if env.get("IMAP_HOST") or env.get("SMTP_HOST") else "not_configured",
            "reason": "Checked non-secret environment presence only.",
        },
        {
            "id": "instagram_meta_api",
            "label": "Meta/Instagram API",
            "status": "configured" if env.get("META_ACCESS_TOKEN") or env.get("INSTAGRAM_ACCESS_TOKEN") else "not_configured",
            "reason": "No account call performed; publishing remains approval-gated.",
        },
        {
            "id": "kanban",
            "label": "Kanban",
            "status": "available",
            "reason": "Uses existing Hermes Kanban capability when enabled in the profile.",
        },
        {
            "id": "cronjob",
            "label": "Cron",
            "status": "available",
            "reason": "Uses existing Hermes cron routes; scheduling remains explicit.",
        },
    ]


def _jarvis_cron_jobs(profile: Optional[str]) -> list[dict[str, Any]]:
    try:
        from hermes_cli.web_routers.cron import _list_cron_jobs_sync
        jobs = _list_cron_jobs_sync(profile or "all")
    except Exception:
        logging.exception("Jarvis cron status is unavailable")
        return []
    filtered = []
    for job in jobs:
        skills = job.get("skills") if isinstance(job.get("skills"), list) else []
        prompt = str(job.get("prompt") or "").lower()
        name = str(job.get("name") or "").lower()
        if "jarvis-assistant" in skills or "jarvis" in prompt or "jarvis" in name:
            filtered.append(job)
    return filtered[:20]


def _model_inventory(profile: Optional[str]) -> dict[str, Any]:
    try:
        from hermes_cli.inventory import build_model_options_payload, load_picker_context
        with _config_profile_scope(profile):
            payload = build_model_options_payload(
                load_picker_context(), include_unconfigured=True, explicit_only=False, refresh=False)
    except Exception:
        logging.exception("Jarvis model inventory is unavailable")
        return {
            "available": False,
            "error": "Model inventory temporarily unavailable",
            "local": [],
            "cloud": [],
            "note": "Model inventory could not be read; no provider call was forced by Jarvis.",
        }
    local_rows = []
    cloud_rows = []
    for row in payload.get("providers", []):
        entry = {
            "provider": row.get("slug") or row.get("id") or "",
            "label": row.get("name") or row.get("label") or row.get("slug") or "",
            "models": list(row.get("models") or [])[:20],
            "authenticated": bool(row.get("authenticated")),
            "source": row.get("source") or "",
            "warning": row.get("warning") or "",
        }
        provider = str(entry["provider"]).lower()
        auth_type = str(row.get("auth_type") or "").lower()
        source = str(entry["source"]).lower()
        if provider in {"llamacpp", "ollama"} or auth_type == "local" or "local" in source:
            local_rows.append(entry)
        else:
            cloud_rows.append(entry)
    return {
        "available": True,
        "local": local_rows,
        "cloud": cloud_rows,
        "fallback_rules": ["local_only", "local_first", "smart", "cloud"],
        "note": "Lists configured/catalogued models only; no model download or live benchmark is performed.",
    }


def _runs_path() -> Path:
    return Path(get_hermes_home()) / "jarvis" / "runs.jsonl"


def _executions_path() -> Path:
    return Path(get_hermes_home()) / "jarvis" / "executions.jsonl"


def _approvals_path() -> Path:
    return Path(get_hermes_home()) / "jarvis" / "approvals.json"


@contextmanager
def _approval_file_lock():
    """Serialize approval mutations between requests and server workers (POSIX)."""
    lock_path = _approvals_path().with_suffix(".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    # A separate lock inode survives atomic replacement of approvals.json.
    with lock_path.open("a+b") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _load_approvals() -> list[dict[str, Any]]:
    path = _approvals_path()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        # Never mistake corrupt storage for an empty queue and overwrite it.
        logging.exception("Jarvis approval queue cannot be read")
        raise RuntimeError("Jarvis approval queue unavailable") from exc
    if not isinstance(data, list) or not all(isinstance(item, dict) for item in data):
        raise RuntimeError("Jarvis approval queue has invalid structure")
    return data


def _save_approvals(items: list[dict[str, Any]]) -> None:
    """Commit approval state atomically. Caller must hold _approval_file_lock."""
    path = _approvals_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(items, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    tmp_name = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent,
            prefix=".approvals-", suffix=".tmp", delete=False,
        ) as handle:
            tmp_name = handle.name
            os.chmod(tmp_name, 0o600)
            handle.write(serialized)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_name, path)
    finally:
        if tmp_name is not None and os.path.exists(tmp_name):
            os.unlink(tmp_name)


def _approval_hash(item: dict[str, Any]) -> str:
    """Digest the stored approval subject, not its mutable status metadata."""
    payload = {
        "action": item.get("action"),
        "reason": item.get("reason"),
        "items": item.get("items"),
        "agent_id": item.get("agent_id"),
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _enqueue_approvals(output: dict[str, Any]) -> list[dict[str, Any]]:
    consolidated = output.get("consolidated") or {}
    approvals = consolidated.get("approval_required") if isinstance(consolidated, dict) else None
    if approvals is None:
        approvals = []
        for result in output.get("results", []) or []:
            if isinstance(result, dict):
                for item in result.get("approval_required", []) or []:
                    if isinstance(item, dict):
                        approvals.append({**item, "agent_id": result.get("agent_id")})
    if not isinstance(approvals, list) or not approvals:
        return []
    created: list[dict[str, Any]] = []
    with _approval_file_lock():
        queue = _load_approvals()
        existing = {
            item.get("params_hash") for item in queue if item.get("status") == "pending"
        }
        for item in approvals:
            if not isinstance(item, dict):
                continue
            record = {
                "id": uuid.uuid4().hex[:16],
                "created_at": time(),
                "status": "pending",
                "action": str(item.get("action") or "external_action"),
                "reason": str(item.get("reason") or "External effect requires approval."),
                "agent_id": str(item.get("agent_id") or ""),
                "items": item.get("items") if isinstance(item.get("items"), list) else [],
            }
            record["params_hash"] = _approval_hash(record)
            if record["params_hash"] in existing:
                continue
            existing.add(record["params_hash"])
            queue.append(record)
            created.append(record)
        if created:
            # Keep every unresolved decision. Only resolved history may be trimmed.
            pending = [row for row in queue if row.get("status") == "pending"]
            resolved = [row for row in queue if row.get("status") != "pending"]
            _save_approvals(pending + resolved[-_MAX_APPROVAL_HISTORY:])
    return created


def _decide_approval_record(approval_id: str, decision: str) -> dict[str, Any]:
    """Record a one-time UI decision; does not execute an external action."""
    with _approval_file_lock():
        queue = _load_approvals()
        for item in queue:
            if item.get("id") != approval_id:
                continue
            if item.get("status") != "pending":
                raise HTTPException(status_code=409, detail="Approval is no longer pending")
            if item.get("params_hash") != _approval_hash(item):
                raise HTTPException(status_code=409, detail="Approval parameters changed")
            if decision not in {"approve", "deny", "reject"}:
                raise HTTPException(status_code=400, detail="Invalid decision")
            item["status"] = "approved" if decision == "approve" else "denied"
            item["decided_at"] = time()
            _save_approvals(queue)
            return {"ok": True, "approval": item, "executed": False}
        raise HTTPException(status_code=404, detail="Approval not found")


def _persist_run_record(kind: str, output: dict[str, Any]) -> None:
    path = _runs_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "created_at": time(),
        "kind": kind,
        "schema": output.get("schema"),
        "status": output.get("status"),
        "request": output.get("request", "")[:500],
        "agents": [task.get("agent_id") for task in output.get("tasks", []) if isinstance(task, dict)],
        "model_policy": output.get("model_policy", {}),
        "token_policy": output.get("token_policy", {}),
        "missing_integrations": output.get("missing_integrations", []),
        "approval_required": output.get("consolidated", {}).get("approval_required", []),
        "external_actions_executed": output.get("consolidated", {}).get("external_actions_executed", False),
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")


def _recent_runs(limit: int = 20) -> list[dict[str, Any]]:
    path = _runs_path()
    if not path.is_file():
        return []
    # Avoid loading an unbounded JSONL history into memory on every status poll.
    bounded_limit = max(1, min(int(limit), _MAX_RUN_HISTORY))
    with path.open("r", encoding="utf-8-sig", errors="replace") as handle:
        recent_lines = deque(handle, maxlen=bounded_limit)
    rows = []
    for line in recent_lines:
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(record, dict):
            rows.append(record)
    return list(reversed(rows))


def _tool_execution_receipt(tool_name: str, raw_result: Any) -> tuple[dict[str, Any], dict[str, Any] | None]:
    return tool_execution_receipt(tool_name, raw_result)


def _persist_execution_receipt(receipt: dict[str, Any]) -> None:
    persist_execution_receipt(receipt, home=Path(get_hermes_home()))


def _is_open_tasks_request(request: str) -> bool:
    words = {word.strip(".,!?;:").lower() for word in request.split()}
    return any(word.startswith("aufgab") for word in words) and any(word.startswith("offen") for word in words)


def _restrict_open_tasks_tools(agent: Any) -> None:
    """Keep the one-shot agent's model-visible and dispatch-valid surface identical."""
    agent.tools = [
        tool for tool in agent.tools
        if isinstance(tool, dict) and tool.get("function", {}).get("name") == "kanban_list"
    ]
    agent.valid_tool_names = {"kanban_list"} if agent.tools else set()


def _build_open_tasks_agent():
    from run_agent import AIAgent
    agent = AIAgent(
        platform="dashboard",
        quiet_mode=True,
        max_iterations=2,
        enabled_toolsets=["kanban"],
        skip_context_files=True,
        skip_memory=True,
        session_db=None,
        save_trajectories=False,
    )
    _restrict_open_tasks_tools(agent)
    return agent


def _latest_tool_result(turn: dict[str, Any], tool_name: str) -> Any:
    messages = turn.get("messages") if isinstance(turn, dict) else None
    if not isinstance(messages, list):
        return None
    for message in reversed(messages):
        if isinstance(message, dict) and message.get("role") == "tool" and message.get("name") == tool_name:
            return message.get("content")
    return None


def _run_open_tasks_agent(request: str, limit: int) -> dict[str, Any]:
    agent = _build_open_tasks_agent()
    prompt = (
        f"{request.strip()}\n\n"
        f"Rufe genau einmal kanban_list mit limit={max(1, min(limit, 50))} auf. "
        "Nutze keine anderen Werkzeuge. Fasse danach ausschließlich das bestätigte Tool-Ergebnis zusammen."
    )
    try:
        turn = agent.run_conversation(prompt, task_id="jarvis-open-tasks")
        raw_result = _latest_tool_result(turn, "kanban_list")
    except Exception:
        logging.exception("Jarvis open-tasks agent loop failed")
        receipt = {"tool": "kanban_list", "status": "failed", "created_at": time(), "error": "Agent loop failed."}
        _persist_execution_receipt(receipt)
        return {"ok": False, "receipt": receipt, "result": None, "response": None}
    if raw_result is None:
        receipt = {"tool": "kanban_list", "status": "failed", "created_at": time(), "error": "Agent did not call kanban_list."}
        _persist_execution_receipt(receipt)
        return {"ok": False, "receipt": receipt, "result": None, "response": turn.get("final_response")}
    receipts = getattr(agent, "_jarvis_execution_receipts", [])
    receipt = receipts[-1] if isinstance(receipts, list) and receipts else None
    if receipt is None:
        receipt, result = _tool_execution_receipt("kanban_list", raw_result)
        _persist_execution_receipt(receipt)
    else:
        _ignored_receipt, result = _tool_execution_receipt("kanban_list", raw_result)
    return {
        "ok": receipt["status"] == "completed",
        "receipt": receipt,
        "result": result,
        "response": turn.get("final_response"),
    }


def _status_sync(profile: Optional[str]) -> dict[str, Any]:
    try:
        module = _orchestrator_module()
        orchestrator_available = True
        agents = _agent_catalog(module)
        schema = module.SCHEMA_VERSION
    except Exception as exc:
        logging.exception("Jarvis orchestrator is unavailable")
        orchestrator_available = False
        agents = []
        schema = ""
        orchestrator_error = str(exc)
    else:
        orchestrator_error = ""
    with _config_profile_scope(profile):
        cfg = load_config()
        jarvis_cfg = _jarvis_skill_config(cfg)
        voice = _voice_status(cfg)
        integrations = _integration_status(cfg)
        model_inventory = _model_inventory(profile)
        runs = _recent_runs()
        pending_approvals = [item for item in _load_approvals() if item.get("status") == "pending"]
    automations = _jarvis_cron_jobs(profile)
    return {
        "ok": True,
        "skill": {
            "name": "jarvis-assistant",
            "available": _JARVIS_SKILL_DIR.is_dir(),
            "path": str(_JARVIS_SKILL_DIR),
        },
        "orchestrator": {
            "available": orchestrator_available,
            "schema": schema,
            "path": str(_ORCHESTRATOR_PATH),
            "error": orchestrator_error,
        },
        "agents": agents,
        "config": jarvis_cfg,
        "integrations": integrations,
        "models": model_inventory,
        "voice": voice,
        "automations": {
            "jarvis_jobs": automations,
            "count": len(automations),
            "activation_policy": "manual_approval_required",
        },
        "runs": runs,
        "approvals": {
            "pending": pending_approvals,
        },
    }


async def _call_orchestrator(fn):
    try:
        return await asyncio.to_thread(fn)
    except HTTPException:
        raise
    except TypeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=f"Jarvis orchestrator missing: {exc}") from exc
    except Exception as exc:
        logging.exception("Jarvis orchestration failed")
        raise HTTPException(status_code=500, detail="Jarvis orchestration failed") from exc


class JarvisDialogueIntentRequest(BaseModel):
    """Optional preflight classification; does not dispatch a tool or model."""
    message: str = Field(min_length=1, max_length=8000)
    mode: Literal["auto", "chat", "task"] = "auto"


@router.post("/api/jarvis/dialogue/intent")
async def classify_jarvis_dialogue_intent(body: JarvisDialogueIntentRequest):
    """Give the UI a cheap hint; preserve Hermes chat and tool authorization."""
    decision = JarvisIntentRouter().classify(body.message, body.mode)
    return {"ok": True, **decision.to_dict()}


@router.get("/api/jarvis/status")
async def get_jarvis_status(profile: Optional[str] = None):
    return await asyncio.to_thread(_status_sync, profile)


@router.get("/api/jarvis/approvals")
async def get_jarvis_approvals(profile: Optional[str] = None):
    def _load():
        with _config_profile_scope(profile):
            queue = _load_approvals()
            return {
                "ok": True,
                "pending": [item for item in queue if item.get("status") == "pending"],
                "history": queue[-50:],
                "source": "profile_jarvis_approval_queue",
                "message": "Approvals are persistent and one-time use. Execution adapters re-check action parameters before external writes.",
            }
    return await asyncio.to_thread(_load)


@router.post("/api/jarvis/approvals/{approval_id}")
async def decide_jarvis_approval(approval_id: str, body: JarvisApprovalDecision, profile: Optional[str] = None):
    def _decide():
        with _config_profile_scope(profile):
            return _decide_approval_record(approval_id, body.decision)
    return await asyncio.to_thread(_decide)
_JARVIS_SETTING_KEYS = {
    "jarvis.routing_mode",
    "jarvis.max_agents",
    "jarvis.max_parallel",
    "jarvis.max_prompt_tokens",
    "jarvis.max_completion_tokens",
    "jarvis.max_estimated_cost_usd",
    "jarvis.cost_tier",
    "jarvis.orchestrator_model",
    "jarvis.specialist_model",
}


@router.put("/api/jarvis/settings")
async def update_jarvis_settings(body: JarvisSettingsUpdate, profile: Optional[str] = None):
    def _save():
        with _config_profile_scope(profile), _CONFIG_MUTATION_LOCK:
            cfg = load_config()
            skills = cfg.setdefault("skills", {})
            skill_cfg = skills.setdefault("config", {})
            for key, value in body.settings.items():
                if key not in _JARVIS_SETTING_KEYS:
                    raise HTTPException(status_code=400, detail=f"Unsupported Jarvis setting: {key}")
                skill_cfg[key] = value
            atomic_config_write(get_config_path(), cfg)
            return {"ok": True, "config": _jarvis_skill_config(cfg)}
    return await asyncio.to_thread(_save)


@router.get("/api/jarvis/runs")
async def get_jarvis_runs(profile: Optional[str] = None, limit: int = 20):
    def _load():
        with _config_profile_scope(profile):
            return {"ok": True, "runs": _recent_runs(limit)}
    return await asyncio.to_thread(_load)


@router.post("/api/jarvis/executions/kanban-list")
async def execute_jarvis_kanban_list(body: JarvisKanbanListRequest, profile: Optional[str] = None):
    """Run one bounded, read-only Jarvis task through Hermes' normal tool dispatcher."""
    def _run():
        args = {
            "include_archived": body.include_archived,
            "limit": max(1, min(body.limit, 50)),
        }
        for key in ("board", "status", "assignee", "tenant"):
            value = getattr(body, key)
            if value:
                args[key] = value
        with _config_profile_scope(profile):
            from model_tools import handle_function_call
            raw_result = handle_function_call(
                "kanban_list", args, task_id="jarvis-kanban-read",
                user_task="Jarvis liest Aufgaben aus dem Kanban.", enabled_toolsets=["kanban"],
            )
            receipt, result = _tool_execution_receipt("kanban_list", raw_result)
            _persist_execution_receipt(receipt)
            return {"ok": receipt["status"] == "completed", "receipt": receipt, "result": result}
    return await _call_orchestrator(_run)


@router.post("/api/jarvis/executions/open-tasks")
async def execute_jarvis_open_tasks(body: JarvisOpenTasksRequest, profile: Optional[str] = None):
    request = body.request.strip()
    if not _is_open_tasks_request(request):
        raise HTTPException(status_code=400, detail="This endpoint only supports asking for open tasks.")
    def _run():
        with _config_profile_scope(profile):
            return _run_open_tasks_agent(request, body.limit)
    return await _call_orchestrator(_run)


@router.post("/api/jarvis/orchestrator/plan")
async def plan_jarvis_orchestration(body: JarvisOrchestrationRequest, profile: Optional[str] = None):
    request = body.request.strip()
    if not request:
        raise HTTPException(status_code=400, detail="request is required")
    def _run():
        with _config_profile_scope(profile):
            module = _orchestrator_module()
            output = module.build_plan(request, body.payload, _limits(module, body.limits))
            _persist_run_record("plan", output)
            _enqueue_approvals(output)
            return output
    return await _call_orchestrator(_run)


@router.post("/api/jarvis/orchestrator/run")
async def run_jarvis_orchestration(body: JarvisOrchestrationRequest, profile: Optional[str] = None):
    request = body.request.strip()
    if not request:
        raise HTTPException(status_code=400, detail="request is required")
    def _run():
        with _config_profile_scope(profile):
            module = _orchestrator_module()
            output = module.orchestrate(request, body.payload, _limits(module, body.limits))
            _persist_run_record("run", output)
            _enqueue_approvals(output)
            return output
    return await _call_orchestrator(_run)


@router.post("/api/jarvis/orchestrator/agent/{agent_id}")
async def run_jarvis_agent(agent_id: str, body: JarvisOrchestrationRequest, profile: Optional[str] = None):
    request = body.request.strip()
    if not request:
        raise HTTPException(status_code=400, detail="request is required")
    def _run():
        with _config_profile_scope(profile):
            module = _orchestrator_module()
            if agent_id not in module.AGENTS:
                raise HTTPException(status_code=404, detail="Jarvis agent not found")
            result = module.asdict(module.run_agent(agent_id, request, body.payload))
            _persist_run_record("agent", {
                "schema": getattr(module, "SCHEMA_VERSION", ""),
                "status": result.get("status"),
                "request": request,
                "tasks": [{"agent_id": agent_id}],
                "missing_integrations": result.get("missing_integrations", []),
                "consolidated": {
                    "approval_required": result.get("approval_required", []),
                    "external_actions_executed": False,
                },
            })
            _enqueue_approvals({
                "results": [result],
                "consolidated": {
                    "approval_required": result.get("approval_required", []),
                    "external_actions_executed": False,
                },
            })
            return result
    return await _call_orchestrator(_run)
