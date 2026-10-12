# Phase 9 – Native Conversational Agent: Analyse

## Reparaturauftrag Phasen 4–6: erneute Bestandsaufnahme

Arbeitsbranch ist bereits `feature/jarvis-native-voice`, HEAD `fe93c553b6`.
Die uncommittierten Voice-Änderungen aus Phase 9 und die umfangreiche lokale
MemoryUniverseScene bleiben erhalten. Kein Backend-Neuaufbau nötig.
`web/src/types/three.d.ts` enthält eine schmale lokale Deklaration: fehlende
Vector3.lengthSq, Mesh.rotation.y und InstancedMesh.count/computeBoundingSphere
erklären sechs Typecheck-Fehler; keine Umgehung durch `any` erforderlich.
Die Node-Installation ist durch vorheriges ENOSPC unvollständig (obug,
@babel/types, rolldown). Rund 1,1 GB npm-Downloadcache wurden lesend ermittelt;
der neue Auftrag erlaubt dessen Regeneration. UV-Cache nur 47 MB. Quellcode,
Git, Profile und Memory werden nicht zur Speichergewinnung gelöscht.
Weitere Integrationspunkte: explizites Unterbrechen der TTS mit neuer Aufnahme,
native Freigaben und Conversation-Lebenszyklus. PTY/Voice dürfen nicht gleichzeitig
eine Session schreiben; gemeinsamer Verlauf verlangt einen bestätigten Rebind.

Stand: 12. Oktober 2026, Ausgangspunkt `fe93c553b6` (lokaler WIP-Commit).

## Ursache und aktueller Datenfluss

Der frühere statische Fallback in `JarvisPage.executeVoiceCommand` wurde bereits
im WIP durch `HermesVoiceConversation.submit` ersetzt. Der lokale Stand ist
damit neuer als die Fehlerbeschreibung; der produktive Stand ist nicht bestätigt.
Allerdings fängt `routeVoiceCommand` weiterhin breite Begriffe wie „Status“ oder
„Nachrichten“ ab und kann entweder eine statische Aktualisierungsmeldung liefern
oder die normale Konversation über einen separaten Spezialagenten-Request umgehen.
Dabei geht der Gesprächskontext dieser Turns an der nativen Voice-Sitzung vorbei.

Browser-Aufnahme (maximal 60 Sekunden, expliziter Start) → vorhandene
profilgebundene Audio-API → HermesVoiceConversation → authentifizierter
GatewayClient `/api/ws` → `session.create` / `session.resume` → `prompt.submit`
mit `voice_turn: true` → `message.delta` / `message.complete` → vorhandene
profilgebundene TTS-API → Browser-Audio. Browser Speech bleibt eine optionale
Alternative; „whisper-local“ ist ein historischer UI-Schlüssel, keine erzwungene
Providerwahl. STT/TTS-Provider und Schlüssel bleiben serverseitig.

## Wiederverwendete Grenzen

- `chat_ws.py` prüft die bestehenden Dashboard-WebSocket-Gates und verbindet
  die TUI-Gateway-Laufzeit. Keine neue Chat-API und keine zweite Agentenengine.
- `audio.py` und die vorhandene API-Fassade führen Audiooperationen im
  angegebenen Profil aus. Keine Keys im Frontend.
- Native Sitzung und AIAgent behalten Profil, SOUL, Memory-Provider,
  Persistenz, Werkzeugberechtigungen, Iterationslimits und Modellrouting.
- `voice_turn` nutzt die bestehende Voice-Modellpolicy, keine neue Modellauswahl.
- `gateway/platforms/api_server.py` ist eine andere vorhandene Oberfläche;
  ein zusätzlicher REST-Chat darüber würde hier nur eine zweite Transportstrecke
  schaffen. Der schon integrierte `/api/ws`-Client bleibt maßgeblich.
- Die PTY-Chat-Sitzung wird nicht übernommen. Voice verwendet ihre eigene
  profilgebundene Sitzung in der vorhandenen Hermes-Persistenz.
- Einmalige native Tool-Freigaben kommen vom Server und verlangen einen
  ausdrücklichen UI-Klick. Sprachtext wird nicht als Zustimmung interpretiert.

## Kleine Integrationsänderungen

1. Nur eng begrenzte lokale Tempoeinstellungen deterministisch behandeln;
   alle fachlichen Spracheingaben unverändert an dieselbe native Sitzung geben.
   Manuelle Planen-/Ausführen-Funktionen der Agentenoberfläche bleiben erhalten.
2. Mikrofon-, STT- und Agentenfehler getrennt anzeigen; TTS behandelt bereits
   seine eigenen Fehler. Keine Rohfehler mit potentiell privaten Providerdaten.
3. Verbindungsabbruch zwischen Turns erkennen, damit der nächste ausdrückliche
   Turn die eigene Sitzung wieder aufnimmt, statt am alten Transport zu scheitern.
4. Initialisierung, Turn und Freigaben mit Tests absichern; keine Wiederholung
   einer potentiell bereits ausgeführten Anfrage.

## Ausgangsprüfung / Hindernisse

`npm run check` scheitert bereits vor dieser Runde an acht TypeScript-Fehlern:
sechs in der lokal vom Nutzer veränderten MemoryUniverseScene (Vector3/InstancedMesh
und fehlende y-Koordinate), zwei in der Vite-Konfiguration. Diese fachfremden
Dateien werden nicht zur Erzeugung eines grünen Ergebnisses überschrieben.
Das Datenvolume meldet nur etwa 246 MiB frei bei 100 % Belegung. Keine erneute
große Installation auf diesem knappen Volume. Push und Deployment erfolgen
gemäß Auftrag erst nach erfolgreicher Implementierung und Abnahme.

Kontinuierliche Aufnahme/Full-Duplex wird nicht behauptet: ein expliziter
Aufnahme-Turn, Text-Streaming und danach abbrechbare TTS-Ausgabe sind der
vorhandene sichere Funktionsumfang.
