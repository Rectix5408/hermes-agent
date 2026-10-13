import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Volume2, RefreshCw, Headphones, ChevronDown, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { useProfileScope } from '@/contexts/useProfileScope'
import { loadVoiceSettings, saveVoiceSettings, subscribeVoiceSettings, type VoiceSettings } from '../../cinematic/voice-settings'
import { JarvisAvatarCore } from './JarvisAvatarCore'
import type { JarvisWorkspaceProps } from '../../shell-types'

const labels = { idle: 'Bereit für deine Stimme', listening: 'Jarvis hört zu', processing: 'Sprache wird erkannt', thinking: 'Jarvis verarbeitet die Anfrage', speaking: 'Jarvis antwortet', error: 'Sprachfunktion unterbrochen' }

function responseText(props: JarvisWorkspaceProps) {
  return props.voiceResponse?.trim() || props.result?.consolidated?.summary?.trim() || props.result?.results?.map(item => item.summary).filter(Boolean).join('\n').trim() || ''
}

function useVoiceConsole(props: JarvisWorkspaceProps) {
  const { profile: selectedProfile, currentProfile } = useProfileScope()
  const profile = selectedProfile || currentProfile
  const [settings, setSettings] = useState(() => loadVoiceSettings(profile))
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [permission, setPermission] = useState('Unbekannt')
  const [notice, setNotice] = useState('')
  const [deviceError, setDeviceError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestAudioLevel = useRef(0)
  const latestAudioLevelUpdate = useRef(0)
  const [audioLevel, setAudioLevel] = useState(0)
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
        const nextLevel = values.reduce((total, value) => total + value, 0) / (values.length * 255)
        const timestamp = performance.now()
        if (timestamp - latestAudioLevelUpdate.current >= 80 && Math.abs(nextLevel - latestAudioLevel.current) >= .025) {
          latestAudioLevel.current = nextLevel
          latestAudioLevelUpdate.current = timestamp
          setAudioLevel(nextLevel)
        }
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
    return () => {
      document.removeEventListener('visibilitychange', visibilityChanged)
      if (frame !== null) cancelAnimationFrame(frame)
      source.disconnect()
      void context.close()
      latestAudioLevel.current = 0
      canvas?.getContext('2d')?.clearRect(0, 0, 320, 72)
    }
  }, [stream])
  const update = (value: Partial<VoiceSettings>) => {
    const next = { ...settings, ...value }
    setSettings(next)
    setNotice(saveVoiceSettings(next, profile) ? 'Für dieses Profil in diesem Browser gespeichert.' : 'Browserspeicher gesperrt. Einstellungen gelten nur vorübergehend.')
  }
  const response = responseText(props)
  const stt = props.status?.voice.stt
  const tts = props.status?.voice.tts
  const canStart = !props.busy && (!props.voiceBusy || props.voiceBusy === 'speaking') && !disabledMode && inputAvailable && (browserMode || stt?.configured === true)
  const activeDeviceName = stream?.getAudioTracks()[0]?.label || chosenDevice?.label || (browserMode ? 'Standardmikrofon des Browsers' : 'Kein Mikrofon aktiv')
  const refreshDevices = async () => {
    try {
      const items = await navigator.mediaDevices.enumerateDevices()
      setDevices(items.filter(item => item.kind === 'audioinput')); setDeviceError('')
    } catch { setDeviceError('Mikrofonliste konnte nicht aktualisiert werden.') }
  }
  return { settings, devices, permission, notice, deviceError, canvasRef, stream, locked, recording, browserMode, disabledMode, browserAvailable, inputAvailable, audioLevel, update, response, stt, tts, canStart, activeDeviceName, refreshDevices }
}

interface VoicePanelProps { props: JarvisWorkspaceProps; view: ReturnType<typeof useVoiceConsole> }

