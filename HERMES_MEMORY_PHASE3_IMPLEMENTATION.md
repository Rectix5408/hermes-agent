# Hermes Infinite Memory Universe – Phase 3 Implementierung

## Ergebnis

Phase 3 liefert ein produktives, metadata-only Graph-Backend auf Basis der
vorhandenen Hermes Learning-Graph- und Built-in-Memory-Strukturen. Es gibt
keine neue Datenbank, keine Migration, keine PTY-/TUI-Änderung und keine
LLM- oder Embedding-Aufrufe für Graph-Navigation.

## Geänderte Dateien

- `agent/memory_graph_projection.py` – redigierte, profilgebundene
  Projektion, Cursor-Pagination, Cache und explizites Memory-Detail-Lesen.
- `hermes_cli/web_routers/status.py` – read-only Memory-Universe-Endpunkte im
  bestehenden authentifizierten Dashboard-Router.
- `tests/agent/test_memory_graph_projection.py` – Projektions-, Redaction-,
  Cursor-, Leer- und 2.048-Node-Verträge.
- `tests/hermes_cli/test_memory_universe_routes.py` – API-Authentifizierung,
  Profiltrennung, Detailzugriff, Suche und Fehlerverträge.

## Datenmodell

Die Projektion leitet Nodes und Edges ausschließlich aus
`agent.learning_graph.build_learning_graph()` ab. Sie persistiert nichts.

### Node

```json
{
  "id": "mu_m_<opaque-digest>",
  "kind": "memory | skill",
  "label": "Memory | Skill-Kurzname",
  "category": "string",
  "profile": "string",
  "project": null,
  "timestamp": 0,
  "connection_count": 0,
  "visual": {
    "cluster_id": "mu_c_<opaque-digest>",
    "tier": "detail",
    "weight": 0
  }
}
```

Memory-Nodes haben absichtlich generische Labels wie `Memory memory` statt
der ersten Zeile aus `MEMORY.md` oder `USER.md`. Damit liefern Übersicht,
Suche, Cursor und Kanten keine privaten Memory-Ausschnitte. `project` bleibt
`null`, solange die vorhandenen Hermes-Memory-Quellen keine autoritative
Projektzuordnung enthalten.

### Edge

```json
{
  "source_id": "mu_*",
  "target_id": "mu_*",
  "relation": "related_skill | memory_skill_overlap",
  "weight": 1
}
```

Edges werden nur ausgegeben, wenn beide Endpunkte im selben,
profilgebundenen Projektionssatz sichtbar sind. Gewicht `1` beschreibt eine
vorhandene deterministische Beziehung, keine semantische LLM-Bewertung.

### Hierarchie

`root` repräsentiert das gesamte verfügbare Gedächtnis; darunter liegen
deterministische Kategorie-Cluster. Unterprojekte werden erst ergänzt, wenn
eine vorhandene Hermes-Datenquelle eine verlässliche Projektzuordnung liefert.
Die API erfindet keine Projektstruktur aus Memory-Texten.

## API-Verträge

Alle Endpunkte unterliegen der vorhandenen Dashboard-Authentifizierung und
akzeptieren den bestehenden Query-Parameter `profile`. Der Router führt jede
Abfrage unter dem angeforderten Hermes-Profil aus.

| Methode | Endpunkt | Zweck |
| --- | --- | --- |
| `GET` | `/api/memory/universe/clusters` | Root- und Kategorie-Cluster |
| `GET` | `/api/memory/universe/nodes` | Cursor-paginierte, redigierte Nodes |
| `GET` | `/api/memory/universe/search` | Suche in sicheren Labels/Kategorien, nie in Memory-Texten |
| `GET` | `/api/memory/universe/nodes/{node_id}` | Metadaten eines sichtbaren Nodes |
| `GET` | `/api/memory/universe/nodes/{node_id}/edges` | Cursor-paginierte Kanten eines Nodes |
| `GET` | `/api/memory/universe/nodes/{node_id}/content` | Explizites Detail-Lesen eines Built-in-Memory-Nodes |
| `GET` | `/api/memory/universe/stats` | Redigierte Mengen- und Cache-Metadaten |

### Pagination

- `nodes`: `cluster_id`, `kind` (`memory` oder `skill`), `query`, `limit`,
  `cursor`, `profile`
- `search`: `query`, optional `kind`, `limit`, `cursor`, `profile`
- `edges`: `limit`, `cursor`, `profile`
- `limit` ist auf **1–100** begrenzt.
- Cursor binden Filter und Sortierposition. Ein Cursor mit abweichenden Filtern
  wird mit `400` abgelehnt.
