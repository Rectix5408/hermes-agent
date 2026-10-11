import type { CronJob } from './api-cron'
import { createMemoryUniverseApi } from './api-memory-universe'

type FetchJSON = <T>(url: string, init?: RequestInit) => Promise<T>

interface JarvisApiDependencies {
  fetchJSON: FetchJSON
  appendProfileParam: (url: string, profile?: string) => string
  getManagementProfile: () => string
}

export interface JarvisAgentSpec {
  agent_id: string
  title: string
  scope: string
  skills: string[]
  toolsets: string[]
  permissions: string[]
  max_steps: number
  max_input_chars: number
  model_route: string
}

export interface JarvisIntegrationStatus {
  id: string
  label: string
  status: 'available' | 'configured' | 'not_configured' | 'disabled' | string
  reason: string
}

export interface JarvisModelProviderSummary {
  provider: string
  label: string
  models: string[]
  authenticated: boolean
  source: string
  warning: string
}

export interface JarvisRunRecord {
  created_at: number
  kind: string
  schema: string
  status: string
  request: string
  agents: string[]
  model_policy?: Record<string, unknown>
  token_policy?: Record<string, unknown>
  missing_integrations: string[]
  approval_required: Array<Record<string, unknown>>
  external_actions_executed: boolean
}

export interface JarvisApprovalRecord {
  id: string
  created_at: number
  decided_at?: number
  status: 'pending' | 'approved' | 'denied' | string
  action: string
  reason: string
  agent_id: string
  items: unknown[]
  params_hash: string
}

export interface JarvisStatusResponse {
  ok: boolean
  skill: { name: string; available: boolean; path: string }
  orchestrator: { available: boolean; schema: string; path: string; error: string }
  agents: JarvisAgentSpec[]
  config: Record<string, unknown>
  integrations: JarvisIntegrationStatus[]
  models: {
    available: boolean
    error?: string
    local: JarvisModelProviderSummary[]
    cloud: JarvisModelProviderSummary[]
    fallback_rules: string[]
    note: string
  }
  voice: {
    stt: { provider: string | null; configured: boolean; available: string }
    tts: { provider: string | null; configured: boolean; available: string }
    note: string
  }
  automations: { jarvis_jobs: CronJob[]; count: number; activation_policy: string }
  runs: JarvisRunRecord[]
  approvals: { pending: JarvisApprovalRecord[] }
}

export interface JarvisOrchestrationRequest {
  request: string
  payload?: Record<string, unknown>
  limits?: Record<string, unknown>
}

export interface JarvisAgentResult {
  agent_id: string
  status: string
  summary: string
  structured: Record<string, unknown>
  approval_required: Array<Record<string, unknown>>
  missing_integrations: string[]
  handoff: Array<Record<string, unknown>>
}

export interface JarvisOrchestrationResponse {
  schema: string
  status: string
  request: string
  limits: Record<string, unknown>
  parallel_groups: string[][]
  tasks: Array<Record<string, unknown>>
  handoff_policy: Record<string, unknown>
  model_policy: Record<string, unknown>
  token_policy?: Record<string, unknown>
  memory_policy?: Record<string, unknown>
  safety: Record<string, unknown>
  missing_integrations: string[]
  results?: JarvisAgentResult[]
  consolidated?: {
    summary: string
    completed_agents: string[]
    blocked_agents: string[]
    approval_required: Array<Record<string, unknown>>
    missing_integrations: string[]
    handoff: Array<Record<string, unknown>>
    external_actions_executed: boolean
  }
}

export interface JarvisApprovalsResponse {
  ok: boolean
  pending: JarvisApprovalRecord[]
  history: JarvisApprovalRecord[]
  source: string
  message: string
}

export interface JarvisRunsResponse {
  ok: boolean
  runs: JarvisRunRecord[]
}

export interface AudioTranscriptionResponse {
  ok: boolean
  transcript: string
  provider?: string | null
}

export interface AudioSpeakResponse {
  ok: boolean
  data_url: string
  mime_type: string
  provider?: string | null
}

export function createJarvisApi({ appendProfileParam, fetchJSON, getManagementProfile }: JarvisApiDependencies) {
  return {
    getJarvisStatus: (profile = getManagementProfile(), signal?: AbortSignal) =>
      fetchJSON<JarvisStatusResponse>(appendProfileParam('/api/jarvis/status', profile), { signal }),
    getJarvisApprovals: (profile = getManagementProfile()) =>
      fetchJSON<JarvisApprovalsResponse>(appendProfileParam('/api/jarvis/approvals', profile)),
    decideJarvisApproval: (approvalId: string, decision: 'approve' | 'deny', profile = getManagementProfile(), signal?: AbortSignal) =>
      fetchJSON<{ ok: boolean; approval: JarvisApprovalRecord; executed: boolean }>(
        appendProfileParam(`/api/jarvis/approvals/${encodeURIComponent(approvalId)}`, profile),
        {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision })
        }
      ),
    updateJarvisSettings: (settings: Record<string, unknown>, profile = getManagementProfile(), signal?: AbortSignal) =>
      fetchJSON<{ ok: boolean; config: Record<string, unknown> }>(appendProfileParam('/api/jarvis/settings', profile), {
        method: 'PUT',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      }),
    getJarvisRuns: (limit = 20, profile = getManagementProfile()) =>
      fetchJSON<JarvisRunsResponse>(appendProfileParam(`/api/jarvis/runs?limit=${limit}`, profile)),
    planJarvis: (body: JarvisOrchestrationRequest, profile = getManagementProfile(), signal?: AbortSignal) =>
      fetchJSON<JarvisOrchestrationResponse>(appendProfileParam('/api/jarvis/orchestrator/plan', profile), {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }),
    runJarvis: (body: JarvisOrchestrationRequest, profile = getManagementProfile(), signal?: AbortSignal) =>
      fetchJSON<JarvisOrchestrationResponse>(appendProfileParam('/api/jarvis/orchestrator/run', profile), {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }),
    runJarvisAgent: (agentId: string, body: JarvisOrchestrationRequest, profile = getManagementProfile(), signal?: AbortSignal) =>
      fetchJSON<JarvisAgentResult>(
        appendProfileParam(`/api/jarvis/orchestrator/agent/${encodeURIComponent(agentId)}`, profile),
        {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      )
  }
}

/** Dashboard-only API extensions share the existing authenticated API facade. */
export function createJarvisDashboardApi(dependencies: JarvisApiDependencies) {
  const { fetchJSON, appendProfileParam, getManagementProfile } = dependencies
  return {
    ...createJarvisApi(dependencies),
    ...createMemoryUniverseApi(dependencies),
    transcribeAudio: (
      data_url: string,
      mime_type?: string,
      profile = getManagementProfile(),
      signal?: AbortSignal,
    ) =>
      fetchJSON<AudioTranscriptionResponse>(
        appendProfileParam("/api/audio/transcribe", profile),
        {
          signal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_url, mime_type }),
        },
      ),
    speakText: (text: string, profile = getManagementProfile(), signal?: AbortSignal) =>
      fetchJSON<AudioSpeakResponse>(
        appendProfileParam("/api/audio/speak", profile),
        {
          signal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      ),
  }
}
