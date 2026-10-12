# Phase 9 – Native Conversational AI Agent

## Aktueller Nachtrag: Master Repair & Integration, Phasen 4–6

12. Oktober 2026. **Lokale funktionale Integration geprüft; keine vollständige
Produktionsfreigabe.** Dieser Nachtrag ersetzt die darunter archivierten
Umgebungsblocker, Testergebnisse und Deployment-Annahmen.

### Tatsächlicher Stand

Branch `feature/jarvis-native-voice`. Ausgangspunkt `fe93c553b6`.
Während der Bearbeitung wurde der geprüfte Arbeitsstand durch einen externen
Vorgang als `fedc2c42b1` committed; dieser Commit wurde hier nicht erzeugt oder
umgeschrieben. Keine Push-, Update-, Deployment- oder Neustartbefehle ausgeführt.

| Phase | Implementierter und überprüfter Umfang | Grenze |
| --- | --- | --- |
| 4 – Voice | Aufnahme/STT → bestehender authentifizierter JSON-RPC-Gateway → native Agentensitzung → Text-Streaming → konfigurierte TTS; begrenzter Handshake und Turn; Abbruch, Fehler und Idle-Reconnect | Providerantworten im Browser isoliert simuliert; keine echte ElevenLabs-/Whisper-Abnahme |
| 5 – Ausführung | Fachliche Sprache unverändert an Hermes statt kontextloser Keyword-Umleitung; native Tool-Start/-Ende-Metadaten; einmalige Freigabe mit Bestätigung, Ablehnung und Abbruch; keine automatische Wiederholung | Toolauswahl, Intent-Verständnis und mehrstufige Ausführung bleiben Aufgaben des vorhandenen Agents; tatsächliche externe Aktionen nicht getestet |
| 6 – Kontext | Dieselbe Sitzung über Folgeturns; explizites Barge-in per Mikrofonknopf; alte TTS-Finalisierung überschreibt neue Aufnahme nicht; kontrollierte Übergabe desselben gespeicherten Verlaufs an PTY nach `session.close` | Keine automatische bidirektionale Chat-/Voice-Synchronisation, kein Hot-Mic/Full-Duplex; Refresh eröffnet eine neue Voice-Sitzung, ältere Verläufe bleiben in Hermes |

Memory, Provider, Profile, Tool-Berechtigungen und Prompt-Caching bleiben bei der
bestehenden Hermes-Runtime. Keine zweite Datenbank, Chat-Engine, API oder neue
Dependency. TTS-Tempo wird weiterhin über Browser-`playbackRate` angewendet;
Stimme und ElevenLabs-Zugangsdaten stammen aus der Serverkonfiguration.
Abbruch ist keine Rücknahme bereits ausgeführter externer Aktionen.

### Reparaturen und Dateien

- `web/src/types/three.d.ts`: fehlende reale Three-API-Typen ergänzt
  (`Vector3.lengthSq`, `Mesh.rotation.y`, `InstancedMesh.count` und
  `computeBoundingSphere`). Keine `any`-Umgehung. Die frühere Vite-Typdiagnose
  verschwand nach sauberer Installation; Vite-Konfiguration unverändert.
- `MemoryUniverseScene.tsx`: vorhandene umfangreiche Nutzerfassung erhalten;
  imperative DOM-Stile über CSSStyleDeclaration-Methoden gesetzt, statt den
  Hook-Rückgabewert mit Property-Zuweisungen zu mutieren.
- `CinematicVoiceConsole.tsx`: bestehende Oberfläche in Hook, Reactor,
  Einstellungen und Protokoll aufgeteilt; Unterbrechen-/Chat-Übergabeknopf und
  begrenzte Werkzeugmetadaten. Tool-Ende wird nicht als Erfolg ausgegeben.
- `JarvisPage.tsx`, `shell-types.ts`: native Turns, Barge-in, Sitzungstransfer,
  profilgebundene Metadaten und getrennte Fehlerzustände.
- `voice-runtime/hermes-conversation.ts`: abbrechbarer Handshake, Idle-Reconnect,
  zustandsgebundene Tool-Ereignisse und bestätigte Freigabe des Session-Zugriffs
  vor PTY-Resume. Fremde IDs und dauerhafte Toolfreigaben werden nicht akzeptiert.
- `JarvisPage.test.tsx`, `hermes-conversation.test.mjs`: zusätzliche Lifecycle-,
  Fehler-, Tool-Metadaten-, Barge-in- und Handoff-Verträge.
