# Hermes Stable Prompt Token Audit — Phase 8

Date: 2026-10-10  
Scope: analysis only. No prompt, runtime, configuration, provider, tool, or session behavior was changed.

## Result

The measured stable tier is approximately **3,263 tokens**. It is cache-friendly, but it is not purely universal: `agent/system_prompt.py` currently places identity, completion rules, tool/model-specific execution prose, tool-lifecycle guidance, coding posture, and pinned auto-loaded skills in the same stable band.

The safe path to a **1,500–2,000 token** stable tier is session-start selection of existing capability-specific prose. It is not safe to delete identity, the anti-fabrication/completion contract, or tool/model behavior that has an explicit production failure mode without behavior evaluation.

## 1. Current stable assembly

`agent/system_prompt.py::build_system_prompt_parts()` assembles stable content in this order:

1. `SOUL.md`, if present, otherwise `DEFAULT_AGENT_IDENTITY`.
2. Hermes self-help guidance, with a skills-aware variant when available.
3. `_guidance_parts()`: task completion, parallel calls, memory/search/skills/Kanban guidance, steering-channel guidance, model/config-gated tool-use and execution guidance, and async delegation handoff.
4. Alibaba-specific model identity, where applicable.
5. Pinned `skills.auto_load` content.
6. Coding-posture prefix from `agent/coding_context.py`, including its model-family edit-format nudge.
7. When no workspace snapshot exists, coding trailing instructions, environment probe output, bot-mode protocol, and platform hints can also land in stable. With a snapshot they follow the context tier instead.

Project instructions and caller system text are context-tier content. Skill index, memory payloads, plugins, profile/date lines, and runtime environment are volatile-tier content.

## 2. Token distribution

| Prompt tier | Estimated tokens |
| --- | ---: |
| Stable | 3,263 |
| Workspace/context | 3,379 |
| Volatile | 1,902 |
| Full system prompt | 8,545 |

Stable composition is runtime-gated, so rows below are not a single additive snapshot. They identify movable candidates using Hermes' rough estimator on current constants.

| Stable component | Estimated tokens | Current gate | Classification |
| --- | ---: | --- | --- |
| Default Hermes identity | 167 | fallback when no `SOUL.md` | KEEP |
| Hermes help, no-skills variant | 118 | always | COMPRESS / capability-gate |
| Task completion / no fabrication | 193 | tool-bearing session | KEEP; modest COMPRESS review |
| Parallel tool calls | 155 | tool-bearing session | COMPRESS / MOVE to execution |
| Memory guidance | 262 | memory tool plus enabled store/profile | MOVE to memory capability |
| Session-search guidance | 47 | `session_search` tool | MOVE to memory capability |
| Skills guidance | 111 | `skill_manage` tool | MOVE to agent/skills capability |
| Kanban protocol | variable, potentially large | owned Kanban worker only | MOVE; never general stable |
| Tool-use enforcement | 207 | model/config gate | COMPRESS / MOVE to execution |
| Full execution discipline | 996 | model/config gate, tool-pruned | COMPRESS / MOVE to execution |
| Steering channel note | 194 | tool-bearing session | MOVE to tool/steering capability |
| Async handoff | 123 | `delegate_task` available | MOVE to agent capability |
| Google operational guidance | 216 | Gemini/Gemma branch | MOVE to model execution capability |
| Coding posture / edit format | variable | coding runtime mode | MOVE to coding capability |
| Auto-loaded skills | variable | skills config and tool availability | KEEP as explicit opt-in; budget separately |
| Alibaba identity | small, variable | Alibaba provider only | KEEP, provider-specific |

The baseline also contains dynamic SOUL, coding, platform, and auto-loaded content. Future accounting must report selected-block totals rather than sum this table.

## 3. Classification rationale

### KEEP

