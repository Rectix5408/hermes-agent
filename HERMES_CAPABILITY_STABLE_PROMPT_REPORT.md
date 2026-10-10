# Hermes Capability-Based Stable Prompt Modularization — Phase 9

Date: 2026-10-10

## Delivered

- Added `agent/prompt_manifest.py` with immutable `StablePromptManifest`:
  `core_always`, `capability_modules`, and `execution_modules`.
- A manifest is frozen after existing tool/memory/config initialization and
  before the first system-prompt build. It is created only for sessions that
  already have a Phase-5 capability profile.
- Unprofiled callers retain the legacy prompt assembly path.
- `system_prompt.py` keeps the existing stable/context/volatile result shape
  and uses the manifest only to select existing stable guidance blocks.
- No prompt content is persisted. Capability metadata now includes
  `prompt_manifest_modules`, `estimated_stable_tokens_before`, and
  `estimated_stable_tokens_after`.

## Module mapping

| Profile | Stable capabilities | Execution modules |
| --- | --- | --- |
| `simple_chat` / `writing` | core only | none |
| `coding` | coding, memory | parallel, steering, tool use, model execution |
| `research` | research, memory | parallel, steering, tool use, model execution |
| `agent_task` | agent, memory, delegation | parallel, steering, tool use, model execution |
| `automation` | automation, memory | parallel, steering, tool use, model execution |

The core always retains identity/SOUL precedence, Hermes help, and completion
or anti-fabrication behavior. Existing tool/model/store gates remain in force
inside each selected module.

## Token impact

The measurement baseline is the audited 3,263-token stable tier. Each profile
records that baseline and Hermes' rough estimate of its actually rendered
stable string. The expected built-in prose targets are:

| Profile | Prior stable baseline | Expected selected stable range |
| --- | ---: | ---: |
| Simple chat / writing | 3,263 | 600–1,000 |
| Research | 3,263 | 1,000–1,500 |
| Coding | 3,263 | 1,500–2,000 |
| Agent / automation | 3,263 | 1,500–2,000 |

SOUL.md and explicitly auto-loaded skill content remain valid session-owned
content and are measured rather than silently removed.

## Cache and session safety

- Manifest selection happens before the first prompt exists.
- A manifest is immutable for its agent lifetime; compression reuses it.
- Resumed conversations and cached gateway agents do not select a replacement
  profile or manifest and retain persisted prompt bytes.
- No global routing, provider, model-policy, tool-schema, or live-session
  mutation was introduced.

## Validation

- Added `tests/agent/test_prompt_manifest.py` for simple, coding, agent task,
  frozen-manifest, resume-selection, and metadata contracts.
- Extended capability-profile tests for the new module mappings.
- Ran focused prompt, restore, cache-parity, context-budget, gateway, and
  agent initialization coverage: 418 tests passed.
- `python scripts/check --only health` passed.

## Remaining risk

The stable tier has been modularized and selected, not semantically shortened.
Further reduction of execution prose requires model-family behavior evaluation
to protect tool use, verification, and external-write safety.
