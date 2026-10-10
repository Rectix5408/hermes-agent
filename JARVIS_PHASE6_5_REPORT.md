# Jarvis Phase 6.5 – Voice Production Hardening

## Änderungen

- Neue lokale Produktions-Zustandsmaschine mit `IDLE`, `LISTENING`, `PROCESSING`, `THINKING`,
  `SPEAKING` und `ERROR`. Ungültige Übergänge gehen kontrolliert in `ERROR`; erfolgreiche Flows
  kehren nach Abschluss nach `IDLE` zurück.
- Menschliche Mikrofonfehler: Zugriff verweigert, kein Mikrofon, abgebrochene Aufnahme,
  belegtes Gerät und nicht unterstützter Browser.
- Aufnahme erhält einen expliziten Stop, eine 60-Sekunden-Sicherheitsgrenze und eine Unmount-
  Bereinigung für Recorder und Timer.
- Voice History zeigt maximal 20 Befehle mit Zeit, erkanntem Text und Router-Aktion. Sie lebt nur
  im React-Speicher der aktuellen Sitzung und wird nicht persistiert.
- Audio-Core kennt nun PROCESSING und ERROR als separate visuelle Zustände. Waveform und Core
  bleiben nur während expliziter Audioaktivität animiert.
- Router-Varianten ergänzt: Systemstatus, E-Mail/Posteingang, Browser-/Agent-Aufträge sowie
  langsamere/schnellere Stimme inklusive prozentbasierter Beschleunigung.

## Sicherheit und Ressourcen

- Keine dauerhafte Mikrofonaufnahme oder Wake-Word-Session.
- Stop und Unmount stoppen `MediaRecorder` und die zugehörigen Tracks über den bestehenden
  Stop-Handler.
- Kein neuer API-Aufruf, keine Abhängigkeit und keine LLM-Auswertung einfacher Befehle.

## Bekannte Grenzen

- Mikrofonberechtigung und reale Gerätedetails benötigen weiterhin einen manuellen Browser-Test.
- Die Verlaufsliste zeigt erkannte Texte nur temporär für die aktuelle Browseransicht; sie ist
  absichtlich nicht in LocalStorage oder Backend gespeichert.
- Browser Speech bleibt ein expliziter Fallback und sein Datenschutzverhalten ist browserabhängig.

## Verifikation

- `npm run typecheck` – erfolgreich
- `npm run lint` – erfolgreich (29 bestehende projektweite Warnungen)
- `npm run build` – erfolgreich
- `npm test` – erfolgreich
