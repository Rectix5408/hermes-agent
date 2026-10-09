# Jarvis Workflow Automation

Use existing Hermes primitives before adding new code. Automation should be visible, reversible, and cheap to run.

## Primitive Choice

| Need | Primitive |
|---|---|
| Run something on a schedule | `cronjob` |
| Durable multi-step task with history | `kanban` |
| Short parallel subtask inside one turn | `delegate_task` |
| Stable preference or small fact | `memory` |
| Repeatable procedure | `skill_manage` skill |
| External app capability | plugin, MCP server, or existing connector skill |

## Automation Ladder

1. Run the workflow manually once.
2. Capture missing integrations and permissions.
3. Create drafts/proposals instead of writes.
4. Ask for approval to persist the workflow.
5. Use `cronjob` for timing, with read-only defaults and explicit delivery.
6. Use `kanban` when work needs review, retries, or multiple agents.
7. Promote stable successful steps into a skill.

## Cron Rules

- No cron job is created without explicit approval.
- The prompt must name allowed data sources and mutation boundaries.
- Prefer read-only recurring checks that produce suggested actions.
- Use per-job model pins only when the user asks; otherwise follow existing Hermes routing.
- For noisy checks, deliver only on material change or needs-attention items.

## Kanban Rules

- Use a named board or task source when configured.
- Keep task cards outcome-focused.
- Store private client or account boundaries in task body only when the user approves.
- Prefer comments for handoffs and blockers over long memories.

## Token Discipline

- Keep recurring prompts short and procedural.
- Reference skills instead of pasting long instructions into cron prompts.
- Save durable preferences in `memory`, not in every automation prompt.
- Keep connector failures in the run summary, not in long-term memory.

## Verification

- Manual run succeeded before scheduling.
- Approval and rollback path are clear.
- Recurring prompt is read-only unless explicitly approved.
- Workflow state lives in cron, Kanban, memory, or a skill, not hidden in chat history.
