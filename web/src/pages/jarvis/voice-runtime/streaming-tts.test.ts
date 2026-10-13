// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { StreamingTtsPlayer, type StreamingTtsDependencies } from './streaming-tts'

class FakeSocket {
  readyState: number = WebSocket.CONNECTING
  binaryType: BinaryType = 'blob'
  onopen: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  readonly sent: string[] = []

  send(data: string) { this.sent.push(data) }
  close() { this.readyState = WebSocket.CLOSED }
  open() { this.readyState = WebSocket.OPEN; this.onopen?.(new Event('open')) }
  message(data: unknown) { this.onmessage?.(new MessageEvent('message', { data })) }
  fail() { this.onerror?.(new Event('error')) }
}

class FakeSource {
  buffer: AudioBuffer | null = null
  playbackRate = { value: 1 } as AudioParam
  onended: ((event: Event) => void) | null = null
  startedAt = -1
  stopped = false
  connect() {}
  start(when = 0) { this.startedAt = when }
  stop() { this.stopped = true }
  finish() { this.onended?.(new Event('ended')) }
}

class FakeAudio {
  currentTime = 2
  destination = {} as AudioNode
  state = 'running'
  readonly sources: FakeSource[] = []
  createBuffer(_channels: number, length: number, sampleRate: number) {
    return {
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
    } as unknown as AudioBuffer
  }
  createBufferSource() { const source = new FakeSource(); this.sources.push(source); return source }
  resume() { return Promise.resolve() }
  close() { this.state = 'closed'; return Promise.resolve() }
}

function harness() {
  const socket = new FakeSocket()
  const audio = new FakeAudio()
  const dependencies: StreamingTtsDependencies = {
    buildUrl: async () => 'ws://synthetic/audio',
    createSocket: () => socket,
    createAudio: () => audio,
  }
  return { socket, audio, dependencies }
}

describe('StreamingTtsPlayer', () => {
  it('buffers deltas until the authenticated socket opens and falls back only when the server says so', async () => {
    const { socket, dependencies } = harness()
    const player = new StreamingTtsPlayer('voice-profile', new AbortController().signal, 1, {}, dependencies)

    player.start()
    player.push('Erster Satz. ')
    const finished = player.finish()
    await Promise.resolve()
    socket.open()
    expect(socket.sent).toEqual(['{"text":"Erster Satz. "}', '{"done":true}'])
    socket.message('{"type":"fallback"}')

    await expect(finished).resolves.toBe('fallback')
  })

  it('plays PCM chunks in server order and waits for queued audio after end', async () => {
    const { socket, audio, dependencies } = harness()
    const player = new StreamingTtsPlayer('voice-profile', new AbortController().signal, .8, {}, dependencies)

    player.start()
    const finished = player.finish()
    await Promise.resolve()
    socket.open()
    socket.message('{"type":"start","sample_rate":24000,"channels":1}')
    socket.message(new Int16Array([1, 2, 3, 4]).buffer)
    socket.message(new Int16Array([5, 6]).buffer)
    socket.message('{"type":"end"}')

    expect(audio.sources).toHaveLength(2)
    expect(audio.sources[1].startedAt).toBeGreaterThan(audio.sources[0].startedAt)
    expect(audio.sources[0].playbackRate.value).toBe(.8)
    audio.sources[0].finish()
    audio.sources[1].finish()
    await expect(finished).resolves.toBe('completed')
  })

  it('stops queued playback and sends a barge-in stop frame exactly once', async () => {
    const { socket, audio, dependencies } = harness()
    const controller = new AbortController()
    const player = new StreamingTtsPlayer('voice-profile', controller.signal, 1, {}, dependencies)

    player.start()
    await Promise.resolve()
    socket.open()
    socket.message('{"type":"start","sample_rate":24000,"channels":1}')
    socket.message(new Int16Array([1, 2]).buffer)
    controller.abort()
    controller.abort()

    await expect(player.finish()).resolves.toBe('stopped')
    expect(socket.sent.filter(frame => frame === '{"stop":true}')).toHaveLength(1)
    expect(audio.sources[0].stopped).toBe(true)
  })

  it('reports a broken stream without synthesizing a second response itself', async () => {
    const { socket, dependencies } = harness()
    const player = new StreamingTtsPlayer('voice-profile', new AbortController().signal, 1, {}, dependencies)

    player.start()
    const finished = player.finish()
    await Promise.resolve()
    socket.open()
    socket.fail()

    await expect(finished).resolves.toBe('failed')
    expect(player.hasProducedAudio).toBe(false)
  })
})
