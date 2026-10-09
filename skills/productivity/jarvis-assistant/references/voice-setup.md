# Jarvis Voice Setup

Jarvis voice mode reuses Hermes STT/TTS. Voice is optional and must not activate paid APIs unless the user explicitly configures them.

## Preferred Defaults

Use these preferences when configuring a Jarvis profile:

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
  submit_mode: direct
```

If local STT is not available, explain the missing dependency and offer free or already-configured alternatives. Do not switch to OpenAI, ElevenLabs, or another paid provider just because a key exists.

## Conversation Rules

- Voice answers should be shorter than text answers.
- For long briefings, speak a concise summary and offer the full text.
- If speech recognition is uncertain, confirm the interpreted command before high-impact actions.
- Keep barge-in enabled when supported so the user can interrupt.

## Verification

- STT provider is local or explicitly approved.
- TTS provider is free/local or explicitly approved.
- Language is German.
- Voice mode is reversible with normal Hermes settings.
