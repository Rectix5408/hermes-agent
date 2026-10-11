// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureBrowserSpeech, captureMicrophone } from './microphone'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
function hardware() {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  const getUserMedia = vi.fn().mockResolvedValue(stream)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  class Recorder {
    static isTypeSupported = (type: string) => type === 'audio/mp4'
    static latest: Recorder
    mimeType = 'audio/mp4'; state = 'inactive'
    onstop: (() => void) | null = null
    onerror: (() => void) | null = null
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    constructor() { Recorder.latest = this }
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['synthetic audio']) }); this.onstop?.() }
  }
  vi.stubGlobal('MediaRecorder', Recorder)
  return { track, stream, getUserMedia, Recorder }
}
describe('bounded microphone capture', () => {
  it('uses the selected device, one stream and the supported container; stops every track', async () => {
    const { getUserMedia, track } = hardware()
    const onStream = vi.fn()
    const capture = captureMicrophone('qa-device', new AbortController().signal, onStream)
    await Promise.resolve()
    capture.stop()
    expect((await capture.recording).type).toBe('audio/mp4')
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: { deviceId: { exact: 'qa-device' } } })
    expect(track.stop).toHaveBeenCalledOnce()
    expect(onStream).toHaveBeenLastCalledWith(null)
  })
  it('disposes a late permission grant after cancel without starting recording', async () => {
    const { getUserMedia, stream, track } = hardware()
    let grant!: (stream: MediaStream) => void
    getUserMedia.mockImplementation(() => new Promise(resolve => { grant = resolve }))
    const controller = new AbortController()
    const capture = captureMicrophone('', controller.signal, vi.fn())
    const rejected = expect(capture.recording).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort(); grant(stream)
    await rejected
    expect(track.stop).toHaveBeenCalledOnce()
  })
  it('cleans up recording errors and never leaves the microphone running', async () => {
    const { Recorder, track } = hardware()
    const capture = captureMicrophone('', new AbortController().signal, vi.fn())
    await Promise.resolve()
    const rejected = expect(capture.recording).rejects.toThrow('unterbrochen')
    Recorder.latest.onerror?.()
    await rejected
    expect(track.stop).toHaveBeenCalledOnce()
    expect(Recorder.latest.state).toBe('inactive')
  })
  it('bounds recording to 60 seconds', async () => {
    vi.useFakeTimers()
    const { track } = hardware()
    const capture = captureMicrophone('', new AbortController().signal, vi.fn())
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(60_000)
    await capture.recording
    expect(track.stop).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not invent browser recognition when unavailable', async () => {
    await expect(captureBrowserSpeech(new AbortController().signal).recording).rejects.toThrow('nicht verfügbar')
  })
  it('aborts browser recognition and ignores any late transcript', async () => {
    const abort = vi.fn()
    class Recognition {
      start() {} stop() {} abort = abort
      lang = ''; continuous = false; interimResults = false
      onresult = null; onerror = null; onend = null
    }
    vi.stubGlobal('SpeechRecognition', Recognition)
    const controller = new AbortController()
    const capture = captureBrowserSpeech(controller.signal)
    const rejected = expect(capture.recording).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    expect(abort).toHaveBeenCalledOnce()
  })
})
