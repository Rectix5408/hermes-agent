# Jarvis Cinematic UI Upgrade

## Komponentenplan

`/jarvis` bleibt die bestehende, funktionsfähige Jarvis-Oberfläche. Die neue
Cinematic-Schicht legt eine lokale Bereichsnavigation über dieselben Module:

```
Visual Core → Brain → Memory → Agents → Voice → Tasks → Runtime → Intelligence → Security → Context
```

Globale Hermes-Routen wie `/models` und `/settings` wurden bewusst nicht
überschrieben. Die gleichnamigen Jarvis-Navigationseinträge springen zu den
jeweiligen Jarvis-internen Bereichen.

## Geänderte und neue Dateien

- `web/src/pages/jarvis/JarvisDashboard.tsx` – additive Cinematic-Einbindung.
- `web/src/pages/jarvis/jarvis-cinematic.css` – Glass-, Scanline-, Radar- und
  reduzierte Bewegungsstile.
- `web/src/pages/jarvis/components/cinematic/CinematicNavigation.tsx` –
  interne Navigation.
- `web/src/pages/jarvis/components/cinematic/CinematicVoiceConsole.tsx` –
  Browser-Mikrofonvorschau und lokale Voice-Einstellungen.
- `web/src/pages/jarvis/components/cinematic/SystemPulseCards.tsx` – lokale
  System-Metriken.
- `web/src/pages/jarvis/components/cinematic/CinematicAgentCards.tsx` –
  kompakte Agentenkarten.

## Voice und Einstellungen

Die Mikrofonvorschau nutzt `getUserMedia` und einen lokalen Web-Audio-Analyser
für das Canvas-Waveform. Audio wird nicht übertragen oder gespeichert. Voice-
Auswahl und Geschwindigkeit werden ausschließlich im Browser unter
`jarvis.cinematic.voice-preferences.v1` persistiert. Whisper und ElevenLabs
sind ausschließlich vorbereitete UI-Optionen.

## Performance

- Keine neuen Abhängigkeiten oder 3D-Engine.
- Animationen sind CSS/SVG-basiert; Canvas zeichnet nur bei aktivem Mikrofon.
- `prefers-reduced-motion` deaktiviert kontinuierliche Radar- und Scanline-
  Animationen.

## Verifikation

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test`
