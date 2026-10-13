# JARVIS Voice – Final Deployment Preflight

## Status

**LOCAL PREFLIGHT PASS — PRODUCTION ROLLOUT BLOCKED.**

Die lokalen Voice-Arbeitsphasen 1–3 bilden einen konsistenten, getesteten
Frontend-Rollout. Eine Freigabe für den Cloud-Server wäre derzeit dennoch
verfrüht: Die installierte Serverrevision, die vorhandenen Audio-/Gateway-Routen,
die beiden Profile und ein echter Browser-Voice-Test wurden absichtlich nicht
remote geprüft. Es gab keinen SSH-Zugriff, kein Deployment, keinen Commit und
keinen Push.

Lokaler Ausgangscommit: `993232398ea29654797a9d751d35ea10c23215b7`
auf `feature/jarvis-native-voice`.

## Änderungsabgrenzung

### Voice-Rollout-Scope

| Datei | Phase | Zweck |
| --- | --- | --- |
| `web/src/pages/JarvisPage.tsx` | 1–2 | Bestehende Gateway-Voice-Session mit Streaming-TTS, Abbruch und bewusstem Fortlaufmodus verbinden |
| `web/src/pages/JarvisPage.test.tsx` | 1–3 | Streaming-, Session-, Profil-, Approval- und Tool-Lifecycle-Verträge |
| `web/src/pages/jarvis/voice-runtime/streaming-tts.ts` | 1 | Neuer Browser-Client für die vorhandene TTS-Streamingroute |
| `web/src/pages/jarvis/voice-runtime/streaming-tts.test.ts` | 1 | Reihenfolge, Fallback, Fehler und Abbruch |
| `web/src/pages/jarvis/voice-runtime/hermes-conversation.ts` | 1, 3 | Delta-Weitergabe über die vorhandene Gateway-Session |
| `web/src/pages/jarvis/components/cinematic/CinematicVoiceConsole.tsx` | 2–3 | Fortlaufmodus sowie sichere Tool-/Approval-Statusanzeige |
| `web/src/pages/jarvis/shell-types.ts` | 2 | Optionale Props für den Fortlaufmodus |
| `docs/JARVIS_VOICE_WORKPHASE*.md` | 1–3 | Lokale Nachweise und Grenzen |

Keine Python-Backend-, Gateway-, Prompt-, Toolset-, Profil-, OAuth-, Memory-
oder Providerdatei ist durch die drei Voice-Phasen geändert worden.

### Ausgeschlossen

Der Arbeitsbaum enthält zusätzlich ältere bzw. fremde ungetrackte VIRUS-,
Artist-Registry-, Prompt-, Memory- und Jarvis-Berichte/Skripte sowie Kopien
unter `hermes_cli/`. Sie gehören nicht zum Voice-Rollout und dürfen weder
committet noch übertragen noch gelöscht werden. Das `config/`-Verzeichnis
bleibt ebenfalls außerhalb des Scope.

## Konsistenz- und Sicherheitsprüfung

### Bestehende Runtime bleibt führend

- `HermesVoiceConversation` erstellt/resumiert eine Gateway-Session für das
  aktive Profil und reicht `voice_turn: true` ausschließlich an
  `prompt.submit` weiter.
- Der Server verarbeitet dies im vorhandenen TUI-Promptpfad und nutzt für
  diesen Turn die bestehende `auxiliary.voice_chat`-Route. Tools, Memory,
  Approval und die normale Session bleiben serverseitig maßgeblich.
- `StreamingTtsPlayer` nutzt nur die bestehende, authentifizierte
  `/api/audio/speak-stream`-Route. Bei explizitem Server-Fallback und nur vor
  erster PCM-Ausgabe verwendet er den vorhandenen REST-Pfad
  `/api/audio/speak`; es gibt keine neue TTS-, STT- oder Agentenplattform.
- Die UI startet weder `runJarvis` noch `runJarvisAgent` für Voice-Turns.

### Profile `default` und `jarvis-dev`

Lokal ist die Isolierung über den vorhandenen Profilvertrag nachvollzogen:

- `JarvisPage` remountet `ProfileWorkspace` über `key={boundProfile}`;
  laufende Aufnahme, TTS, Timer und Gateway-Session des alten Profils werden
  beim Wechsel beendet.
- Alle Voice-Gateway- und TTS-WebSocket-Aufrufe tragen das aktive Profil.
- Der vorhandene Server bindet beim Prompt-Turn und in der TTS-Synthese die
  anfragende Profilkonfiguration.
