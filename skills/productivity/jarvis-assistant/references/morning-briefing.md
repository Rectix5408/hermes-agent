# Jarvis Morning Briefing

Create a read-only German briefing for the configured day. Do not create calendar events, send mail, write memory, or schedule jobs during the briefing unless the user explicitly approves that exact action.

## Inputs

- Target day: `skills.config.jarvis.briefing_day`, default `today`.
- Timezone: `skills.config.jarvis.timezone`, default `Europe/Berlin`.
- Connectors: `google-workspace` for Gmail and Calendar; `himalaya` for email-only fallback.
- Optional tasks: existing `todo`, `kanban`, local project notes, or other user-approved sources.

## Procedure

### 1. Resolve date and coverage

State the exact local date and timezone. Define a half-open local day window from 00:00 to the next 00:00. Mention which sources will be checked and which are unavailable.

### 2. Check integrations

Load `google-workspace` when Gmail or Calendar is needed. If setup is missing, report that Google Workspace is not connected and include the setup action, but continue with available sources. If only email is configured through `himalaya`, use email-only coverage.

### 3. Calendar

List today's events, tentative events, all-day holds, conflicts, tight transitions, locations, and meeting-prep clues. Exclude declined or cancelled events unless they explain a conflict.

### 4. Mail

Search recent and urgent mail with bounded queries. Prioritize messages that affect today's meetings, deadlines, money, customers, blockers, travel, or waiting decisions. Do not include newsletters unless the user requested them.

### 5. Tasks and reminders

Use available Hermes task sources only when present in the active toolset, such as `todo` or `kanban`. If no task source is configured, state that task coverage is missing and suggest connecting or defining one.

### 6. Compose the brief

Use this order:

1. Kurzüberblick
2. Termine
3. Vorbereitung und Konflikte
4. Wichtige E-Mails und Fristen
5. Aufgaben und Erinnerungen
6. Fehlende Integrationen
7. Empfohlene nächste Schritte

Keep it concise. Show action proposals separately from completed checks.

## Missing Integration Messages

- Google Workspace missing: "Google Workspace ist noch nicht verbunden; Kalender und Gmail konnte ich nicht prüfen."
- Email-only mode: "Kalenderdaten fehlen; ich habe nur E-Mail-Quellen geprüft."
- No task source: "Aufgaben/Erinnerungen sind noch nicht angebunden."
- No delivery target: "Ich habe nichts automatisch verschickt; dieses Briefing bleibt in dieser Unterhaltung."

## Verification

- The briefing names the date, timezone, and checked sources.
- Every included item has a reason.
- Missing integrations are visible.
- No mutation happened without explicit approval.
