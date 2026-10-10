# Hermes Capability Profiles — Phase 5

## Scope

This phase adds a session-start capability selector using existing Hermes
toolsets. It does not add a tool architecture, change providers or models, or
modify an already-running session.

## Implementation

- `agent/capability_profiles.py` contains immutable capability definitions and
  the deterministic resolver.
- Gateway and CLI callers resolve a profile only while creating a fresh agent
  for an empty conversation. Reused agents and sessions with history preserve
  their previously cached prompt and tool array.
- `AIAgent` accepts an already resolved profile during construction. The profile
  supplies existing toolset names and whether normal memory initialization is
  needed; provider, model and fallback selection are untouched.
- Prompt modules are metadata describing existing prompt sections. No prompt
  module is added, removed or reloaded during a conversation. Existing
  tool-aware prompt gates determine which guidance becomes relevant.
- Content-free metadata is stored in session `model_config` after the session
  row exists:
  - `capability_name`
  - `loaded_toolsets`
  - `prompt_modules`
  - `memory_enabled`
  - `prompt_context_estimate`
  - `estimated_context_tokens`

No user text, prompt text, provider identity or model identity is stored by
the capability metadata.

## Profiles

| Capability | Existing toolsets | Prompt modules | Memory |
| --- | --- | --- | --- |
| `simple_chat` | `clarify` | core, execution | off |
| `writing` | `clarify` | core, execution | off |
| `coding` | `coding` | core, coding, execution | on |
| `research` | `web`, `clarify` | core, research, execution | on |
| `agent_task` | `delegation`, `clarify` | core, agent, execution | on |
| `automation` | `cronjob`, `clarify` | core, automation, execution | on |

An unavailable existing tool is still filtered by the normal Hermes registry;
the profile neither synthesizes nor bypasses a tool.

## Local token measurement

Measurements used Hermes' `estimate_tokens_rough` against the current checkout,
current workspace instruction files and current available-tool registry. They
are directional estimates, not provider-billed tokenizer counts.

Baseline from the Phase 4 audit: approximately **19,640 tokens** before user
text or conversation history (8,545 system-prompt tokens plus 11,095 Tool
Search schema tokens).

| Profile | Tools loaded | Prompt estimate | Tool schemas | Estimated initial context | Reduction vs. baseline |
| --- | ---: | ---: | ---: | ---: | ---: |
| simple_chat | 1 | 6,196 | 454 | 6,650 | 66.1% |
| writing | 1 | 6,196 | 454 | 6,650 | 66.1% |
| research | 3 | 6,196 | 933 | 7,129 | 63.7% |
| agent_task | 2 | 6,319 | 1,615 | 7,934 | 59.6% |
| automation | 1 available | 6,196 | 454 | 6,650 | 66.1% |
| coding | 23 | 8,545 | 10,470 | 19,015 | 3.2% |

The existing coding toolset remains intentionally broad, so its small reduction
is an honest result rather than a reason to remove coding capabilities. Reaching
an 80% reduction for simple sessions still requires the separately audited
workspace/context-file budgeting work; this phase safely removes the dominant
unneeded tool surface first.

## Cache and safety guarantees

- Profile selection occurs before `AIAgent` loads tool schemas or builds the
  system prompt.
- Existing sessions never receive a different profile, toolset or prompt
  module mid-conversation.
- Existing configured providers, runtime profiles, fallback chains and toolset
  validation remain authoritative.
- Explicitly unavailable tools remain unavailable through the existing registry
  checks.

## Validation

- `tests/agent/test_capability_profiles.py`
- `tests/agent/test_adaptive_routing.py`
- `tests/agent/test_system_prompt.py`
- `tests/agent/test_turn_context.py`
- Gateway cache/turn tests and CLI single-query tests
- `git diff --check`
