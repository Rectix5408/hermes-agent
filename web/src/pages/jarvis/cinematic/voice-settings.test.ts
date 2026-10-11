// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applyVoiceSpeedCommand, loadVoiceSettings, saveVoiceSettings, subscribeVoiceSettings } from './voice-settings'

beforeEach(() => localStorage.clear())
describe('profile voice preferences', () => {
  it('isolates settings and notifications and never restores a microphone request', () => {
    let notifications = 0
    const unsubscribe = subscribeVoiceSettings(() => notifications++, 'B')
    saveVoiceSettings({ ...loadVoiceSettings('A'), deviceId: 'device-a', speed: 1.2, microphoneRequested: true }, 'A')
    expect(loadVoiceSettings('B').deviceId).toBe('')
    expect(loadVoiceSettings('A').microphoneRequested).toBe(false)
    expect(notifications).toBe(0)
    unsubscribe()
  })
  it('applies explicit relative speed commands, not arbitrary sentences', () => {
    saveVoiceSettings({ ...loadVoiceSettings('A'), speed: 1 }, 'A')
    expect(applyVoiceSpeedCommand('Sprich 20 Prozent schneller', 'A')?.speed).toBe(1.2)
    expect(applyVoiceSpeedCommand('Sprich langsamer', 'A')?.speed).toBe(1.08)
    expect(applyVoiceSpeedCommand('Der schnellere Zug fährt langsamer', 'A')).toBeNull()
    expect(loadVoiceSettings('B').speed).toBe(.95)
  })
})
