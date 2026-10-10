export interface VoiceCommand {
  request: string
  agentHint: 'email' | 'instagram' | 'auto'
  execute: boolean
  response: string
}

/** Deterministic command routing: it never asks a model to interpret a voice command. */
export function routeVoiceCommand(transcript: string): VoiceCommand | null {
  const normalized = transcript.trim().toLocaleLowerCase('de-DE')
  if (!normalized.startsWith('jarvis')) return null
  if (normalized.includes('öffne') && normalized.includes('email')) return {
    request: 'Liste meine E-Mails auf und zeige nur Metadaten. Keine Nachricht senden oder ändern.',
    agentHint: 'email', execute: true, response: 'Ich öffne die E-Mail-Übersicht über den Hermes Email-Agenten.'
  }
  if (normalized.includes('fass') && (normalized.includes('nachricht') || normalized.includes('email'))) return {
    request: 'Fasse meine aktuellen Nachrichten zusammen. Erstelle keine Antwort und führe keine externe Aktion aus.',
    agentHint: 'email', execute: true, response: 'Ich lasse die Nachrichten vom Email-Agenten zusammenfassen.'
  }
  if (normalized.includes('instagram') && normalized.includes('agent')) return {
    request: 'Starte eine sichere Analyse für den Instagram-Agenten. Keine Veröffentlichung und keine externe Aktion ohne Freigabe.',
    agentHint: 'instagram', execute: true, response: 'Ich starte die sichere Instagram-Agenten-Analyse.'
  }
  if (normalized.includes('systemstatus') || normalized.includes('systemstatus') || normalized.includes('system status')) return {
    request: 'Zeige den aktuellen Hermes-Systemstatus.', agentHint: 'auto', execute: false,
    response: 'Ich aktualisiere den Systemstatus.'
  }
  return null
}