- **Identity / SOUL precedence:** establishes Hermes identity, communication posture, and user-configured persona.
- **Completion and no-fabrication contract:** protects the core promise that completed work is grounded in real execution.
- **Provider-specific identity:** already narrowly gated.
- **Explicitly pinned auto-loaded skills:** operator-selected guidance; the concern is independent budgeting, not silent removal.

### COMPRESS

- **Task completion and tool-use enforcement** overlap on acting, persisting, and verification. Keep distinct behavioral contracts, but evaluate a concise shared execution invariant plus model-specific deltas.
- **Parallel tool calls** can reduce to the operational rule: batch independent reads; serialize dependencies.
- **Hermes help** can be shorter but must retain the authoritative docs and `hermes-agent` skill direction.
- **Execution discipline** should retain tool-name availability gates; shortening must never create dangling tool references.

### MOVE

- Memory/search, skills, Kanban, delegation, and steering guidance only belong to the matching capability/toolset.
- Model-specific execution and coding posture remain stable within an eligible session, but do not belong in every session's permanent prefix.

### REMOVE

No production prose is recommended for unconditional removal. The apparent overlap is behaviorally intentional: completion, grounding, verification, and literal preservation came from separate failure modes. Deterministic adaptive routing already belongs outside the prompt.

## 4. Duplications and deterministic alternatives

| Area | Finding | Safe direction |
| --- | --- | --- |
| Completion vs execution discipline | Both require persistence and verification | Keep concise universal completion; make execution a tool/model-specific delta after evaluation. |
| Tool-use enforcement vs completion | Both prohibit planning without action | Retain distinct coverage initially; evaluate compact shared form. |
| Tool names in prose | Some execution lines duplicate schemas | Keep only behavioral boundaries; schemas remain authoritative for mechanics. |
| Memory/skills lifecycle | Prose repeats capability availability | Capability-gate prose; retain store and schema checks. |
| Kanban protocol | Worker-specific operating process | Only dispatcher-owned worker sessions receive it. |

## 5. Target composition and savings

| Session type | Stable target | Composition |
| --- | ---: | --- |
| Simple chat / writing | 600–1,000 | identity, concise Hermes help, compact completion; no memory/agent/coding modules |
| Research | 1,000–1,500 | core plus compact execution and memory/search when selected |
| Coding | 1,500–2,000 | core, compact execution, coding posture/edit-format delta |
| Agent / automation | 1,500–2,000 | core, compact execution, precise agent/delegation module; Kanban only for owned workers |

| Change | Estimated stable-tier reduction | Preconditions |
| --- | ---: | --- |
| Omit memory/search/skills/delegation/steering in simple and writing sessions | 400–750 tokens, plus variable Kanban/skills | session-start module manifest |
| Make execution/model guidance capability- and model-specific | 200–1,200 tokens | preserve existing model/config gates |
| Compress parallel/help/execution overlap | 250–500 tokens | tool-use and completion evaluation |
| Keep coding posture out of non-coding sessions | variable | existing runtime-mode gate |
| **Ordinary-session total** | **1,300–2,100 tokens** | no oversized SOUL or auto-loaded skill payload |

Selection is the low-risk saving; prose deletion is not. A first implementation should target 1,500–2,000 tokens and measure completion, tool-use, and prompt-cache behavior before shortening safety text.

## 6. Risks and future scope

1. Module selection must occur before a fresh `AIAgent` exists. Resume, gateway cache reuse, and compression rebuilds must use their frozen manifest and persisted prompt bytes.
2. Every selected block must retain the current `valid_tool_names` guard.
3. SOUL and operator-pinned skills must never be silently truncated to satisfy a global target.
4. GPT/Codex and Gemini/Gemma execution instructions require behavior tests before compaction.
5. Kanban and async delivery instructions may be moved but not weakened.

Likely later changes are limited to `agent/system_prompt.py`, `agent/prompt_builder.py`, `agent/capability_profiles.py`, fresh-session initialization seams, and behavior-contract tests. Providers, model routing, tool schemas, and live sessions need no changes.
