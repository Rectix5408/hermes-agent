# HERMES/Jarvis – Phase 5: Echte Hermes-Tool-Freigaben

**Basis:** `Rectix5408/hermes-agent`, Branch `main`, Basiscommit `da27254cfde67b52e5f33230e1b61454f740d54f` (11.10.2026). Lokale Phase-1–4-Änderungen liegen möglicherweise noch nicht auf GitHub. Dieses Paket pusht oder deployed **nichts**.

## Ziel

Der in Phase 4 eingerichtete `HermesVoiceConversation` empfängt die echten `approval`-Serveranfragen vom vorhandenen `tui_gateway` über `/api/ws`. Die Fragen sind an die laufende Voice-`session_id` gebunden. Das Dashboard zeigt sie als Bedienkarte an; es erteilt **niemals** eine Freigabe aufgrund von gesprochener Zustimmung.

- Aktive `approval`-Anfrage: Werkzeugname, Beschreibung und aufklappbarer, serverseitig bereits redigierter Befehl; keine eigene Ersatzgenehmigung im Jarvis-Entwurfsrouter.
- Erlauben: ausschließlich `choice: 'once', all: false`, nach **zwei separaten UI-Klicks**, wenn die aktuelle Anfrage diese Option anbietet.
- Ablehnen: `choice: 'deny'`, nur für die exakt zur aktiven Sprachsitzung gehörende Anfrage.
- `session` und `always`: **nicht** über die Sprachebene verfügbar, auch wenn der Gateway sie anbietet.
- Zwei gleichzeitige Anfragen, unbekannte Rückfragen (z.B. Secret/Sudo/Clarify), ungültige Choices oder fremde Sessions: fail-closed.
- Abbruch, Schließen und Timeout: ausstehende Anfrage wird abgelehnt oder mit Fehler beantwortet; keine automatische Wiederholung von eventuell ausgeführten Werkzeugen.
- `request.cancel` des Backends entfernt die Anzeige; die Anfrage kann danach nicht erneut angenommen werden.
- React zeigt die Freigabekarte **in allen Jarvis-Workspaces** an, nicht nur im Voice-Tab. Der vorhandene `/jarvis/security`-Freigabeentwurfsbereich wird nicht ersetzt.

**Wichtig:** Wenn das Hermes-Profil Ausführungen ausdrücklich ohne Freigabe zulässt, kann diese UI die serverseitige Konfiguration **nicht** nachträglich einschränken. Für die Live-Nutzung muss eine sichere Approval-Policy im Hermes-Profil gelten. Es wurden keine Backend-Toolregeln und keine vorhandenen `approval`-Schemata umgangen oder verändert.

## Paket (nur Original-Projektpfade)

```text
web/src/pages/jarvis/voice-runtime/hermes-conversation.ts
web/src/pages/jarvis/voice-runtime/hermes-conversation.test.mjs
web/src/pages/jarvis/components/autonomy/VoiceApprovalCard.tsx
scripts/apply_hermes_voice_phase5.py
tests/hermes_cli/test_jarvis_voice_phase5_patcher.py
docs/HERMES_JARVIS_PHASE5_APPROVAL.md
```

Die Integration verändert nach dem Preflight zusätzlich **nur diese vorhandenen Dateien direkt im Checkout**:

```text
web/src/pages/JarvisPage.tsx
web/src/pages/jarvis/JarvisShell.tsx
web/src/pages/jarvis/shell-types.ts
```

Kein `copy/`, `backup/`, `old/`, `staging/`, kein doppelter Projektroot und keine Ersetzung ganzer Verzeichnisse. Auch `hermes_cli/` wird hier **nicht** angefasst. Das Paket enthält sechs Dateien, nicht neun; die drei bestehenden React-Dateien werden ausschließlich am Einbaupunkt aktualisiert.

## Einbau im lokalen VS-Code-Checkout (noch nicht pushen!)

1. Vorhandene Änderungen sichern **über Git** (nicht mittels kopierter Ordner) und `git status --short` prüfen.
2. ZIP im **Root des bestehenden Repositories** entpacken und ausschließlich seine Dateien an den identischen Pfaden ergänzen/ersetzen. Bestehende Verzeichnisse nicht löschen.
3. Sicherstellen, dass Phase 4 tatsächlich *integriert* ist. Das bloße Kopieren von `hermes-conversation.ts` reicht nicht: `JarvisPage.tsx` muss `new HermesVoiceConversation(profile, () => new GatewayClient())` enthalten. Falls das fehlt, den vorhandenen Phase-4-Installer zuerst im Checkout ausführen:

```sh
python scripts/apply_hermes_voice_phase4.py --root .
python scripts/apply_hermes_voice_phase4.py --root . --apply
```

4. Phase 5 vorprüfen und einbauen (kein Backup-Ordner erzeugt):

```sh
python scripts/apply_hermes_voice_phase5.py --root .
python scripts/apply_hermes_voice_phase5.py --root . --apply
```

5. Änderungen prüfen, testen und **noch nicht deployen oder pushen**:

```sh
git diff --check
git diff -- web/src/pages/JarvisPage.tsx web/src/pages/jarvis/JarvisShell.tsx web/src/pages/jarvis/shell-types.ts
node --experimental-strip-types --test web/src/pages/jarvis/voice-runtime/hermes-conversation.test.mjs
python -m pytest -q tests/hermes_cli/test_jarvis_voice_phase5_patcher.py
cd web
npm run build
npm run test -- --run
```

Das finale Deployment / der Push erfolgen erst nach dem vereinbarten Gesamttest. Die Python- und Node-Befehle müssen aus dem passenden Repository-Root ausgeführt werden; das Projekt benötigt seine bestehenden Build-Abhängigkeiten.

## Testumfang dieser Phase

- **19 isolierte JS-Testfälle** für Voice-Gateway-Antworten, Session-Grenzen, One-Time-Approval, Ablehnung, Abbruch, Server-Withdrawal und Fail-Closed-Situationen.
- **6 Python-Patcher-Tests** für schreibfreien Preflight, idempotente Integration, inkompatible Dateien und Transaktions-Vorabprüfung.
- Separater TypeScript-Check von `hermes-conversation.ts` mit `tsc --noEmit --strict --target ES2022 --lib ES2022,DOM`.
- Kein echter Provider, keine E-Mail, kein Instagram, keine Produktiv-API wurde ausgeführt. Vollständiger Web-Build, React-Komponententests, Geräte-/Browser-Test, echtes Approval-Roundtrip und Server-Deployment sind **noch offen**.

## Weitere Phase

Phase 6: Einbetten der Voice-Unterhaltung in dieselbe persistente Hermes-Sitzung wie der normale Chat (oder sichere Wiederaufnahme), ergänzende `clarify`-Fragen und Voice-Barge-in mit klarer Audio-/Provider-Abbruchgrenze. Für sensible Auth-/Secret-Anfragen bleibt eine eigene sichere UI erforderlich; keine Sprachübertragung von Passwörtern.
