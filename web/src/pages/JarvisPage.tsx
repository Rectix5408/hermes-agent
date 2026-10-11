import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { Toast } from '@nous-research/ui/ui/components/toast'
import { useToast } from '@nous-research/ui/hooks/use-toast'
import { api } from '@/lib/api'
import { GatewayClient } from '@/lib/gatewayClient'
import { HermesVoiceConversation, type VoiceApprovalDisplay } from './jarvis/voice-runtime/hermes-conversation'
import type { JarvisOrchestrationResponse, JarvisStatusResponse, MemoryStatus } from '@/lib/api'
import { ApiError, errorMessage } from '@/lib/api-error'
import { useProfileScope } from '@/contexts/useProfileScope'
import { usePageHeader } from '@/contexts/usePageHeader'
import { JarvisShell } from './jarvis/JarvisShell'
import { emit } from './jarvis/runtime/event-bus'
import { routeVoiceCommand } from './jarvis/cinematic/voice-command-router'
import { captureMicrophone, captureBrowserSpeech } from './jarvis/voice-runtime/microphone'
import { applyVoiceSpeedCommand, loadVoiceSettings } from './jarvis/cinematic/voice-settings'
import { appendVoiceHistory, microphoneErrorMessage, transitionVoiceState, type ProductionVoiceState, type VoiceHistoryEntry } from './jarvis/voice-runtime/production-state'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Audio konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}

function executionLimits(config: Record<string, unknown> = {}) {
  return {
    max_agents: config.max_agents ?? 3,
    max_parallel: config.max_parallel ?? 2,
    cost_tier: config.cost_tier ?? 'low',
    max_estimated_cost_usd: config.max_estimated_cost_usd ?? 0,
    routing_mode: config.routing_mode ?? 'local_first',
    max_prompt_tokens: config.max_prompt_tokens ?? 4000,
    max_completion_tokens: config.max_completion_tokens ?? 1200,
  }
}

