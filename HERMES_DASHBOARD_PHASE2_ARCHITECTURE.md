# Hermes / Jarvis – Phase 2 Architektur: Premium Dashboard & Memory Universe

## Entscheidungsgrundlage

Diese Architekturprüfung baut auf
[HERMES_DASHBOARD_PHASE1_ANALYSIS.md](HERMES_DASHBOARD_PHASE1_ANALYSIS.md)
auf. Sie beschreibt die sichere Integration des bestehenden Hermes-Chats und
der bestehenden Memory-Daten in eine hochwertige Dashboard-Oberfläche. Es
wurden keine Produktionskomponenten, APIs oder Daten verändert.

## Verbindliche Architekturentscheidung

Das Dashboard erhält **keinen zweiten Chat- oder Agenten-Stack**:

```text
Browser Dashboard
  ├─ Premium Shell / Jarvis Workspaces
  ├─ Hermes ChatPage (xterm.js)
  │    └─ /api/pty → bestehendes hermes --tui
  └─ Memory Universe
       └─ bestehende, profilgebundene Hermes-Memory-/Learning-Graph-Daten
```

Der TUI-Prozess bleibt alleinige Quelle für Gesprächsverlauf, Streaming,
Slash-Commands, Tool-Ausführung und Sitzungszustand. Das Memory Universe ist
eine reine, interaktive Visualisierung bereits vorhandener Hermes-Daten.

## PTY/TUI-Integration

### Bestehender, nutzbarer Pfad

`ChatPage.tsx` verwendet bereits xterm.js mit `/api/pty`. Der Server startet
das gleiche `hermes --tui`, das auch der CLI-Chat verwendet. Das erfüllt die
Anforderung nach einer Browser-Terminal-Komponente, ohne einen zweiten
Composer, Stream oder Session-Speicher einzuführen.

| Anforderung | Bestehender Mechanismus | Entscheidung |
| --- | --- | --- |
| Eingabe/Ausgabe | Bidirektionaler PTY-WebSocket | Unverändert verwenden |
| Streaming | Rohe PTY-Bytes an xterm.js | Unverändert verwenden |
| Resize | Lokale `RESIZE`-Escape-Sequenz, serverseitig verarbeitet | Unverändert verwenden |
| Reconnect | Attach-Token, Ringpuffer und Wiederanbindung an dieselbe PTY | Bestehende Client-Logik weiterverwenden |
| Sitzungslebenszyklus | `PtySessionRegistry`, TTL 30 Minuten, begrenzte Session-Zahl | Keine parallele Registry anlegen |
| Mehrere Browser-Tabs | Token-Claim und Web Lock verhindern konkurrierende Attachments | Nicht umgehen |
| Wiederaufnahme | Profil- und Resume-ID sind Teil des PTY-Schlüssels | Profilgrenzen beibehalten |

### Sicherheitsgrenzen

Die WebSocket-Strecke prüft bereits Peer-, Host- und Origin-Grenzen. Im
authentifizierten Betrieb werden zeitlich begrenzte Tickets bzw. verifizierte
Sitzungsdaten verwendet; der legacy Session-Token ist dort absichtlich nicht
zulässig. Eine neue Dashboard-Oberfläche darf diese Prüfungen weder umgehen
noch Tokens in DOM, Logs oder lokalem Speicher duplizieren.

### Konsequenz für das visuelle Design

Die Premium-Hauptfläche kann `ChatPage` als zentrale Arbeitsfläche verlinken
oder in einem kompatiblen Shell-Bereich darstellen. Sie darf aber weder selbst
einen Chat-WebSocket öffnen noch einen eigenen Nachrichtenverlauf verwalten.
Status-/Intelligence-Panels bleiben ergänzende, lesende UI-Komponenten.

## Bestehende Memory- und Learning-Graph-Quellen

