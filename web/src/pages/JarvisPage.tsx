import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { Toast } from '@nous-research/ui/ui/components/toast'
import { useToast } from '@nous-research/ui/hooks/use-toast'
import { api } from '@/lib/api'
import type { JarvisOrchestrationResponse, JarvisStatusResponse, MemoryStatus } from '@/lib/api'
import { ApiError, errorMessage } from '@/lib/api-error'
import { useProfileScope } from '@/contexts/useProfileScope'
import { usePageHeader } from '@/contexts/usePageHeader'
import { JarvisShell } from './jarvis/JarvisShell'
import { emit } from './jarvis/runtime/event-bus'
import { routeVoiceCommand } from './jarvis/cinematic/voice-command-router'
import { applyVoiceSpeedCommand } from './jarvis/cinematic/voice-settings'
import { appendVoiceHistory, microphoneErrorMessage, transitionVoiceState, type ProductionVoiceState, type VoiceHistoryEntry } from './jarvis/voice-runtime/production-state'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Audio konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}

export default function JarvisPage() {
  const { profile } = useProfileScope()
  return <ProfileWorkspace key={profile} profile={profile} />
}

function ProfileWorkspace({ profile }: { profile: string }) {
  const { setEnd, setTitle } = usePageHeader()
  const { toast, showToast } = useToast()
  const navigate = useNavigate()
  const [status, setStatus] = useState<JarvisStatusResponse | null>(null)
  const [memory, setMemory] = useState<MemoryStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'plan' | 'run' | null>(null)
  const [selectedAgent, setSelectedAgent] = useState('auto')
  const [request, setRequest] = useState('')
  const [payloadText, setPayloadText] = useState('{}')
  const [result, setResult] = useState<JarvisOrchestrationResponse | null>(null)
  const [error, setError] = useState('')
  const [voiceBusy, setVoiceBusy] = useState<'recording' | 'transcribing' | 'thinking' | 'speaking' | null>(null)
  const [voiceState, setVoiceState] = useState<ProductionVoiceState>('idle')
  const [voiceHistory, setVoiceHistory] = useState<VoiceHistoryEntry[]>([])
  const [autoSpeak, setAutoSpeak] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingTimerRef = useRef<number | null>(null)
  const lifetime = useRef(new AbortController())
  const refreshRequest = useRef<AbortController | null>(null)
  const playerRef = useRef<HTMLAudioElement | null>(null)
  const setVoicePhase = (next: ProductionVoiceState) => setVoiceState(current => transitionVoiceState(current, next))

  useEffect(() => {
    lifetime.current = new AbortController()
    return () => {
      lifetime.current.abort()
      refreshRequest.current?.abort()
      playerRef.current?.pause()
      if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current)
      recorderRef.current?.stream.getTracks().forEach(track => track.stop())
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
    }
  }, [])

  const refresh = useCallback(async () => {
    if (lifetime.current.signal.aborted) return
    refreshRequest.current?.abort()
    const controller = new AbortController()
    refreshRequest.current = controller
    setLoading(true)
    setError('')
    try {
      const [nextStatus, nextMemory] = await Promise.all([api.getJarvisStatus(profile, controller.signal), api.getMemory(profile, controller.signal).catch(() => null)])
      if (controller.signal.aborted) return
      setStatus(nextStatus)
      setMemory(nextMemory)
    } catch (err) {
      if (controller.signal.aborted) return
      setStatus(null)
      setMemory(null)
      setError(err instanceof ApiError && [401, 403].includes(err.status)
        ? 'Zugriff nicht erlaubt. Bitte Anmeldung und Profilberechtigung prüfen.'
        : 'Hermes ist derzeit nicht erreichbar. Über Aktualisieren erneut verbinden.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    setTitle('Jarvis')
    setEnd(
      <Button size="sm" ghost onClick={refresh} aria-label="Jarvis aktualisieren">
        <RefreshCw className="h-4 w-4" />
      </Button>
    )
    refresh()
    return () => {
      setTitle(null)
      setEnd(null)
    }
  }, [refresh, setEnd, setTitle])

  const payload = useMemo(() => {
    try {
      const parsed = JSON.parse(payloadText || '{}')
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }, [payloadText])

  const speak = async (text: string, speed = 1) => {
    const signal = lifetime.current.signal
    if (signal.aborted) return
    setVoiceBusy('speaking')
    setVoicePhase('speaking')
    try {
      const audio = await api.speakText(text, profile, signal)
      if (signal.aborted) return
      await new Promise<void>((resolve, reject) => {
        const player = new Audio(audio.data_url)
        playerRef.current = player
        signal.addEventListener('abort', () => { player.pause(); resolve() }, { once: true })
        player.playbackRate = speed
        player.onended = () => resolve()
        player.onerror = () => reject(new Error('Audio konnte nicht abgespielt werden.'))
        void player.play().catch(reject)
      })
    } catch (err) {
      setError(errorMessage(err))
      setVoicePhase('error')
    } finally {
      setVoiceBusy(null)
      setVoiceState(current => current === 'error' ? current : 'idle')
    }
  }

  const run = async (mode: 'plan' | 'run', command = { request, agentId: selectedAgent }) => {
    const signal = lifetime.current.signal
    if (signal.aborted || busy) return
    const { request: activeRequest, agentId: activeAgent } = command
    if (!activeRequest.trim()) return showToast('Aufgabe fehlt.', 'error')
    if (!payload) return showToast('Payload ist kein JSON-Objekt.', 'error')
    setBusy(mode)
    setError('')
    try {
      const limits = {
        max_agents: status?.config.max_agents ?? 3,
        max_parallel: status?.config.max_parallel ?? 2,
        cost_tier: status?.config.cost_tier ?? 'low',
        max_estimated_cost_usd: status?.config.max_estimated_cost_usd ?? 0,
        routing_mode: status?.config.routing_mode ?? 'local_first',
        max_prompt_tokens: status?.config.max_prompt_tokens ?? 4000,
        max_completion_tokens: status?.config.max_completion_tokens ?? 1200
      }
      const body = { request: activeRequest, payload, limits }
      emit({ profile, source: 'task', type: mode === 'run' ? 'TASK_STARTED' : 'TASK_PLANNED', status: 'started', payload: { agent: activeAgent } })
      const next =
        mode === 'plan'
          ? await api.planJarvis(body, profile, signal)
          : activeAgent === 'auto'
            ? await api.runJarvis(body, profile, signal)
          : ({
              schema: 'jarvis.multi_agent.v1',
              status: 'completed',
              request: activeRequest,
              limits,
              parallel_groups: [[activeAgent]],
              tasks: [],
              handoff_policy: {},
              model_policy: {},
              safety: { external_writes: 'approval_required' },
              missing_integrations: [],
              results: [await api.runJarvisAgent(activeAgent, body, profile, signal)]
            } as JarvisOrchestrationResponse)
      if (signal.aborted) return
      setResult(next)
      emit({ profile, source: 'task', type: 'TASK_COMPLETED', status: 'completed', payload: { status: next.status } })
      if (autoSpeak && next.consolidated?.summary) await speak(next.consolidated.summary)
      await refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const executeVoiceCommand = async (transcript: string): Promise<string> => {
    const speed = applyVoiceSpeedCommand(transcript)
    if (speed) { showToast(`Sprechgeschwindigkeit: ${speed.speed.toFixed(2)}×`, 'success'); return 'TTS Geschwindigkeit angepasst' }
    const command = routeVoiceCommand(transcript)
    if (!command) return 'Kein deterministischer Befehl erkannt'
    const matchingAgent = status?.agents.find(agent => agent.agent_id.toLowerCase().includes(command.agentHint))?.agent_id ?? 'auto'
    setRequest(command.request)
    setSelectedAgent(matchingAgent)
    showToast(command.response, 'success')
    emit({ profile, source: 'voice', type: 'VOICE_COMMAND_ROUTED', status: 'completed', payload: { agent: matchingAgent } })
    if (command.execute) { setVoiceBusy('thinking'); setVoicePhase('thinking'); await run('run', { request: command.request, agentId: matchingAgent }) }
    else await refresh()
    return command.response
  }

  const processVoiceTranscript = async (transcript: string) => {
    setVoicePhase('processing')
    setRequest(transcript)
    const action = await executeVoiceCommand(transcript)
    setVoiceHistory(history => appendVoiceHistory(history, transcript, action))
    setVoiceState(current => current === 'error' ? current : 'idle')
  }

  const recordVoice = async () => {
    const signal = lifetime.current.signal
    if (signal.aborted || voiceBusy) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      return showToast('Browseraufnahme ist hier nicht verfügbar.', 'error')
    setVoiceBusy('recording')
    setVoicePhase('listening')
    emit({ profile, source: 'voice', type: 'LISTENING_STARTED', status: 'started' })
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (signal.aborted) { stream.getTracks().forEach(track => track.stop()); return }
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      const chunks: Blob[] = []
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      const stopped = new Promise<Blob>(resolve => {
        recorder.onstop = () => {
          stream.getTracks().forEach(track => track.stop())
          recorderRef.current = null
          if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current)
          recordingTimerRef.current = null
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        }
      })
      recorder.start()
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop()
      }, 60_000)
      const blob = await stopped
      if (signal.aborted) return
      setVoiceBusy('transcribing')
      setVoicePhase('processing')
      const data = await blobToDataUrl(blob)
      if (signal.aborted) return
      const transcript = await api.transcribeAudio(data, blob.type || 'audio/webm', profile, signal)
      if (signal.aborted) return
      if (transcript.transcript) {
        emit({ profile, source: 'voice', type: 'TRANSCRIPTION_COMPLETED', status: 'completed', payload: { provider: transcript.provider ?? 'configured' } })
        showToast('Sprache erkannt.', 'success')
        await processVoiceTranscript(transcript.transcript)
      } else {
        showToast('Keine Sprache erkannt.', 'error')
      }
    } catch (err) {
      setError(microphoneErrorMessage(err))
      setVoicePhase('error')
    } finally {
      setVoiceBusy(null)
      setVoiceState(current => current === 'error' ? current : 'idle')
    }
  }

  const stopVoice = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const decideApproval = async (id: string, decision: 'approve' | 'deny') => {
    try {
      await api.decideJarvisApproval(id, decision, profile, lifetime.current.signal)
      if (lifetime.current.signal.aborted) return
      await refresh()
      showToast(decision === 'approve' ? 'Freigabe markiert.' : 'Freigabe abgelehnt.', 'success')
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  const saveRoutingMode = async (mode: string) => {
    try {
      const saved = await api.updateJarvisSettings({ 'jarvis.routing_mode': mode }, profile, lifetime.current.signal)
      if (lifetime.current.signal.aborted) return
      setStatus(previous => (previous ? { ...previous, config: saved.config } : previous))
      showToast('Routingmodus gespeichert.', 'success')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <Toast toast={toast} />
      <JarvisShell
        status={status}
        memory={memory}
        loading={loading}
        busy={busy}
        selectedAgent={selectedAgent}
        request={request}
        payloadText={payloadText}
        payload={payload}
        result={result}
        error={error}
        voiceBusy={voiceBusy}
        voiceState={voiceState}
        voiceHistory={voiceHistory}
        autoSpeak={autoSpeak}
        onNavigate={navigate}
        onRequestChange={setRequest}
        onPayloadChange={setPayloadText}
        onAgentSelect={setSelectedAgent}
        onRun={run}
        onRecordVoice={recordVoice}
        onStopVoice={stopVoice}
        onVoiceTranscript={processVoiceTranscript}
        onSpeak={speak}
        onAutoSpeakChange={setAutoSpeak}
        onApprovalDecision={decideApproval}
        onRoutingModeChange={saveRoutingMode}
      />
    </>
  )
}
