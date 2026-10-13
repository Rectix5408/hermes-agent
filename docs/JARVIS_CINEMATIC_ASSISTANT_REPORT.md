# JARVIS Cinematic Assistant Integration

## Status

**PARTIAL — lokale Integration und Tests bestanden; Live-Voice-Konfiguration und autorisierte Laufzeit bleiben unverifiziert.**

Es gab keinen SSH-Zugriff, kein Deployment, keinen Commit und keinen Push. Keine VIRUS-Datei wurde geändert.

## Bestand vor der Änderung

- `JarvisPage` verwendet bereits die Hermes-Gateway-Sitzung für Voice-Turns; es gibt keinen zweiten Agent-Runner.
- Text-Deltas der Gateway-Antwort gehen an den vorhandenen `/api/audio/speak-stream`-Player. Satzweises Streaming, geordnete Wiedergabe, Barge-in, Audio-Cleanup und der Fallback auf `/api/audio/speak` waren bereits vorhanden.
- Tool-Aktivität und Freigaben stammen aus den tatsächlichen Gateway-Ereignissen. Eine Voice-Freigabe ist weiterhin ausschließlich eine explizite UI-Entscheidung für den einzelnen Vorgang; gesprochene Zustimmung genügt nicht.
- `JarvisAvatarCore` und `HologramBrain` verwenden bestehende, reale Zustände (`listening`, `thinking`, Tool-Schritt, Freigabe, `speaking`). Das Memory Universe bleibt an die profilgebundene API gebunden und zeigt für leere Daten einen ehrlichen Leerzustand.
- Die bestehende ElevenLabs-Anbindung löst Anbieter und Voice-ID profilgebunden serverseitig auf. Die Audio-Routen bieten eine nicht geheime Stimmenliste; Konfigurationsschreibvorgänge laufen über die vorhandene, profilgebundene `/api/config`-Autorisierung.

## Tatsächlich geänderte Dateien

| Datei | Änderung |
| --- | --- |
| `web/src/pages/jarvis/components/cinematic/CinematicVoiceConsole.tsx` | Sichtbarer Einstieg **„Serverstimme verwalten“** zur vorhandenen globalen Konfiguration. Der Hinweis stellt ausdrücklich klar, dass die Voice-Konsole selbst keine Voice-ID ändert. |
| `web/src/pages/jarvis/components/cinematic/CinematicVoiceConsole.test.tsx` | Regressionstest: Die Aktion navigiert zu `/config`; kein lokaler Voice-ID-Wechsel wird suggeriert. |
| `docs/JARVIS_CINEMATIC_ASSISTANT_REPORT.md` | Dieser Bericht. |

## Stimme und Persönlichkeit

Die aktive Voice-ID wurde **nicht** aus lokaler Konfiguration oder Secrets ausgelesen. Eine laufende, authentifizierte Hermes-Instanz stand in dieser Arbeitsphase nicht zur Abfrage bereit. Daher ist weder die aktuell aktive ElevenLabs-Stimme noch die Verfügbarkeit einer bestimmten britisch klingenden, deutsch geeigneten Stimme als Live-Fakt behauptet.

Der neue Einstieg führt bewusst zur vorhandenen autorisierten Konfiguration. Dort wird eine neue Voice-ID erst durch eine explizite Auswahl und Speicherung wirksam. Die Voice-Konsole persistiert nur Browser-Einstellungen wie Mikrofonauswahl, STT-Modus und Wiedergabegeschwindigkeit pro Profil; sie darf keine serverseitige Voice-ID vortäuschen oder überschreiben. Keine Prominentenstimme, kein neuer Provider und kein Cloud-LLM wurden ergänzt.

Die Kommunikation selbst bleibt in der bestehenden profilgebundenen SOUL-/Persönlichkeitskonfiguration. Es wurde absichtlich keine zweite, hartcodierte Jarvis-Persönlichkeit in das Frontend eingebracht.

## Sicherheits- und Architekturprüfung

- Die vorhandene PTY/TUI-Chatoberfläche bleibt unverändert die primäre Chat-Implementierung.
- Voice nutzt weiterhin die bestehende Gateway-Session inklusive profilgebundener Memory- und Tool-Auflösung.
- Streaming-TTS, Abbruchsignale und der serverseitige Tool-/Approval-Pfad wurden nicht ersetzt oder gelockert.
- Browserseitige Einstellungen sind profilgetrennt. Die serverseitige Konfiguration wird nur über den bestehenden, profilgebundenen Konfigurationsweg geändert.
- Es wurden keine Schlüssel, Tokens, Voice-IDs oder Gesprächsinhalte in Tests, Logs oder diesen Bericht aufgenommen.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Gezielte Voice-UI-, Speed-, Gateway- und Streaming-Tests | PASS — 27 Tests in 4 Dateien |
| Audio-Router-, Streaming- und Voice-Wrapper-Backendtests | PASS — 31 Tests in 3 Dateien |
| `web/npm test` | PASS — 501 Tests in 77 Dateien |
| `web/npm run typecheck` | PASS |
| `web/npm run lint -- --quiet` | PASS — 0 Fehler |
| `web/npm run build` | PASS — Produktionsbundle erzeugt |
| `git diff --check` | PASS |

Ein zusätzlich ausgeführtes, bestehendes PTY-Profiltestmodul war **nicht erfolgreich**: `tests/hermes_cli/test_web_server_profile_unification.py` hatte 7 Fehler. Der Home-I/O-Guard blockierte dabei korrekt einen realen `~/.hermes/tools/...`-Pfad, den der Python-Resolver während eines PTY-Tests prüfte. Die Voice-Änderung berührt diesen Pfad nicht; die drei fokussierten Audio-/Streaming-Module bestanden. Der Umgebungsfehler wurde nicht umgangen und keine fremde PTY-Datei geändert.

## Verbleibende Live-Prüfungen

1. In einer autorisierten, nicht produktiv schreibenden Sitzung die bestehende Konfigurationsseite mit dem vorgesehenen Profil öffnen.
2. Die vom bestehenden ElevenLabs-Endpunkt gelieferte Stimmenliste laden und eine lizenzierte Stimme erst nach bewusster Auswahl speichern.
3. Mit einer synthetischen, nicht sensiblen Anfrage prüfen: erste Text-Deltas, Satz-TTS, Abbruch durch erneutes Sprechen, Tool-Freigabe und Profilwechsel.
4. Falls eine britisch klingende Männerstimme mit guter deutscher Aussprache benötigt wird, nur anhand der autorisiert angebotenen ElevenLabs-Metadaten auswählen und den Ergebnis-Test dokumentieren; Sprachqualität kann aus Metadaten allein nicht garantiert werden.

Die beigefügten Video-Referenzen waren in der lokalen Arbeitsumgebung nicht als abspielbare Dateien verfügbar. Die bereits implementierte Avatar-/Hologramm-Architektur wurde deshalb nur gegen ihre echten Zustandsquellen und nicht gegen einen Video-Pixelvergleich validiert.
