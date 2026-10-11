// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { AgentRegistryCenter } from './components/agents/AgentRegistryCenter'
import { UnifiedApprovalPanel } from './components/autonomy/UnifiedApprovalPanel'
import type { JarvisWorkspaceProps } from './shell-types'
import type { JarvisStatusResponse } from '@/lib/api'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root; let host: HTMLDivElement
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
function fixture(): JarvisWorkspaceProps {
  return { status: { ok: true, orchestrator: { available: true }, config: {}, agents: [
    { agent_id: 'custom-a', title: 'Custom Alpha', scope: 'Actual API scope', skills: ['Analyse'], toolsets: ['web'], permissions: ['read-only'], model_route: 'configured-route', max_steps: 4, max_input_chars: 800 },
    { agent_id: 'custom-b', title: 'Custom Beta', scope: 'Other scope', skills: ['Planung'], toolsets: [], permissions: [], model_route: 'other-route', max_steps: 2, max_input_chars: 500 },
  ], integrations: [], runs: [], approvals: { pending: [] } } as unknown as JarvisStatusResponse,
  selectedAgent: 'custom-a', result: null, busy: null, voiceBusy: null, voiceState: 'idle', voiceHistory: [], request: 'Synthetic task', payloadText: '{}', payload: {}, error: '', loading: false, memory: null, autoSpeak: false,
  onRun: vi.fn(), onAgentSelect: vi.fn(), onNavigate: vi.fn(), onRequestChange: vi.fn(), onPayloadChange: vi.fn(), onRecordVoice: vi.fn(), onStopVoice: vi.fn(), onVoiceTranscript: vi.fn(), onSpeak: vi.fn(), onAutoSpeakChange: vi.fn(), onApprovalDecision: vi.fn(), onRoutingModeChange: vi.fn() }
}
async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event(element instanceof HTMLInputElement ? 'input' : 'change', { bubbles: true }))
  })
}
function button(text: string) { return [...host.querySelectorAll('button')].find(item => item.textContent === text)! }
describe('agent operations', () => {
  it('renders arbitrary registered agents and filters the catalogue without creating placeholder agents', async () => {
    const props = fixture()
    await act(async () => root.render(<AgentRegistryCenter {...props} />))
    expect(host.querySelectorAll('.operations-list button')).toHaveLength(2)
    expect(host.textContent).not.toContain('Research Agent')
    expect(host.textContent).toContain('Actual API scope')
    expect(host.textContent).toContain('configured-route')
    await change(host.querySelector('input')!, 'Beta')
    expect(host.querySelectorAll('.operations-list button')).toHaveLength(1)
    await act(async () => (host.querySelector('.operations-list button') as HTMLButtonElement).click())
    expect(props.onAgentSelect).toHaveBeenCalledWith('custom-b')
    await change(host.querySelector('input')!, '')
    await change(host.querySelectorAll('select')[1], 'Analyse')
    expect(host.querySelectorAll('.operations-list button')).toHaveLength(1)
    expect(host.querySelector('.operations-list')?.textContent).toContain('Alpha')
    await change(host.querySelectorAll('select')[0], 'unavailable')
    expect(host.querySelectorAll('.operations-list button')).toHaveLength(0)
  })
  it('keeps planning and explicit execution separate', async () => {
    const props = fixture()
    await act(async () => root.render(<AgentRegistryCenter {...props} />))
    expect(props.onRun).not.toHaveBeenCalled()
    await act(async () => button('Planen').click())
    expect(props.onRun).toHaveBeenCalledExactlyOnceWith('plan')
    await act(async () => button('Ausführen').click())
    expect(props.onRun).toHaveBeenLastCalledWith('run')
  })
  it('requires confirmation for approvals and blocks interactions while a decision is pending', async () => {
    const onDecision = vi.fn()
    const approvals = [{ id: 'approval-a', agent_id: 'custom-a', action: 'Test action', reason: 'Needs approval', items: [], params_hash: 'bound', status: 'pending', created_at: 1 }]
    await act(async () => root.render(<UnifiedApprovalPanel approvals={approvals} onDecision={onDecision} />))
    await act(async () => button('Erlauben').click())
    expect(onDecision).not.toHaveBeenCalled()
    await act(async () => button('Entscheidung bestätigen').click())
    expect(onDecision).toHaveBeenCalledExactlyOnceWith('approval-a', 'approve')
    await act(async () => root.render(<UnifiedApprovalPanel approvals={approvals} busy onDecision={onDecision} />))
    expect(button('Ablehnen').disabled).toBe(true)
    await act(async () => root.render(<UnifiedApprovalPanel approvals={approvals} onDecision={onDecision} />))
    await act(async () => button('Ablehnen').click())
    await act(async () => button('Entscheidung bestätigen').click())
    expect(onDecision).toHaveBeenLastCalledWith('approval-a', 'deny')
  })
})