export default function JarvisPage() {
  const { profile, currentProfile } = useProfileScope()
  const boundProfile = profile || currentProfile
  return <ProfileWorkspace key={boundProfile} profile={boundProfile} />
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
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null)
  const [voiceResponse, setVoiceResponse] = useState('')
  const [voiceProgress, setVoiceProgress] = useState(0)
  const [voiceApproval, setVoiceApproval] = useState<VoiceApprovalDisplay | null>(null)
  const conversation = useRef<HermesVoiceConversation | null>(null)
  const voiceOperation = useRef<AbortController | null>(null)
  const captureStop = useRef<(() => void) | null>(null)
  const runLock = useRef(false)
  const [approvalBusy, setApprovalBusy] = useState(false)
  const approvalLock = useRef(false)
  const [approvalHistory, setApprovalHistory] = useState<string[]>([])
  const cancelVoice = useCallback(() => {
    voiceOperation.current?.abort()
    voiceOperation.current = null
    captureStop.current?.()
    captureStop.current = null
    playerRef.current?.pause()
    setVoiceStream(null)
    setVoiceResponse('')
    setVoiceBusy(null)
    setVoiceState('idle')
  }, [])
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
      voiceOperation.current?.abort()
      captureStop.current?.()
      conversation.current?.close()
      conversation.current = null
    }
  }, [])

  const refresh = useCallback(async () => {
    if (lifetime.current.signal.aborted) return
    refreshRequest.current?.abort()
    const controller = new AbortController()
    refreshRequest.current = controller
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

  const speak = async (text: string, speed = loadVoiceSettings(profile).speed, providedSignal?: AbortSignal) => {
    if (lifetime.current.signal.aborted) return
    const operation = providedSignal ? null : new AbortController()
    if (operation) {
      if (voiceOperation.current) return
      voiceOperation.current = operation
    }
    const signal = providedSignal ?? operation!.signal
    if (signal.aborted) return
    setVoiceProgress(0)
    setVoiceBusy('speaking')
    setVoicePhase('speaking')
    try {
      const audio = await api.speakText(text, profile, signal)
      if (signal.aborted) return
      await new Promise<void>((resolve, reject) => {
        const player = new Audio(audio.data_url)
        playerRef.current = player
        player.playbackRate = speed
        const aborted = () => { player.pause(); cleanup(); resolve() }
        const cleanup = () => { signal.removeEventListener('abort', aborted); player.onended = null; player.onerror = null; player.ontimeupdate = null }
        signal.addEventListener('abort', aborted, { once: true })
        player.ontimeupdate = () => { if (Number.isFinite(player.duration) && player.duration > 0) setVoiceProgress(player.currentTime / player.duration) }
        player.onended = () => { cleanup(); setVoiceProgress(1); resolve() }
        player.onerror = () => { cleanup(); reject(new Error('Audio konnte nicht abgespielt werden.')) }
        void player.play().catch(error => { cleanup(); reject(error) })
      })
    } catch (err) {
      if (signal.aborted) return
      setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'Wiedergabe vom Browser blockiert. Bitte „Antwort sprechen“ anklicken.' : 'Sprachausgabe nicht verfügbar. Bitte TTS-Konfiguration prüfen.')
      setVoicePhase('error')
    } finally {
      if (operation && voiceOperation.current === operation) voiceOperation.current = null
      if (!signal.aborted) {
        setVoiceBusy(null)
        setVoiceState(current => current === 'error' ? current : 'idle')
      }
    }
  }

  const run = async (mode: 'plan' | 'run', command = { request, agentId: selectedAgent }, signal = lifetime.current.signal, fromVoice = false) => {
    if (signal.aborted || runLock.current || (!fromVoice && voiceOperation.current)) return
    const { request: activeRequest, agentId: activeAgent } = command
    if (!activeRequest.trim()) return showToast('Aufgabe fehlt.', 'error')
    if (!payload) return showToast('Payload ist kein JSON-Objekt.', 'error')
    runLock.current = true
    setBusy(mode)
    setError('')
    try {
      const limits = executionLimits(status?.config)
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
      const summary = next.consolidated?.summary || next.results?.map(item => item.summary).filter(Boolean).join('\n') || 'Plan erstellt.'
      if (autoSpeak && !fromVoice) await speak(summary)
      await refresh()
      return summary
    } catch (err) {
      if (!signal.aborted) {
        setError(errorMessage(err))
        emit({ profile, source: 'task', type: 'TASK_FAILED', status: 'failed' })
        if (fromVoice) throw new Error('Der Auftrag konnte nicht abgeschlossen werden.')
      }
    } finally {
      runLock.current = false
      setBusy(null)
    }
  }

  const executeVoiceCommand = async (transcript: string, signal: AbortSignal): Promise<string> => {
    const speed = applyVoiceSpeedCommand(transcript, profile)
    if (speed) return `Sprechgeschwindigkeit auf ${speed.speed.toFixed(2)} angepasst.`
    const command = routeVoiceCommand(transcript)
    if (!command) {
      setVoiceBusy('thinking')
      setVoicePhase('thinking')
      if (!conversation.current) conversation.current = new HermesVoiceConversation(profile, () => new GatewayClient(), setVoiceApproval)
      const reply = await conversation.current.submit(transcript, signal, text => {
        if (!signal.aborted && !lifetime.current.signal.aborted) setVoiceResponse(text)
      })
      return reply.text
    }
    const hints = command.agentHint === 'email' ? ['email', 'mail'] : [command.agentHint]
    const matchingAgent = status?.agents.find(agent => hints.includes(agent.agent_id.toLowerCase()))?.agent_id
    if (command.execute && !matchingAgent) return 'Der benötigte Agent ist in diesem Profil nicht registriert. Es wurde nichts ausgeführt.'
    setRequest(command.request)
    setSelectedAgent(matchingAgent ?? 'auto')
    emit({ profile, source: 'voice', type: 'VOICE_COMMAND_ROUTED', status: 'completed', payload: { agent: matchingAgent ?? 'auto' } })
    if (command.execute) {
      setVoiceBusy('thinking'); setVoicePhase('thinking')
      return await run('run', { request: command.request, agentId: matchingAgent! }, signal, true) || 'Keine neue Ausführung gestartet.'
    }
    await refresh()
    return command.response
  }

  const processVoiceTranscript = async (transcript: string, signal = lifetime.current.signal) => {
    if (signal.aborted || !transcript.trim()) return
    setVoicePhase('processing')
    setVoiceResponse('')
    setRequest(transcript)
    const action = await executeVoiceCommand(transcript, signal)
    if (signal.aborted) return
    setVoiceHistory(history => appendVoiceHistory(history, transcript, action))
    setVoiceResponse(action)
    if (status?.voice?.tts.configured) await speak(action, loadVoiceSettings(profile).speed, signal)
    setVoiceState(current => current === 'error' ? current : 'idle')
  }

  const recordVoice = async () => {
    if (lifetime.current.signal.aborted || voiceOperation.current || runLock.current) return
    const settings = loadVoiceSettings(profile)
    if (settings.sttEngine === 'disabled') { setError('Bitte eine Spracherkennung auswählen.'); return }
    const operation = new AbortController()
    voiceOperation.current = operation
    const signal = operation.signal
    setVoiceBusy('recording')
    setVoiceState('listening')
    setError('')
    let transcribing = false
    try {
      const capture = settings.sttEngine === 'browser-speech'
        ? captureBrowserSpeech(signal)
        : captureMicrophone(settings.deviceId ?? '', signal, stream => { if (voiceOperation.current === operation) setVoiceStream(stream) })
      captureStop.current = capture.stop
      const audio = await capture.recording
      if (signal.aborted) return
      setVoiceBusy('transcribing')
      setVoicePhase('processing')
      transcribing = true
      let transcript: string
      if (typeof audio === 'string') transcript = audio
      else {
        const data = await blobToDataUrl(audio)
        if (signal.aborted) return
        const response = await api.transcribeAudio(data, audio.type, profile, signal)
        transcript = response.transcript
      }
      if (signal.aborted) return
      if (!transcript.trim()) throw new Error('Keine Sprache erkannt. Bitte erneut sprechen.')
      emit({ profile, source: 'voice', type: 'TRANSCRIPTION_COMPLETED', status: 'completed' })
      await processVoiceTranscript(transcript, signal)
    } catch (err) {
      if (!signal.aborted) {
        setError(transcribing ? 'Spracherkennung oder Auftrag fehlgeschlagen. Bitte Provider und Verbindung prüfen.' : err instanceof DOMException ? microphoneErrorMessage(err) : err instanceof Error ? err.message : 'Aufnahme nicht verfügbar.')
        setVoiceState('error')
      }
    } finally {
      if (voiceOperation.current === operation) {
        voiceOperation.current = null
        captureStop.current = null
        setVoiceBusy(null)
        setVoiceState(current => current === 'error' ? current : 'idle')
      }
    }
  }

  const stopVoice = () => { captureStop.current?.() }

  const submitVoiceTranscript = async (transcript: string) => {
    if (voiceOperation.current || runLock.current || lifetime.current.signal.aborted) return
    const operation = new AbortController()
    voiceOperation.current = operation
    setError('')
    setVoiceState('idle')
    try { await processVoiceTranscript(transcript, operation.signal) }
    catch {
      if (!operation.signal.aborted) {
        setError('Sprachdialog unterbrochen. Bitte Provider und Verbindung prüfen; es wird nichts automatisch wiederholt.')
        setVoiceState('error')
      }
    } finally {
      if (voiceOperation.current === operation) { voiceOperation.current = null; setVoiceBusy(null) }
    }
  }

  const decideApproval = async (id: string, decision: 'approve' | 'deny') => {
    if (approvalLock.current || !status?.approvals.pending.some(item => item.id === id)) return
    approvalLock.current = true
    setApprovalBusy(true)
    try {
      await api.decideJarvisApproval(id, decision, profile, lifetime.current.signal)
      if (lifetime.current.signal.aborted) return
      await refresh()
      setApprovalHistory(previous => [`${new Date().toLocaleTimeString('de-DE')} · ${decision === 'approve' ? 'Erlaubt' : 'Abgelehnt'} · ${id}`, ...previous].slice(0, 20))
      showToast(decision === 'approve' ? 'Freigabe markiert.' : 'Freigabe abgelehnt.', 'success')
    } catch (err) {
      setError(errorMessage(err))
    }
    finally { approvalLock.current = false; setApprovalBusy(false) }
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
        voiceStream={voiceStream}
        voiceResponse={voiceResponse}
        voiceProgress={voiceProgress}
        voiceApproval={voiceApproval}
        onVoiceApprovalDecision={(id, choice) => { conversation.current?.decideApproval(id, choice) }}
        onCancelVoice={cancelVoice}
        approvalBusy={approvalBusy}
        approvalHistory={approvalHistory}
        autoSpeak={autoSpeak}
        onNavigate={navigate}
        onRequestChange={setRequest}
        onPayloadChange={setPayloadText}
        onAgentSelect={setSelectedAgent}
        onRun={run}
        onRecordVoice={recordVoice}
        onStopVoice={stopVoice}
        onVoiceTranscript={submitVoiceTranscript}
        onSpeak={speak}
        onAutoSpeakChange={setAutoSpeak}
        onApprovalDecision={decideApproval}
        onRoutingModeChange={saveRoutingMode}
      />
    </>
  )
}