- `hermes_cli/web_routers/jarvis.py`: POSIX-Lockimport nur bei Lock-Verwendung;
  bestehende Lock-/Approval-Semantik bleibt erhalten. Keine neue Windows-
  Lockimplementierung behauptet.
- `scripts/qa_native_voice.cjs`: wiederholbare isolierte Browserprüfung der
  tatsächlichen gebauten UI und des echten Frontend-JSON-RPC-Clients.
- `scripts/qa_command_center.cjs`: optional installierter Chrome statt fehlendem
  Playwright-Browser, begrenztes Warten und Diagnose beim Reduced-Motion-Test.
- Analyse und dieser Bericht unter `docs/JARVIS_PHASE9_*.md` aktualisiert.

### Entwicklungsumgebung

Ausgangsbelegung etwa 233 MiB frei. Ausschließlich regenerierbaren npm-Cache
bereinigt, zunächst etwa 1,1 GB; nach Installation nochmals 72 MB. Nach erneutem
ENOSPC bei der Index-Prüfung außerdem den nicht laufenden vollständigen
Chromium-1243-Downloadcache (359 MB) entfernt; per Browserdownload regenerierbar.
Der für die QA verwendete Headless-Shell-Cache bleibt erhalten. Keine
Benutzerdateien, Profile, Memory, Git-Historie oder Quellcodekopien gelöscht.
Abhängigkeiten aus unverändertem Lockfile mit
`npm ci --workspace web --include-workspace-root --ignore-scripts --no-audit --no-fund`
wiederhergestellt. Python-Umgebung durch den vorgesehenen PM-Test-Runner
bereitgestellt, nicht durch manuelles pip. Kein Lockfile geändert.

Erneutes ENOSPC während eines Screenshot-Laufs zeigt weiterhin knappen
Datenträgerplatz; vor der letzten Cachebereinigung rund 397 MiB frei. Weitere Entwicklung/Deployment
benötigt ausreichend freien Speicher. Kein dauerhafter Speicherplatzgewinn
durch bloßes Löschen wiederaufgebauter Caches versprochen.

### Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | Bestanden |
| `npm test` | 482 Tests, 73 Dateien bestanden |
| `npm run lint` | Bestanden: 0 Fehler, 31 Warnungen |
| `npm run build` | Bestanden; Three-Chunk weiterhin ca. 850 kB, über Warnschwelle |
| `node --experimental-strip-types --test web/src/pages/jarvis/voice-runtime/hermes-conversation.test.mjs` | 28/28 bestanden; zusätzlich zur Vitest-Suite |
| `scripts/run_tests.sh -j 2 …` | 97 unterschiedliche Backend-Tests in 14 Dateien bestanden; Wiederholungen nicht zusätzlich gezählt |
| `scripts/check --only health` über `scripts/run-in-hermes-env` | Bestanden, 0 blockierende Befunde |
| Vollständiges `scripts/check` über denselben Wrapper | Nicht grün: zwei Befunde ausschließlich in vorhandenen ungetrackten Dateien (siehe unten) |
| `scripts/check --staged` über denselben Wrapper | Nach Cachebereinigung alle 11 Prüfungen bestanden; ungetrackte Kopien ausdrücklich nicht Bestandteil des Index |
| `git diff --check` | Bestanden |
| `qa_native_voice.cjs`, gebautes Bundle, installierter Chrome | Bestanden: 2 Turns, 2 Audio-Uploads, genau 1 Session-Erzeugung; einmal erlaubt und einmal abgelehnt; keine unbehandelten JS-Fehler |
| `qa_command_center.cjs --chrome` | Teilprüfung: Navigation, responsive Ansichten, PTY-Mount, Profilwechsel und Fehlerzustände bis zur Schlussprüfung erreicht; Reduced-Motion-Prüfung fehlgeschlagen |
| Derselbe Harness mit vorhandenem Chromium Headless Shell 1243 | Vollständig bestanden: 7 Workspaces, 6 Viewports, 0 unbehandelte JS-Fehler, 0 laufende Animationen bei Reduced Motion |

Python-Dateien: `test_voice_turn_route`, `test_jarvis_web_router`,
`test_memory_universe_routes`, `test_approval_cancelled_on_reap`,
`test_session_control`, `test_resume_profile_scope`, `test_closed_session_turn_lease`,
`test_session_foreign`, `test_stream_interrupt_recovery_orphan`,
`test_resume_live_profile_scope`, `test_web_server_approvals_broadcast`,
`test_audio_router_scope`, `test_audio_playback_guard`, `test_chat_ws_lease_holder`.

