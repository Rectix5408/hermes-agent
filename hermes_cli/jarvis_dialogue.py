"""Low-cost, non-authoritative intent hints for the Hermes/Jarvis UI.

This module NEVER dispatches tools, selects permissions, authorizes side-effects,
or calls an LLM.  The existing Hermes agent and tool authorization remain the
sole sources of truth for execution.  Classifying a turn is not executing it.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
import re
from typing import Literal

RouteMode = Literal["chat", "agent"]
IntentType = Literal["conversation", "read_request", "task_request", "write_request"]
UserMode = Literal["auto", "chat", "task"]


@dataclass(frozen=True)
class JarvisIntent:
    route: RouteMode
    intent: IntentType
    approval_hint: Literal["tool_policy", "review_external_write"]
    execution_started: bool = False
    classifier: str = "local_rules_v1"

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


class JarvisIntentRouter:
    """Deterministic UI routing hints without a model or tool invocation.

    Conservative default: ambiguous messages go to existing Hermes chat.  A
    task hint does not mean the orchestrator may start side effects without
    its usual approval and per-tool policy checks.
    """

    _intro = re.compile(
        r"^(?:(?:hey|hallo|hi|okay|ok)[, ]+)?(?:jarvis|hermes)[,!: ]+",
        re.IGNORECASE,
    )
    _request = re.compile(
        r"^(?:(?:kannst|könntest|würdest) du (?:mir )?(?:bitte )?|"
        r"ich möchte[, ]+dass du |ich will[, ]+dass du |bitte )",
        re.IGNORECASE,
    )
    _education = re.compile(
        r"^(?:wie |warum |was |wer |wann |wieso |wo |erkläre (?:mir )?|"
        r"lass uns |können wir |kann ich |ich möchte (?:über|mit dir)|"
        r"hilf mir zu verstehen)",
        re.IGNORECASE,
    )
    _read = re.compile(
        r"^(?:zeig(?:e)?|lies|lese|prüfe|analysiere|durchsuche|suche|finde|"
        r"liste|überprüfe|checke|fasse|fass|recherchiere|ermittle|"
        r"sortiere|priorisiere)\b",
        re.IGNORECASE,
    )
    _write = re.compile(
        r"^(?:sende|versende|schicke|verschicke|veröffentliche|poste|"
        r"lösche|entferne|überweise|bezahle|kaufe|bestelle|buche|"
        r"storniere|ändere|aktualisiere|installiere|deinstalliere|"
        r"verschiebe|teile|lade hoch|schalte|starte)\b",
        re.IGNORECASE,
    )
    _task = re.compile(
        r"^(?:erstelle|plane|organisiere|bereite|überarbeite|"
        r"automatisiere|erledige|bearbeite|übernimm|öffne|"
        r"schreibe)\b",
        re.IGNORECASE,
    )
    _negative = re.compile(r"^(?:nicht|niemals|auf keinen fall|keine\b)", re.IGNORECASE)
    # Spoken modal questions often place the actual verb at the very end.
    _modal_read = re.compile(
        r"\b(?:analysieren|prüfen|durchsuchen|suchen|finden|anzeigen|zeigen|"
        r"auflisten|recherchieren|zusammenfassen|priorisieren|sortieren)\b",
        re.IGNORECASE,
    )
    _modal_write = re.compile(
        r"\b(?:senden|versenden|verschicken|veröffentlichen|posten|"
        r"löschen|entfernen|überweisen|bezahlen|kaufen|bestellen|buchen|"
        r"stornieren|ändern|aktualisieren|installieren|deinstallieren)\b",
        re.IGNORECASE,
    )

    def classify(self, message: str, mode: UserMode = "auto") -> JarvisIntent:
        if not isinstance(message, str) or not message.strip():
            raise ValueError("message must contain text")
        if len(message) > 8000:
            raise ValueError("message is too long")
        if mode not in {"auto", "chat", "task"}:
            raise ValueError("invalid mode")

        clean = " ".join(message.strip().split())
        clean = self._intro.sub("", clean, count=1)
        if mode == "chat":
            return JarvisIntent("chat", "conversation", "tool_policy")

        # Explanations and open questions are conversations, not instructions.
        # Do not trust lexical routing hints as authorization decisions.
        if mode == "auto" and self._education.match(clean):
            return JarvisIntent("chat", "conversation", "tool_policy")

        candidate = self._request.sub("", clean, count=1)
        candidate = candidate.lstrip(" ,:!")
        if self._negative.match(candidate):
            return JarvisIntent("chat", "conversation", "tool_policy")

        if self._write.match(candidate):
            return JarvisIntent("agent", "write_request", "review_external_write")
        if self._read.match(candidate):
            return JarvisIntent("agent", "read_request", "tool_policy")
        if self._task.match(candidate):
            return JarvisIntent("agent", "task_request", "tool_policy")
        # Modal requests like "Kannst du meine E-Mails analysieren?" are tasks.
        # Negated requests are not dispatched; this is an advisory hint only.
        if candidate != clean and not re.search(r"\b(?:nicht|keine|niemals)\b", candidate, re.IGNORECASE):
            if self._modal_write.search(candidate):
                return JarvisIntent("agent", "write_request", "review_external_write")
            if self._modal_read.search(candidate):
                return JarvisIntent("agent", "read_request", "tool_policy")
        if mode == "task":
            return JarvisIntent("agent", "task_request", "tool_policy")
        return JarvisIntent("chat", "conversation", "tool_policy")
