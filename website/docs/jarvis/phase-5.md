# Jarvis Phase 5

Phase 5 adds deterministic model-routing metadata, token budgets, local/cloud model visibility, and compact run persistence without changing the Hermes turn loop.

## Implemented

- `jarvis_multi_agent.py` now supports routing modes: `local_only`, `local_first`, `smart`, and `cloud`.
- Each planned task includes `routing_decision`, `token_budget`, `estimated_prompt_tokens`, and `model_route`.
- Plans include `model_policy`, `token_policy`, and `memory_policy`.
- Deterministic local handlers are preferred when enough data is already in the payload.
- `/api/jarvis/status` includes local/cloud model inventory from existing Hermes model options.
- `/api/jarvis/status` includes recent Jarvis run summaries.
- `/api/jarvis/runs` returns persisted Jarvis run summaries.
- `/jarvis` shows routing mode, token budgets, model inventory, token policy from the latest plan, and recent runs.

## Reused Hermes Components

- Provider/model inventory through existing model options.
- Local model support through existing llama.cpp/local runtime inventory.
- Dashboard auth and profile scoping.
- Existing cron routes for automation visibility.
- Existing Jarvis skill config.

## Safety and Cost Boundaries

- No model downloads.
- No live provider benchmark calls from Jarvis.
- No external write actions.
- Cloud fallback is metadata only and still requires configured Hermes provider routing.
- Persisted runs store summaries only: request excerpt, agent ids, policies, missing integrations, approvals, and external-action status.

## Not Implemented Yet

- Direct Ollama server probing beyond existing Hermes inventory.
- Per-agent model assignment writes from `/jarvis`.
- Real billing reconciliation for Jarvis-only runs.
- Persistent global approval queue.
- Memory relevance retrieval beyond policy metadata.
