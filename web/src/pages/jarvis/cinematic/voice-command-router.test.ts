import { describe, expect, it } from 'vitest'
import { routeVoiceCommand } from './voice-command-router'

describe('routeVoiceCommand', () => {
  it('routes email checks through the read-only Email Agent path', () => {
    const command = routeVoiceCommand('Jarvis, prüfe meine Emails')

    expect(command).toMatchObject({ agentHint: 'email', execute: true })
    expect(command?.request).toContain('Keine Nachricht senden oder ändern')
  })

  it('routes mail summaries without permitting an external action', () => {
    const command = routeVoiceCommand('Jarvis, fasse meine Mails zusammen')

    expect(command).toMatchObject({ agentHint: 'email', execute: true })
    expect(command?.request).toContain('keine externe Aktion')
  })

  it('recognizes the important-mail question only with the wake word', () => {
    expect(routeVoiceCommand('Jarvis, was ist wichtig?')).toMatchObject({ agentHint: 'email' })
    expect(routeVoiceCommand('Was ist wichtig?')).toBeNull()
  })
})
