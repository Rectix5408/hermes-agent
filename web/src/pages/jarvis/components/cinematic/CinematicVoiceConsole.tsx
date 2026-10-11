import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Volume2, RefreshCw, Headphones, ChevronDown, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { useProfileScope } from '@/contexts/useProfileScope'
import { loadVoiceSettings, saveVoiceSettings, subscribeVoiceSettings, type VoiceSettings } from '../../cinematic/voice-settings'
import { AudioHologram } from './AudioHologram'
import type { JarvisWorkspaceProps } from '../../shell-types'

const labels = { idle: 'Bereit für deine Stimme', listening: 'Jarvis hört zu', processing: 'Sprache wird erkannt', thinking: 'Jarvis verarbeitet die Anfrage', speaking: 'Jarvis antwortet', error: 'Sprachfunktion unterbrochen' }

function responseText(props: JarvisWorkspaceProps) {
  return props.voiceResponse?.trim() || props.result?.consolidated?.summary?.trim() || props.result?.results?.map(item => item.summary).filter(Boolean).join('\n').trim() || ''
}

export function CinematicVoiceConsole(props: JarvisWorkspaceProps) {
  const { profile: selectedProfile, currentProfile } = useProfileScope()
  const profile = selectedProfile || currentProfile
  const [settings, setSettings] = useState(() => loadVoiceSettings(profile))
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [permission, setPermission] = useState('Unbekannt')
  const [notice, setNotice] = useState('')
  const [deviceError, setDeviceError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stream = props.voiceStream
  const cancelVoice = useRef(props.onCancelVoice)
  const locked = !!props.voiceBusy || !!props.busy
  const recording = props.voiceBusy === 'recording'
  const browserMode = settings.sttEngine === 'browser-speech'
  const disabledMode = settings.sttEngine === 'disabled'
  const browserAvailable = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  const inputAvailable = browserMode ? browserAvailable : !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
  const chosenDevice = devices.find(device => device.deviceId === settings.deviceId)
  useEffect(() => {
    setSettings(loadVoiceSettings(profile))
    setNotice('')
    return subscribeVoiceSettings(setSettings, profile)
  }, [profile])
  useEffect(() => { cancelVoice.current = props.onCancelVoice }, [props.onCancelVoice])
  useEffect(() => () => cancelVoice.current?.(), [])
  useEffect(() => {
    let active = true
    let permissionStatus: PermissionStatus | undefined
    const updateDevices = () => {
      if (!navigator.mediaDevices?.enumerateDevices) { setDeviceError('Dieser Browser unterstützt keine Geräteauflistung.'); return }
      void navigator.mediaDevices.enumerateDevices().then(items => { if (active) { setDevices(items.filter(item => item.kind === 'audioinput')); setDeviceError('') } })
        .catch(() => { if (active) setDeviceError('Geräteliste nicht verfügbar. HTTPS und Browserberechtigung prüfen.') })
    }
    if (navigator.permissions?.query) void navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then(result => {
        if (!active) return
        permissionStatus = result
        const update = () => setPermission(result.state === 'granted' ? 'Erlaubt' : result.state === 'denied' ? 'Verweigert' : 'Noch nicht erteilt')
        update()
        result.onchange = update
      }).catch(() => { /* Safari may expose capture without microphone permission queries. */ })
    updateDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', updateDevices)
    return () => { active = false; if (permissionStatus) permissionStatus.onchange = null; navigator.mediaDevices?.removeEventListener?.('devicechange', updateDevices) }
  }, [stream])
  useEffect(() => {
    if (!stream?.active || typeof AudioContext === 'undefined') return
    let context: AudioContext
    try { context = new AudioContext() } catch { return }
    const analyser = context.createAnalyser()
    analyser.fftSize = 128
    const source = context.createMediaStreamSource(stream)
    source.connect(analyser)
    const values = new Uint8Array(analyser.frequencyBinCount)
    const canvas = canvasRef.current
    let frame: number | null = null
    const draw = () => {
      frame = null
      if (document.hidden) return
      const ctx = canvas?.getContext('2d')
      if (!document.hidden && canvas && ctx) {
        analyser.getByteFrequencyData(values)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#67e8f9'
        values.forEach((value, index) => { const height = Math.max(2, value / 255 * 72); ctx.fillRect(index * 5, (72 - height) / 2, 3, height) })
      }
      frame = requestAnimationFrame(draw)
    }
    const visibilityChanged = () => {
      if (document.hidden) { if (frame !== null) cancelAnimationFrame(frame); frame = null }
      else if (frame === null) draw()
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    draw()
    return () => { document.removeEventListener('visibilitychange', visibilityChanged); if (frame !== null) cancelAnimationFrame(frame); source.disconnect(); void context.close(); canvas?.getContext('2d')?.clearRect(0, 0, 320, 72) }
  }, [stream])
  const update = (value: Partial<VoiceSettings>) => {
    const next = { ...settings, ...value }
    setSettings(next)
    setNotice(saveVoiceSettings(next, profile) ? 'Für dieses Profil in diesem Browser gespeichert.' : 'Browserspeicher gesperrt. Einstellungen gelten nur vorübergehend.')
  }
  const response = responseText(props)
  const stt = props.status?.voice.stt
  const tts = props.status?.voice.tts
  const canStart = !locked && !disabledMode && inputAvailable && (browserMode || stt?.configured === true)
  const activeDeviceName = stream?.getAudioTracks()[0]?.label || chosenDevice?.label || (browserMode ? 'Standardmikrofon des Browsers' : 'Kein Mikrofon aktiv')
  const refreshDevices = async () => {
    try {
      const items = await navigator.mediaDevices.enumerateDevices()
      setDevices(items.filter(item => item.kind === 'audioinput')); setDeviceError('')
    } catch { setDeviceError('Mikrofonliste konnte nicht aktualisiert werden.') }
  }
  return <section className="command-panel voice-console" aria-label="HERMES Sprachsteuerung">
    <header><p className="text-xs uppercase tracking-widest text-cyan-300">HERMES Voice Control</p><h1>Sprich mit Jarvis</h1><p>Eine Aufnahme. Eine klare Antwort. Keine Hintergrundaufnahme.</p></header>
    <div className="voice-layout">
      <div className="voice-reactor">
        <AudioHologram state={props.voiceState} />
        <h2 className="mt-6" role="status">{labels[props.voiceState]}</h2>
        <dl className="operations-facts">
          <div><dt>Berechtigung</dt><dd>{stream ? 'Erlaubt' : permission}</dd></div>
          <div><dt>Mikrofon</dt><dd>{activeDeviceName}</dd></div>
          <div><dt>Aufnahme</dt><dd>{stream ? 'Aktiv' : props.voiceBusy === 'recording' && settings.sttEngine === 'browser-speech' ? 'Browser-Erkennung angefordert' : 'Aus'}</dd></div>
        </dl>
        <canvas aria-label="Mikrofon-Frequenzen" ref={canvasRef} width="320" height="72" className="voice-waveform" />
        <p>{stream?.active ? 'Live-Pegel des geöffneten Mikrofons' : 'Mikrofonpegel erscheint erst während einer Aufnahme'}</p>
        <div className="command-actions">
          <Button disabled={recording ? !!props.busy : !canStart} onClick={recording ? props.onStopVoice : props.onRecordVoice}>
            {props.voiceBusy === 'recording' ? <Square size={16} /> : <Mic size={16} />}
            {props.voiceBusy === 'recording' ? 'Aufnahme beenden' : 'Zuhören starten'}
          </Button>
          <Button outlined disabled={!props.voiceBusy} onClick={props.onCancelVoice}><X size={16} />Abbrechen</Button>
          <Button outlined disabled={!response || locked || !tts?.configured} onClick={() => response && props.onSpeak(response, settings.speed)}><Volume2 size={16} />Antwort sprechen</Button>
        </div>
        {props.voiceState === 'speaking' && <progress aria-label="Wiedergabefortschritt" max={1} value={Math.min(1, Math.max(0, props.voiceProgress ?? 0))} />}
        {!inputAvailable && !disabledMode && <p role="alert"><AlertCircle size={16} />{browserMode ? 'Browser Speech wird hier nicht unterstützt. Wähle Hermes-STT.' : 'Mikrofonaufnahme nicht verfügbar. Prüfe HTTPS und Browserberechtigungen.'}</p>}
      </div>
      <div className="voice-settings">
        <h2><Headphones size={18} />Spracheinstellungen</h2>
        <label className="command-field">Spracherkennung<select value={settings.sttEngine} disabled={locked} onChange={event => update({ sttEngine: event.target.value as VoiceSettings['sttEngine'] })}>
          <option value="whisper-local">Hermes-STT (Serverkonfiguration)</option><option value="browser-speech">Browser-Spracherkennung</option><option value="disabled">Deaktiviert</option>
        </select></label>
        <p>{settings.sttEngine === 'browser-speech' ? 'Der Browser kann Audio an seinen Sprachanbieter senden. Nur nach ausdrücklichem Start; Standardmikrofon des Browsers.' : stt?.configured ? `Gemeldeter STT-Anbieter: ${stt.provider || 'Serverkonfiguration'}` : 'STT nicht eingerichtet. Bitte im Hermes-Profil konfigurieren.'}</p>
        <label className="command-field">Eingabegerät<select disabled={locked || browserMode || !navigator.mediaDevices?.enumerateDevices} value={settings.deviceId ?? ''} onChange={event => update({ deviceId: event.target.value })}>
          <option value="">Systemstandard</option>{devices.filter(device => device.deviceId).map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Mikrofon ${index + 1}`}</option>)}
        </select></label>
        <Button outlined disabled={locked || !navigator.mediaDevices?.enumerateDevices} onClick={() => void refreshDevices()}><RefreshCw size={14} />Geräteliste aktualisieren</Button>
        {deviceError && <p role="alert">{deviceError}</p>}
        <p>Gerätenamen werden gegebenenfalls erst nach Erlaubnis sichtbar. Aufnahme höchstens 60 Sekunden; kein automatischer Neustart.</p>
        <p>Sprache: Deutsch (Browser). Hermes-STT verwendet die Serverkonfiguration.</p>
        <p>Sprachausgabe: {tts?.configured ? tts.provider || 'Konfigurierter Anbieter' : 'Nicht eingerichtet'}. Stimme und Voice-ID werden serverseitig verwaltet.</p>
        <label className="command-field">Wiedergabegeschwindigkeit · {settings.speed.toFixed(2)}×<input aria-label="Wiedergabegeschwindigkeit" type="range" min=".75" max="1.25" step=".05" value={settings.speed} onChange={event => update({ speed: Number(event.target.value) })} /></label>
        <p role="status">{notice}</p>
      </div>
    </div>
    <section className="voice-transcript" aria-label="Sprachprotokoll">
      <h2>Erkannt und beantwortet</h2>
      <p>Nur in dieser Profil-Sitzung, maximal 20 Einträge. Keine zusätzliche Speicherung im Browser.</p>
      {props.voiceHistory.length ? <ol>{props.voiceHistory.map(entry => <li key={entry.id}><time>{new Date(entry.timestamp).toLocaleTimeString('de-DE')}</time><p>{entry.text}</p><p>{entry.action}</p></li>)}</ol> : <p>Noch keine Spracheingabe.</p>}
      {response && <section aria-label="Hermes-Sprachantwort" aria-busy={props.voiceState === 'thinking'}><h3>Letzte Hermes-Antwort</h3><p className="whitespace-pre-wrap break-words">{response}</p></section>}
      <details><summary><ChevronDown size={16} />Technische Diagnose & Hinweise</summary>
        <p>{props.status?.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{props.status?.ok ? 'Hermes-Status erreichbar' : 'Hermes-Status nicht verfügbar'}</p>
        <p>STT: {disabledMode ? 'Deaktiviert' : browserMode ? browserAvailable ? 'Browser-Erkennung verfügbar (nicht getestet)' : 'Browser-Erkennung nicht unterstützt' : stt?.configured ? `${stt.provider || 'Hermes-STT'} konfiguriert (Verfügbarkeit nicht getestet)` : 'Hermes-STT nicht konfiguriert'}</p>
        <p>„Jarvis, prüfe meine Emails“, „Jarvis Status“, „Sprich langsamer“. Freie Spracheingaben gehen an die native Hermes-Engine. Die Sprachsitzung ist vom PTY-Chat getrennt. Gesprächspersistenz und Werkzeugrechte verwaltet Hermes; eine Freigabe erfolgt nie durch ein beiläufiges „Ja“.</p>
      </details>
    </section>
  </section>
}
