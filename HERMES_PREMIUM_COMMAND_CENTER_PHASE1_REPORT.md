# HERMES / JARVIS — Premium Command Center

## A. Umgesetzter Umfang

Master Prompt 1 umgesetzt im vorhandenen Dashboard, ohne neue Anwendung,
Backend-Endpunkte, Dependencies oder produktive Bereitstellung.

- Kompakte Jarvis-Workspace-Navigation statt zweiter Sidebar. Globale Hermes-
  Navigation und alle sieben Jarvis-URLs bleiben erhalten.
- Funktionale Command Bar mit Profilanzeige und Tastaturbedienung. Enter
  übernimmt eine Aufgabe in die bestehende Konsole; es erfolgt dabei **kein**
  Modellaufruf, kein POST und keine automatische Ausführung.
- Großer SVG-Core mit Orbit-Ringen, Gehirnkontur, vier Workspace-Verbindungen
  und Zuständen aus aktuellen Benutzeraktionen bzw. dem API-Status.
- Rechte Informationsspalte für Modellkonfiguration, registrierte Agenten,
  gemeldete Aufgaben, Freigaben und Verfügbarkeit.
- Schnellzugriffe, kompakter Memory-Einstieg und aufklappbares Morgenbriefing.
- Bestehende Planen-/Ausführen-, Voice-, TTS- und Approval-Funktionen erhalten.
  Ergebnis und strukturierter Plan sind in der Konsole einsehbar.
- Ausführungsfehler korrigiert: Ein ausgewählter Spezialagent wird durch
  **Planen** nicht mehr ausgeführt. Planung nutzt die Orchestrierung;
  die Agentenauswahl gilt für **Ausführen**.

## B. Dateien

| Datei | Änderung |
| --- | --- |
| `web/src/pages/jarvis/JarvisShell.tsx` | Kompakte Navigation, profilgebundene Links, Fehlerzustand, Lazy Memory Workspace, Sichtbarkeitspause |
| `web/src/pages/jarvis/JarvisDashboard.tsx` | Command-Center-Layout statt vertikaler Visualisierungssammlung |
| `web/src/pages/jarvis/components/dashboard/CommandBar.tsx` | Neue, lokale Aufgabenübergabe ohne Ausführung |
| `web/src/pages/jarvis/components/dashboard/CommandConsole.tsx` | Vorhandene Orchestrierungs-UI extrahiert und verbessert |
| `web/src/pages/jarvis/components/dashboard/IntelligencePanel.tsx` | Neue, rein präsentierende Informationsspalte |
| `web/src/pages/jarvis/components/visual/JarvisCore.tsx` | Interaktiver, zustandsgebundener Core |
| `web/src/pages/jarvis/components/visual/HologramBrain.tsx` | SVG-Visualisierung mit instanzgebundenen Gradient-IDs |
| `web/src/pages/jarvis/styles/command-center.css` | Jarvis-Tokens, Layout, responsive Regeln, Motion-Regeln |
| `web/src/pages/JarvisPage.tsx` | Explizite Profilbindung, Request-Abbruch, Schutz gegen späte Antworten, sichere Planung |
| `web/src/lib/api-jarvis.ts` | Optionale AbortSignals; bestehende Audio-Clientmethoden aufgenommen |
| `web/src/lib/api.ts` | Memory-Request explizit bindbar; Audio-Methoden in vorhandenes Fachmodul verschoben |
| `web/src/pages/jarvis/runtime/event-types.ts` | Optionale Profilzuordnung für lokale Ereignisse |
| `web/src/pages/jarvis/runtime/event-store.ts` | UI liest nur Ereignisse des ausgewählten Profils |
| `web/src/pages/jarvis/components/RuntimeEventStream.tsx` | Keine automatische Demo-Einspeisung; Kennzeichnung als lokale Aktivität |
| `web/src/pages/jarvis/cinematic/live-runtime.ts` | Memory-Dateigrößen korrekt als Byte statt Dateianzahl |
| `web/src/pages/jarvis/cinematic/morning-briefing.ts` | Registrierte Agenten und gemeldete Aufgaben statt unbelegter Live-Zahlen |
| `web/src/pages/JarvisPage.test.tsx` | Neue Lifecycle-, Profil-, Fehler- und Planungstests |
| `web/src/pages/jarvis/command-center.test.tsx` | Neue Command-Bar-, Zustands- und Chat-Navigationstests |
| `web/src/lib/api-jarvis.test.ts` | Neue Transportvertrag-/Profil-/Abbruchtests |
| `web/src/pages/jarvis/runtime/event-store.test.tsx` | Neuer Test gegen profilfremde und ungebundene Ereignisse |
| `web/src/pages/jarvis/cinematic/live-runtime.test.ts` | Neuer Test der Memory-Maßeinheit |
| `scripts/qa_command_center.cjs` | Wiederholbare, isolierte Browserabnahme mit vorhandener Playwright-Installation |
| `docs/qa/command-center/` | Screenshots und aggregierte Browser-Messergebnisse |

