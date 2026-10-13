import { api } from '@/lib/api'

export type StreamPlaybackResult = 'completed' | 'fallback' | 'failed' | 'stopped'

interface StreamSocket {
  readyState: number
  binaryType: BinaryType
  onopen: ((event: Event) => void) | null
  onerror: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  send(data: string): void
  close(): void
}

interface AudioSource {
  buffer: AudioBuffer | null
  playbackRate: AudioParam
  onended: ((event: Event) => void) | null
  connect(destination: AudioNode): void
  start(when?: number): void
  stop(): void
}

interface AudioOutput {
  currentTime: number
  destination: AudioNode
  state: string
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer
  createBufferSource(): AudioSource
  resume(): Promise<void>
  close(): Promise<void>
}

export interface StreamingTtsDependencies {
  buildUrl: (profile: string) => Promise<string>
  createSocket: (url: string) => StreamSocket
  createAudio: () => AudioOutput
}

export interface StreamingTtsCallbacks {
  onAudioStart?: () => void
  onFailure?: () => void
}

const defaultDependencies: StreamingTtsDependencies = {
  buildUrl: profile => api.buildWsUrl('/api/audio/speak-stream', { profile }),
  createSocket: url => new WebSocket(url),
  createAudio: () => new AudioContext(),
}

function int16ToAudioBuffer(audio: AudioOutput, data: ArrayBuffer, sampleRate: number): AudioBuffer | null {
  const input = new Int16Array(data)
  if (!input.length) return null
  const buffer = audio.createBuffer(1, input.length, sampleRate)
  const output = buffer.getChannelData(0)
  for (let index = 0; index < input.length; index += 1) output[index] = input[index] / 32768
  return buffer
}

/**
 * One voice turn's server-backed PCM queue. Text deltas can arrive before the
 * authenticated socket opens; they are held in memory for this turn only.
 */
export class StreamingTtsPlayer {
  private readonly dependencies: StreamingTtsDependencies
  private readonly callbacks: StreamingTtsCallbacks
  private readonly speed: number
  private socket: StreamSocket | null = null
  private audio: AudioOutput | null = null
  private sampleRate = 0
  private nextStart = 0
  private sources = new Set<AudioSource>()
  private pendingText: string[] = []
  private doneRequested = false
  private serverEnded = false
  private stopped = false
  private producedAudio = false
  private settled = false
  private opened = false
  private connectionTimer: ReturnType<typeof setTimeout> | null = null
  private readonly profile: string
  private readonly finished: Promise<StreamPlaybackResult>
  private settleFinished!: (result: StreamPlaybackResult) => void

  constructor(
    profile: string,
    signal: AbortSignal,
    speed: number,
    callbacks: StreamingTtsCallbacks = {},
    dependencies: StreamingTtsDependencies = defaultDependencies,
  ) {
    this.profile = profile
    this.dependencies = dependencies
    this.callbacks = callbacks
    this.speed = Math.max(.75, Math.min(1.25, speed))
    this.finished = new Promise(resolve => { this.settleFinished = resolve })
    signal.addEventListener('abort', () => this.stop(), { once: true })
  }

  start(): void {
    void this.connect()
  }

  get hasProducedAudio(): boolean {
    return this.producedAudio
  }

  push(text: string): void {
    if (!text || this.stopped || this.settled) return
    if (!this.opened || !this.socket) {
      this.pendingText.push(text)
      return
    }
    this.socket.send(JSON.stringify({ text }))
  }

  async finish(): Promise<StreamPlaybackResult> {
    this.doneRequested = true
    if (this.opened) this.sendDone()
    return this.finished
  }

  stop(): void {
    if (this.stopped || this.settled) return
    this.stopped = true
    try {
      if (this.opened) this.socket?.send(JSON.stringify({ stop: true }))
    } catch {
      // Closing the socket below is sufficient when a network tear-down won.
    }
    this.socket?.close()
    this.stopAudio()
    this.settle('stopped')
  }

  private async connect(): Promise<void> {
    try {
      const url = await this.dependencies.buildUrl(this.profile)
      if (this.stopped || this.settled) return
      const socket = this.dependencies.createSocket(url)
      socket.binaryType = 'arraybuffer'
      this.socket = socket
      this.connectionTimer = setTimeout(() => this.fail(), 15_000)
      socket.onopen = () => {
        if (this.stopped || this.settled) return
        this.clearConnectionTimer()
        this.opened = true
        for (const text of this.pendingText.splice(0)) this.push(text)
        if (this.doneRequested) this.sendDone()
      }
      socket.onerror = () => this.fail()
      socket.onclose = () => {
        if (!this.stopped && !this.serverEnded) this.fail()
      }
      socket.onmessage = event => this.handleMessage(event.data)
    } catch {
      this.fail()
    }
  }

  private sendDone(): void {
    if (!this.opened || this.stopped || this.settled) return
    try {
      this.socket?.send(JSON.stringify({ done: true }))
    } catch {
      this.fail()
    }
  }

  private handleMessage(data: unknown): void {
    if (this.stopped || this.settled) return
    if (typeof data === 'string') {
      try {
        const frame = JSON.parse(data) as { type?: unknown; sample_rate?: unknown }
        if (frame.type === 'start' && typeof frame.sample_rate === 'number' && frame.sample_rate >= 8_000 && frame.sample_rate <= 48_000) {
          this.sampleRate = frame.sample_rate
          return
        }
        if (frame.type === 'fallback') {
          this.serverEnded = true
          this.settle('fallback')
          return
        }
        if (frame.type === 'end') {
          this.serverEnded = true
          this.finishPlayback()
          return
        }
      } catch {
        this.fail()
      }
      return
    }
    if (data instanceof ArrayBuffer) this.enqueueAudio(data)
  }

  private enqueueAudio(data: ArrayBuffer): void {
    if (!this.sampleRate) {
      this.fail()
      return
    }
    try {
      if (!this.audio) this.audio = this.dependencies.createAudio()
      const audio = this.audio
      const buffer = int16ToAudioBuffer(audio, data, this.sampleRate)
      if (!buffer) return
      const source = audio.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = this.speed
      source.connect(audio.destination)
      const when = Math.max(audio.currentTime + .03, this.nextStart)
      this.nextStart = when + buffer.duration / this.speed
      this.sources.add(source)
      source.onended = () => {
        this.sources.delete(source)
        if (this.serverEnded && !this.sources.size) this.settle('completed')
      }
      this.producedAudio = true
      this.callbacks.onAudioStart?.()
      void audio.resume().catch(() => this.fail())
      source.start(when)
    } catch {
      this.fail()
    }
  }

  private finishPlayback(): void {
    if (!this.producedAudio || !this.sources.size) {
      this.settle(this.producedAudio ? 'completed' : 'fallback')
    }
  }

  private fail(): void {
    if (this.stopped || this.settled) return
    this.callbacks.onFailure?.()
    this.stopAudio()
    this.settle('failed')
  }

  private stopAudio(): void {
    for (const source of this.sources) {
      source.onended = null
      try { source.stop() } catch { /* A finished source is already stopped. */ }
    }
    this.sources.clear()
    if (this.audio && this.audio.state !== 'closed') void this.audio.close()
    this.audio = null
  }

  private settle(result: StreamPlaybackResult): void {
    if (this.settled) return
    this.settled = true
    this.clearConnectionTimer()
    this.socket?.close()
    this.settleFinished(result)
  }

  private clearConnectionTimer(): void {
    if (this.connectionTimer === null) return
    clearTimeout(this.connectionTimer)
    this.connectionTimer = null
  }
}
