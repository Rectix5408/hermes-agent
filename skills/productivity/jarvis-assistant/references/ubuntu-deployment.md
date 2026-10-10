# Ubuntu Deployment Notes

Use this checklist when rolling Jarvis into an existing Hermes installation on an Ubuntu cloud server. The goal is to preserve configuration, credentials, memory, cron jobs, sessions, and user data.

## Safety Rules

- Do not overwrite an existing Hermes home without a verified backup.
- Do not commit `.env`, `auth.json`, tokens, database files, or memory data.
- Keep Jarvis changes in the checkout: skill files, docs, tests, and profile-safe config guidance.
- Apply user configuration through Hermes commands or reviewed config edits, not by replacing whole files.

## Preflight

1. Identify the active `HERMES_HOME`.
2. Stop or drain the gateway before updating files.
3. Create a backup with Hermes' backup command or an operator-approved filesystem snapshot.
4. Verify the backup contains at least `config.yaml`, `.env`, `auth.json`, `state.db`, `memories/`, and `cron/jobs.json` when those files exist.
5. Record the current git commit and Hermes version.

## Apply

1. Pull or copy the Jarvis-enabled checkout.
2. Run dependency activation through Hermes' existing PM workflow; do not use raw package installers.
3. Keep existing `config.yaml` and `.env` in place.
4. Enable the Jarvis skill for the desired profile if skills were disabled.
5. Configure non-secret Jarvis settings under `skills.config.jarvis`.
6. Restart the gateway only after configuration is reviewed.

## Suggested Profile Settings

```yaml
display:
  language: de
memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: ask
stt:
  enabled: true
  provider: local
  local:
    model: base
    language: de
tts:
  provider: edge
voice:
  voice_chat_mode: chained
  auto_tts: false
skills:
  auto_load: [jarvis-assistant]
  config:
    jarvis.language: de
    jarvis.timezone: Europe/Berlin
    jarvis.briefing_day: today
    jarvis.voice_enabled: false
    jarvis.memory_review: ask
    jarvis.task_source: kanban
    jarvis.email_mode: drafts
    jarvis.automation_review: approve
```

`skills.config` uses the literal dotted keys declared by the skill, not a nested `jarvis:` map. Add `jarvis-assistant` to `skills.auto_load` only in the intended profile; existing sessions retain their current prompt until a new session begins.

Only enable `voice_enabled` after STT/TTS has been verified. Accept the morning briefing blueprint through Hermes suggestions or create the cron job manually after a successful foreground briefing.

## Phase 2 Integrations

Configure only the integrations the user wants Jarvis to operate:

- Gmail and Calendar: run the `google-workspace` OAuth setup and store credentials in the profile's existing Hermes home.
- IMAP/SMTP-only email: configure `himalaya`; keep mailbox passwords in the system keyring or `.env`, never in Git.
- Durable tasks: use Kanban first, or configure an external task MCP/plugin and set `skills.config.jarvis.task_source`.
- Reminders and recurring routines: create `cronjob` entries only after a foreground dry run and explicit approval.

Default external-action stance:

- email mode: drafts first;
- calendar mode: proposal first;
- tasks/reminders: write only to the configured task source;
- automations: opt-in after review.

## Rollback

1. Stop or drain the gateway.
2. Restore the verified backup for the affected `HERMES_HOME`.
3. Return the checkout to the recorded commit.
4. Start the gateway and verify sessions, memory status, and cron list.