## C. Wiederverwendung

Weiterverwendet werden App-/Profil-Shell, ProfileProvider, PageHeader, die
authentifizierte API-Fassade, Jarvis-Orchestrierung, DS-Buttons/Spinner,
Lucide-Icons, MorningBriefing, VisualControls und sämtliche spezialisierten
Jarvis-Workspaces. MemoryUniverse bleibt dieselbe bestehende Komponente.

`ChatPage.tsx`, PTY/WebSocket, Sessionverwaltung, Hermes-Core, Backend und
`apps/shared` wurden nicht geändert. Kein zusätzlicher Chat-Composer,
Chatverlauf, WebSocket-Client oder Memory-Speicher wurde eingeführt.

## D. Architektur, Daten und Sicherheit

Die Projektberichte Phase 1/2 wurden gegen den aktuellen Code geprüft.
Insbesondere existieren inzwischen die Phase-3-Memory-Universe-Endpunkte und
die Phase-4-WebGL-Ansicht; sie werden nicht nochmals aufgebaut.

Darstellung und Interaktion sind getrennt: Die Shell navigiert, die Command Bar
übernimmt nur einen Entwurf, JarvisPage führt bereits vorhandene API-Operationen
aus. Modellkataloge werden nicht als aktive Modellinstanzen bezeichnet.
Registrierte Agenten gelten nicht automatisch als laufend. CPU/RAM/Latenz bleiben
ausdrücklich nicht verfügbar bzw. nicht gemessen.

Profilwechsel setzen den lokalen Workspace zurück. Anfragen tragen das
erfasste Profil und AbortSignals. Alte Leseantworten werden ignoriert; späte
Ausführungsergebnisse dürfen weder TTS noch Folgeabrufe im neuen Profil starten.
Aufnahme und Wiedergabe werden beim Unmount gestoppt.

Der bestehende lokale Event Bus bleibt erhalten. Ungebundene Demo-Ereignisse
erscheinen nicht im profilgebundenen Runtime-Stream. Die alte, aus Statusdaten
abgeleitete Brain-Ansicht bleibt als ausdrücklich bezeichnete Visualisierungsdemo
zugänglich. Das ist **kein** autoritativer Backend-Eventstream.

Keine Inhalte werden neu persistiert. Die Browserabnahme verwendet ausschließlich
synthetische Antworten, einschließlich eines wirkungslosen Testtokens; alle
API- und PTY-Verbindungen werden im Test abgefangen.

## E. Ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | Bestanden |
| `npm run test` | 459 Tests in 70 Dateien bestanden |
| `npm run lint` | 0 Fehler; 30 bestehende Warnungen |
| `npm run build` | Produktionsbundle erzeugt |
| `scripts/run-in-hermes-env python scripts/check` | 11 Checks bestanden |
| `git diff --check` | Bestanden |
| Playwright, lokaler Vite-Server | Bestanden mit isolierten Testantworten |
| Playwright, gebautes Bundle über Vite Preview | Bestanden mit isolierten Testantworten |

