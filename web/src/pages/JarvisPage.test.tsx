// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileContext } from '@/contexts/profile-context'
import { ApiError } from '@/lib/api-error'
import type { JarvisWorkspaceProps } from './jarvis/shell-types'
import type { JarvisStatusResponse } from '@/lib/api'

const seam = vi.hoisted(() => ({ props: null as JarvisWorkspaceProps | null }))
const mocked = vi.hoisted(() => ({
  getJarvisStatus: vi.fn(), getMemory: vi.fn(), planJarvis: vi.fn(),
  runJarvis: vi.fn(), runJarvisAgent: vi.fn(), speakText: vi.fn(),
  setEnd: vi.fn(), setTitle: vi.fn(), showToast: vi.fn(), transcribeAudio: vi.fn(),
  captureMicrophone: vi.fn(), decideJarvisApproval: vi.fn(),
}))
const gateway = vi.hoisted(() => ({ connect: vi.fn(), request: vi.fn(), close: vi.fn(), onAny: vi.fn(), onRequest: vi.fn(), onState: vi.fn() }))
vi.mock('@/lib/gatewayClient', () => ({ GatewayClient: class { constructor() { return gateway } } }))
vi.mock('@/lib/api', () => ({ api: mocked }))
vi.mock('./jarvis/voice-runtime/microphone', () => ({ captureMicrophone: mocked.captureMicrophone, captureBrowserSpeech: vi.fn() }))
vi.mock('@/contexts/usePageHeader', () => ({ usePageHeader: () => mocked }))
vi.mock('@nous-research/ui/hooks/use-toast', () => ({ useToast: () => ({ toast: null, showToast: mocked.showToast }) }))
vi.mock('@nous-research/ui/ui/components/toast', () => ({ Toast: () => null }))
vi.mock('./jarvis/JarvisShell', () => ({ JarvisShell: (props: JarvisWorkspaceProps) => { seam.props = props; return <div>{props.error}</div> } }))
import JarvisPage from './JarvisPage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let host: HTMLDivElement
const status = { ok: true, config: {}, agents: [], runs: [], approvals: { pending: [] } } as unknown as JarvisStatusResponse
async function render(profile: string) {
  await act(async () => root.render(<MemoryRouter><ProfileContext.Provider value={{ profile, currentProfile: profile, profiles: [profile], setProfile: () => {} }}><JarvisPage /></ProfileContext.Provider></MemoryRouter>))
}
beforeEach(() => {
  vi.clearAllMocks()
  mocked.getJarvisStatus.mockResolvedValue(status)
  mocked.getMemory.mockResolvedValue(null)
  mocked.planJarvis.mockResolvedValue({ status: 'planned' })
  gateway.connect.mockResolvedValue(undefined)
  gateway.request.mockImplementation(async (method: string) => method === 'session.create' ? { session_id: 'voice-A', stored_session_id: 'stored-A' } : { status: 'streaming' })
  gateway.onAny.mockReturnValue(vi.fn())
  gateway.onRequest.mockReturnValue(vi.fn())
  gateway.onState.mockReturnValue(vi.fn())
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

describe('Jarvis session boundary', () => {
  it('streams native dialogue, reuses the voice session and never routes it to the task planner', async () => {
    await render('A')
    let turn!: unknown
    act(() => { turn = seam.props!.onVoiceTranscript('Kann ich normal mit dir reden?') })
    await act(async () => { await Promise.resolve() })
    const emit = gateway.onAny.mock.calls.at(-1)![0]
    await act(async () => emit({ type: 'message.delta', session_id: 'voice-A', payload: { text: 'Hallo' } }))
    expect(seam.props!.voiceResponse).toBe('Hallo')
    expect(seam.props!.voiceState).toBe('thinking')
    await act(async () => { emit({ type: 'message.complete', session_id: 'voice-A', payload: { text: 'Hallo zusammen', status: 'complete' } }); await turn })
    expect(seam.props!.voiceResponse).toBe('Hallo zusammen')
    expect(mocked.planJarvis).not.toHaveBeenCalled()
    expect(mocked.runJarvis).not.toHaveBeenCalled()
    act(() => { turn = seam.props!.onVoiceTranscript('Erzähl weiter') })
    await act(async () => { await Promise.resolve() })
    await act(async () => { gateway.onAny.mock.calls.at(-1)![0]({ type: 'message.complete', session_id: 'voice-A', payload: { text: 'Gerne' } }); await turn })
    expect(gateway.request.mock.calls.filter(([method]) => method === 'session.create')).toHaveLength(1)
    expect(seam.props!.voiceHistory).toHaveLength(2)
  })
  it('binds native approvals to the voice turn, refuses double input and clears it on profile change', async () => {
    await render('A')
    act(() => { void seam.props!.onVoiceTranscript('Bitte einen Entwurf erstellen') })
    await act(async () => { await Promise.resolve() })
    await act(async () => seam.props!.onVoiceTranscript('zweiter Klick'))
    const respond = vi.fn()
    await act(async () => gateway.onRequest.mock.calls.at(-1)![0]({ id: 'approval-A', method: 'approval', params: { session_id: 'voice-A', choices: ['once', 'deny'] }, respond, fail: vi.fn() }))
    expect(seam.props!.voiceApproval?.id).toBe('approval-A')
    expect(respond).not.toHaveBeenCalled()
    expect(gateway.request.mock.calls.filter(([method]) => method === 'prompt.submit')).toHaveLength(1)
    await render('B')
    expect(respond).toHaveBeenCalledWith({ choice: 'deny' })
    expect(seam.props!.voiceApproval).toBeNull()
    expect(seam.props!.voiceResponse).toBe('')
    expect(gateway.close).toHaveBeenCalled()
  })
  it('aborts profile A reads, resets drafts, and ignores late responses after B is selected', async () => {
    let finish!: (value: JarvisStatusResponse) => void
    mocked.getJarvisStatus.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await render('A')
    const signal = mocked.getJarvisStatus.mock.calls[0][1] as AbortSignal
    await act(async () => seam.props!.onRequestChange('A private draft'))
    await render('B')
    expect(signal.aborted).toBe(true)
    expect(mocked.getJarvisStatus.mock.calls[1][0]).toBe('B')
    expect(seam.props!.request).toBe('')
    await act(async () => finish({ ...status, ok: false }))
    expect(seam.props!.status?.ok).toBe(true)
  })
  it('planning with a selected specialist never executes that agent', async () => {
    await render('A')
    await act(async () => { seam.props!.onRequestChange('Prepare a task'); seam.props!.onAgentSelect('mail') })
    await act(async () => seam.props!.onRun('plan'))
    expect(mocked.planJarvis).toHaveBeenCalledWith(expect.objectContaining({ request: 'Prepare a task' }), 'A', expect.any(AbortSignal))
    expect(mocked.runJarvisAgent).not.toHaveBeenCalled()
    expect(mocked.runJarvis).not.toHaveBeenCalled()
  })
  it('an unmounted run cannot trigger TTS or fetch the newly selected profile', async () => {
    let finish!: (value: unknown) => void
    mocked.runJarvis.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await render('A')
    await act(async () => { seam.props!.onRequestChange('Prepare'); seam.props!.onAutoSpeakChange(true) })
    act(() => { void seam.props!.onRun('run') })
    const signal = mocked.runJarvis.mock.calls[0][2] as AbortSignal
    await render('B')
    await act(async () => finish({ status: 'completed', consolidated: { summary: 'A result' } }))
    expect(signal.aborted).toBe(true)
    expect(mocked.speakText).not.toHaveBeenCalled()
    expect(mocked.getJarvisStatus).toHaveBeenCalledTimes(2)
    expect(seam.props!.result).toBeNull()
  })
  it('shows a permission state without leaking response details', async () => {
    mocked.getJarvisStatus.mockRejectedValueOnce(new ApiError('private diagnostic', { status: 403, body: 'private', url: '/' }))
    await render('A')
    expect(host.textContent).toContain('Zugriff nicht erlaubt')
    expect(host.textContent).not.toContain('private')
    expect(seam.props!.loading).toBe(false)
    expect(seam.props!.status).toBeNull()
  })
  it('shows offline separately and aborts on unmount', async () => {
    mocked.getJarvisStatus.mockRejectedValueOnce(new Error('offline'))
    await render('A')
    expect(host.textContent).toContain('nicht erreichbar')
    const signal = mocked.getJarvisStatus.mock.calls[0][1] as AbortSignal
    await act(async () => root.render(null))
    expect(signal.aborted).toBe(true)
  })
  it('routes a recorded read-only command to the registered agent and speaks its actual result', async () => {
    const configured = { ...status, agents: [{ agent_id: 'email', title: 'Mail' }], voice: { tts: { configured: true } } } as unknown as JarvisStatusResponse
    mocked.getJarvisStatus.mockResolvedValue(configured)
    mocked.captureMicrophone.mockReturnValue({ recording: Promise.resolve(new Blob(['synthetic'], { type: 'audio/mp4' })), stop: vi.fn() })
    mocked.transcribeAudio.mockResolvedValue({ transcript: 'Jarvis, prüfe meine Emails' })
    mocked.runJarvisAgent.mockResolvedValue({ agent_id: 'email', status: 'completed', summary: 'Synthetisches Agentenergebnis', approval_required: [] })
    mocked.speakText.mockResolvedValue({ data_url: 'data:audio/wav;base64,AA==' })
    class Player {
      playbackRate = 1; onended: (() => void) | null = null; onerror = null; ontimeupdate = null
      pause() {}
      play() { queueMicrotask(() => this.onended?.()); return Promise.resolve() }
    }
    vi.stubGlobal('Audio', Player)
    await render('A')
    await act(async () => seam.props!.onRecordVoice())
    expect(mocked.transcribeAudio).toHaveBeenCalledWith(expect.stringContaining('data:'), 'audio/mp4', 'A', expect.any(AbortSignal))
    expect(mocked.runJarvisAgent).toHaveBeenCalledWith('email', expect.any(Object), 'A', expect.any(AbortSignal))
    expect(mocked.speakText).toHaveBeenCalledWith('Synthetisches Agentenergebnis', 'A', expect.any(AbortSignal))
    expect(seam.props!.voiceResponse).toBe('Synthetisches Agentenergebnis')
    expect(seam.props!.voiceBusy).toBeNull()
    expect(seam.props!.voiceState).toBe('idle')
  })
  it('never falls back to automatic agent execution when a spoken specialist is absent', async () => {
    await render('A')
    await act(async () => seam.props!.onVoiceTranscript('Jarvis, prüfe meine Emails'))
    expect(mocked.runJarvisAgent).not.toHaveBeenCalled()
    expect(mocked.runJarvis).not.toHaveBeenCalled()
    expect(seam.props!.voiceResponse).toContain('nicht registriert')
  })
  it('cancels an in-flight transcription when leaving voice and ignores the late command', async () => {
    let finish!: (value: unknown) => void
    mocked.captureMicrophone.mockReturnValue({ recording: Promise.resolve(new Blob(['synthetic'])), stop: vi.fn() })
    mocked.transcribeAudio.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await render('A')
    act(() => { void seam.props!.onRecordVoice() })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    const signal = mocked.transcribeAudio.mock.calls.at(-1)![3] as AbortSignal
    await act(async () => seam.props!.onCancelVoice?.())
    await act(async () => finish({ transcript: 'Jarvis, prüfe meine Emails' }))
    expect(signal.aborted).toBe(true)
    expect(mocked.runJarvisAgent).not.toHaveBeenCalled()
    expect(seam.props!.voiceHistory).toHaveLength(0)
  })
  it('deduplicates decisions and rejects IDs outside the current approval queue', async () => {
    mocked.getJarvisStatus.mockResolvedValue({ ...status, approvals: { pending: [{ id: 'allowed' }] } })
    let finish!: (value: unknown) => void
    mocked.decideJarvisApproval.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await render('A')
    act(() => { seam.props!.onApprovalDecision('foreign', 'approve'); seam.props!.onApprovalDecision('allowed', 'approve'); seam.props!.onApprovalDecision('allowed', 'deny') })
    expect(mocked.decideJarvisApproval).toHaveBeenCalledExactlyOnceWith('allowed', 'approve', 'A', expect.any(AbortSignal))
    await act(async () => finish({ ok: true }))
  })
})
