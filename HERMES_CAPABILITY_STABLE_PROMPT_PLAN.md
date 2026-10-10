# Hermes Capability-Based Stable Prompt Modularization — Phase 9 Plan

Date: 2026-10-10  
Scope: analysis and plan only. No prompt behavior changed.

## Architecture decision

Keep the existing `stable` / `context` / `volatile` architecture in `agent/system_prompt.py`. Compose its stable tier from a frozen, session-owned manifest: a minimal `CORE_ALWAYS` plus selected capability and execution blocks. This should be a typed Python registry, not a runtime `prompt_tiers/` markdown directory: existing builders, gates, provenance, and ordering remain authoritative, while standalone files add configuration risk without saving tokens.

## Stable content map

| Existing source | Target tier | Rule |
| --- | --- | --- |
| `SOUL.md` or `DEFAULT_AGENT_IDENTITY` | `CORE_ALWAYS` | Always retain identity and SOUL precedence. |
| Hermes self-help guidance | `CORE_ALWAYS` | Retain; potentially compact later, never remove. |
| Completion / anti-fabrication | `CORE_ALWAYS` | Always retain. |
| Parallel calls, steering, tool enforcement | `EXECUTION` | Only for tool-bearing sessions and current gates. |
| Tool-pruned/model-specific execution discipline | `EXECUTION` | Preserve current model/config and tool-name gates. |
| Memory and session-search guidance | `memory` | Requires matching tools and enabled store/profile. |
| Skills guidance | `agent` | Requires skill-management capability. |
| Kanban guidance | `automation` | Only dispatcher-owned worker sessions. |
| Async handoff | `delegation` | Requires `delegate_task`. |
| Coding posture/edit format | `coding` | Only coding posture sessions. |
| Auto-loaded skills | selected-skill layer | Explicit operator content; independently budgeted. |
| Alibaba identity | provider-specific core delta | Retain existing narrow gate. |

`research` needs no invented generic prose. Its existing distinction is the web tool surface and, where relevant, the memory module.

## Target logical structure

```text
agent/
  prompt_tiers.py          # proposed typed manifest and render dispatch
  system_prompt.py         # keeps stable/context/volatile assembly ownership
  prompt_builder.py        # retains prose and builder ownership
  capability_profiles.py   # profile -> requested stable module names
```

Logical modules rendered into the current stable string:

```text
CORE_ALWAYS: identity, Hermes help, completion/no-fabrication
CAPABILITY: coding, agent, memory, research (empty initially), automation, delegation
EXECUTION: parallel calls, steering, tool enforcement, model execution discipline
```

Workspace/project context stays in `context`; skills index, memory payloads, plugins, timestamp, profile, and runtime facts stay `volatile`.

## Integration and cache invariants

1. Gateway and CLI already resolve a `CapabilityProfile` only for fresh sessions.
2. `AIAgent` carries that requested profile into `agent_init.py` before the first prompt exists.
3. After existing tool loading/configuration establishes `valid_tool_names`, model, memory stores, and worker ownership, `agent_init.py` freezes a `StablePromptManifest` before prompt construction.
4. `system_prompt.py` renders current blocks through that frozen manifest in their existing order.
5. Resumes and gateway cache reuse create no new manifest and restore persisted prompt bytes. Compression reuses the agent's frozen manifest.

The two stages are deliberate: posture is known before construction, but the authoritative loaded tool surface exists only after `_load_tools()`. No provider request occurs between them.

## Planned files and migration

| File | Planned responsibility |
| --- | --- |
| New `agent/prompt_tiers.py` | Manifest type, capability selection, dispatch to existing builders, numeric estimates. |
| `agent/capability_profiles.py` | Requested module names and content-free metadata. |
| `agent/agent_init.py` | Freeze manifest after tools/memory setup and before prompt build. |
| `agent/system_prompt.py` | Manifest-aware stable aggregation; preserve current public output shape. |
| `agent/prompt_builder.py` | Only narrow reusable builders; no broad prose rewrite. |
| `agent/coding_context.py` | Remains owner of coding guidance/workspace content. |

Migration order:

1. Add a compatibility manifest that renders today’s effective blocks.
2. Add count-only per-module measurement.
3. Apply capability selection only to new profile-backed sessions; unprofiled callers retain present behavior.
4. Move memory, agent, delegation, automation, coding, and execution blocks behind the manifest while retaining existing gates.
5. Compare token, cache, tool-use, and completion behavior before shortening prose.

## Required tests

- Identity and completion/no-fabrication are present in every manifest.
- Simple chat/writing omit inapplicable memory, skills, delegation, coding, and execution blocks.
- Coding has coding posture but no delegation/Kanban unless separately eligible.
- Agent task only gets delegation guidance with `delegate_task`.
- Memory guidance requires both enabled store/profile and matching tools.
- Kanban remains restricted to an owned worker.
- Model-specific blocks retain config/model gates and tool-name pruning.
- Resume is byte-for-byte unchanged; compression reuses its frozen manifest.
- Profile token measurements show a simple-session reduction against compatibility baseline.

Primary existing coverage: `test_system_prompt.py`, `test_system_prompt_restore.py`, `test_system_prompt_switch_invalidation.py`, `test_background_review_cache_parity.py`, and capability-profile tests.

## Expected stable-token savings

| Profile | Current baseline | Target | Reduction |
| --- | ---: | ---: | ---: |
| Simple chat / writing | 3,263 | 600–1,000 | 2,263–2,663 (69–82%) |
| Research | 3,263 | 1,000–1,500 | 1,763–2,263 (54–69%) |
| Coding | 3,263 | 1,500–2,000 | 1,263–1,763 (39–54%) |
| Agent / automation | 3,263 | 1,500–2,000 | 1,263–1,763 (39–54%) |

Large SOUL or explicitly auto-loaded skill content can validly exceed these targets. It must be measured visibly, not dropped. No provider, model-policy, tool schema, global route, or live-session change is required.