Regression gegen `fe93c553b6` in isolierten temporären Dateien: Idle-Reconnect
verwendet dort fälschlich die alte Runtime-ID (Assertion fehlgeschlagen), der
Handshake-Abbruch beendet den Test nicht innerhalb von 2 Sekunden. Dieselben
beiden Tests bestehen gegen den aktuellen Code. Keine Rücksetzung des Worktrees.

Browser-Voice verwendet Browser-MediaRecorder mit ausdrücklich künstlichem
Mikrofon, synthetische STT-Antworten, einen stillen WAV für TTS und abgefangene
JSON-RPC-Frames. Geprüft wurden auch: keine Freigabe vor dem zweiten Klick,
keine Argumente/Rohresultate in der Toolanzeige, kein Upload abgebrochener
Aufnahme, alle Mikrofon-Tracks beendet, Resume-URL mit derselben gespeicherten
Session und anschließend vorhandener xterm-Mount. Kein echtes Provider-,
Memory-Retrieval- oder externes Tool-E2E als Erfolg deklariert.

### Verbleibende Abnahmehindernisse

1. Im installierten Chrome meldet der generelle Browserharness eine laufende `gradient-stroke`-
   Animation des Shared-Button-Pseudoelements, obwohl die berechneten
   Animation-Stile bei Reduced Motion bereits `none` sind. Wiederholt nach
   CSS-Wartezeit und Screenshot. Ursache nicht abschließend geklärt; Test
   nicht abgeschwächt. Ein versuchsweises Ausblenden des dekorativen Layers
   wurde mangels Wirkung zurückgenommen. Der anschließende Lauf mit vorhandenem
   Chromium Headless Shell 1243 besteht ohne diese Abweichung. Screenshots und
   `results.json`: lokales temporäres Verzeichnis
   `hermes-native-voice-repair-qa-chromium/`. Gemessen:
   Ready-Core nach 573 bzw. 424 ms (zwei lokale synthetische Messpunkte), kein Überlauf
   bei 1920/1536/1440/1280/768/390 px. Kein Produktions-Performancebenchmark.
2. `scripts/check` findet den alten `fcntl`-Import in
   `hermes_cli/web_routers copy/jarvis.py` sowie BOM-intolerantes Lesen in
   `scripts/apply_hermes_voice_phase5.py`. Vorhandene ungetrackte Kopien/Patcher
   wurden nicht gelöscht oder stillschweigend geändert. Die aktive Routerdatei
   ist korrigiert. Zehn der elf Prüfkategorien bestehen.
3. Keine reale Mikrofon-/ElevenLabs-/Whisper-/Cloud-Agenten-/Memory-Abnahme.
   Keine Bestätigung der Produktionskonfiguration oder Windows-Lockfunktionen.
4. Keine automatische Chat→Voice-Übernahme einer aktiven PTY-Sitzung. Eine
   bidirektionale Übernahme benötigt einen expliziten getesteten Ownership-
   Übergang; konkurrierende Session-Schreiber werden nicht eingeführt.

### Reproduktion und Deployment-Vorbereitung

```sh
# Repository-Root; lokal, keine Produktion:
npm run typecheck --workspace web
npm test --workspace web
npm run lint --workspace web
npm run build --workspace web
node --experimental-strip-types --test web/src/pages/jarvis/voice-runtime/hermes-conversation.test.mjs
npm run preview --workspace web -- --host 127.0.0.1 --port 5175
# Zweites Terminal, vorhandene Playwright-Installation verwenden:
NODE_PATH=<vorhandene-node_modules> node scripts/qa_native_voice.cjs http://127.0.0.1:5175
qa_output="$(mktemp -d)"
NODE_PATH=<vorhandene-node_modules> node scripts/qa_command_center.cjs http://127.0.0.1:5175 "$qa_output" --browser-executable=<vorhandene-chromium-headless-shell>
```

Vor Cloud-Deployment: offene Abnahmehindernisse klären, Zielinstallation,
Fork/Branch, freigegebenen Commit und tatsächlichen Dienstpfad verifizieren;
sauberen Worktree und Recovery-Möglichkeit bestätigen. Bestehenden Buildweg
nutzen, danach authentifizierte Voice-/Approval-/Resume-Liveabnahme.
Ein gezielter QA-/Dokumentationscommit folgt ausschließlich nach erfolgreicher
Prüfung des vorgesehenen Git-Index (`scripts/check --staged`); ungetrackte
Kopien und Patcher gehören nicht dazu. Dies ist keine Produktionsfreigabe.
**Kein Push, Deployment oder Server-Neustart.** Der externe Zwischencommit
bleibt erhalten. Die nachfolgenden alten `main`-/Service-Annahmen sind keine
aktuelle Deployment-Anweisung.

