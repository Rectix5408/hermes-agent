# JARVIS Voice – Workphase 3

## Status

**PASS (lokal integriert und mit Mocks validiert).** Ein produktiver Voice-,
Gateway-, Mikrofon-, Tool- oder ElevenLabs-End-to-End-Test ist weiterhin
**LIVE UNVERIFIED**. Es gab keinen SSH-Zugriff, kein Deployment, keinen Commit
und keinen Push.

## Nachgewiesene Architektur

Voice verwendet keine zweite Agenten- oder Toolarchitektur.

1. `HermesVoiceConversation` erzeugt oder setzt eine profilgebundene
   Gateway-Session fort und übermittelt über `prompt.submit` den Parameter
   `voice_turn: true`.
2. Der vorhandene TUI-Gateway-Promptpfad übernimmt diesen Turn. Er setzt die
   bestehende `auxiliary.voice_chat`-Route nur für den aktuellen Turn; die
   normale Sessionroute, Prompt-Cache-, Memory- und Toolkonfiguration bleiben
   maßgeblich und werden anschließend wiederhergestellt.
3. Tool-Lebenszyklusereignisse (`tool.start`, `tool.complete`),
   Antwortdeltas, serverseitige Approvals und Session-Interrupts kommen über
   dieselbe Gateway-Verbindung. Die Voice-UI erstellt keinen Agent Runner und
   ruft keinen eigenständigen Tool-/Provider-Endpunkt auf.

Damit kann Jarvis per Sprache genau die Tools verwenden, die die aktuelle
Hermes-Session serverseitig autorisiert. Konkrete Toolverfügbarkeit hängt von
Profil, konfigurierten Integrationen und dem bestehenden Toolset ab; dieser
lokale Checkout bestätigt keine produktiv konfigurierte Google-, E-Mail-,
Kalender-, Instagram- oder CRM-Integration.

## Ergänzung in dieser Phase

Die vorhandene Voice-UI zeigt nun nur beobachtbare Zustände deutlicher an:

- bei einer serverseitigen Tool-Anfrage: „Jarvis führt einen Werkzeugschritt
  aus“ mit dem vom Gateway gemeldeten Toolnamen;
- bei einer serverseitigen Approval-Anfrage: „Jarvis wartet auf deine
  Freigabe“;
- nach `tool.complete`: Abschluss ohne behaupteten Erfolg.

Toolargumente und Toolergebnisse werden nicht in diese Statusanzeige
übernommen. Die vorhandene `VoiceApprovalCard` bleibt die einzige Oberfläche
für eine einmalige Entscheidung. Sie akzeptiert ausschließlich eine aktive,
sessionspezifische Serveranfrage und übermittelt `{ choice: 'once', all: false
}` bzw. eine Ablehnung. Gesprochene Bestätigungen führen keine Freigabe aus.

## Geänderte Dateien

| Datei | Änderung |
| --- | --- |
| `web/src/pages/jarvis/components/cinematic/CinematicVoiceConsole.tsx` | Anzeige realer Tool- und Approval-Zustände ohne Tooldatenlecks |
| `web/src/pages/JarvisPage.test.tsx` | Gateway-gestützter Tool-Lifecycle-Test für einen Voice-Turn |
| `docs/JARVIS_VOICE_WORKPHASE3_REPORT.md` | Dieser Abschlussbericht |

Die Phase-1-/2-Dateien wurden nicht neu aufgebaut. Ihre vorhandenen Streaming-,
Fortlaufmodus-, Abbruch-, Sitzungs- und TTS-Schutzmechanismen bleiben aktiv.

## Autorisierte Voice-Tool-Flows

Mit einer tatsächlich konfigurierten Integration kann die vorhandene Hermes-
Runtime über Voice etwa lesende Kalender-, E-Mail-, Aufgaben-, Memory- oder
Dokumentabfragen ausführen und Zusammenfassungen/Entwürfe liefern. Das Modell
wählt dabei nur vorhandene Tools; fehlende Integrationen bleiben fehlend und
dürfen nicht simuliert werden.

Externe Änderungen – darunter Versand, Veröffentlichung, Kalender- oder
Dateiänderung, CRM-Schreiben, Booking- oder Finanzzusagen – bleiben vom
serverseitigen Approval-Vertrag abhängig. Nach Disconnect, Barge-in, Timeout
oder Profilwechsel sendet der Client einen Interrupt beziehungsweise verweigert
eine offene Approval; er wiederholt keinen Prompt und keine Aktion automatisch.

## Teststatus

| Prüfung | Ergebnis |
| --- | --- |
| `JarvisPage.test.tsx` | PASS — 20 Tests, inklusive Tool-Lifecycle ohne Argument-/Ergebnisleak |
| `hermes-conversation.test.mjs` | PASS — 28 Tests: Sessionbindung, Follow-ups, Approval, Deny, Disconnect, Barge-in und Exactly-once-Submit |
| `tests/agent/test_voice_turn_route.py` + `tests/hermes_cli/test_web_server_speak_stream.py` | PASS — 15 Tests (9 Voice-Routing, 6 Speak-Stream) |
| Gesamte Web-Suite | PASS — 489 Tests in 74 Dateien |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — 0 Fehler, 31 bestehende Warnungen |
| `npm run build` | PASS — Produktionsbundle erzeugt; bestehende Three-Chunk-Größenwarnung |
| `git diff --check` einschließlich neuer Voice-/Report-Dateien | PASS |

## Sicherheit, Token und Performance

- Keine Browser-Freigabelogik als Autoritätsquelle, keine dauerhaften oder
  sessionweiten Voice-Grants.
- Keine Toolargumente, Toolresultate, Secrets oder externe Inhalte in den
  Voice-Statusmeldungen.
- Keine zusätzlichen LLM-, TTS-, Tool- oder Memory-Aufrufe für den Status.
- Die bestehende Voice-Modelroute und die vorhandenen Limits begrenzen den
  aktuellen Turn; die normale Modell-/Providerpolitik wurde nicht geändert.

## Live-Test- und Rollback-Plan

Vor einer Bereitstellung in einer autorisierten Staging-/Produktumgebung:

1. Einen nur lesenden, vorhandenen Tool-Flow mit einem Testprofil ausführen.
2. Eine explizit approval-pflichtige Testaktion bis zur Karte führen und
   ablehnen; keine echte externe Änderung auslösen.
3. Barge-in und Gateway-Abbruch während eines Tool-Laufs testen und prüfen,
   dass kein Prompt/keine Aktion erneut gesendet wird.
4. Profilwechsel während TTS/Tool-Ausführung testen.

Rollback ist rein dateibasiert: die drei in „Geänderte Dateien“ genannten
Dateien auf den vorherigen geprüften Stand zurücksetzen, das Web-Bundle erneut
mit `npm run build` erzeugen und erst danach den bestehenden Dashboarddienst
nach dessen regulärem Betriebsverfahren neu laden. Kein Datenbank-, OAuth-,
Profil-, Memory- oder Provider-Rollback ist erforderlich.

## Verbleibende Blocker

- Keine echte Browser-Mikrofon-, Lautsprecher- oder ElevenLabs-Abnahme.
- Keine autorisierten Live-Tool-Integrationen im lokalen Checkout nachgewiesen.
- Keine produktive Exactly-once-Bestätigung über einen Netzwerkabbruch hinaus:
  Der Client wiederholt nicht; der Server bleibt die Autorität darüber, ob eine
  bereits gestartete externe Aktion abgeschlossen wurde.