- Sortierung ist deterministisch; ein gelöschter Cursor-Node erzeugt keinen
  verwaisten Serverzustand, weil Cursor zustandslos sind.

Erfolgsantworten enthalten `profile`, eine Ergebnisliste, `next_cursor` und
`has_more`. Nicht sichtbare, fremde oder ungültige IDs ergeben dieselbe
generische `404`-Antwort und leaken keine Profilinformationen.

## Sicherheit und Datenschutz

- Die Übersicht und der Cache enthalten keine Memory-Bodies.
- Opaque IDs enthalten weder Memory-Titel noch Dateipfade.
- Die Detailroute liest genau einen Built-in-Memory-Eintrag erst nach einer
  aktiven Anfrage; sie nutzt dieselbe Authentifizierungs- und Profilgrenze wie
  die übrigen Dashboard-Routen.
- Der aktuelle Hermes-Dashboard-Auth-Mechanismus ist die Autorisierungsgrenze.
  Zusätzliche Rollen-/ACL-Regeln existieren in Hermes derzeit nicht und wurden
  nicht vorgetäuscht.
- Externe Memory-Provider werden nicht inventarisiert: ihre generische
  Provider-Schnittstelle garantiert keine sichere globale Listenoperation.

## Performance

- Cache: maximal acht Hermes-Profile, fünf Sekunden TTL, ausschließlich
  redigierte Metadaten.
- Paging: maximal 100 Nodes oder Edges pro Antwort.
- Der Backend-Graph wird ausschließlich aus den vorhandenen lokalen
  Memory-/Skill-Quellen abgeleitet; keine LLM-, Embedding- oder Provider-Calls
  werden beim Browsen ausgelöst.
- Der Cache wird nach Hermes-Home getrennt, damit Mehrprofil-Prozesse keine
  Daten vermischen.

### Synthetische Messung

Gemessen am 11. Oktober 2026 in dieser Entwicklungsumgebung:

```text
10.000 redigierte Nodes
100 Cursorseiten à 100 Nodes
0,2570 Sekunden Gesamtdauer
```

Die Messung konstruiert nur Metadaten im Speicher; sie ist kein Versprechen
für IO-, Netzwerk- oder externe Provider-Latenzen.

## Runtime-Ereignisse

Für Phase 4 gilt dieser kompakte, sichere Visualisierungsvertrag:

```text
agent.started
memory.retrieved
tool.executed
memory.stored
task.completed
task.failed
```

Jedes Ereignis darf nur `timestamp`, `profile`, eine genehmigte
`source_id`/`target_id`, Status und eine grobe Kategorie enthalten — nie
Prompts, Memory-Inhalte, Tool-Argumente, Secrets oder behauptete
Modellgedanken. Phase 3 legt keinen neuen Eventstrom an, da der vorhandene
Backend-Runtime-Pfad keinen autoritativen, dashboardfähigen Stream für diese
Ereignisse bereitstellt. Die spätere Anbindung muss an tatsächlich beobachtete
Hermes-Events erfolgen.

## Tests

Ausgeführt:

```text
scripts/run_tests.sh \
  tests/agent/test_memory_graph_projection.py \
  tests/hermes_cli/test_memory_universe_routes.py \
  tests/agent/test_learning_graph.py \
  tests/agent/test_learning_mutations.py \
  tests/hermes_cli/test_web_unknown_profile_404.py
```

Ergebnis: **33 Tests bestanden, 0 fehlgeschlagen**.

Abgedeckt sind Authentifizierung, Profiltrennung, metadata-only Übersicht,
Details, Cursor-/Filter-Verträge, Suche, leere Graphen, fremde IDs, bestehende
Learning-Graph-/Mutation-Verträge und eine synthetische 2.048-Node-Pagination.

## Bekannte Einschränkungen und Phase 4

- Die aktuelle Projektion visualisiert Built-in-Memory und gelernte Skills;
  eine sichere Inventarisierung externer Provider braucht einen expliziten
  Providervertrag.
- Es gibt noch keine Projekt- oder Unterbereichsmetadaten in den bestehenden
  Datenquellen.
- Die Suchroute durchsucht absichtlich keine privaten Memory-Texte.
- Der Graph ist noch nicht an eine Canvas-/3D-Ansicht angebunden.
- Ein Live-Eventstream folgt erst, wenn eine reale, profilgebundene Hermes-
  Ereignisquelle ohne Inhaltslecks verfügbar ist.
