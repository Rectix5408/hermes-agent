# Jarvis Phase 8 – Cinematic Intelligence UI Overhaul

## Änderungen

- Das bestehende Jarvis-Design-System wurde zu einer geschichteten Premium-Control-Shell erweitert:
  dunkle Glasflächen, reflektierende Layer, Cyan-Akzente, feine Scanlines, Tiefenschatten und
  bewegungsreduzierte Fallbacks.
- Die interne Navigation ist jetzt als KI-Betriebssystem gegliedert: **Command Center**,
  **Intelligence**, **Operations**, **Communication** und **System**. Alle vorhandenen
  Jarvis-URLs und die bestehende Navigation bleiben erhalten.
- Das Command Center stellt den Hologramm-Core stärker in den Mittelpunkt. Sein Status wird aus
  Hermes-Status, Voice-Aktivität und Runtime-Events abgeleitet; feste Demo-Anzahlen wurden entfernt.
- Voice erhält einen räumlicheren Reactor mit Status-spezifischen Radar-, Energie- und
  Pulsanimationen, einem holografischen Settings-Panel sowie weiterhin zugänglichen Fehlermeldungen.
- Runtime zeigt CPU, RAM, Model, Tokens, Latenz und aktive Tasks als einheitliche HUD-Metriken.
  CPU/RAM werden ehrlich als wartende Telemetrie bezeichnet, solange Hermes diese Werte nicht
  liefert; es werden keine fiktiven Systemwerte dargestellt.
- Agent Registry und Security Center nutzen konsistente Hover-Tiefe, Lichtkanten und
  Freigabe-indikatoren, ohne ihre vorhandene Logik zu verändern.

## Design- und Performance-Entscheidungen

- Die Motion basiert ausschließlich auf CSS/SVG und `requestAnimationFrame` der bereits
  vorhandenen Voice-Waveform. Es wurden keine Dependencies, Canvas-Schleifen oder API-Aufrufe ergänzt.
- `prefers-reduced-motion` deaktiviert alle neuen kontinuierlichen Animationen.
- Die Videos waren im bereitgestellten Pfad vorhanden, konnten aber in dieser Umgebung nicht
  frameweise geprüft werden, weil `ffmpeg`/`ffprobe` nicht installiert sind. Die Umsetzung leitet
  sich daher aus den benannten Designprinzipien ab, nicht aus kopierten Screens.

## Nicht verändert

- Keine Hermes-Core-Datei, Backend-API, globale Route, LLM-Integration oder Dependency geändert.
- Bestehende Voice-, Registry-, Approval- und Runtime-Funktionen bleiben unverändert angebunden.

## Verifikation

- `npm run typecheck` – erfolgreich
- `npm run lint` – erfolgreich; 29 bestehende projektweite Warnungen, keine neuen Fehler
- `npm run build` – erfolgreich
- `npm test` – erfolgreich: 63 Test-Dateien, 442 Tests
- `git diff --check` – erfolgreich
