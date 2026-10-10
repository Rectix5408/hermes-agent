import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { Toast } from '@nous-research/ui/ui/components/toast'
import { useToast } from '@nous-research/ui/hooks/use-toast'
import { api } from '@/lib/api'
import type { JarvisOrchestrationResponse, JarvisStatusResponse, MemoryStatus } from '@/lib/api'
import { errorMessage } from '@/lib/api-error'
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
  const { setEnd, setTitle } = usePageHeader()
  const { toast, showToast } = useToast()
  const navigate = useNavigate()
  const [status, setStatus] = useState<JarvisStatusResponse | null>(null)
  const [memory, setMemory] = useState<MemoryStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'plan' | 'run' | null>(null)
  const [selectedAgent, setSelectedAgent] = useState('auto')
  const [request, setRequest] = useState('Plane meinen Tag, prüfe offene Aufgaben und bereite nötige Entwürfe vor.')
  const [payloadText, setPayloadText] = useState('{\n  "topics": ["Jarvis", "Automatisierung"],\n  "tasks": []\n}')
  const [result, setResult] = useState<JarvisOrchestrationResponse | null>(null)
  const [error, setError] = useState('')
  const [voiceBusy, setVoiceBusy] = useState<'recording' | 'transcribing' | 'thinking' | 'speaking' | null>(null)
  const [voiceState, setVoiceState] = useState<ProductionVoiceState>('idle')
  const [voiceHistory, setVoiceHistory] = useState<VoiceHistoryEntry[]>([])
  const [autoSpeak, setAutoSpeak] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingTimerRef = useRef<number | null>(null)
  const setVoicePhase = (next: ProductionVoiceState) => setVoiceState(current => transitionVoiceState(current, next))

  useEffect(() => () => {
    if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current)
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [nextStatus, nextMemory] = await Promise.all([api.getJarvisStatus(), api.getMemory().catch(() => null)])
      setStatus(nextStatus)
      setMemory(nextMemory)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

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
    setVoiceBusy('speaking')
    setVoicePhase('speaking')
    try {
      const audio = await api.speakText(text)
      await new Promise<void>((resolve, reject) => {
        const player = new Audio(audio.data_url)
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

  const run = async (mode: 'plan' | 'run', command?: { request: string; agentId: string }) => {
    const activeRequest = command?.request ?? request
    const activeAgent = command?.agentId ?? selectedAgent
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
      emit({ source: 'task', type: mode === 'run' ? 'TASK_STARTED' : 'TASK_PLANNED', status: 'started', payload: { agent: activeAgent } })
      const next =
        activeAgent === 'auto'
          ? mode === 'plan'
            ? await api.planJarvis(body)
            : await api.runJarvis(body)
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
              results: [await api.runJarvisAgent(activeAgent, body)]
            } as JarvisOrchestrationResponse)
      setResult(next)
      emit({ source: 'task', type: 'TASK_COMPLETED', status: 'completed', payload: { status: next.status } })
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
    emit({ source: 'voice', type: 'VOICE_COMMAND_ROUTED', status: 'completed', payload: { agent: matchingAgent } })
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
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      return showToast('Browseraufnahme ist hier nicht verfügbar.', 'error')
    setVoiceBusy('recording')
    setVoicePhase('listening')
    emit({ source: 'voice', type: 'LISTENING_STARTED', status: 'started' })
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
      setVoiceBusy('transcribing')
      setVoicePhase('processing')
      const transcript = await api.transcribeAudio(await blobToDataUrl(blob), blob.type || 'audio/webm')
      if (transcript.transcript) {
        emit({ source: 'voice', type: 'TRANSCRIPTION_COMPLETED', status: 'completed', payload: { provider: transcript.provider ?? 'configured' } })
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
      await api.decideJarvisApproval(id, decision)
      await refresh()
      showToast(decision === 'approve' ? 'Freigabe markiert.' : 'Freigabe abgelehnt.', 'success')
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  const saveRoutingMode = async (mode: string) => {
    try {
      const saved = await api.updateJarvisSettings({ 'jarvis.routing_mode': mode })
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
