# Jarvis Phase 2

Phase 2 extends `skills/productivity/jarvis-assistant` into a personal productivity assistant for email, calendar, tasks, reminders, day planning, and controlled automation.

## Implemented

- Email management defaults to triage and drafts.
- Calendar management defaults to proposals before writes.
- Task and reminder routing uses `skills.config.jarvis.task_source`.
- External writes require an approval batch.
- Repeatable workflows use existing Hermes `cronjob`, `kanban`, `memory`, and skill primitives.
- Missing integrations are reported as setup gaps, not treated as implemented.

## New Skill References

- `references/productivity-operations.md`
- `references/approval-policy.md`
- `references/workflow-automation.md`

## Suggested Settings

```yaml
skills:
  config:
    jarvis:
      task_source: kanban
      email_mode: drafts
      automation_review: approve
```

Keep Google, IMAP/SMTP, calendar, and task-provider credentials in the existing Hermes auth stores or `.env`. Do not store secrets in Git.

## Open Integrations

- Google Workspace OAuth for Gmail and Calendar.
- Optional IMAP/SMTP via `himalaya`.
- A durable task source, preferably Kanban for Phase 2.
- Optional external reminder or task MCP server if the user does not want Kanban.

## Usage

```text
/skill jarvis-assistant
Jarvis, triagiere meine Inbox und entwirf Antworten.
Jarvis, plane meinen Tag anhand von Kalender und Aufgaben.
Jarvis, mache daraus einen wöchentlichen Workflow, aber noch nicht aktivieren.
```

Jarvis should present proposed writes as approval batches before executing them.