---

## Archiv: Stand vor dem Reparaturauftrag

12. Oktober 2026 · **Implementierung erweitert, Abnahme blockiert.**

## Ergebnis und Architektur

Ausgangspunkt ist der bereits vorhandene WIP-Commit
`fe93c553b61f233c27089c6a18780ea96a4bd8d2`.
Die frühere „Auftrag vorbereitet“-Antwort war dort für freie Gespräche bereits
ersetzt. In dieser Runde wurde auch die verbleibende Schlüsselwort-Umleitung
aus dem aktiven Voice-Pfad entfernt: Mail-, Status-, Tagesplan- und andere
fachliche Eingaben gehen unverändert an dieselbe native Hermes-Sitzung.
Nur eng erkannte Wiedergabegeschwindigkeitsbefehle bleiben lokal und LLM-frei.
Die manuelle Agenten-/Orchestrierungsoberfläche bleibt bestehen.

Es bleibt beim vorhandenen Ablauf: bewusst gestartete Browseraufnahme →
profilgebundene Hermes-STT-API → authentifizierter `/api/ws`-Client → native
Session/Agent/Memory/Tools → öffentliche Text-Deltas und finale Antwort →
vorhandene TTS-API und abbrechbare Browserwiedergabe.
Keine Provideränderung, neue API, Datenbank oder zusätzliche Routing-KI.
ElevenLabs Scribe und die Jarvis-Stimme werden nicht im Frontend erzwungen:
die tatsächliche Serverprofilkonfiguration entscheidet.

## Änderungen

| Datei | Änderung |
| --- | --- |
| `web/src/pages/JarvisPage.tsx` | Fachliche Spracheingaben an native Sitzung; getrennte Mikrofon-/STT-/Agentenfehler |
| `web/src/pages/JarvisPage.test.tsx` | Native Mail-/Status-/Briefing-Transporte sowie STT- und TTS-Fehlerfälle |
| `web/src/pages/jarvis/voice-runtime/hermes-conversation.ts` | Idle-Disconnect-Erkennung; abbrechbarer, zeitbegrenzter Verbindungsaufbau |
| `web/src/pages/jarvis/voice-runtime/hermes-conversation.test.mjs` | Drei zusätzliche Tests für Idle-Reconnect, Turn-Timeout und Abbruch während Handshake |
| `docs/JARVIS_PHASE9_ANALYSIS.md` | Ursachenanalyse und Architekturentscheidung |
| `docs/JARVIS_PHASE9_REPORT.md` | Dieser Ergebnis-/Blockerbericht |

Die umfangreiche lokale Änderung an `MemoryUniverseScene.tsx` stammt vom Nutzer
und wurde nicht bearbeitet. Vorhandene untracked Berichte und doppelte Dateien
wurden nicht gelöscht, gestaged oder committed.

## Tatsächlich getestete Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Node-Runtime-Suite (`node --experimental-strip-types --test web/src/pages/jarvis/voice-runtime/hermes-conversation.test.mjs`) | **25/25 bestanden**; isolierte Gateway-Fixtures, keine Provideraufrufe |
| `npm run check` in `web` | Fehlgeschlagen beim Typecheck, acht bereits vor diesen Änderungen vorhandene Fehler |
| `npm run typecheck` nach Änderungen | Dieselben acht Fehler, keine zusätzliche TypeScript-Diagnose |
| `npm test` separat | Startfehler: unvollständiges Paket `obug`, keine Vitest-Fälle ausgeführt |
| `npm run lint` separat | Startfehler: `@babel/types` fehlt |
| `npm run build` | Fehlgeschlagen: `rolldown/parseAst` fehlt |
| `git diff --check` | Bestanden |
| Python-Tests | In dieser Runde nicht ausgeführt; keine Backend-Datei geändert |
| Browser-/Live-Abnahme | Nicht ausgeführt, kein erfolgreicher Build und keine verifizierte Produktionsumgebung |

Die acht Typecheck-Fehler betreffen sechs Stellen in MemoryUniverseScene
(`Vector3.lengthSq`, drei fehlende `y`-Koordinaten, `InstancedMesh.count` und
`computeBoundingSphere`) sowie zwei Stellen in `vite.config.ts`
(`preset.rolldown.filter` optional und Plugin-Typ). Fachfremde Komponenten und
Nutzeränderungen wurden nicht zur Umgehung dieser Fehler geändert.

