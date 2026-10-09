# Jarvis Productivity Operations

Use this reference for email management, calendar help, tasks, reminders, and day planning. The default posture is read-only analysis plus drafts; external writes need approval.

## Integration Sources

- Gmail and Google Calendar: load `google-workspace`.
- IMAP/SMTP email only: load `himalaya`.
- Inbox triage and reply drafting: load `email-inbox-triage`.
- Meeting prep: load `meeting-action-items` when notes or transcripts are involved.
- Weekly or longer planning: load `weekly-review-planning`.
- Durable task work: use `kanban` when available.
- Session-only task work: use `todo` when durable task storage is unavailable.

If a connector is missing, report the missing integration and continue with available sources.

## Email Management

Default mode is `skills.config.jarvis.email_mode`, with `drafts` as the safe default.

1. Define scope: account, labels/folders, date window, unread/all, and action boundary.
2. Retrieve complete relevant threads, not only snippets.
3. Classify: urgent reply, reply, action without reply, waiting, reference, noise.
4. Draft replies in the user's style when enough sent-mail evidence is available.
5. Present a batch: recipient, thread, proposed action, draft summary, risk.
6. Send, archive, label, or delete only after approval.
7. Verify by reading back provider state.

Never send an email because the user asked to "handle" or "clean up" the inbox. That means triage and drafts unless they explicitly approve sending or archiving.

## Calendar Management

1. Read events in an explicit timezone and half-open window.
2. Detect conflicts, travel gaps, tentative holds, missing prep, and attendees needing follow-up.
3. Propose changes as a plan: create, move, cancel, RSVP, or add prep block.
4. Apply approved changes only through the connector skill.
5. Read back the event ID, time, attendees, and link.

Never create, move, cancel, or RSVP to calendar events without approval.

## Tasks and Reminders

Use `skills.config.jarvis.task_source`:

- `kanban`: durable multi-step tasks, workflows, delegated work, or cross-session reminders.
- `todo`: in-session planning and short-lived checklists.
- `external`: a user-provided connector or MCP server; name the integration before use.
- `none`: summarize missing task coverage and offer setup.

For reminders, distinguish:

- one-off personal reminder: task source first;
- recurring check: `cronjob` only after approval;
- multi-step deliverable: `kanban`;
- calendar time block: calendar proposal first.

## Day Planning

Build the plan in this order:

1. Fixed calendar commitments.
2. Hard deadlines from mail and tasks.
3. Preparation blocks before meetings.
4. Focus blocks for important work.
5. Short admin batch.
6. Buffer and recovery time.

Return a compact plan with "Jetzt", "Heute", "Warten", and "Optional". Do not write tasks, events, or reminders unless the user approves the exact changes.

## Verification

- Email actions are draft-first and approved before send/archive/delete.
- Calendar mutations are approved and read back.
- Task/reminder destination matches `jarvis.task_source`.
- Missing connectors are named without pretending coverage exists.
