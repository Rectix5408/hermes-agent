# Jarvis Phase 1

Jarvis Phase 1 is implemented as an update-friendly Hermes skill: `skills/productivity/jarvis-assistant`.

It adds:

- a German assistant persona,
- conservative long-term memory rules,
- optional German voice setup guidance,
- a read-only morning briefing workflow,
- a suggested morning briefing blueprint that does not schedule itself.

## Enable

Load the skill in a session:

```text
/skill jarvis-assistant
```

Then ask:

```text
Jarvis, erstelle mein Morgenbriefing für heute.
```

## Configure

Suggested non-secret profile settings:

```yaml
skills:
  config:
    jarvis:
      language: de
      timezone: Europe/Berlin
      briefing_day: today
      voice_enabled: false
      memory_review: ask
```

Keep secrets in `.env` or the existing Hermes auth stores. Do not put API keys into the repository.

## Voice

Voice remains optional. Prefer local STT and free/local TTS:

```yaml
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
```

## Morning Briefing

The bundled blueprint is only a suggestion. It becomes a real cron job only after the user accepts it through Hermes suggestions or creates a cron job manually.

The briefing is read-only by default: no email sends, calendar writes, memory writes, or new cron jobs without explicit approval.
