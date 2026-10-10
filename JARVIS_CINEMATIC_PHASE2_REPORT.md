# Jarvis Cinematic UI – Phase 2

## Erweiterungen

- Voice Intelligence Console mit Zuständen `IDLE`, `LISTENING`, `THINKING`
  und `SPEAKING`.
- Kreisförmiger Hologramm-Audio-Ring, CSS-Frequenzbalken und Canvas-
  Waveform; Canvas zeichnet nur während einer aktiven Mikrofonvorschau.
- Browser-Berechtigungsstatus, lokales Reconnect-Intent und explizite
  Nutzeraktion für `getUserMedia`. Browser lassen Mikrofonzugriff nach einem
  Refresh nicht ohne Geste wieder zu.
- Versionierte lokale Voice-Settings unter
  `jarvis.cinematic.voice-settings.v2`: Whisper-/ElevenLabs-Seams, Sprache,
  Stimme und Geschwindigkeit (0.75–1.25).
- Permanente HUD-Leisten, Live-Core-Karten sowie ein erweitertes Agentenraster.

## Neue Dateien

- `web/src/pages/jarvis/cinematic/voice-settings.ts`
- `web/src/pages/jarvis/components/cinematic/AudioHologram.tsx`
- `web/src/pages/jarvis/components/cinematic/CinematicHud.tsx`
- `web/src/pages/jarvis/components/cinematic/LiveSystemCore.tsx`
- `web/src/pages/jarvis/components/cinematic/AgentCommandRoster.tsx`
- `JARVIS_CINEMATIC_PHASE2_REPORT.md`

## Geänderte Dateien

- `web/src/pages/jarvis/components/cinematic/CinematicVoiceConsole.tsx`
- `web/src/pages/jarvis/JarvisDashboard.tsx`
- `web/src/pages/jarvis/jarvis-cinematic.css`

## API-Erweiterungen

Keine. `VoiceSettingsTransport` ist als optionaler zukünftiger
Persistenzvertrag deklariert, wird aber nicht aufgerufen. Es gibt keine neuen
Backend-Requests, Provider oder LLM-Aufrufe.

## Performance

- Keine zusätzliche Bibliothek oder 3D-Engine.
- Audio-Canvas nutzt `requestAnimationFrame` ausschließlich bei aktivem Stream.
- Der Live-Core aktualisiert seine rein lokale Zeitmarke alle 15 Sekunden.
- `prefers-reduced-motion` bleibt für kontinuierliche Cinema-Animationen aktiv.

## Tests

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test`