| Quelle | Bestehende Schnittstelle | Inhalt | Geeignet für |
| --- | --- | --- | --- |
| Provider-/Dateistatus | `GET /api/memory` | Aktiver Provider, Readiness, Größen der Built-in-Dateien | Memory Health und sichere Leerzustände |
| Lern-/Memory-Graph | `GET /api/learning/graph` | Gelernt genutzte Skills, Memory-Knoten, Kanten, Cluster und Statistiken | Visualisierungsbasis |
| Knotendetail | `GET /api/learning/node` | Aktueller Skill- oder Memory-Inhalt | Nur nach explizitem Klick und Berechtigungsprüfung |
| Profilgrenze | `?profile=` mit serverseitigem Scope | Isolierte Daten je Hermes-Profil | Muss in jeder Anzeige beibehalten werden |
| Laufende Ereignisse | Bestehender Jarvis-Runtime-Event-Bus | Lokale/UI-nahe Statusereignisse | Nichtautoritative visuelle Aktivierung |

`agent/learning_graph.py` erzeugt den heutigen Graphen aus Lern-Skills sowie
Chunks aus `MEMORY.md` und `USER.md`. Er liefert derzeit im vollständigen
Graph-Payload auch Memory-Ausschnitte. Diese Eigenschaft ist für eine
datensparsame, große Visualisierung nicht geeignet: die Canvas-Ansicht benötigt
für Nodes nur Metadaten, keine Memory-Inhalte.

## Memory Universe: Zielarchitektur

```text
Profile-spezifische Hermes Memory-/Skill-Quellen
                  │
                  ▼
       Metadata-only Graph Projection
       - opaque node id
       - category / type
       - relationship ids
       - timestamps / counters where authorised
                  │
                  ▼
  Jarvis Memory Universe (Canvas/WebGL/SVG decision)
       - level-of-detail clusters
       - client-side viewport / zoom
       - explicit node selection
       - accessible list/search alternative
                  │
                  ▼
    Explicit Detail Request (only when authorised)
```

### Skalierung und „tausende Knoten“

Der heutige Endpoint erstellt einen vollständigen Graphen synchron aus allen
relevanten Dateien. Das eignet sich für den aktuellen kleinen Lern-Graphen,
nicht für tausende dynamische Knoten. Ein skalierbares Universe benötigt vor
einer Visualisierungsimplementierung eine **metadata-only Projektion** mit:

- serverseitiger Begrenzung und cursorbasierter Weiterladung;
- Cluster-/Aggregatdaten für die Startansicht;
- Detailkanten erst bei Auswahl oder Zoomstufe;
- stabilen, opaken IDs statt Titel oder Memory-Text;
- einer expliziten Obergrenze für Knoten und Kanten pro Antwort.

Dies ist keine zweite Memory-Datenbank: Die Projektion liest weiterhin die
vorhandenen Hermes-Memory- und Skill-Quellen. Eine neue API dafür wäre eine
eng abgegrenzte Erweiterung des bestehenden Dashboard-Routers und muss separat
freigegeben, authentifiziert, profilgebunden und getestet werden.

### Datenschutz und Details

1. Die Übersicht zeigt standardmäßig keine privaten Memory-Titel, Bodies oder
   `USER.md`-Inhalte.
2. Detailabrufe erfolgen ausschließlich nach einer aktiven Nutzerhandlung.
3. Der Server prüft Profil, Authentifizierung und eine spätere
   Sichtbarkeits-/Freigaberegel vor der Ausgabe.
4. Suche läuft zunächst über freigegebene Metadaten; Volltextsuche über private
   Inhalte benötigt eine explizite Produkt- und Sicherheitsentscheidung.
5. Der Browser speichert keine Memory-Payloads dauerhaft.

## Visualisierungstechnik

Für die erste produktive Stufe wird eine progressive Darstellung empfohlen:

| Zoomstufe | Darstellung | Datenmenge |
| --- | --- | --- |
| Universe | Kategorien/Cluster und aggregierte Counts | Sehr klein |
| Region | Begrenzte Cluster-Nachbarschaft | Klein |
| Node | Verbundene Metadaten und Status | Begrenzt |
| Inspector | Autorisiertes Detail nach Klick | Einzelabfrage |

