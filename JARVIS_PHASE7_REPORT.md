# Jarvis Phase 7 – Agent Command Center

## Umsetzung

- Einheitliche, frontendseitige Agent Registry für Mail, Instagram, Calendar und Research.
  Sie leitet Verfügbarkeit, Berechtigungen und letzte Ergebnisse ausschließlich aus dem
  vorhandenen Jarvis-Status und Orchestrierungsresultat ab. Fehlende Hermes-Agenten werden
  ausdrücklich als `OFFLINE` angezeigt.
- Neues Cinematic **Agent Command Center** auf `/jarvis/agents`: Fähigkeiten,
  Berechtigungen, letzte Aktion, Runtime-Status und Freigabezustand pro Agent.
- Mail-Sprachbefehle routen deterministisch und ausschließlich lesend:
  `Jarvis, prüfe meine Emails`, `Jarvis, fasse meine Mails zusammen` und
  `Jarvis, was ist wichtig?`. Die erzeugten Aufträge untersagen ausdrücklich Senden,
  Ändern und externe Aktionen.
- Instagram zeigt die sichere Pipeline `Idee → Entwurf → PENDING APPROVAL → Veröffentlichung`.
  Veröffentlichung wird nicht ausgelöst und bleibt bis zur bestehenden Approval Queue gesperrt.
- Calendar und Research sind als sichere, vorbereitende Spezialagenten repräsentiert:
  Tages-/Morning-Briefing bzw. Rechercheauftrag, Ergebnis und Zusammenfassung.
- Keine Backend-Route, keine API und keine Abhängigkeit ergänzt. Das vorhandene Approval Panel
  bleibt die einzige Stelle, die Freigaben tatsächlich entscheidet.

## Token- und Sicherheitsverhalten

- Der Voice Router normalisiert feste deutsche Befehle lokal; er ruft kein LLM für Routing auf.
- Agenten werden nur nach einem erkannten, expliziten Befehl über die bestehende
  Hermes-Orchestrierung angesprochen.
- Der Mail-Flow enthält keine Schreibrechte. Riskante Instagram-Schritte bleiben im
  `PENDING APPROVAL`-Zustand.

## Tests

- Neue Unit-Tests prüfen den lesenden Mail-Router sowie Offline- und Pending-Approval-Zustände
  des Registry-Mappers.
- `npm run typecheck` – erfolgreich
- `npm run lint` – erfolgreich; 29 bestehende projektweite Warnungen, keine neuen Fehler
- `npm run build` – erfolgreich
- `npm test` – erfolgreich: 63 Test-Dateien, 442 Tests

## Bekannte Grenzen

- Runtime-Status, Berechtigungen und tatsächliche letzte Aktionen können nur dargestellt werden,
  wenn sie der vorhandene Hermes-Status liefert. Die Oberfläche erfindet keine Agenten- oder
  MCP-Ausführungen.
- Die Registry führt keine neuen Aktionen ein. Eine produktive Mail-MCP-Ausführung hängt weiterhin
  vollständig an der bereits vorhandenen Hermes-Agent- und MCP-Konfiguration.