Der Test gegen ungewollte Spezialagenten-Ausführung wurde zusätzlich mit dem
ursprünglichen Dispatch-Zweig ausgeführt: er schlug wie erwartet fehl. Nach
Wiederherstellung der Korrektur bestand er.

Browsergeprüft: sieben Workspaces, profilgebundene Navigation, Back/Forward,
Memory-Direktaufruf nach Refresh, Command-Übernahme ohne POST, Planen ohne Run-
Aufruf, bestehender xterm-Mount, Profil-/Entwurfswechsel, Permission-Denied,
Offline und Reduced Motion. Es wurden keine produktiven Aktionen ausgeführt.

Keine neue Backend-Implementierung: Die Python-Funktionstests wurden in dieser
UI-Phase nicht erneut ausgeführt. Frontend-Tests ersetzen keinen produktiven
Authentifizierungs-, Mikrofon-, STT-/TTS- oder Agenten-End-to-End-Test.

## F. Screenshots und Referenzvergleich

Vorhandene SOLL-Referenzen: `docs/design/HERMES_DASHBOARD_REFERENCE.png` und
`docs/design/HERMES_MEMORY_UNIVERSE_REFERENCE.png`. Keine dieser Dateien wird
als UI-Hintergrund verwendet.

- [Vorher: bestehende Shell, Offline-Test, 1280 × 720](docs/qa/command-center/command-before.png)
- [Nachher: Desktop, 1920 × 1080](docs/qa/command-center/command-1920.png)
- [1536 × 960](docs/qa/command-center/command-1536.png)
- [1440 × 900](docs/qa/command-center/command-1440.png)
- [1280 × 800](docs/qa/command-center/command-1280.png)
- [Tablet, 768 × 1024](docs/qa/command-center/command-768.png)
- [Smartphone, 390 × 844](docs/qa/command-center/command-390.png)
- [Orchestrierungskonsole](docs/qa/command-center/command-console.png)
- [Offline-Zustand](docs/qa/command-center/command-offline.png)
- [Browser-Metadaten](docs/qa/command-center/results.json)

Alle Aufnahmen stammen aus der laufenden Anwendung. Nachher-Aufnahmen zeigen
gekennzeichnete Testdaten, keine echten Benutzerinhalte. Vorher/Nachher haben
unterschiedliche Viewports und dienen dem strukturellen Vergleich, nicht einem
Pixel-Diff.

| Referenzprinzip | Umsetzung / verbleibende Abweichung |
| --- | --- |
| Eine globale Sidebar | Hermes-Sidebar bleibt; zweite Jarvis-Sidebar entfällt |
| Navy/Cyan, Glas und Tiefenstaffelung | Zentral definierte Tokens, kontrollierte Kanten und Schatten |
| Command Bar oben | Echter Entwurfstransfer und Voice-Navigation, kein neuer Chat |
| Großes holografisches Zentrum | Leichter, interaktiver SVG-Core; kein komplexes Memory-Universum auf der Startseite |
| Rechte Informationsspalte | 300 px auf breiten Displays; darunter responsives Raster |
| Mobile Bedienbarkeit | Scrollbare kompakte Workspace-Leiste; keine gemessene Seitenüberbreite |
| Dichte 3D-Cluster der Memory-Referenz | Bewusst nicht Teil dieses Prompts; bestehende Memory-Ansicht bleibt erhalten |

Keine Behauptung einer pixelidentischen Kopie: Globale Hermes-Themes, Navigation
und TUI behalten ihre eigenen Gestaltungskonventionen; es werden weder fiktive
Integrationen noch die Beispielpersonen/-zahlen der Referenz übernommen.

## G. Performance und Grenzen

