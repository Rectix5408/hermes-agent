# Hermes / Jarvis Dashboard – Phase 1 Analyse

## Auftrag und Grenzen

Diese Analyse bewertet das bestehende Dashboard gegen den Premium-Dashboard-
Master-Prompt und das bereitgestellte Referenzbild. Sie nimmt keine Änderungen
an React-Komponenten, Backend-Routern, APIs, Authentifizierung oder
Produktionskonfiguration vor.

Das Referenzbild definiert die gewünschte visuelle Richtung: dunkles Navy,
cyanfarbene Akzente, klare Drei-Spalten-Hierarchie, ruhige Glasflächen und eine
hochwertige Command-Bar. Es ist eine Designreferenz, keine Quelle für
Produktionsdaten oder Funktionsbehauptungen.

## Bestehende Frontend-Architektur

| Bereich | Bestehender Einstieg | Bewertung für den Ausbau |
| --- | --- | --- |
| Globale SPA und Routen | `web/src/App.tsx` | React Router, Lazy Loading und eine bestehende globale Navigation sind vorhanden. `/jarvis/*` ist bereits als isolierte Jarvis-Fläche registriert. |
| Hauptchat | `web/src/pages/ChatPage.tsx` | Bindet das echte Hermes-TUI über PTY/WebSocket ein. Dies ist die maßgebliche Chat- und Composer-Oberfläche. |
| Jarvis-Seite | `web/src/pages/JarvisPage.tsx` | Lädt Status und Memory, verwaltet Jarvis-Orchestrierung, Voice-Aufnahme, Transkription, TTS sowie Freigaben. |
| Jarvis-Shell | `web/src/pages/jarvis/JarvisShell.tsx` | Bestehende interne Workspaces für Dashboard, Voice, Agents, Memory, Runtime, Security und Settings. Deep Links werden innerhalb von `/jarvis/*` über den Pfad ausgewertet. |
| Cinematic Design | `web/src/pages/jarvis/jarvis-cinematic.css` | Bereits vorhandene Glasflächen, Cyan-Akzente, Radar-/Scanline-Animationen, reduzierte Bewegungen und responsive Regeln. |
| Jarvis-Komponenten | `web/src/pages/jarvis/components/` | Wiederverwendbare Visual-, Voice-, Agent-, Memory-, Runtime- und Security-Komponenten sind vorhanden. |

## Bestehende Jarvis-Navigation

Die aktuelle interne Navigation deckt diese URLs ab:

| URL | Aktueller Workspace |
| --- | --- |
| `/jarvis` | Command Center |
| `/jarvis/voice` | Voice Intelligence |
| `/jarvis/agents` | Agent Operations |
| `/jarvis/memory` | Memory Intelligence |
| `/jarvis/runtime` | Live Runtime |
| `/jarvis/security` | Security Center |
| `/jarvis/settings` | Settings |

Die URLs werden durch die bestehende Catch-all-Route `/jarvis/*` bedient. Für
den vorgesehenen visuellen Umbau ist keine Änderung globaler Hermes-Routen
erforderlich. Separate Route-Komponenten sind erst sinnvoll, wenn Ladegrenzen,
Fehlergrenzen oder unabhängige Datenabhängigkeiten das rechtfertigen.

## Reale Backend-Anbindungen

`JarvisPage.tsx` verwendet die bestehende, profilbewusste API-Schicht. Relevante
Funktionen sind bereits vorhanden:

- `GET /api/jarvis/status` für Verfügbarkeit, Agenten, Modelle und Freigaben.
- Jarvis-Orchestrierungs-Endpunkte für Planung, Ausführung und spezialisierte
  Agenten.
- Bestehende Audio-Endpunkte für Transkription und TTS.
- Bestehende Memory- und Einstellungszugriffe.

Der Router `hermes_cli/web_routers/jarvis.py` ist als authentifizierter,
profilgebundener Adapter umgesetzt. Die Designphase darf seine Daten lediglich
anzeigen; sie darf keine simulierten Werte als reale Telemetrie ausgeben und
keine zusätzliche API-Schicht schaffen.

## Wichtige technische Invarianten

1. **Kein zweiter React-Chat:** Der primäre Chat, Streaming, Slash Commands und
   Composer bleiben im eingebetteten TUI (`ChatPage.tsx`, PTY-WebSocket). Ein
   neues zentral platziertes Chat-Layout muss diese Oberfläche einbetten oder
   als Navigation dorthin führen.
2. **Keine globale Routenänderung:** Die Jarvis-Oberfläche bleibt unter
   `/jarvis/*`; die normalen Hermes-Seiten und die persistente Chat-Route
   bleiben unverändert.
