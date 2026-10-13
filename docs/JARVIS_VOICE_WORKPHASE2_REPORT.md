# JARVIS Voice – Workphase 2

## Status

**PASS (lokale automatisierte Validierung).** Ein echter Mikrofon-,
Lautsprecher-, ElevenLabs- oder Gateway-Lauf wurde nicht durchgeführt und ist
als **LIVE UNVERIFIED** dokumentiert. Kein SSH, Deployment, Commit oder Push
wurde ausgeführt.

## Bestand vor dieser Phase

Die Phase-1-Implementierung war vorhanden und wurde beibehalten:

- eine profilgebundene `HermesVoiceConversation` mit Gateway-WebSocket und
  Kontext über mehrere explizite Sprachturns;
- freie Spracheingaben gehen als `voice_turn` direkt an Hermes, nicht an den
  Task-Planer oder eine Keyword-Ausführungslogik;
- serverseitige Satzsegmentierung und browserseitig geordnete PCM-Wiedergabe
  über `/api/audio/speak-stream`;
- vorhandene STT-Optionen, ElevenLabs-Serverprofil, Voice-Approval-Card,
  Geschwindigkeitsbefehle und maximal 20 flüchtige Voice-History-Einträge.

## Änderungen

### Bewusster Fortlaufmodus

Der Voice-Workspace hat nun einen ausdrücklich aktivierten, nicht persistenten
Fortlaufmodus. Nach einer vollständig beendeten Antwort öffnet er die nächste
Aufnahme derselben Hermes-Voice-Sitzung. Dadurch bleiben Folgefragen im
vorhandenen Sitzungs-/Memory-Kontext, ohne eine zweite Runtime oder ein neues
Transkript-Speicherformat einzuführen.

- Standard bleibt sicher: Das Mikrofon ist aus, bis der Nutzer zuhört oder den
  Fortlaufmodus ausdrücklich startet.
- Die Wiederaufnahme wartet auf das Ende der Stream- oder Fallback-Wiedergabe
  und zusätzlich 350 ms. Sie startet somit nicht während Jarvis noch spricht.
- `Abbrechen`, Profilwechsel und Unmount beenden Controller, Aufnahme,
  PCM-Stream, Audioelement und ausstehende Wiederaufnahme.
- Beim bewussten Barge-in wird die vorherige Wiedergabe abgebrochen, bevor die
  neue Aufnahme entsteht. Es gibt keinen parallelen Audio-Stream.
- Freigaben, Fehler und abgebrochene Turns lösen keine automatische Folgeaufnahme
  aus. Eine externe Aktion bleibt weiterhin der bestehenden Freigabelogik
  unterworfen.

Die bestehende `de-DE`-Browsererkennung, Hermes-STT-Auswahl, profilgebundene
Geschwindigkeitswerte (`0.75×` bis `1.25×`) sowie Befehle wie „Sprich langsamer"
oder „Sprich 20 Prozent langsamer" wurden unverändert wiederverwendet.

## Geänderte Dateien

| Datei | Änderung |
| --- | --- |
| `web/src/pages/JarvisPage.tsx` | Opt-in-Fortlaufmodus, sichere Wiederaufnahme und Aufräumen bei Abbruch/Profilevent |
| `web/src/pages/jarvis/shell-types.ts` | Optionale Workspace-Props für Fortlaufmodus |
| `web/src/pages/jarvis/components/cinematic/CinematicVoiceConsole.tsx` | Sichtbare Aktivierung/Beendigung und Mikrofonstatus-Hinweis |
| `web/src/pages/JarvisPage.test.tsx` | Gesprächsfortsetzung, Session-Wiederverwendung und Abbruch getestet |

## Tests

| Prüfung | Ergebnis |
| --- | --- |
| Voice-, Mikrofon-, Geschwindigkeit- und Streaming-Zieltests | PASS — 31 Tests in 4 Dateien |
| Python-Vertrag für `/api/audio/speak-stream` | PASS — 6 Tests |
| `npm test` im `web/`-Workspace | PASS — 488 Tests in 74 Dateien |
| TypeScript-Typecheck | PASS |
| `npm run lint` | PASS — 0 Fehler, 31 bestehende Warnungen außerhalb dieser Änderung |
| `npm run build` | PASS — Produktionsbundle erzeugt |
| `git diff --check` | PASS |

Die Testausgabe enthält bekannte jsdom-Hinweise zu `window.open` und Canvas
sowie eine Vite-Konfigurationswarnung. Sie verursachten keinen Testfehler.
Der Build meldet weiterhin den bekannten großen Three.js-Chunk.

## Sicherheit und Datenschutz

- Keine neue STT-/TTS-/LLM-Plattform, keine zusätzliche Browser-Persistenz für
  Gesprächsinhalte und keine neue Agentenarchitektur.
- Voice-History bleibt auf 20 sichtbare, flüchtige Einträge begrenzt;
  Profilwechsel erzeugt eine neue `ProfileWorkspace`-Instanz und schließt die
  alte Voice-Sitzung.
- Native Tool- und Approval-Nachrichten bleiben im Gateway-Flow. Ein beiläufiges
  gesprochenes „Ja" bestätigt nichts.
- Keine Transkript-, Zugangsdaten- oder Audioinhalte wurden geloggt.

## Offene Live-Prüfung und Phase 3

Der Browser kann Lautsprecher-Echos am physischen Mikrofon nicht zuverlässig
plattformübergreifend erkennen oder unterdrücken. Die Implementierung minimiert
das Risiko, indem sie erst nach vollständig beendeter Wiedergabe wieder aufnimmt;
für Lautsprecherbetrieb bleibt ein echter Test mit Headset und Lautsprecher
erforderlich. Der sichtbare Button **Abbrechen** ist der zuverlässige manuelle
Unterbrechungsweg.

Für Phase 3 sind vor allem reale, autorisierte Browserprüfungen nötig:

1. Mikrofonfreigabe, Ablehnung und Gerätewechsel auf HTTPS.
2. Zwei bis drei zusammenhängende deutsche Turns im Fortlaufmodus.
3. Barge-in während Streaming-TTS und ein abgerissener Audio-WebSocket.
4. Profilwechsel während Wiedergabe sowie eine approval-pflichtige Aktion.