function VoiceReactor({ props, view }: VoicePanelProps) {
  const { stream, permission, activeDeviceName, settings, canvasRef, recording, canStart, response, locked, tts, inputAvailable, disabledMode, browserMode, audioLevel } = view
  const latestTool = props.voiceTools?.at(-1)
  const liveStatus = props.voiceApproval
    ? 'Jarvis wartet auf deine Freigabe'
    : latestTool?.status === 'started'
      ? `Jarvis führt einen Werkzeugschritt aus: ${latestTool.name}`
      : labels[props.voiceState]
  return <div className="voice-reactor">
        <div className="voice-reactor-status" role="status">
          <span className={`voice-status-dot voice-status-dot-${props.voiceState}`} aria-hidden="true" />
          <span>Voice-Status</span>
          <strong>{liveStatus}</strong>
        </div>
        <div className="voice-core-stage">
        <JarvisAvatarCore
          voiceState={props.voiceState}
          approval={props.voiceApproval}
          tools={props.voiceTools}
          audioLevel={stream?.active ? audioLevel : 0}
        />
          <div className="voice-state-copy">
            <h2>{liveStatus}</h2>
            <p>Der sichtbare Status stammt aus der laufenden Voice-Sitzung.</p>
          </div>
        </div>
        <div className="voice-signal">
          <canvas aria-label="Mikrofon-Frequenzen" ref={canvasRef} width="320" height="72" className="voice-waveform" />
          <p>{stream?.active ? 'Live-Pegel des geöffneten Mikrofons' : 'Mikrofonpegel erscheint erst während einer Aufnahme'}</p>
        </div>
        <dl className="voice-facts">
          <div><dt>Berechtigung</dt><dd>{stream ? 'Erlaubt' : permission}</dd></div>
          <div><dt>Mikrofon</dt><dd>{activeDeviceName}</dd></div>
          <div><dt>Aufnahme</dt><dd>{stream ? 'Aktiv' : props.voiceBusy === 'recording' && settings.sttEngine === 'browser-speech' ? 'Browser-Erkennung angefordert' : 'Aus'}</dd></div>
        </dl>
        <div className="voice-action-deck">
          <Button className="voice-action voice-action-primary" disabled={recording ? !!props.busy : !canStart} onClick={recording ? props.onStopVoice : props.onRecordVoice}>
            {props.voiceBusy === 'recording' ? <Square size={16} /> : <Mic size={16} />}
            <span><strong>{recording ? 'Aufnahme beenden' : props.voiceBusy === 'speaking' ? 'Unterbrechen und sprechen' : 'Zuhören starten'}</strong><small>{recording ? 'Diese Aufnahme sicher abschließen' : 'Mikrofon nur bewusst aktivieren'}</small></span>
          </Button>
          <Button className="voice-action voice-action-cancel" outlined disabled={!props.voiceBusy} onClick={props.onCancelVoice}><X size={16} /><span><strong>Abbrechen</strong><small>Aktuelle Sitzung beenden</small></span></Button>
          {props.onContinuousVoiceChange && <Button className="voice-action voice-action-mode" outlined aria-pressed={props.continuousVoice} disabled={!!props.busy} onClick={() => props.onContinuousVoiceChange?.(!props.continuousVoice)}>
            <span className="voice-mode-toggle" aria-hidden="true"><span /></span><span><strong>Fortlaufender Dialog</strong><small>{props.continuousVoice ? 'Aktiv – nächste Aufnahme folgt nach der Antwort' : 'Aus – jede Aufnahme wird einzeln gestartet'}</small></span>
          </Button>}
          <Button className="voice-action voice-action-speak" outlined disabled={!response || locked || !tts?.configured} onClick={() => response && props.onSpeak(response, settings.speed)}><Volume2 size={16} /><span><strong>Antwort sprechen</strong><small>Letzte Antwort wiedergeben</small></span></Button>
        </div>
        <p className="voice-privacy-note" role="status">{props.continuousVoice
          ? 'Fortlaufender Dialog aktiv: Nach einer vollständig beendeten Antwort öffnet Jarvis die nächste Aufnahme. Mit „Abbrechen“ stoppst du sofort.'
          : 'Mikrofon bleibt aus, bis du bewusst „Zuhören starten“ wählst.'}</p>
        {props.voiceState === 'speaking' && <progress className="voice-progress" aria-label="Wiedergabefortschritt" max={1} value={Math.min(1, Math.max(0, props.voiceProgress ?? 0))} />}
        {!inputAvailable && !disabledMode && <p className="voice-alert" role="alert"><AlertCircle size={16} />{browserMode ? 'Browser Speech wird hier nicht unterstützt. Wähle Hermes-STT.' : 'Mikrofonaufnahme nicht verfügbar. Prüfe HTTPS und Browserberechtigungen.'}</p>}
      </div>
}

