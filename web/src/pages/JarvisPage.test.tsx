// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileContext } from '@/contexts/profile-context'
import { ApiError } from '@/lib/api-error'
import type { JarvisWorkspaceProps } from './jarvis/shell-types'
import type { JarvisStatusResponse } from '@/lib/api'

const seam = vi.hoisted(() => ({ props: null as JarvisWorkspaceProps | null }))
const mocked = vi.hoisted(() => ({
  getJarvisStatus: vi.fn(), getMemory: vi.fn(), planJarvis: vi.fn(),
  runJarvis: vi.fn(), runJarvisAgent: vi.fn(), speakText: vi.fn(),
  buildWsUrl: vi.fn(),
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
function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}
async function render(profile: string) {
  await act(async () => root.render(<MemoryRouter><LocationProbe /><ProfileContext.Provider value={{ profile, currentProfile: profile, profiles: [profile], setProfile: () => {} }}><JarvisPage /></ProfileContext.Provider></MemoryRouter>))
}
beforeEach(() => {
  vi.clearAllMocks()
  mocked.getJarvisStatus.mockResolvedValue(status)
  mocked.getMemory.mockResolvedValue(null)
  mocked.planJarvis.mockResolvedValue({ status: 'planned' })
  mocked.buildWsUrl.mockRejectedValue(new Error('synthetic stream unavailable'))
  gateway.connect.mockResolvedValue(undefined)
  gateway.request.mockImplementation(async (method: string) => method === 'session.create' ? { session_id: 'voice-A', stored_session_id: 'stored-A' } : { status: 'streaming' })
  gateway.onAny.mockReturnValue(vi.fn())
  gateway.onRequest.mockReturnValue(vi.fn())
  gateway.onState.mockReturnValue(vi.fn())
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

describe('Jarvis session boundary', () => {
  it('interrupts TTS on an explicit microphone click without an old turn resetting the new recording', async () => {
    mocked.getJarvisStatus.mockResolvedValue({ ...status, voice: { tts: { configured: true } } })
    mocked.speakText.mockResolvedValue({ data_url: 'data:audio/wav;base64,AA==' })
    const pause = vi.fn()
    class Player {
      playbackRate = 1; onended = null; onerror = null; ontimeupdate = null
      pause = pause
      play() { return Promise.resolve() }
    }
    vi.stubGlobal('Audio', Player)
    mocked.captureMicrophone.mockImplementation((_device, signal: AbortSignal) => ({
      recording: new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })), stop: vi.fn(),
    }))
    await render('A')
    let turn: unknown
    act(() => { turn = seam.props!.onVoiceTranscript('Hallo') })
    await act(async () => { await Promise.resolve() })
    await act(async () => gateway.onAny.mock.calls.at(-1)![0]({ type: 'message.complete', session_id: 'voice-A', payload: { text: 'Antwort', status: 'complete' } }))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(seam.props!.voiceState).toBe('speaking')
    const oldSignal = mocked.speakText.mock.calls.at(-1)![2] as AbortSignal
    let recording: unknown
    act(() => { recording = seam.props!.onRecordVoice() })
    await act(async () => { await turn })
    expect(oldSignal.aborted).toBe(true)
    expect(pause).toHaveBeenCalled()
    expect(seam.props!.voiceState).toBe('listening')
    expect(seam.props!.voiceBusy).toBe('recording')
    await act(async () => seam.props!.onRecordVoice())
    expect(mocked.captureMicrophone).toHaveBeenCalledTimes(1)
    await act(async () => { seam.props!.onCancelVoice?.(); await recording })
    expect(seam.props!.voiceBusy).toBeNull()
    expect(gateway.request.mock.calls.filter(([method]) => method === 'session.create')).toHaveLength(1)
  })
  it('opens the same stored conversation in PTY chat only after a confirmed session close', async () => {
    await render('A')
    let turn: unknown
    act(() => { turn = seam.props!.onVoiceTranscript('Hallo') })
    await act(async () => { await Promise.resolve() })
    await act(async () => { gateway.onAny.mock.calls.at(-1)![0]({ type: 'message.complete', session_id: 'voice-A', payload: { text: 'Antwort', status: 'complete' } }); await turn })
    let acknowledge!: (value: unknown) => void
    gateway.request.mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve }))
    let handoff: unknown
    act(() => { handoff = seam.props!.onContinueVoiceInChat?.() })
    await act(async () => { await Promise.resolve() })
    expect(host.querySelector('[data-testid="location"]')?.textContent).toBe('/')
    expect(gateway.request).toHaveBeenLastCalledWith('session.close', { profile: 'A', session_id: 'voice-A' }, 45000, expect.any(AbortSignal))
    await act(async () => { acknowledge({ closed: true }); await handoff })
    expect(host.querySelector('[data-testid="location"]')?.textContent).toBe('/chat?resume=stored-A&profile=A')
    expect(seam.props!.onContinueVoiceInChat).toBeUndefined()
  })
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
  it('shows only server-originated tool lifecycle metadata for a native voice turn', async () => {
    await render('A')
    let turn!: unknown
    act(() => { turn = seam.props!.onVoiceTranscript('Prüfe autorisierte Informationen') })
    await act(async () => { await Promise.resolve() })
    const emit = gateway.onAny.mock.calls.at(-1)![0]
    await act(async () => emit({ type: 'tool.start', session_id: 'voice-A', payload: { name: 'mail', args: { secret: 'never shown' } } }))
    expect(seam.props!.voiceTools).toEqual([{ name: 'mail', status: 'started' }])
    await act(async () => emit({ type: 'tool.complete', session_id: 'voice-A', payload: { name: 'mail', result: 'private tool result' } }))
    await act(async () => { emit({ type: 'message.complete', session_id: 'voice-A', payload: { text: 'Hermes hat die autorisierten Informationen geprüft.', status: 'complete' } }); await turn })
    expect(seam.props!.voiceTools).toEqual([
      { name: 'mail', status: 'started' },
      { name: 'mail', status: 'finished' },
    ])
    expect(mocked.runJarvis).not.toHaveBeenCalled()
    expect(mocked.runJarvisAgent).not.toHaveBeenCalled()
  })
  it('re-arms an explicitly enabled continuous dialogue only after a completed response', async () => {
    mocked.transcribeAudio.mockResolvedValue({ transcript: 'Guten Morgen, Jarvis' })
    const stopNextCapture = vi.fn()
    mocked.captureMicrophone
      .mockReturnValueOnce({ recording: Promise.resolve(new Blob(['first'], { type: 'audio/webm' })), stop: vi.fn() })
      .mockReturnValueOnce({ recording: new Promise((_resolve, reject) => { stopNextCapture.mockImplementation(() => reject(new DOMException('Cancelled', 'AbortError'))) }), stop: stopNextCapture })
    gateway.onAny.mockImplementationOnce(handler => {
      queueMicrotask(() => handler({ type: 'message.complete', session_id: 'voice-A', payload: { text: 'Guten Morgen. Wie kann ich helfen?', status: 'complete' } }))
      return vi.fn()
    })
    await render('A')
    act(() => { seam.props!.onContinuousVoiceChange?.(true) })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 450)) })
    expect(seam.props!.continuousVoice).toBe(true)
    expect(mocked.captureMicrophone).toHaveBeenCalledTimes(2)
    expect(gateway.request.mock.calls.filter(([method]) => method === 'session.create')).toHaveLength(1)
    expect(mocked.runJarvis).not.toHaveBeenCalled()
    expect(seam.props!.voiceState).toBe('listening')
    await act(async () => { seam.props!.onCancelVoice?.(); await Promise.resolve() })
    expect(stopNextCapture).toHaveBeenCalled()
  })
  it('forwards gateway deltas to speak-stream and uses the existing fallback only when the server requests it', async () => {
    mocked.getJarvisStatus.mockResolvedValue({ ...status, voice: { tts: { configured: true } } })
    mocked.speakText.mockResolvedValue({ data_url: 'data:audio/wav;base64,AA==' })
    mocked.buildWsUrl.mockResolvedValue('ws://synthetic/audio')
    type FakeSocket = { open: () => void; message: (data: string) => void; sent: string[] }
    let socket: FakeSocket | null = null
    function StreamSocket() {
      const created = {
        binaryType: 'blob' as BinaryType,
        readyState: 0,
        onopen: null as null | ((event: Event) => void),
        onerror: null,
        onclose: null,
        onmessage: null as null | ((event: MessageEvent) => void),
        sent: [] as string[],
        send(data: string) { created.sent.push(data) },
        close() { created.readyState = 3 },
        open() { created.readyState = 1; created.onopen?.(new Event('open')) },
        message(data: string) { created.onmessage?.(new MessageEvent('message', { data })) },
      }
      socket = created
      return created
    }
    vi.stubGlobal('WebSocket', StreamSocket)
    class Player { playbackRate = 1; onended: (() => void) | null = null; onerror = null; ontimeupdate = null; pause() {}; play() { queueMicrotask(() => this.onended?.()); return Promise.resolve() } }
    vi.stubGlobal('Audio', Player)
    await render('A')
    let turn: unknown
    act(() => { turn = seam.props!.onVoiceTranscript('Sag etwas') })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    const activeSocket = () => socket as FakeSocket
    activeSocket().open()
    const emit = gateway.onAny.mock.calls.at(-1)![0]
    await act(async () => emit({ type: 'message.delta', session_id: 'voice-A', payload: { text: 'Der erste Satz. ' } }))
    expect(activeSocket().sent).toContain('{"text":"Der erste Satz. "}')
    await act(async () => emit({ type: 'message.complete', session_id: 'voice-A', payload: { text: 'Der erste Satz.', status: 'complete' } }))
    activeSocket().message('{"type":"fallback"}')
    await act(async () => { await turn })
    expect(activeSocket().sent).toContain('{"done":true}')
    expect(mocked.speakText).toHaveBeenCalledWith('Der erste Satz.', 'A', expect.any(AbortSignal))
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
  it('routes recorded mail requests through the native conversation and speaks the returned result', async () => {
    const configured = { ...status, agents: [{ agent_id: 'email', title: 'Mail' }], voice: { tts: { configured: true } } } as unknown as JarvisStatusResponse
    mocked.getJarvisStatus.mockResolvedValue(configured)
    mocked.captureMicrophone.mockReturnValue({ recording: Promise.resolve(new Blob(['synthetic'], { type: 'audio/mp4' })), stop: vi.fn() })
    mocked.transcribeAudio.mockResolvedValue({ transcript: 'Jarvis, prüfe meine Emails' })
    gateway.onAny.mockImplementationOnce(handler => {
      queueMicrotask(() => handler({ type: 'message.complete', session_id: 'voice-A', payload: { text: 'Synthetisches Agentenergebnis', status: 'complete' } }))
      return vi.fn()
    })
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
    expect(mocked.runJarvisAgent).not.toHaveBeenCalled()
    expect(gateway.request).toHaveBeenCalledWith('prompt.submit', expect.objectContaining({ text: 'Jarvis, prüfe meine Emails', profile: 'A', voice_turn: true }), 45000, expect.any(AbortSignal))
    expect(mocked.speakText).toHaveBeenCalledWith('Synthetisches Agentenergebnis', 'A', expect.any(AbortSignal))
    expect(seam.props!.voiceResponse).toBe('Synthetisches Agentenergebnis')
    expect(seam.props!.voiceBusy).toBeNull()
    expect(seam.props!.voiceState).toBe('idle')
  })
  it.each(['Jarvis, prüfe meine Emails', 'Jarvis Status', 'Jarvis, fasse meinen Tag zusammen'])('lets Hermes resolve available tools for %s without static shortcut responses', async text => {
    gateway.onAny.mockImplementationOnce(handler => {
      queueMicrotask(() => handler({ type: 'message.complete', session_id: 'voice-A', payload: { text: 'Antwort aus der Test-Laufzeit', status: 'complete' } }))
      return vi.fn()
    })
    await render('A')
    await act(async () => seam.props!.onVoiceTranscript(text))
    expect(mocked.runJarvisAgent).not.toHaveBeenCalled()
    expect(mocked.runJarvis).not.toHaveBeenCalled()
    expect(seam.props!.voiceResponse).toBe('Antwort aus der Test-Laufzeit')
    expect(gateway.request).toHaveBeenCalledWith('prompt.submit', expect.objectContaining({ text }), 45000, expect.any(AbortSignal))
  })
  it('reports STT failure without submitting a prompt or exposing provider diagnostics', async () => {
    mocked.captureMicrophone.mockReturnValue({ recording: Promise.resolve(new Blob(['synthetic'])), stop: vi.fn() })
    mocked.transcribeAudio.mockRejectedValueOnce(new Error('private provider diagnostic'))
    await render('A')
    await act(async () => seam.props!.onRecordVoice())
    expect(seam.props!.error).toContain('STT-Anbieter')
    expect(seam.props!.error).not.toContain('private')
    expect(gateway.request).not.toHaveBeenCalled()
    expect(seam.props!.voiceState).toBe('error')
  })
  it('keeps the model answer when TTS fails, without replaying the turn', async () => {
    mocked.getJarvisStatus.mockResolvedValue({ ...status, voice: { tts: { configured: true } } })
    gateway.onAny.mockImplementationOnce(handler => {
      queueMicrotask(() => handler({ type: 'message.complete', session_id: 'voice-A', payload: { text: 'Echte Transportantwort im Test' } }))
      return vi.fn()
    })
    mocked.speakText.mockRejectedValueOnce(new Error('private audio diagnostic'))
    await render('A')
    await act(async () => seam.props!.onVoiceTranscript('Kannst du mich hören?'))
    expect(seam.props!.voiceResponse).toBe('Echte Transportantwort im Test')
    expect(seam.props!.error).toContain('TTS-Konfiguration')
    expect(seam.props!.error).not.toContain('private')
    expect(gateway.request.mock.calls.filter(([method]) => method === 'prompt.submit')).toHaveLength(1)
    expect(mocked.speakText).toHaveBeenCalledTimes(1)
    expect(seam.props!.voiceState).toBe('error')
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
