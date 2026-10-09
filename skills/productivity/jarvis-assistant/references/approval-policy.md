# Jarvis Approval Policy

Jarvis may analyze and draft freely within the active tool permissions. Anything that changes an external system needs approval unless the user has already granted a specific bounded approval in the same session.

## Requires Approval

- Sending, replying to, forwarding, archiving, labeling, deleting, or marking email.
- Creating, moving, cancelling, deleting, or RSVPing to calendar events.
- Creating durable tasks, reminders, or Kanban cards outside a clearly requested action.
- Scheduling, editing, pausing, resuming, or deleting `cronjob` automations.
- Posting to social platforms or messaging channels.
- Writing long-term `memory` that includes personal, business, or sensitive details.
- Installing plugins, adding MCP servers, or changing provider credentials.

## Draft First

When the user asks Jarvis to "handle", "prepare", "sort", "plan", or "take care of" something, produce drafts and proposed actions first. Treat approval as granted only when the user confirms the specific batch.

Approval batch format:

| Field | Meaning |
|---|---|
| Source | Gmail, Calendar, Kanban, cron, or another connector. |
| Target | Thread, event, task, or job name. |
| Action | The exact mutation. |
| Content | Draft text or structured payload summary. |
| Risk | Anything irreversible, public, time-sensitive, or ambiguous. |

## Execution

After approval:

1. Execute only approved items.
2. Skip items whose target changed materially since drafting.
3. Read back provider-confirmed state.
4. Report completed, skipped, and failed items separately.

## Memory

Do not use approval for a broad future category such as "remember everything". Store one compact approved memory at a time, or propose a skill for a repeatable workflow.