function VoiceSettingsPanel({ view }: VoicePanelProps) {
  const { settings, locked, update, stt, browserMode, devices, refreshDevices, deviceError, tts, notice } = view
  return <div className="voice-settings">
        <header className="voice-settings-header"><span className="voice-settings-icon"><Headphones size={18} /></span><div><h2>Spracheinstellungen</h2><p>Erkennung und Wiedergabe für dieses Profil.</p></div></header>
        <section className="voice-settings-group">
        <label className="command-field"><span>Spracherkennung</span><select value={settings.sttEngine} disabled={locked} onChange={event => update({ sttEngine: event.target.value as VoiceSettings['sttEngine'] })}>
          <option value="whisper-local">Hermes-STT (Serverkonfiguration)</option><option value="browser-speech">Browser-Spracherkennung</option><option value="disabled">Deaktiviert</option>
        </select></label>
        <p className="voice-setting-help">{settings.sttEngine === 'browser-speech' ? 'Der Browser kann Audio an seinen Sprachanbieter senden. Nur nach ausdrücklichem Start; Standardmikrofon des Browsers.' : stt?.configured ? `Gemeldeter STT-Anbieter: ${stt.provider || 'Serverkonfiguration'}` : 'STT nicht eingerichtet. Bitte im Hermes-Profil konfigurieren.'}</p>
        </section>
        <section className="voice-settings-group">
        <label className="command-field"><span>Eingabegerät</span><select disabled={locked || browserMode || !navigator.mediaDevices?.enumerateDevices} value={settings.deviceId ?? ''} onChange={event => update({ deviceId: event.target.value })}>
          <option value="">Systemstandard</option>{devices.filter(device => device.deviceId).map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Mikrofon ${index + 1}`}</option>)}
        </select></label>
        <Button className="voice-refresh" outlined disabled={locked || !navigator.mediaDevices?.enumerateDevices} onClick={() => void refreshDevices()}><RefreshCw size={14} />Geräteliste aktualisieren</Button>
        {deviceError && <p className="voice-alert" role="alert">{deviceError}</p>}
        <p className="voice-setting-help">Gerätenamen werden gegebenenfalls erst nach Erlaubnis sichtbar. Aufnahme höchstens 60 Sekunden; kein automatischer Neustart.</p>
        </section>
        <section className="voice-settings-group voice-output-settings">
          <h3>Sprachausgabe</h3>
          <p className="voice-setting-help">Sprache: Deutsch (Browser). Hermes-STT verwendet die Serverkonfiguration.</p>
          <p className="voice-setting-help">{tts?.configured ? `Anbieter: ${tts.provider || 'Konfigurierter Anbieter'}. Stimme und Voice-ID werden serverseitig verwaltet.` : 'Sprachausgabe ist für dieses Profil nicht eingerichtet.'}</p>
          <label className="command-field"><span>Wiedergabegeschwindigkeit <strong>{settings.speed.toFixed(2)}×</strong></span><input aria-label="Wiedergabegeschwindigkeit" type="range" min=".75" max="1.25" step=".05" value={settings.speed} onChange={event => update({ speed: Number(event.target.value) })} /></label>
        </section>
        {notice && <p className="voice-settings-notice" role="status">{notice}</p>}
      </div>
}

function VoiceTranscript({ props, view }: VoicePanelProps) {
  const { response, locked, disabledMode, browserMode, browserAvailable, stt } = view
  const latestTool = props.voiceTools?.at(-1)
  return <section className="voice-transcript" aria-label="Sprachprotokoll">
      <header><div><p className="voice-section-label">Sitzungsprotokoll</p><h2>Erkannt und beantwortet</h2><p>Nur in dieser Profil-Sitzung, maximal 20 Einträge. Keine zusätzliche Speicherung im Browser.</p></div></header>
      {props.voiceHistory.length ? <ol>{props.voiceHistory.map(entry => <li key={entry.id}><time>{new Date(entry.timestamp).toLocaleTimeString('de-DE')}</time><p>{entry.text}</p><p>{entry.action}</p></li>)}</ol> : <p>Noch keine Spracheingabe.</p>}
      {response && <section aria-label="Hermes-Sprachantwort" aria-busy={props.voiceState === 'thinking'}><h3>Letzte Hermes-Antwort</h3><p className="whitespace-pre-wrap break-words">{response}</p></section>}
      {!!props.voiceTools?.length && <section aria-label="Gemeldete Werkzeugaktivität"><h3>Werkzeugaktivität dieser Anfrage</h3>{latestTool?.status === 'started' && <p role="status">Jarvis führt den gemeldeten Werkzeugschritt aus. Es wird kein Ergebnis vorweggenommen.</p>}<ul>{props.voiceTools.map((activity, index) => <li key={index}>{activity.name} · {activity.status === 'started' ? 'Gestartet' : 'Beendet (kein Erfolgsnachweis)'}</li>)}</ul></section>}
      {props.onContinueVoiceInChat && <Button outlined disabled={locked} onClick={props.onContinueVoiceInChat}>Gespräch im Hermes Chat fortsetzen</Button>}
      <details><summary><ChevronDown size={16} />Technische Diagnose & Hinweise</summary>
        <p>{props.status?.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{props.status?.ok ? 'Hermes-Status erreichbar' : 'Hermes-Status nicht verfügbar'}</p>
        <p>STT: {disabledMode ? 'Deaktiviert' : browserMode ? browserAvailable ? 'Browser-Erkennung verfügbar (nicht getestet)' : 'Browser-Erkennung nicht unterstützt' : stt?.configured ? `${stt.provider || 'Hermes-STT'} konfiguriert (Verfügbarkeit nicht getestet)` : 'Hermes-STT nicht konfiguriert'}</p>
        <p>„Jarvis, prüfe meine Emails“, „Jarvis Status“, „Sprich langsamer“. Freie Spracheingaben gehen an die native Hermes-Engine. Voice besitzt eine eigene Sitzung; „Gespräch im Hermes Chat fortsetzen“ übergibt denselben gespeicherten Verlauf an den PTY-Chat und beendet Voice. Kein gleichzeitiger Schreibzugriff. Gesprächspersistenz und Werkzeugrechte verwaltet Hermes; eine Freigabe erfolgt nie durch ein beiläufiges „Ja“.</p>
      </details>
    </section>
}

export function CinematicVoiceConsole(props: JarvisWorkspaceProps) {
  const view = useVoiceConsole(props)
  return <section className="command-panel voice-console" aria-label="HERMES Sprachsteuerung">
    <header className="voice-console-header"><div><p className="voice-section-label">Hermes Voice Control</p><h1>Sprich mit Jarvis</h1><p>Freier Dialog in einer Profil-Sitzung. Das Mikrofon bleibt ohne bewusste Aktivierung aus.</p></div><span className={`voice-ready-chip voice-ready-chip-${props.voiceState}`} role="status"><span aria-hidden="true" />{labels[props.voiceState]}</span></header>
    <div className="voice-layout">
      <VoiceReactor props={props} view={view} />
      <VoiceSettingsPanel props={props} view={view} />
    </div>
    <VoiceTranscript props={props} view={view} />
  </section>
}