- Lokale Tests prüfen Profilwechsel, Abbruch alter Antworten und
  sessionspezifische Events. Sie verwenden synthetische Profile, nicht die
  Cloud-Profile `default` und `jarvis-dev`.

Die tatsächliche Existenz, Berechtigungstrennung und TTS-Konfiguration dieser
beiden Cloud-Profile bleibt deshalb ein verpflichtender Remote-Preflight.

### Abbruch, Freigaben und doppelte Ausführung

- Barge-in, Abbrechen, Profilwechsel und Unmount stoppen Aufnahme, TTS-Socket,
  Audioquellen und den aktiven Gateway-Turn; der Client sendet höchstens einen
  `session.interrupt` und wiederholt keinen Prompt.
- Eine Audio-Unterbrechung führt nicht zu einer automatischen REST-Wiederholung,
  nachdem bereits PCM ausgegeben wurde.
- Nur die vorhandene, serverinitiierte `VoiceApprovalCard` kann einmalig
  freigeben; gesprochene Bestätigungen, dauerhafte oder sessionweite Grants
  werden abgelehnt.
- Toolstatus enthält nur servergemeldeten Namen und Start/Ende. Argumente und
  Ergebnisse gelangen nicht in die Voice-Anzeige.
- Exactly-once für eine bereits serverseitig gestartete externe Aktion kann ein
  Browserclient nicht garantieren; der Server bleibt dafür autoritativ.

### Datenschutz und Bundle

Die Voice-Quellen enthalten keine `console`-Protokollierung und keine direkte
externe Netzverbindung. Ihre einzigen Netzseams sind der vorhandene
`GatewayClient`, `api.buildWsUrl('/api/audio/speak-stream', { profile })` und
der vorhandene REST-TTS-Client. Ein statischer Scan der relevanten Quellen und
des erzeugten Bundles fand keine literal zugewiesene API-Key-, Secret- oder
Passwortzeichenfolge. Das ist kein Ersatz für einen serverseitigen Secret- und
Log-Audit; bestehende Backend-Providerlogs wurden nicht verändert.

## Vorhandene Backend-Voraussetzungen

Diese unveränderten Dateien müssen auf dem Zielserver in einer kompatiblen
Revision vorhanden sein:

| Voraussetzung | Lokaler Nachweis |
| --- | --- |
| Authentifizierte TTS-WebSocket-Route | `hermes_cli/web_routers/audio.py` → `/api/audio/speak-stream` mit Auth- und Request-Policy-Prüfung |
| Profilgebundene TTS-Auflösung | dieselbe Route verwendet eine Profil-Konfigurationsscope bei Auflösung und Synthese |
| Voice-Turn-Markierung | `tui_gateway/methods_prompt.py` übernimmt `voice_turn` aus `prompt.submit` |
| Bestehende Voice-Modelroute | `tui_gateway/prompt_turn.py` setzt `_voice_turn_pending`; `agent/voice_turn_route.py` bindet und stellt die Route wieder her |
| Serverseitige Approvals und Interrupts | vorhandener Gateway-Request-/Session-Interrupt-Vertrag |

Fehlt auch nur eine dieser Voraussetzungen auf dem Cloud-Server, darf das neue
Bundle nicht ausgerollt werden. Besonders ein älterer Server ohne
`/api/audio/speak-stream` oder ohne `voice_turn` wäre inkompatibel.

## Tatsächlich ausgeführte lokale Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Voice-Frontend-Zieltests (`JarvisPage`, `streaming-tts`) | PASS — 24 Tests |
| Gateway-Voice-Vertrag | PASS — 28 Tests |
| Python Voice-Routing + Speak-Stream | PASS — 15 Tests |
| Gesamte Web-Suite | PASS — 489 Tests in 74 Dateien |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — 0 Fehler, 31 bereits vorhandene Warnungen |
| `npm run build` | PASS — `hermes_cli/web_dist/index.html` erzeugt |
| `git diff --check` einschließlich neuer Voice-Dateien | PASS |

Vitest gibt bekannte jsdom-Hinweise für `window.open` und Canvas aus; der Build
meldet den bestehenden großen Three.js-Chunk. Beides ist kein Testfehler und
nicht durch Voice verursacht.

## Prüfsummen des lokalen Review-Stands

Die folgenden Werte dienen nur der späteren Review eines exakt gleichen,
freigegebenen Arbeitsstands. Ein neuer Commit oder erneuter Build ändert sie.