Die Node-Tests sichern u. a. zusammenhängende Turns, profilgebundene Requests,
fremde Sitzungsereignisse, explizite einmalige Freigaben/Ablehnung,
`request.cancel`, keine permanenten Grants, keine Doppelausführung,
Text-Streaming ohne Reasoning, Providerfehler, Abbruch, Handshake-Cleanup,
Wiederaufnahme der eigenen gespeicherten Sitzung und Turn-Timeout ab.
Dies ist kein Nachweis echter Memory-Retrievals oder externer Werkzeugausführung.
Die neuen React-Integrationstests sind geschrieben, aber noch nicht ausführbar.

## Sicherheit, Kosten und Grenzen

- Der Server bleibt für Werkzeuge, Freigaben, Memory, SOUL, Modellrouting und
  Iterations-/Kontextlimits maßgeblich. Keine Umschreibung laufender Prompts.
- Die PTY-Sitzung wird nicht übernommen. Nur die selbst erzeugte Voice-Sitzung
  wird weiterverwendet oder beim nächsten ausdrücklichen Turn resumed.
- Fehlgeschlagene Turns werden nicht automatisch wiederholt. Ein Idle-
  Disconnect verwirft nicht mehr erst die nächste Benutzereingabe.
- Initialisierung maximal 45 Sekunden, Agenten-Turn maximal 180 Sekunden;
  bei Turn-Abbruch erfolgt der vorhandene `session.interrupt`-Request.
- Die Sprachaufnahme ist kein unbemerkter Dauerstream. Kein Full-Duplex oder
  automatisches Barge-in; Ausgabe beginnt nach abgeschlossener Agentenantwort.
- Andere interaktive Serverfragen als Tool-Approval bleiben sicher abgelehnt.
- Keine neue Kostenmessung oder Einsparungszahl. Native Turns nutzen die
  bestehende Modellpolicy; die verwendbaren Tools hängen vom Serverprofil ab.

## Commit und Deployment

**Kein neuer Commit, kein Push, kein Deployment und kein Service-Neustart.**
Die vom Auftrag vorgeschaltete erfolgreiche Gesamtabnahme ist nicht erfüllt.
Die Voice-Seite und die dort konfigurierte Modell-/ElevenLabs-Kette sind noch
nicht live verifiziert; das Produktabnahmekriterium ist daher offen.

Aktuelle Blocker: nur etwa 246 MiB freier Speicher bei 100 % Belegung,
unvollständige Node-Abhängigkeiten und die oben genannten Ausgangs-Typfehler.
In dieser Runde wurde keine weitere große Installation versucht.
Erforderlich sind ausreichend freier Speicher, Wiederherstellung der lokalen
Abhängigkeiten aus den bestehenden Projektmanifesten/Locks und eine separate
Klärung der Memory-/Vite-Fehler. Danach vollständige Tests und Browserabnahme.

### Erst nach grüner Abnahme

Die folgenden Befehle wurden **nicht ausgeführt**. Sie sind eine manuelle
Vorlage; vor Neustart muss die systemweite Unit tatsächlich diesen Checkout
verwenden. Bei abweichendem Remote, lokalen Änderungen oder fehlgeschlagenen
Prüfungen stoppen, nicht resetten/stashen/erzwingen.

```sh
cd /home/administrator/.hermes/hermes-agent
git status --short
git remote get-url origin
git branch --show-current
systemctl cat hermes-dashboard.service
# Quelle muss Rectix5408/hermes-agent sein, Branch main, Worktree sauber.
# Nach expliziter Prüfung der obigen Voraussetzungen:
git pull --ff-only origin main
git rev-parse HEAD
# Hash mit dem nach erfolgreichem Push verifizierten GitHub-Hash vergleichen.
cd web
npm ci --workspace web
npm run check && npm run build
# Nur wenn alles erfolgreich und die systemweite Unit verifiziert ist:
sudo systemctl restart hermes-dashboard.service
systemctl is-active hermes-dashboard.service
```

Gateway-Neustart ist für diese Frontend-Änderungen nicht vorgesehen. Abschließend
authentifiziert `https://hermes.virus-event.de/jarvis/voice?profile=default`
öffnen und Aufnahme, Modellantwort, TTS, Folgefrage, Freigabe und Abbruch prüfen.
