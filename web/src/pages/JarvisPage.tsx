import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { Toast } from '@nous-research/ui/ui/components/toast'
import { useToast } from '@nous-research/ui/hooks/use-toast'
import { api } from '@/lib/api'
import type { JarvisOrchestrationResponse, JarvisStatusResponse } from '@/lib/api'
import { errorMessage } from '@/lib/api-error'
import { usePageHeader } from '@/contexts/usePageHeader'
import { JarvisDashboard } from './jarvis/JarvisDashboard'

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
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'plan' | 'run' | null>(null)
  const [selectedAgent, setSelectedAgent] = useState('auto')
  const [request, setRequest] = useState('Plane meinen Tag, prüfe offene Aufgaben und bereite nötige Entwürfe vor.')
  const [payloadText, setPayloadText] = useState('{\n  "topics": ["Jarvis", "Automatisierung"],\n  "tasks": []\n}')
  const [result, setResult] = useState<JarvisOrchestrationResponse | null>(null)
  const [error, setError] = useState('')
  const [voiceBusy, setVoiceBusy] = useState<'recording' | 'transcribing' | 'speaking' | null>(null)
  const [autoSpeak, setAutoSpeak] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await api.getJarvisStatus())
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

  const speak = async (text: string) => {
    setVoiceBusy('speaking')
    try {
      const audio = await api.speakText(text)
      await new Promise<void>((resolve, reject) => {
        const player = new Audio(audio.data_url)
        player.onended = () => resolve()
        player.onerror = () => reject(new Error('Audio konnte nicht abgespielt werden.'))
        void player.play().catch(reject)
      })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setVoiceBusy(null)
    }
  }

  const run = async (mode: 'plan' | 'run') => {
    if (!request.trim()) return showToast('Aufgabe fehlt.', 'error')
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
      const body = { request, payload, limits }
      const next =
        selectedAgent === 'auto'
          ? mode === 'plan'
            ? await api.planJarvis(body)
            : await api.runJarvis(body)
          : ({
              schema: 'jarvis.multi_agent.v1',
              status: 'completed',
              request,
              limits,
              parallel_groups: [[selectedAgent]],
              tasks: [],
              handoff_policy: {},
              model_policy: {},
              safety: { external_writes: 'approval_required' },
              missing_integrations: [],
              results: [await api.runJarvisAgent(selectedAgent, body)]
            } as JarvisOrchestrationResponse)
      setResult(next)
      if (autoSpeak && next.consolidated?.summary) await speak(next.consolidated.summary)
      await refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const recordVoice = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      return showToast('Browseraufnahme ist hier nicht verfügbar.', 'error')
    setVoiceBusy('recording')
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      const stopped = new Promise<Blob>(resolve => {
        recorder.onstop = () => {
          stream.getTracks().forEach(track => track.stop())
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        }
      })
      recorder.start()
      window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop()
      }, 7000)
      const blob = await stopped
      setVoiceBusy('transcribing')
      const transcript = await api.transcribeAudio(await blobToDataUrl(blob), blob.type || 'audio/webm')
      if (transcript.transcript) {
        setRequest(transcript.transcript)
        showToast('Sprache erkannt.', 'success')
      } else {
        showToast('Keine Sprache erkannt.', 'error')
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setVoiceBusy(null)
    }
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
      <JarvisDashboard
        status={status}
        loading={loading}
        busy={busy}
        selectedAgent={selectedAgent}
        request={request}
        payloadText={payloadText}
        payload={payload}
        result={result}
        error={error}
        voiceBusy={voiceBusy}
        autoSpeak={autoSpeak}
        onNavigate={navigate}
        onRequestChange={setRequest}
        onPayloadChange={setPayloadText}
        onAgentSelect={setSelectedAgent}
        onRun={run}
        onRecordVoice={recordVoice}
        onSpeak={speak}
        onAutoSpeakChange={setAutoSpeak}
        onApprovalDecision={decideApproval}
        onRoutingModeChange={saveRoutingMode}
      />
    </>
  )
}