```text
35ab4e3c5875e47984f29128ac5d1613ba437ec66bc47fb2dabe83efae05fc8e  JarvisPage.tsx
a7fca28c80213e6764a25c76b843ac3d5a440fd0b4b420e358babbc100a5a810  JarvisPage.test.tsx
ba31dd533b0fe2d312edfd4d1854d5084fb20d2839c8ece8c253eb4469dcaa95  CinematicVoiceConsole.tsx
12c154fa046152d5b1ccb008dbbcbf0446473b98e258daa0086500a9a01d4fa1  shell-types.ts
1ccbc3e5502a31f04cc8acd557c1e748ab721dad3f57f4f86d93bd1b44cfd329  hermes-conversation.ts
a6deb1ebde6abd006da47210b76f3a173412815f49c1a001a0512e14ef700eff  streaming-tts.ts
22e7429d1cab7a6ee80def57e86598b1269f8a04751d9780396fdc36a0676efe  streaming-tts.test.ts
6e820897e37bbcd7010ae9beec5f53606278f9845398a0e4c644c0383b56a3f6  web_dist/index.html
```

## Rollout-Runbook — erst nach ausdrücklicher Freigabe

Die konkrete Cloud-Repo-Position und der Dienstmanager wurden lokal nicht
ermittelt. Daher keine `systemctl`-Unit raten und keine ungetrackten lokalen
Dateien per Kopie übertragen. Der sichere Weg ist ein einzelner, separat
reviewter Commit, der **nur** die Dateien aus dem Voice-Rollout-Scope enthält.

1. Vor der Übertragung den Commit-Hash freigeben und auf dem Server dessen
   Arbeitsbaum prüfen: `git status --porcelain` muss leer sein.
2. Vor dem Build den tatsächlichen Zielstand ohne Inhalte auszugeben prüfen:

   ```sh
   cd "$(git rev-parse --show-toplevel)"
   git rev-parse HEAD
   rg -n '/api/audio/speak-stream|voice_turn' \
     hermes_cli/web_routers/audio.py tui_gateway/methods_prompt.py \
     tui_gateway/prompt_turn.py agent/voice_turn_route.py
   hermes dashboard --status
   hermes profile list
   ```

3. Nur wenn die vier Backend-Voraussetzungen und die Profile `default` sowie
   `jarvis-dev` bestätigt sind: den freigegebenen Commit aus dem vorgesehenen
   Fork beziehen, den Arbeitsbaum erneut auf Sauberkeit prüfen und im Checkout
   bauen:

   ```sh
   cd "$(git rev-parse --show-toplevel)/web"
   npm run build
   test -f ../hermes_cli/web_dist/index.html
   ```

4. Den bereits verwendeten Dashboard-Supervisor anhand von `hermes dashboard
   --status` identifizieren und ausschließlich nach dessen bestehendem
   Betriebsverfahren neu laden. Keinen zusätzlichen Service erzeugen und keine
   unbekannte Unit neu starten.
5. Nach dem Start nur mit einem autorisierten Testprofil prüfen: Status,
   Mikrofon erlauben/ablehnen, einen lesenden Voice-Turn, Streaming-TTS,
   Barge-in, Profilwechsel und eine approval-pflichtige Aktion bis zur Karte
   führen und ablehnen. Dabei keine externe Änderung freigeben.

## Rollback

Bei einem fehlenden Endpoint, einer Profilvermischung, einer nicht abbrechbaren
Wiedergabe oder einem unerwarteten Tool-Run: den Dashboardprozess über seinen
bereits verwendeten Supervisor zurück auf den vorherigen freigegebenen Commit
bringen, `web/` erneut bauen und den Dienst nach demselben Verfahren neu laden.
Keine Datenbank, OAuth-Konfiguration, Profile, Memory-Daten oder Providersecrets
werden durch diesen Rollout migriert oder zurückgesetzt.

## Verbindliche Deployment-Gates

1. Separater, sauberer und reviewter Voice-Commit vorhanden.
2. Tatsächliche Cloud-Revision enthält die aufgeführten Backend-Voraussetzungen.
3. `default` und `jarvis-dev` sind als getrennte Profile nachgewiesen.
4. Bestehender Dashboard-Supervisor und Rückweg zum vorherigen Commit sind
   bekannt.
5. Autorisierter Browser-/Mikrofon-/TTS-Live-Test mit einer abgelehnten
   Toolfreigabe ist erfolgreich.

Bis dahin bleibt der Produktionsstatus **BLOCKED**.
