# Jarvis Phase 3

Phase 3 adds an executable, skill-local multi-agent orchestration helper without changing Hermes core.

## Implemented Executable Pieces

- `scripts/jarvis_multi_agent.py plan`: detects intent, selects bounded specialist agents, and returns a structured plan.
- `scripts/jarvis_multi_agent.py orchestrate`: runs local safe draft/analyze handlers and consolidates results.
- `scripts/jarvis_multi_agent.py run-agent`: runs one specialist handler.

The helper is deterministic, dependency-free, and side-effect-free. It does not post, send email, mutate calendars, create cron jobs, or write memory. Model and cost preferences are exposed as planning metadata and profile config; Hermes keeps final provider routing.

## Specialist Agents

- Instagram: content ideas, caption drafts, hashtags, reels/stories drafts, content calendar, supplied-stat summary.
- Email: supplied-thread prioritization, reply drafts, follow-up detection.
- Research: research queries, supplied-source comparison, conflict markers, controlled handoff.
- Business: project plan, task coordination, decision brief, workflow proposals.

## Hermes Features Reused

- `delegate_task` for live specialist work when the local helper is not enough.
- `kanban` for durable multi-step tasks and review.
- `cronjob` for approved recurring workflows.
- `memory` for compact stable preferences only.
- Existing model/profile routing through `jarvis.orchestrator_model`, `jarvis.specialist_model`, and `jarvis.cost_tier`.
- Existing connector skills: `google-workspace`, `himalaya`, `email-inbox-triage`.
- Existing research tools: `web_search`, `web_extract`, `browser`.

## Integration Gaps

- Meta/Instagram API plugin or MCP server is still required for live account stats and publishing preparation.
- Gmail/IMAP credentials must be configured before live inbox reads.
- Live web research still uses Hermes tools; the helper only plans or compares supplied sources.
- Durable external task providers beyond Kanban need a plugin or MCP server.

## Phase 4 Preparation

Phase 4 should add UI surfaces for orchestration plans, approval batches, agent status, and mobile-friendly workflow review. The helper already emits structured JSON suitable for those surfaces.
