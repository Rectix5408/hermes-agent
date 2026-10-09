# Jarvis Phase 4

Phase 4 adds a dashboard surface for Jarvis on top of the existing Hermes web app. It keeps the real Hermes chat in `/chat` and adds `/jarvis` for orchestration, status, approvals, integrations, briefing state, and workflow review.

## Implemented UI

- `/jarvis` dashboard route with dark, responsive layout.
- Jarvis task composer for planning or running the Phase 3 orchestrator.
- Agent selection for Auto, Instagram, E-Mail, Recherche, and Business.
- Structured JSON result viewer.
- Approval and missing-integration panels based on actual orchestration output.
- Voice status panel based on configured STT/TTS provider fields.
- Morning-briefing status from the Jarvis skill and existing cron surface.
- Jarvis automation list filtered from existing Hermes cron jobs.

## Backend Endpoints

- `GET /api/jarvis/status`: returns Jarvis skill availability, orchestrator availability, registered agents, non-secret Jarvis config, integration status, voice config status, and Jarvis-related cron jobs.
- `GET /api/jarvis/approvals`: Phase 4 exposed approval status; Phase 6A replaces the placeholder with a persisted profile-scoped queue.
- `POST /api/jarvis/orchestrator/plan`: calls the Python orchestrator directly and returns a bounded plan.
- `POST /api/jarvis/orchestrator/run`: calls the Python orchestrator directly and returns consolidated safe local results.
- `POST /api/jarvis/orchestrator/agent/{agent_id}`: runs one safe local agent handler.

All endpoints are under `/api/` and use the existing dashboard authentication and profile scoping.

## Not Implemented Yet

- A separate persisted Jarvis approval queue.
- Live Instagram account calls through Meta Graph API.
- Live Gmail/Calendar reads inside the Jarvis page; existing connector skills and Hermes chat remain the execution path.
- In-page voice recording and playback controls; the page only reports configured provider status.
- Direct model assignment per Jarvis agent; Phase 4 exposes the configured route metadata and reuses existing model settings.

## Safety

- No shell endpoint is exposed.
- The orchestrator is loaded as a Python module.
- External writes remain proposals or `approval_required` records.
- No secrets are returned to the frontend.
- Missing integrations are displayed instead of simulated.
