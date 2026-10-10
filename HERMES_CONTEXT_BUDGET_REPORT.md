# Hermes Adaptive Context Budget Controller — Phase 7

Date: 2026-10-10

## Scope

Implemented a deterministic workspace-context decision before fresh-agent
creation. The controller does not call an LLM, change providers, mutate
toolsets, or retain request text. It does not change an existing session.

## Implementation

- `agent/context_budget.py` selects `required`, `optional`, or `unnecessary`
  from the existing adaptive task type and transient project-reference signals.
- `run_agent.py` and `agent/agent_init.py` freeze a supplied decision before
  prompt construction.
- `agent/system_prompt.py` skips only project/workspace context when the frozen
  decision is not required. `skip_context_files` retains its existing broader
  semantics, so identity and other established behavior are unaffected.
- Fresh gateway, interactive CLI, and one-shot CLI sessions resolve the decision
  beside the existing capability profile. Gateway cache reuse and resumed
  histories pass no new decision.
- Capability metadata now records only:
  - `workspace_context_loaded`
  - `estimated_prompt_tokens_before`
  - `estimated_prompt_tokens_after`

The before value is the actual assembled prompt plus the conservative 3,379
token workspace-context estimate from the Phase 4 audit when project context
is deliberately omitted. The after value is Hermes' rough estimate of the
prompt actually assembled. No prompt, workspace, or user-request content is
persisted.

## Savings by profile

The local baseline system prompt was 8,545 estimated tokens, including 3,379
tokens of workspace/project context. This controller affects only that tier.

| Task/profile posture | Workspace decision | Estimated system-prompt reduction |
| --- | --- | ---: |
| `simple_chat` | unnecessary | 3,379 tokens (39.5%) |
| `writing` without a project reference | unnecessary | 3,379 tokens (39.5%) |
| `writing` with project/file/repository reference | required | 0 tokens; retain context |
| `coding` with project/file/repository reference | required | 0 tokens; retain context |
| `coding` without an explicit workspace reference | optional, not auto-loaded | 3,379 tokens (39.5%) |
| `research` without an explicit workspace reference | optional, not auto-loaded | 3,379 tokens (39.5%) |
| `agent_task` / `automation` | required | 0 tokens; retain context |

`optional` is deliberately not auto-loaded. Adding workspace context after a
session begins would change the cached prefix; a user can start a new,
workspace-scoped session when context becomes necessary.

## Cache guarantees

- The decision is made only before constructing a fresh `AIAgent`.
- Resumed sessions restore their persisted prompt and receive no new decision.
- Cached gateway agents are reused unchanged.
- Compression rebuilds use the frozen decision already attached to the agent.
- Stable prompt content, SOUL identity, security guidance, tools, memory, and
  provider/model policy are unchanged.

## Validation

- New contracts in `tests/agent/test_context_budget.py` cover simple chat,
  project-free writing, coding with a file/repository reference, agent tasks,
  token metadata, session resume, and no reassessment of a running session.
- Focused suite: 148 tests passed.