3. **Echte Daten klar von Zuständen trennen:** Nicht konfigurierte Integrationen
   erhalten verständliche Empty States. CPU, RAM, Datenbank, Ollama oder
   Aufgaben dürfen nur angezeigt werden, wenn die vorhandenen Endpunkte sie
   liefern.
4. **Keine neuen KI-Aufrufe durch UI:** Visualisierung, Navigation, Animationen
   und Statusaufbereitung bleiben lokal bzw. verwenden nur vorhandene Runtime-
   Daten.
5. **Zugänglichkeit und Bewegung:** `prefers-reduced-motion` wird bereits
   berücksichtigt und muss bei neuen Animationen vollständig erhalten bleiben.

## Abgleich mit der Referenz

| Referenzprinzip | Bestehende Basis | Geplanter Ausbau ohne Funktionsbruch |
| --- | --- | --- |
| Dunkle Premium-Shell | Jarvis-CSS und Glass Panels vorhanden | Design-Tokens zentralisieren und bestehende Farbsprache konsistent anwenden. |
| Linke modulare Navigation | JarvisShell-Gruppen vorhanden | Informationshierarchie, aktive Zustände, Statuspunkte und kompakte Darstellung verfeinern. |
| Globale Command Bar | Globale Hermes-Kopfzeile und Jarvis-Header vorhanden | Nur an reale Navigation/TUI anbinden; keine zweite Command-Ausführung einführen. |
| Zentraler Chat | Reales TUI in `ChatPage.tsx` | TUI als maßgebliche Chatfläche verwenden, nicht nachimplementieren. |
| Rechte Intelligence-Spalte | Jarvis Status-, Agent-, Memory- und Security-Komponenten vorhanden | Datenabhängige Panels und hochwertige Empty/Loading/Error States konsolidieren. |
| Responsive Drei-Spalten-Layout | Responsive Shell-CSS vorhanden | Desktop/Tablet/Mobil anhand klarer Breakpoints prüfen und gezielt nachschärfen. |

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| React-Chat neben dem TUI | Doppelter Sitzungs- und Streamingzustand | TUI nicht nachbauen; bestehende `ChatPage` weiterverwenden. |
| Statische Telemetrie als Live-Daten | Irreführende Produktionsanzeige | Nur bereits verfügbare Felder zeigen, sonst neutralen Wartezustand. |
| Große visuelle Änderung in `App.tsx` | Regression globaler Hermes-Oberflächen | Jarvis-spezifische Komponenten und CSS zuerst innerhalb von `/jarvis` ändern. |
| Unkontrollierte Effekte | CPU-Last und Motion-Barrieren | CSS/SVG bevorzugen, Animationen begrenzen und Reduced Motion respektieren. |
| Design-Duplikation | Inkonsistente spätere Module | Gemeinsame Tokens und wenige wiederverwendbare Shell-/Status-Komponenten nutzen. |

## Empfohlene Folgephasen

1. **Designsystem:** Bestehende Jarvis-Tokens in eine dokumentierte,
   wiederverwendbare Token-Schicht überführen; keine globale Theme-Migration.
2. **Shell-Polish:** JarvisShell, HUD und Workspace-Header anhand der
   Referenzhierarchie verdichten.
3. **Chat-Integration:** Die reale TUI-Chatseite als visuelles Zentrum der
   Hermes-Hauptfläche behandeln, ohne ihren PTY- oder Session-Lebenszyklus zu
   ändern.
4. **Datengebundene Panels:** Vorhandene Jarvis-Komponenten konsolidieren,
   fehlende Daten als klare, nicht-technische Zustände zeigen.
5. **Responsive, Accessibility und Tests:** Bestehende Web-Tests erweitern und
   Layout-/Tastatur-/Reduced-Motion-Verhalten prüfen.

## Geplante Dateien für die nächste Phase

Noch nicht verändert. Voraussichtlich betroffen sind ausschließlich:

- `web/src/pages/jarvis/jarvis-cinematic.css`
- `web/src/pages/jarvis/JarvisShell.tsx`
- gezielt bestehende Komponenten unter `web/src/pages/jarvis/components/`
- `docs/HERMES_DASHBOARD_DESIGN_SYSTEM.md` als dauerhafte Designrichtlinie

`web/src/App.tsx`, `ChatPage.tsx`, `hermes_cli/web_routers/jarvis.py` und
globale Hermes-Routen bleiben außerhalb des ersten visuellen Änderungsumfangs,
sofern die Analyse keinen konkreten, getesteten Integrationsbedarf zeigt.
