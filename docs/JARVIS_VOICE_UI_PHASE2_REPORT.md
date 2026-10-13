# JARVIS Voice UI – Phase 2

## Status

**PASS — lokale Frontend-Integration und kontrollierte Browserabnahme.**

Kein SSH-Zugriff, Deployment, Commit, Push, Backend-/Gateway-Umbau,
Mikrofonzugriff, Provider-Aufruf oder echte Tool-Ausführung wurde durchgeführt.

## Architektur

`JarvisAvatarCore` ist eine wiederverwendbare SVG-/CSS-Komponente und ersetzt
nur die zentrale dekorative Voice-Visualisierung. Sie verwendet bewusst nicht
die im Memory Universe vorhandene Three.js-/React-Three-Fiber-Szene: Für eine
einzelne Voice-Präsenz wäre deren GPU- und Bundle-Aufwand unverhältnismäßig.

Die Komponente startet weder eine Voice-Session noch einen AudioContext,
WebSocket, LLM- oder Mikrofonzugriff. Ihr Zustand kommt ausschließlich aus den
bereits in `JarvisPage` verwalteten Props:

| Avatar-Zustand | Autoritative Quelle |
| --- | --- |
| Bereit, Hört zu, Denkt nach, Spricht, Fehler | `voiceState` |
| Transkribiert | bestehender `processing`-Zustand |
| Werkzeugschritt aktiv | zuletzt gemeldete `voiceTools`-Aktivität mit `started` |
| Freigabe erforderlich | bestehendes `voiceApproval`-Objekt |

Ein manueller Abbruch bzw. Barge-in beendet die vorhandene Voice-Operation und
setzt deren Zustand bereits auf `idle`; der Avatar kehrt somit ohne eigenen
Timer zu **Bereit** zurück. Ein expliziter `interrupted`-Produktivzustand
existiert nicht und wurde nicht erfunden.

## Echte Audio-Reaktivität

Der bereits bestehende Mikrofon-Analyser erzeugt weiterhin die Canvas-Wellenform.
Sein Mittelwert wird höchstens alle 80 ms und nur bei einer relevanten Änderung
an den Avatar weitergegeben. Dadurch reagiert der `listening`-Kern auf den
tatsächlich geöffneten Mikrofonstream, ohne einen zweiten MediaStream oder
AudioContext zu erzeugen.

Für Streaming-TTS gibt die vorhandene `StreamingTtsPlayer`-Schnittstelle keinen
Audiopegel frei. Der `speaking`-Effekt ist daher sichtbar zustandsbasiert, nicht
als präzise Audiosynchronisation dargestellt.

## Umsetzung

- holografischer Energiekern, segmentierte Orbit-Ringe, Datenlinien, Partikel
  und eine eigene, markenfreie geometrische Kern-Symbolik;
- Cyan als Grundenergie, Magenta für Akzente, Amber bei echter Freigabe und
  Rot/Magenta für den Fehlerzustand;
- `IntersectionObserver` pausiert CSS-Animationen, sobald der Kern nicht mehr
  sichtbar ist; Unmount/Profilewechsel trennt den Observer;
- das bestehende globale `prefers-reduced-motion`-Verhalten pausiert sämtliche
  Avatar-Animationen;
- Action Deck, Einstellungen, Approval-UI, Stream-/TTS-Logik und PTY-Chat sind
  unverändert erhalten.

## Geänderte Dateien

| Datei | Änderung |
| --- | --- |
| `web/src/pages/jarvis/components/cinematic/JarvisAvatarCore.tsx` | Neue reine SVG-/CSS-Avatar-Komponente mit Sichtbarkeits-Cleanup |
| `web/src/pages/jarvis/components/cinematic/jarvis-avatar-core-state.ts` | Deterministische Zuordnung vorhandener Voice-, Tool- und Approval-Zustände |
| `web/src/pages/jarvis/components/cinematic/JarvisAvatarCore.test.ts` | Zustandstests für Idle, Aufnahme, Transkription, Denken, Tool, Freigabe, TTS und Fehler |
| `web/src/pages/jarvis/components/cinematic/CinematicVoiceConsole.tsx` | Übergabe des vorhandenen gedrosselten Mikrofonpegels und Einbindung des Avatar-Kerns |
| `web/src/pages/jarvis/styles/command-center.css` | Gekapselte Avatar-Visuals, Zustandsfarben, Responsive- und Sichtbarkeitsregeln |
| `docs/qa/voice-ui/phase2-avatar-*.png` | Lokale Browseraufnahmen mit fehlendem Dashboard-Backend klar sichtbar |

