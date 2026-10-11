// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandBar } from './components/dashboard/CommandBar'
import { JarvisDashboard } from './JarvisDashboard'
import { ProfileContext } from '@/contexts/profile-context'
import type { JarvisWorkspaceProps } from './shell-types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const noop = () => {}
function props(): JarvisWorkspaceProps {
  return { status: null, memory: null, result: null, voiceBusy: null, busy: null, loading: false, selectedAgent: 'auto', request: '', payloadText: '{}', payload: {}, error: '', autoSpeak: false, voiceState: 'idle', voiceHistory: [], onNavigate: vi.fn(), onRequestChange: vi.fn(), onPayloadChange: noop, onAgentSelect: noop, onRun: vi.fn(), onRecordVoice: noop, onStopVoice: noop, onVoiceTranscript: noop, onSpeak: noop, onAutoSpeakChange: noop, onApprovalDecision: noop, onRoutingModeChange: noop }
}

describe('Premium Command Center', () => {
  it('transfers typed commands into the existing console without executing them', async () => {
    const handlers = props()
    await act(async () => root.render(<MemoryRouter><ProfileContext.Provider value={{ profile: 'test-profile', currentProfile: 'default', profiles: [], setProfile: noop }}><CommandBar {...handlers} /></ProfileContext.Provider></MemoryRouter>))
    expect(host.textContent).toContain('test-profile')
    const input = host.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Eine Recherche vorbereiten')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(handlers.onRequestChange).toHaveBeenCalledWith('Eine Recherche vorbereiten')
    expect(handlers.onNavigate).toHaveBeenCalledWith('/jarvis#jarvis-command-console')
    expect(handlers.onRun).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Bitte Planen oder Ausführen')
    expect(input.value).toBe('')
  })
  it('does not accept a second command while the orchestrator is busy', async () => {
    const handlers = { ...props(), busy: 'run' as const }
    await act(async () => root.render(<MemoryRouter><CommandBar {...handlers} /></MemoryRouter>))
    expect(host.querySelector('input')!.disabled).toBe(true)
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(handlers.onRequestChange).not.toHaveBeenCalled()
  })
  it('offers existing chat navigation and honest unavailable states', async () => {
    const handlers = props()
    await act(async () => root.render(<JarvisDashboard {...handlers} />))
    expect(host.textContent).toContain('OFFLINE')
    expect(host.textContent).toContain('Nicht gemessen')
    expect(host.textContent).toContain('Agentenstatus nicht verfügbar')
    const chat = [...host.querySelectorAll('button')].find(button => button.textContent?.startsWith('Chat öffnen'))!
    await act(async () => chat.click())
    expect(handlers.onNavigate).toHaveBeenCalledWith('/chat')
    expect(host.querySelector('[aria-label="Systeminformationen"]')).not.toBeNull()
    expect(host.querySelector('canvas')).toBeNull()
    expect(host.querySelectorAll('form')).toHaveLength(0)
  })
  it('drives the core from actual pending work, not a historical event', async () => {
    await act(async () => root.render(<JarvisDashboard {...props()} busy="plan" />))
    expect(host.querySelector('[aria-label="Jarvis Core"]')?.getAttribute('data-state')).toBe('THINKING')
    await act(async () => root.render(<JarvisDashboard {...props()} voiceBusy="speaking" />))
    expect(host.querySelector('[aria-label="Jarvis Core"]')?.getAttribute('data-state')).toBe('SPEAKING')
    await act(async () => root.render(<JarvisDashboard {...props()} />))
    expect(host.querySelector('[aria-label="Jarvis Core"]')?.getAttribute('data-state')).toBe('OFFLINE')
  })
})
