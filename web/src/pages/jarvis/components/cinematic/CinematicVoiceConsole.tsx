import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Volume2 } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import type { JarvisStatusResponse } from '@/lib/api'
import { loadVoiceSettings, saveVoiceSettings, type VoiceSettings } from '../../cinematic/voice-settings'
import { AudioHologram, type HologramState } from './AudioHologram'

interface CinematicVoiceConsoleProps {
  status: JarvisStatusResponse | null
  voiceBusy: 'recording' | 'transcribing' | 'speaking' | null
  response?: string
  onRecordVoice: () => void
  onSpeak: (text: string, speed?: number) => void
}

export function CinematicVoiceConsole({ status, voiceBusy, response, onRecordVoice, onSpeak }: CinematicVoiceConsoleProps) {
  const [settings, setSettings] = useState(loadVoiceSettings)
  const [state, setState] = useState<HologramState>('idle')
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [error, setError] = useState('')
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number | null>(null)

  const stop = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    void contextRef.current?.close()
    contextRef.current = null
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    setState('idle')
  }

  useEffect(() => {
    if (!navigator.permissions?.query) return
    let status: PermissionStatus | undefined
    void navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
      status = result
      setPermission(result.state === 'prompt' ? 'unknown' : result.state)
      result.onchange = () => setPermission(result.state === 'prompt' ? 'unknown' : result.state)
    })
    return () => { if (status) status.onchange = null }
  }, [])
  useEffect(() => () => stop(), [])
  useEffect(() => { saveVoiceSettings(settings) }, [settings])

  const updateSettings = (next: Partial<VoiceSettings>) => setSettings(value => ({ ...value, ...next }))
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setError('Browser microphone is unavailable.')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      updateSettings({ microphoneRequested: true })
      setPermission('granted')
      setError('')
      setState('listening')
      const context = new AudioContext()
      contextRef.current = context
      const analyser = context.createAnalyser()
      analyser.fftSize = 64
      context.createMediaStreamSource(stream).connect(analyser)
      const values = new Uint8Array(analyser.frequencyBinCount)
      const draw = () => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (canvas && ctx) {
          analyser.getByteFrequencyData(values)
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          values.forEach((value, index) => {
            const height = Math.max(3, value / 255 * canvas.height)
            ctx.fillStyle = '#67e8f9'
            ctx.fillRect(index * 7, (canvas.height - height) / 2, 3, height)
          })
        }
        frameRef.current = requestAnimationFrame(draw)
      }
      draw()
    } catch {
      setPermission('denied')
      setError('Microphone permission was not granted.')
    }
  }

  const liveState: HologramState = voiceBusy === 'recording' ? 'listening' : voiceBusy === 'transcribing' ? 'thinking' : voiceBusy === 'speaking' ? 'speaking' : state
  const stt = status?.voice.stt
  const tts = status?.voice.tts
  return <section id="jarvis-voice-cinematic" className="jarvis-glass relative overflow-hidden p-5">
    <div className="jarvis-scanline" />
    <div className="relative grid items-center gap-5 lg:grid-cols-[minmax(18rem,.8fr)_minmax(0,1fr)_minmax(18rem,.7fr)]">
      <div className="text-center">
        <AudioHologram state={liveState} />
        <p className="mt-4 text-xs uppercase tracking-[.22em] text-cyan-300/80">Voice Intelligence</p>
        <p className="mt-1 text-xl text-slate-100">{liveState.toUpperCase()}</p>
        <p className="mt-2 text-xs text-slate-500">Permission: {permission} · reconnect {settings.microphoneRequested ? 'requested' : 'off'}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[.22em] text-cyan-300/80">Voice Core Console</p>
        <h2 className="mt-1 text-2xl font-medium text-slate-100">Conversational Control</h2>
        <p className="mt-2 text-sm text-slate-500">Browser-Mikrofon → Hermes STT → Command Router → Orchestrierung → TTS.</p>
        <canvas ref={canvasRef} width="224" height="72" className="mt-6 h-18 w-full border-y border-cyan-300/15 bg-slate-950/60" />
        <div className="mt-5 flex flex-wrap gap-2">
          {state === 'listening' ? <Button onClick={stop}><Square className="h-4 w-4" />Audio-Monitor stoppen</Button> : <Button onClick={() => void start()}><Mic className="h-4 w-4" />Audio-Monitor</Button>}
          <Button onClick={onRecordVoice} disabled={!!voiceBusy}><Mic className="h-4 w-4" />{voiceBusy === 'recording' ? 'Aufnahme läuft' : 'Befehl aufnehmen'}</Button>
          <Button outlined onClick={() => response && onSpeak(response, settings.speed)} disabled={!response || !!voiceBusy}><Volume2 className="h-4 w-4" />Antwort sprechen</Button>
        </div>
        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
      </div>
      <div className="border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-[.16em] text-slate-500">Voice settings</p>
        <Setting label="STT engine" value={stt?.provider ?? stt?.available ?? 'Nicht konfiguriert'} />
        <Setting label="Language" value={settings.language === 'de' ? 'Deutsch' : settings.language} />
        <Setting label="TTS provider" value={tts?.provider ?? tts?.available ?? 'Nicht konfiguriert'} />
        <label className="mt-3 block text-xs text-slate-400">Voice<select value={settings.voice} onChange={event => updateSettings({ voice: event.target.value })} className="mt-1 block w-full border border-white/10 bg-slate-950 p-2 text-sm text-slate-100"><option>Jarvis Voice</option><option>Calm Assistant</option></select></label>
        <label className="mt-3 block text-xs text-slate-400">Speed <span className="float-right text-cyan-200">{settings.speed.toFixed(2)}×</span><input type="range" min="0.75" max="1.25" step="0.05" value={settings.speed} onChange={event => updateSettings({ speed: Number(event.target.value) })} className="mt-2 w-full accent-cyan-300" /></label>
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Volume2 className="h-3.5 w-3.5" /> Wiedergabegeschwindigkeit wird auf die echte TTS-Antwort angewandt.</p>
      </div>
    </div>
  </section>
}
function Setting({ label, value }: { label: string; value: string }) { return <div className="mt-3 border-b border-white/10 pb-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm text-slate-200">{value}</p></div> }
