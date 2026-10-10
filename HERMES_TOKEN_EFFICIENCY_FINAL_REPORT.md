# Hermes Token Efficiency Benchmark

## Scope

This benchmark measures the current session-initialization architecture after
Adaptive Routing, Capability Profiles, the Context Budget Controller, and the
Stable Prompt Manifest. It does not change production behavior and does not
send a model request. Only aggregate token estimates and configuration metadata
were measured; no user content was retained.

## Method

- **Before:** the Phase 4 general-session baseline: stable prompt 3,263,
  workspace/context 3,379, volatile prompt 1,902, Tool Search 11,095, and no
  memory payload: **19,640 estimated tokens**.
- **After:** a new `AIAgent` was initialized for each deterministic task type.
  The benchmark measured the generated stable, context, volatile, tool-schema,
  and memory sections using Hermes' rough token estimator.
- The direct source-tree benchmark has no externally supplied workspace or
  memory payload. A `workspace_context_loaded` decision can therefore be true
  while no external workspace text is available to add.
- This is a comparison against the audited general baseline, not a replay of
  historical user conversations. Actual values vary with enabled services,
  workspace content, retrieved memory, and configured tools.

## Results

| Capability | System prompt | Tool context | Workspace context | Memory context | Total after | Total before | Saved | Reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `simple_chat` | 688 | 454 | 0 | 0 | 1,142 | 19,640 | 18,498 | 94.2% |
| `writing` | 688 | 454 | 0 | 0 | 1,142 | 19,640 | 18,498 | 94.2% |
| `coding` | 3,837 | 10,470 | 165 | 0 | 14,307 | 19,640 | 5,333 | 27.2% |
| `research` | 1,038 | 933 | 0 | 0 | 1,971 | 19,640 | 17,669 | 90.0% |
| `agent_task` | 1,161 | 1,615 | 0 | 0 | 2,776 | 19,640 | 16,864 | 85.9% |
| `automation` | 1,038 | 454 | 0 | 0 | 1,492 | 19,640 | 18,148 | 92.4% |

System prompt includes stable, workspace/context, and volatile prompt sections.
The `coding` profile is intentionally broader: its existing coding tool schemas
alone account for 10,470 estimated tokens (about 73.2% of its total).

## Component Detail

| Capability | Stable | Workspace/context | Volatile | Tool context | Memory |
| --- | ---: | ---: | ---: | ---: | ---: |
| `simple_chat` | 499 | 0 | 189 | 454 | 0 |
| `writing` | 499 | 0 | 189 | 454 | 0 |
| `coding` | 1,776 | 165 | 1,896 | 10,470 | 0 |
| `research` | 849 | 0 | 189 | 933 | 0 |
| `agent_task` | 972 | 0 | 189 | 1,615 | 0 |
| `automation` | 849 | 0 | 189 | 454 | 0 |

## Interpretation

- Five of six profiles reduce estimated initial context by more than 80%.
- Simple, writing, research, agent, and automation sessions avoid unrelated
  tool schemas and optional prompt modules at session creation.
- Coding remains the principal optimization opportunity. Its reduction is
  limited by the existing coding toolset, not by the manifest or workspace
  controller. Any further reduction should preserve the toolset/provider
  contracts and be evaluated separately.
- No benchmark profile loaded a memory payload. Memory retrieval can raise
  totals in real sessions, while remaining session-scoped and cache-safe.

## Cache and Privacy Notes

- The benchmark creates new agents only; it does not modify or reevaluate a
  running or resumed session.
- Capability and manifest choices remain frozen at session creation, preserving
  prompt-prefix cache invariants.
- Recorded measurements contain only capability names, section estimates, and
  aggregate totals. No prompt, workspace, memory, or user-request content is
  recorded.

## Validation

- Measurement completed without provider/model calls.
- Existing Phase 9 focused validation remains green: **418 tests passed**.
- `scripts/run-in-hermes-env python scripts/check` passed all 11 checks during
  Phase 9 validation.
