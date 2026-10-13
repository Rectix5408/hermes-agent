# JARVIS Voice – Workphase 1

## Status

**PASS (lokale Implementierung und automatisierte Validierung).** Es wurden
weder ein SSH-Zugang noch ein Deployment, ein Commit, ein Push oder ein echter
Modell-/ElevenLabs-Aufruf ausgeführt.

## Ausgangslage

Die angefragte Datei `docs/JARVIS_PHASE10B_VOICE_UX_REPORT.md` war im lokalen
Checkout nicht vorhanden. Der Code enthielt jedoch bereits die wesentlichen
Server-Bausteine:

- `HermesVoiceConversation` empfängt `message.delta` über die vorhandene
  Hermes-Gateway-WebSocket-Sitzung.
- `POST /api/audio/speak` spielte eine vollständige, erst nach Turn-Ende
  verfügbare Antwort ab.
- `/api/audio/speak-stream` existiert bereits als authentifizierte WebSocket-
  Route. Sie segmentiert eingehenden Text serverseitig satzweise und liefert
  PCM-Chunks mit `start`, `end` und bei nicht verfügbarer Synthese `fallback`.

Der Engpass lag im Browser: `processVoiceTranscript()` wartete zuerst auf
`executeVoiceCommand()` und rief danach ausschließlich die vollständige
Antwort über `speak()` auf.

## Umsetzung

- Neuer turngebundener Browser-Client `StreamingTtsPlayer` für die vorhandene
  Route `/api/audio/speak-stream`. Er verwendet den bestehenden authentifizierten
  WebSocket-URL-Builder und führt keine neue Voice-Plattform ein.
- Gateway-Textdeltas werden während der laufenden Konversation an diesen Client
  weitergereicht. Der Server übernimmt die satzweise Segmentierung; der Browser
  reiht eintreffende PCM-Audioquellen deterministisch in Empfangsreihenfolge ein.
- Ein Abbruch (Barge-in, Profilwechsel oder Unmount) sendet maximal einen
  `stop`-Frame, schließt den Socket und beendet alle geplanten Audioquellen.
- Fehler vor der ersten PCM-Ausgabe oder ein explizites Server-`fallback`
  verwenden weiterhin den bewährten REST-Weg. Nach bereits gestarteter Audio-
  Ausgabe erfolgt keine automatische Wiederholung; dadurch entstehen keine
  doppelten Sprachantworten.
- Ein unterbrochener Gateway-Turn beendet den zugehörigen TTS-Stream ebenfalls.
- Ein 15-Sekunden-Verbindungs-Timeout verhindert, dass eine nicht geöffnete
  Streaming-Verbindung die Voice-Session dauerhaft blockiert.
- Bestehende profilgebundene ElevenLabs-/TTS-Konfiguration und
  Wiedergabegeschwindigkeit bleiben maßgeblich. Text-Chat, Genehmigungen und
  die vorhandene Mikrofon-/STT-Architektur wurden nicht ersetzt oder verändert.

## Geänderte Dateien

| Datei | Änderung |
| --- | --- |
| `web/src/pages/jarvis/voice-runtime/streaming-tts.ts` | Neuer, lokaler Client für geordnete PCM-Streamingwiedergabe |
| `web/src/pages/jarvis/voice-runtime/streaming-tts.test.ts` | Deltas, Reihenfolge, Abbruch und Fehler getestet |
| `web/src/pages/jarvis/voice-runtime/hermes-conversation.ts` | Reicht den ursprünglichen Delta-Text zusätzlich weiter |
| `web/src/pages/JarvisPage.tsx` | Verbindet Voice-Turn, Streaming-TTS, Fallback und Abbruch ohne Änderung des Text-Chats |
| `web/src/pages/JarvisPage.test.tsx` | Integrationsprüfung für Delta→Streaming→expliziten Fallback |

## Ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `scripts/run_tests.sh tests/hermes_cli/test_web_server_speak_stream.py` | PASS — 6 Tests |
| Zieltests `streaming-tts` + `JarvisPage` | PASS — 22 Tests |
| `npm test` im `web/`-Workspace | PASS — 487 Tests in 74 Dateien |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — 0 Fehler, 31 bestehende Warnungen außerhalb dieser Änderung |
| `npm run build` | PASS — Produktionsbundle erzeugt |
| `git diff --check` sowie No-Index-Checks für neue Dateien | PASS |

Die Testausgabe enthält bekannte jsdom-Hinweise zu `window.open` und Canvas sowie
eine Vite-Konfigurationswarnung. Sie verursachten keinen Testfehler. Der Build
meldet außerdem weiterhin den bereits bekannten großen Three.js-Chunk.

## Grenzen und nächste Prüfung

- Die Validierung verwendet isolierte Gateway-, WebSocket- und Audio-Mocks;
  keine produktive Sprache, kein echter Browser-Mikrofonzugriff und keine
  externe ElevenLabs-Anfrage wurden ausgelöst.
- Ein echter Staging-Test sollte einen normalen Voice-Turn, Barge-in während
  der ersten gesprochenen Antwort, einen abgerissenen Audio-WebSocket sowie
  den serverseitigen `fallback` mit der bestehenden Profilkonfiguration prüfen.
- Während der Arbeit standen nur etwa 927 MiB freier Speicher zur Verfügung.
  Der Produktionsbuild war erfolgreich; keine fremden oder ungetrackten Dateien
  wurden dafür gelöscht.
