export interface VoiceCommand {
  request: string
  agentHint: 'email' | 'instagram' | 'auto'
  execute: boolean
  response: string
}

/** Deterministic command routing: it never asks a model to interpret a voice command. */
export function routeVoiceCommand(transcript: string): VoiceCommand | null {
  const normalized = transcript.trim().toLocaleLowerCase('de-DE')
  const command = normalized.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const hasWakeWord = command.startsWith('jarvis')
  const withoutWakeWord = command.replace(/^jarvis\s*/, '')
  const isMailCommand = /\b(e mail|emails|mail|mails|nachrichten|posteingang)\b/.test(withoutWakeWord)
  const isSystemCommand = /\b(systemstatus|system status|system prufen|status)\b/.test(withoutWakeWord)
  const isExplicitMailShortcut = /^(e mails?|emails?|posteingang)\s+(prufen|checken|lesen)$/.test(withoutWakeWord)

  if (!hasWakeWord && !isExplicitMailShortcut) return null
  if ((/\b(offne|lies|prufe|checke|zeige)\b/.test(withoutWakeWord) && isMailCommand) || isExplicitMailShortcut) return {
    request: 'Liste meine E-Mails auf und zeige nur Metadaten. Keine Nachricht senden oder ändern.',
    agentHint: 'email', execute: true, response: 'Ich öffne die E-Mail-Übersicht über den Hermes Email-Agenten.'
  }
  if (/\bfass/.test(withoutWakeWord) && isMailCommand) return {
    request: 'Fasse meine aktuellen Nachrichten zusammen. Erstelle keine Antwort und führe keine externe Aktion aus.',
    agentHint: 'email', execute: true, response: 'Ich lasse die Nachrichten vom Email-Agenten zusammenfassen.'
  }
  if (/\b(was ist wichtig|was wichtig ist|wichtige nachrichten)\b/.test(withoutWakeWord)) return {
    request: 'Prüfe wichtige E-Mail-Metadaten und fasse sie lesend zusammen. Keine Antwort senden oder ändern.',
    agentHint: 'email', execute: true, response: 'Ich prüfe wichtige Nachrichten nur lesend mit dem Email-Agenten.'
  }
  if (withoutWakeWord.includes('instagram') && withoutWakeWord.includes('agent')) return {
    request: 'Starte eine sichere Analyse für den Instagram-Agenten. Keine Veröffentlichung und keine externe Aktion ohne Freigabe.',
    agentHint: 'instagram', execute: true, response: 'Ich starte die sichere Instagram-Agenten-Analyse.'
  }
  if (withoutWakeWord.includes('fass') && (withoutWakeWord.includes('meinen tag') || withoutWakeWord.includes('mein tag'))) return {
    request: 'Zeige das Morning Briefing aus vorhandenen Hermes-Statusdaten.', agentHint: 'auto', execute: false,
    response: 'Ich aktualisiere dein Morning Briefing.'
  }
  if (isSystemCommand || withoutWakeWord.includes('wie geht es dem system')) return {
    request: 'Zeige den aktuellen Hermes-Systemstatus.', agentHint: 'auto', execute: false,
    response: 'Ich aktualisiere den Systemstatus.'
  }
  return null
}
