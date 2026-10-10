# Jarvis Phase 6A

Phase 6A focuses on wiring the existing Jarvis surfaces closer to real Hermes infrastructure while keeping external effects gated. This phase is not marked complete yet because several executable integrations still require adapter work.

## Implemented

- Persistent Jarvis approval queue under the active profile home: `jarvis/approvals.json`.
- `/api/jarvis/approvals` lists pending approvals and recent history with profile scoping.
- `/api/jarvis/approvals/{id}` records one-time `approve` or `deny` decisions and re-checks a stable action hash before accepting the decision.
- `/api/jarvis/status` includes pending approvals from the active profile.
- `/api/jarvis/settings` persists allowed Jarvis settings into `skills.config` in `config.yaml`.
- `/jarvis` can approve or deny queued external actions without executing them.
- `/jarvis` can persist the routing mode through the backend instead of changing only local React state.
- `/jarvis` uses existing dashboard audio endpoints for browser STT and TTS:
  - `POST /api/audio/transcribe`
  - `POST /api/audio/speak`
- Client API tests were added for settings, approvals, and audio endpoint wiring.
- Router unit coverage was added for persistent one-time approvals.

## Reused Hermes Components

- Dashboard auth and session-token middleware.
- Profile scoping through `_config_profile_scope`.
- Atomic config writes through `atomic_config_write`.
- Existing audio router for STT/TTS.
- Existing model inventory and cron visibility from earlier Jarvis dashboard work.

## Safety Boundaries

- Approving a queued item does not execute external actions yet.
- Publishing, sending, deleting, or modifying third-party data remains disabled.
- Approval entries are deduplicated by action hash while pending.
- Approval decisions are one-time use.
- No secrets are stored by Jarvis code.
- No cloud deployment or live account calls are performed by these routes.

## Still Open

- Jarvis orchestrator still uses deterministic local handlers instead of calling the Hermes turn loop/provider stack.
- Memory relevance retrieval is not yet wired into planner context.
- Approved actions do not yet dispatch to Gmail, Calendar, Meta/Instagram, or task adapters.
- Ollama probing is still limited to existing Hermes model inventory.
- Per-agent model selection is exposed as config fields but not fully surfaced in the dashboard.
- Workflow execution after approval needs adapter-specific parameter validation and audit records.

## Tests

Tests were added but intentionally not executed for this phase request:

- `tests/hermes_cli/test_jarvis_web_router.py`
- `web/src/lib/api.test.ts`
