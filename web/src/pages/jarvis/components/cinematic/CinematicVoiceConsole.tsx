import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Volume2 } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import type { JarvisStatusResponse } from '@/lib/api'
import { loadVoiceSettings, saveVoiceSettings, subscribeVoiceSettings, type VoiceSettings } from '../../cinematic/voice-settings'
import { AudioHologram, type HologramState } from './AudioHologram'
import { microphoneErrorMessage, type ProductionVoiceState, type VoiceHistoryEntry } from '../../voice-runtime/production-state'

interface CinematicVoiceConsoleProps {
  status: JarvisStatusResponse | null
  voiceBusy: 'recording' | 'transcribing' | 'thinking' | 'speaking' | null
  voiceState: ProductionVoiceState
  history: VoiceHistoryEntry[]
  response?: string
  onRecordVoice: () => void
  onStopVoice: () => void
  onTranscript: (transcript: string) => void
  onSpeak: (text: string, speed?: number) => void
}

interface BrowserRecognition { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void }
type BrowserRecognitionConstructor = new () => BrowserRecognition

export function CinematicVoiceConsole({ status, voiceBusy, voiceState, history, response, onRecordVoice, onStopVoice, onTranscript, onSpeak }: CinematicVoiceConsoleProps) {
  const [settings, setSettings] = useState(loadVoiceSettings)
  const [state, setState] = useState<HologramState>('idle')
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [device, setDevice] = useState('Standardmikrofon')
  const [browserListening, setBrowserListening] = useState(false)
  const [error, setError] = useState('')
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number | null>(null)
  const recognitionRef = useRef<BrowserRecognition | null>(null)

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
  useEffect(() => subscribeVoiceSettings(setSettings), [])

  const updateSettings = (next: Partial<VoiceSettings>) => setSettings(value => ({ ...value, ...next }))
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setError('Mikrofon ist in diesem Browser nicht verfügbar.')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setDevice(stream.getAudioTracks()[0]?.label || 'Standardmikrofon')
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
    } catch (error) {
      setPermission('denied')
      setError(microphoneErrorMessage(error))
    }
  }

  const startListening = () => {
    if (settings.sttEngine === 'disabled') return setError('STT Engine Offline · wähle Whisper Local oder Browser Speech.')
    if (settings.sttEngine === 'whisper-local') return onRecordVoice()
    const recognitionWindow = window as unknown as { SpeechRecognition?: BrowserRecognitionConstructor; webkitSpeechRecognition?: BrowserRecognitionConstructor }
    const Recognition = recognitionWindow.SpeechRecognition ?? recognitionWindow.webkitSpeechRecognition
    if (!Recognition) return setError('Browser Speech ist in diesem Browser nicht verfügbar.')
    const recognition = new Recognition()
    recognition.lang = 'de-DE'; recognition.continuous = false; recognition.interimResults = false
    recognition.onresult = event => { const transcript = event.results[0]?.[0]?.transcript.trim(); if (transcript) onTranscript(transcript) }
    recognition.onerror = () => setError('Browser Speech konnte keine Sprache erkennen.')
    recognition.onend = () => { recognitionRef.current = null; setBrowserListening(false); setState('idle') }
    recognitionRef.current = recognition; setError(''); setBrowserListening(true); setState('listening'); recognition.start()
  }
  const stopListening = () => { if (recognitionRef.current) { recognitionRef.current.stop(); return } if (voiceBusy === 'recording') onStopVoice(); stop() }

  const liveState: HologramState = error || voiceState === 'error' ? 'error' : voiceState === 'processing' ? 'processing' : voiceState === 'thinking' ? 'thinking' : voiceState === 'speaking' ? 'speaking' : voiceState === 'listening' || voiceBusy === 'recording' ? 'listening' : state
  const stt = status?.voice.stt
  const tts = status?.voice.tts
  const sttRuntimeStatus = voiceBusy === 'transcribing' ? 'LOADING' : stt?.configured ? 'READY' : 'OFFLINE'
  return <section id="jarvis-voice-cinematic" className="jarvis-glass relative overflow-hidden p-5">
    <div className="jarvis-scanline" />
    <div className="relative grid items-center gap-5 lg:grid-cols-[minmax(18rem,.8fr)_minmax(0,1fr)_minmax(18rem,.7fr)]">
      <div className="text-center">
        <AudioHologram state={liveState} />
        <p className="mt-4 text-xs uppercase tracking-[.22em] text-cyan-300/80">Voice Intelligence</p>
        <p className="mt-1 text-xl text-slate-100">{liveState === 'processing' ? 'PROCESSING' : liveState.toUpperCase()}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-left text-[10px] uppercase tracking-[.08em] text-slate-500"><StatusMetric label="Permission" value={permission} /><StatusMetric label="Device" value={device} /><StatusMetric label="Recording" value={voiceBusy === 'recording' || state === 'listening' ? 'On' : 'Off'} /></div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[.22em] text-cyan-300/80">Voice Core Console</p>
        <h2 className="mt-1 text-2xl font-medium text-slate-100">Conversational Control</h2>
        <p className="mt-2 text-sm text-slate-500">Browser-Mikrofon → Hermes STT → Command Router → Orchestrierung → TTS.</p>
        <canvas ref={canvasRef} width="224" height="72" className="mt-6 h-18 w-full border-y border-cyan-300/15 bg-slate-950/60" />
        <div className="mt-5 flex flex-wrap gap-2">
          {state === 'listening' ? <Button onClick={stop}><Square className="h-4 w-4" />Audio-Monitor stoppen</Button> : <Button onClick={() => void start()}><Mic className="h-4 w-4" />Audio-Monitor</Button>}
          <Button onClick={voiceBusy === 'recording' || browserListening ? stopListening : startListening} disabled={!!voiceBusy && voiceBusy !== 'recording'}><Mic className="h-4 w-4" />{voiceBusy === 'recording' || browserListening ? 'Stop Listening' : 'Start Listening'}</Button>
          <Button outlined onClick={() => response && onSpeak(response, settings.speed)} disabled={!response || !!voiceBusy}><Volume2 className="h-4 w-4" />Antwort sprechen</Button>
        </div>
        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
      </div>
      <div className="border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-[.16em] text-slate-500">Voice settings</p>
        <label className="mt-3 block text-xs text-slate-400">STT Engine<select value={settings.sttEngine} onChange={event => updateSettings({ sttEngine: event.target.value as VoiceSettings['sttEngine'] })} className="mt-1 block w-full border border-white/10 bg-slate-950 p-2 text-sm text-slate-100"><option value="whisper-local">Whisper Local</option><option value="browser-speech">Browser Speech</option><option value="disabled">Disabled</option></select></label>
        <Setting label="Local Whisper Model" value={sttRuntimeStatus} />
        <Setting label="Hermes STT Status" value={providerLabel(stt?.provider ?? stt?.available, 'STT Engine Offline · lokale Whisper-Installation abwarten')} />
        <Setting label="Language" value={settings.language === 'de' ? 'Deutsch' : settings.language} />
        <Setting label="TTS provider" value={providerLabel(tts?.provider ?? tts?.available, 'TTS Engine Offline · ElevenLabs-Konfiguration prüfen')} />
        <label className="mt-3 block text-xs text-slate-400">Voice<select value={settings.voice} onChange={event => updateSettings({ voice: event.target.value })} className="mt-1 block w-full border border-white/10 bg-slate-950 p-2 text-sm text-slate-100"><option>Jarvis Voice</option><option>Calm Assistant</option></select></label>
        <label className="mt-3 block text-xs text-slate-400">Voice ID<input value={settings.voiceId} onChange={event => updateSettings({ voiceId: event.target.value })} placeholder="Vom ElevenLabs-Profil verwaltet" className="mt-1 block w-full border border-white/10 bg-slate-950 p-2 text-sm text-slate-100 placeholder:text-slate-600" /></label>
        <label className="mt-3 block text-xs text-slate-400">Speed <span className="float-right text-cyan-200">{settings.speed.toFixed(2)}×</span><input type="range" min="0.75" max="1.25" step="0.05" value={settings.speed} onChange={event => updateSettings({ speed: Number(event.target.value) })} className="mt-2 w-full accent-cyan-300" /></label>
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Volume2 className="h-3.5 w-3.5" /> Wiedergabegeschwindigkeit wird auf die echte TTS-Antwort angewandt.</p>
      </div>
    </div><VoiceHistory history={history} />
  </section>
}
function Setting({ label, value }: { label: string; value: string }) { return <div className="mt-3 border-b border-white/10 pb-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm text-slate-200">{value}</p></div> }
function StatusMetric({ label, value }: { label: string; value: string }) { return <div className="border border-white/10 bg-black/20 p-2"><p>{label}</p><p className="mt-1 truncate text-cyan-100" title={value}>{value}</p></div> }
function providerLabel(value: string | null | undefined, fallback: string): string { if (!value || value === 'not_configured' || value === 'unavailable') return fallback; return value }
function VoiceHistory({ history }: { history: VoiceHistoryEntry[] }) { return <div className="relative mt-5 border-t border-cyan-300/15 pt-4"><p className="text-xs uppercase tracking-[.16em] text-cyan-300/80">Letzte Befehle</p>{history.length ? <ol className="mt-3 grid gap-2 md:grid-cols-2">{history.map(entry => <li key={entry.id} className="border border-white/10 bg-black/20 p-2 text-xs"><p className="text-slate-500">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {entry.action}</p><p className="mt-1 truncate text-slate-200">{entry.text}</p></li>)}</ol> : <p className="mt-2 text-xs text-slate-500">Nur für diese Sitzung. Keine Befehle gespeichert.</p>}</div> }