Der finale lokale Preview-Durchlauf erreichte den sichtbaren Ready-Core nach 513 ms.
Das ist ein einzelner synthetischer Messpunkt, keine Server-Latenz, kein p95 und
kein Benchmark auf Benutzerhardware. Die wiederholbaren Messwerte stehen im
JSON neben den Screenshots.

Bei 1920, 1536, 1440, 1280, 768 und 390 px entsprach die Dokumentbreite jeweils
der Viewportbreite; auch der Workspace hatte keinen horizontalen Überlauf.
Keine unbehandelten JavaScript-Fehler im Abnahmelauf. Die absichtlich fehlenden
Testquellen lieferten erwartete 503-Antworten; der Permission-Test liefert 403.

Beim initialen Command-Center-Aufruf wurden keine Three- oder xterm-Vendorchunks
geladen. MemoryUniverse ist lazy. Der neue Core hat keinen Renderloop und keine
Polling-/KI-Abfragen. Animationen pausieren bei ausgeblendetem Dokument bzw.
Core außerhalb des Viewports; bei Reduced Motion wurden null laufende
Animationen gemessen.

Verbleibend:

- Der vorhandene Three-Vendorchunk liegt weiterhin über Vites 600-kB-Warnschwelle.
- CPU, RAM, GPU-Auslastung, reale API-Latenzen und produktive Voice-/Agentenläufe
  wurden nicht gemessen.
- Ein Client-Abbruch beendet nicht garantiert einen schon gestarteten
  serverseitigen Auftrag. Bestehende Backend-Freigaben bleiben maßgeblich.
- Der Plan-Endpunkt plant über die Orchestrierung, nicht ausschließlich über den
  in der UI gewählten Spezialagenten; diese Unterscheidung steht in der Konsole.
- Spezialisierte Workspaces behalten ältere, als lokale Vorschau/Demo
  gekennzeichnete Architekturmodule. Diese sind keine zusätzliche Live-Anbindung.

## H. Build und Start

Build-Ziel: `hermes_cli/web_dist/index.html` und zugehörige Assets.
Keine neue Dependency, keine Änderungen an Lockfiles.

Reproduzierbare Browserabnahme mit bereits installiertem Playwright:

```sh
# Terminal 1, im web/-Workspace, nach npm run build:
npm run preview -- --host 127.0.0.1 --port 5175

# Terminal 2, Repository-Root; NODE_PATH nur falls Playwright extern installiert:
NODE_PATH=<vorhandenes-playwright-node_modules> node scripts/qa_command_center.cjs http://127.0.0.1:5175 docs/qa/command-center
```

Der Test installiert nichts und verwendet keine produktiven Zugangsdaten.

## I. Upstream-Kompatibilität

Geprüfter Ausgangspunkt: `dbf52c2082` auf `main`; persönlicher Fork bleibt
`origin`, NousResearch bleibt `upstream`. Keine Remote-/Branch-Umschreibung.

Die meisten Änderungen liegen unter Jarvis. Merge-Berührungspunkte sind die
bereits vorhandene `JarvisPage.tsx` sowie optionale Signal-/Profilparameter und
die Audio-Methodenextraktion in der API-Fassade. Bestehende Aufrufer benötigen
keine Änderungen; URLs, Nutzdaten und Authentifizierung bleiben identisch.

Keine Änderungen an App-Routen, ChatPage, PTY, Backend, Providerauflösung,
Prompt-Caching oder Produktionskonfiguration. Kein Commit, Push oder
Produktionsneustart für diesen Auftrag.

## J. Übergabe an Master Prompt 2

Die neue Startseite verlinkt das bestehende `/jarvis/memory` profilgebunden.
Die schwere Szene wird erst dort geladen. Phase-3-API-Verträge und die bestehende
Memory-Implementierung sind unverändert. Für den nächsten Schritt stehen
Design-Tokens, kompakte Shell und Browserharness bereit; das komplexe
Memory-Universe-Design muss separat mit echten autorisierten Quellen oder
explizit isolierten Graph-Fixtures abgenommen werden.
