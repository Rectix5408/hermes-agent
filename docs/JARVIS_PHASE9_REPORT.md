# Phase 9 – Native Conversational AI Agent

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