`JarvisPage.tsx`, Gateway, STT/TTS-Routen, Streaming-Player und
Agenten-/Approval-Logik wurden nicht verändert.

## Browserabnahme

Die Idle-Aufnahmen stammen aus der laufenden lokalen Anwendung. Der nicht
laufende Dashboard-Backendzustand wird in ihnen als solcher angezeigt; es
wurden keine Statuswerte erfunden.

- [Desktop, 1920 × 1080](qa/voice-ui/phase2-avatar-desktop.png)
- [Tablet, 768 × 1024](qa/voice-ui/phase2-avatar-tablet.png)
- [Smartphone, 390 × 844](qa/voice-ui/phase2-avatar-mobile.png)
- [Kontrollierte Listening-Styling-Fixture](qa/voice-ui/phase2-avatar-listening.png)
- [Kontrollierte Thinking-Styling-Fixture](qa/voice-ui/phase2-avatar-thinking.png)
- [Kontrollierte Approval-Styling-Fixture](qa/voice-ui/phase2-avatar-awaiting-approval.png)
- [Kontrollierte Speaking-Styling-Fixture](qa/voice-ui/phase2-avatar-speaking.png)
- [Kontrollierte Error-Styling-Fixture](qa/voice-ui/phase2-avatar-error.png)

Die Zustands-Fixtures ändern im Browser-Test ausschließlich das `data-state`
der bereits gerenderten Dekoration. Sie sind keine simulierte Agenten- oder
Audioaktivität. Die zugehörige fachliche Zustandslogik wird separat als
Unit-Test mit synthetischen Props geprüft.

| Prüfung | Ergebnis |
| --- | --- |
| 1920 × 1080, 768 × 1024, 390 × 844 | PASS — kein horizontaler Overflow |
| Unbehandelte Browserfehler | PASS — 0 |
| Reduced Motion | PASS — 0 laufende Avatar-Animationen |
| Avatar-Zustandszuordnung | PASS — 8 gezielte Unit-Tests |

## Qualität

| Prüfung | Ergebnis |
| --- | --- |
| Gesamte Web-Suite | PASS — 497 Tests in 75 Dateien |
| Zieltests (Avatar, JarvisPage, Streaming-TTS) | PASS — 32 Tests |
| TypeScript-Typecheck | PASS |
| Lint | PASS — 0 Fehler; bestehende Projektwarnungen außerhalb dieser Änderung bleiben |
| Produktionsbuild | PASS — `hermes_cli/web_dist/index.html` erzeugt |
| `git diff --check` | PASS |

## Vergleich und Grenzen

Die Referenzrichtung — zentrale Hologrammpräsenz, Neonringe, HUD-Tiefenwirkung,
dezente Partikel und ein ruhiger Sci-Fi-Charakter — ist übernommen. Bewusst
nicht übernommen wurden ein fremdes Logo, eine neue globale Navigation,
fiktive Statuswerte, ein Roboterkopf oder ein dauerhafter GPU-Renderer.

Nicht live verifiziert bleiben echtes Mikrofon-Input-Level, echte TTS-/ElevenLabs-
Wiedergabe, Barge-in mit Hardware, Profilwechsel während einer sichtbaren
Animation und Gateway-Tool-/Approval-Ereignisse. Diese benötigen eine
autorisierte Staging- oder Produktionsabnahme; die lokale Umsetzung ändert
keine dieser Schnittstellen.

## Nächste Phase

Eine spätere Phase kann echten TTS-Analyserzugriff ergänzen, wenn der
vorhandene Player ihn explizit und datenschutzkonform bereitstellt. Bis dahin
bleibt die Speaking-Präsenz korrekt als Zustandsvisualisierung gekennzeichnet.
