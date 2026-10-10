# Jarvis Acceptance Test – Phasen 1–4

## Ergebnis

**Status: FIX REQUIRED**

Alle automatisierbaren Build- und Testprüfungen sind erfolgreich. Die Gesamtfreigabe bleibt offen,
weil die Abnahmeumgebung weder einen interaktiven Browser für Mikrofonberechtigungen noch eine
laufende Hermes-Instanz mit E-Mail/MCP-Integration und freigabepflichtiger Aktion bereitstellt.
Das ist eine offene manuelle Validierung, kein festgestellter Implementierungsfehler.

## 1. Build-Validierung

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | bestanden |
| `npm run lint` | bestanden, 29 bestehende projektweite Warnungen |
| `npm run build` | bestanden |
| `npm test` | bestanden: 61 Dateien, 437 Tests |

## 2. UI- und Routing-Prüfung

- `/jarvis` ist weiterhin als Lazy-Route in `web/src/App.tsx` registriert.
- Die Jarvis-Navigation scrollt ausschließlich zu lokalen Abschnitts-IDs: Dashboard, Voice,
  Agents, Memory, Runtime, Intelligence und Security.
- Es wurden keine globalen Hermes-Routen ersetzt oder ergänzt.
- Keine Screenshots: In der Abnahmeumgebung ist kein Browser-Automationstool installiert.

## 3. Voice-Prüfung

- Statisch geprüft: Browser-Mikrofonzugriff erfolgt über `navigator.mediaDevices.getUserMedia`.
- Statisch geprüft: die visuellen Zustände `IDLE`, `LISTENING`, `THINKING` und `SPEAKING` sind an
  `voiceBusy` beziehungsweise die Voice-Konsole angebunden.
- Statisch geprüft: Audio-Ring, Waveform und Puls werden durch die bestehenden Canvas-/CSS-Komponenten
  gerendert; der Frame-Loop läuft nur bei aktiviertem Audio-Monitor.
- Statisch geprüft: Deutsch und Geschwindigkeit werden lokal gespeichert; die Geschwindigkeit wird
  auf die Wiedergabe der tatsächlichen TTS-Antwort angewandt.
- Offen: Browser-Permission-Dialog und tatsächliche Hardwareaufnahme.

## 4. Command-Prüfung

- `Jarvis zeige Systemstatus`: deterministisches Routing aktualisiert den vorhandenen Hermes-Status.
- `Jarvis fasse Emails zusammen`: routet an den bestehenden Email-Agenten und die vorhandene
  Jarvis-Orchestrierung.
- `Jarvis starte Instagram Agent`: routet nur an einen vom Hermes-Status gemeldeten Instagram-Agenten;
  andernfalls wird der sichere Auto-Router verwendet.
- Offen: Ende-zu-Ende-Ausführung mit einer real konfigurierten Hermes-Instanz.

## 5. Agenten-, Approval- und Security-Prüfung

- Agentenkarten lesen Status, Toolsets und Berechtigungen aus dem bestehenden Jarvis-Status und aus
  Orchestrierungsergebnissen.
- Die Approval Queue verwendet vorhandene pending approvals; Erlauben/Ablehnen ruft die vorhandene
  Entscheidungsmethode auf.
- Das Security Center aggregiert gemeldete Toolsets, Berechtigungen, Integrationen/MCP-Status und
  letzte Ausführung ohne neue API-Aufrufe.
- Offen: eine echte, freigabepflichtige Aktion sowie reale Mail-/MCP-Daten erzeugen und prüfen.

## 6. Performance-Prüfung

- Keine neue Dauerschleife oder neues Polling im Jarvis-Layer gefunden.
- Der einzige Aufnahme-Timer beendet die explizit gestartete Aufnahme nach sieben Sekunden.
- Keine neuen LLM-Aufrufe; Briefing, Security und Memory-Ansichten verarbeiten vorhandene Daten.

## Erforderliche manuelle Abschlusschecks

1. `/jarvis` in einem Browser mit laufendem Hermes öffnen und die Abschnittsnavigation anklicken.
2. Mikrofon erlauben, eine Aufnahme erstellen und IDLE/LISTENING/THINKING/SPEAKING beobachten.
3. Die drei Sprachbefehle gegen konfigurierte Email- und Instagram-Agenten ausführen.
4. Eine reale externe Aktion erzeugen und die Queue mit Erlauben/Ablehnen prüfen.
5. Nach erfolgreichem manuellen Durchlauf den Status auf **READY FOR PHASE 5** setzen.
