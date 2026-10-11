import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Volume2 } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { useProfileScope } from '@/contexts/useProfileScope'
import { loadVoiceSettings, saveVoiceSettings, subscribeVoiceSettings, type VoiceSettings } from '../../cinematic/voice-settings'
import { AudioHologram } from './AudioHologram'
import type { JarvisWorkspaceProps } from '../../shell-types'

const labels = { idle: 'Bereit', listening: 'Aufnahme angefordert', processing: 'Sprache verarbeiten', thinking: 'Auftrag bearbeiten', speaking: 'Antwort wiedergeben', error: 'Unterbrochen' }

function responseText(props: JarvisWorkspaceProps) {
  return props.voiceResponse || props.result?.consolidated?.summary || props.result?.results?.map(item => item.summary).join('\n')
}

export function CinematicVoiceConsole(props: JarvisWorkspaceProps) {
  const { profile } = useProfileScope()
  const [settings, setSettings] = useState(() => loadVoiceSettings(profile))
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [permission, setPermission] = useState('Unbekannt')
  const [notice, setNotice] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stream = props.voiceStream
  const cancelVoice = props.onCancelVoice
  const locked = !!props.voiceBusy || !!props.busy
  useEffect(() => subscribeVoiceSettings(setSettings, profile), [profile])
  useEffect(() => () => cancelVoice?.(), [cancelVoice])
  useEffect(() => {
    let active = true
    let permissionStatus: PermissionStatus | undefined
    const updateDevices = () => {
      if (!navigator.mediaDevices?.enumerateDevices) return
      void navigator.mediaDevices.enumerateDevices().then(items => { if (active) setDevices(items.filter(item => item.kind === 'audioinput')) })
        .catch(() => { if (active) setNotice('Geräteliste nicht verfügbar. HTTPS und Browserberechtigung prüfen.') })
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
    if (!stream || typeof AudioContext === 'undefined') return
    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 128
    const source = context.createMediaStreamSource(stream)
    source.connect(analyser)
    const values = new Uint8Array(analyser.frequencyBinCount)
    const canvas = canvasRef.current
    let frame = 0
    const draw = () => {
      const ctx = canvas?.getContext('2d')
      if (!document.hidden && canvas && ctx) {
        analyser.getByteFrequencyData(values)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#67e8f9'
        values.forEach((value, index) => { const height = Math.max(2, value / 255 * 72); ctx.fillRect(index * 5, (72 - height) / 2, 3, height) })
      }
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(frame); source.disconnect(); void context.close(); canvas?.getContext('2d')?.clearRect(0, 0, 320, 72) }
  }, [stream])
  const update = (value: Partial<VoiceSettings>) => {
    const next = { ...settings, ...value }
    setSettings(next)
    setNotice(saveVoiceSettings(next, profile) ? 'Für dieses Profil in diesem Browser gespeichert.' : 'Browserspeicher gesperrt. Einstellungen gelten nur vorübergehend.')
  }
  const response = responseText(props)
  const stt = props.status?.voice.stt
  const tts = props.status?.voice.tts
  return <section className="command-panel voice-console" aria-label="Sprachsteuerung">
    <div className="voice-layout">
      <div className="voice-reactor">
        <AudioHologram state={props.voiceState} />
        <h2 className="mt-6">{labels[props.voiceState]}</h2>
        <dl className="operations-facts">
          <div><dt>Berechtigung</dt><dd>{stream ? 'Erlaubt' : permission}</dd></div>
          <div><dt>Mikrofon</dt><dd>{stream?.getAudioTracks()[0]?.label || (settings.sttEngine === 'browser-speech' ? 'Vom Browser verwaltet' : 'Nicht aktiv')}</dd></div>
          <div><dt>Aufnahme</dt><dd>{stream ? 'Aktiv' : props.voiceBusy === 'recording' && settings.sttEngine === 'browser-speech' ? 'Browser-Erkennung angefordert' : 'Aus'}</dd></div>
        </dl>
        <canvas aria-label="Mikrofon-Frequenzen" ref={canvasRef} width="320" height="72" className="voice-waveform" />
        <div className="command-actions">
          <Button disabled={locked && props.voiceBusy !== 'recording'} onClick={props.voiceBusy === 'recording' ? props.onStopVoice : props.onRecordVoice}>
            {props.voiceBusy === 'recording' ? <Square size={16} /> : <Mic size={16} />}
            {props.voiceBusy === 'recording' ? 'Aufnahme beenden' : 'Zuhören starten'}
          </Button>
          <Button outlined disabled={!props.voiceBusy} onClick={props.onCancelVoice}>Abbrechen</Button>
          <Button outlined disabled={!response || locked || !tts?.configured} onClick={() => response && props.onSpeak(response, settings.speed)}><Volume2 size={16} />Antwort sprechen</Button>
        </div>
        {props.voiceState === 'speaking' && <progress aria-label="Wiedergabefortschritt" max={1} value={props.voiceProgress ?? 0} />}
      </div>
      <div className="voice-settings">
        <h2>Spracheinstellungen</h2>
        <label className="command-field">Spracherkennung<select value={settings.sttEngine} disabled={locked} onChange={event => update({ sttEngine: event.target.value as VoiceSettings['sttEngine'] })}>
          <option value="whisper-local">Hermes-STT (Serverkonfiguration)</option><option value="browser-speech">Browser-Spracherkennung</option><option value="disabled">Deaktiviert</option>
        </select></label>
        <p>{settings.sttEngine === 'browser-speech' ? 'Der Browser kann Audio an seinen Sprachanbieter senden. Nur nach ausdrücklichem Start; Standardmikrofon des Browsers.' : stt?.configured ? `Gemeldeter STT-Anbieter: ${stt.provider || 'Serverkonfiguration'}` : 'STT nicht eingerichtet. Bitte im Hermes-Profil konfigurieren.'}</p>
        <label className="command-field">Eingabegerät<select disabled={locked || settings.sttEngine === 'browser-speech'} value={settings.deviceId ?? ''} onChange={event => update({ deviceId: event.target.value })}>
          <option value="">Systemstandard</option>{devices.filter(device => device.deviceId).map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Mikrofon ${index + 1}`}</option>)}
        </select></label>
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
      <details><summary>Sprachbefehle und Grenzen</summary><p>„Jarvis, prüfe meine Emails“, „Jarvis Status“, „Sprich langsamer“. Unbekannte Eingaben werden nur als Auftrag vorbereitet. Freie Gespräche bleiben im bestehenden Hermes Chat; hier entsteht keine zweite Chat-Sitzung.</p></details>
    </section>
  </section>
}