- **Canvas 2D** ist für viele Punkte und ruhige Pan/Zoom-Interaktion die
  bevorzugte Basis. SVG bleibt für kleine, zugängliche Detailnetze geeignet.
- Eine 3D-Optik kann über Parallaxe, Tiefenstaffelung, Unschärfe und
  Level-of-detail entstehen; eine schwere 3D-Engine ist nicht erforderlich.
- Kanten und Partikel werden nur im sichtbaren Ausschnitt animiert.
- `requestAnimationFrame`, Sichtbarkeitsprüfung und `prefers-reduced-motion`
  sind verpflichtend. Im reduzierten Bewegungsmodus bleibt eine statische,
  verständliche Graphansicht verfügbar.
- Jede Canvas-Interaktion benötigt eine gleichwertige tastaturbedienbare
  Listen-/Suchansicht mit Fokusindikatoren.

## Agentenereignisse und „Gedankenanimation“

Der Jarvis-Runtime-Event-Bus kann visuelle Akzente für bereits bekannte
Agenten-, Tool- oder Memory-Ereignisse auslösen. Das ist eine **Darstellung**,
keine neue Ereignisquelle und keine Behauptung über internes Modell-Denken.

- Ein vorhandenes `MEMORY_READ`-Ereignis kann einen bereits sichtbaren Knoten
  kurz hervorheben.
- Ein Agent-/Tool-Ereignis kann nur die zugehörige, sichtbare Kante animieren.
- Ohne echtes Runtime-Ereignis bleibt die Visualisierung ruhig; es werden keine
  „Live“-Aktivitäten simuliert.
- Das Event-System führt keine Polling- oder LLM-Aufrufe aus.

## Empfohlene Umsetzung in getrennten Schritten

1. **Designsystem und Shell:** Bestehende Jarvis-Tokens, Navigation, Header,
   Command-Bar-Optik und Statuspanels konsistent zur Referenz ausarbeiten.
2. **Chat-Layout:** Die existierende `ChatPage` visuell einordnen, ohne ihren
   PTY-, Auth- oder Session-Lebenszyklus zu verändern.
3. **Memory Health:** Bestehendes `GET /api/memory` mit sicheren, verständlichen
   Zuständen anzeigen.
4. **Kleiner Graph:** Den aktuellen Learning-Graph nur mit freigegebenen,
   metadatenbasierten Knoten in einer begrenzten Canvas-/SVG-Ansicht darstellen.
5. **Skalierbarer Universe-Endpoint:** Erst nach separater Freigabe einen
   paginierten, metadata-only Graph-Projektionsendpunkt ergänzen.
6. **Interaktion und Monitoring:** Suche, Inspector, Events und Agentenstatus
   an reale vorhandene Daten anbinden.

## Risiken, die vor Implementierung aufzulösen sind

| Risiko | Bewertung | Erforderliche Entscheidung |
| --- | --- | --- |
| Vollständiger Graph enthält Memory-Ausschnitte | Hoch | Metadata-only Projektion vor großer Visualisierung |
| Tausende Knoten im aktuellen Voll-Endpoint | Hoch | Cursor/Cluster/LOD statt Komplettdownload |
| „3D“ als schwere Client-Abhängigkeit | Mittel | Canvas-first; neue Dependency nur mit Leistungsnachweis |
| Echtzeitstatus ohne Backend-Eventstrom | Mittel | Vorhandene Ereignisse nutzen; keine Live-Simulation |
| Private Memory-Suche | Hoch | Sichtbarkeits- und Freigabemodell separat definieren |
| Änderungen am primären Chat | Hoch | Ausdrücklich ausgeschlossen; TUI bleibt führend |

## Nächster Freigabepunkt

Die visuelle Shell und ein begrenzter, metadata-basierter Memory-Graph können
ohne neue Agentenarchitektur umgesetzt werden. Für „tausende dynamisch geladene
Knoten“ sowie vollständige Memory-Suche ist eine explizite Freigabe für die
beschriebene, datensparsame Erweiterung des bestehenden Memory-Graph-Endpunkts
erforderlich. Vorher sollte keine private Memory-Payload in die neue Oberfläche
gelangen.
