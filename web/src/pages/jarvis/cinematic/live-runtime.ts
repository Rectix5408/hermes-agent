import type { JarvisOrchestrationResponse, JarvisStatusResponse, MemoryStatus } from '@/lib/api'

export type LiveAgentState = 'RUNNING' | 'WAITING' | 'DONE' | 'ERROR' | 'READY'

export interface LiveAgent {
  id: string
  name: string
  tools: string[]
  permissions: string[]
  status: LiveAgentState
  task: string
  activity: string
}

function toLiveStatus(value: string | undefined): LiveAgentState {
  if (value === 'failed' || value === 'error') return 'ERROR'
  if (value === 'completed') return 'DONE'
  if (value === 'running') return 'RUNNING'
  if (value === 'waiting') return 'WAITING'
  return 'READY'
}

export function liveAgents(status: JarvisStatusResponse | null, busy: boolean, result: JarvisOrchestrationResponse | null): LiveAgent[] {
  const outcomes = new Map((result?.results ?? []).map(item => [item.agent_id, item]))
  return (status?.agents ?? []).map(agent => {
    const outcome = outcomes.get(agent.agent_id)
    return {
      id: agent.agent_id,
      name: agent.title,
      tools: agent.toolsets,
      permissions: agent.permissions,
      status: busy ? 'RUNNING' : toLiveStatus(outcome?.status),
      task: busy ? 'Hermes-Orchestrierung läuft' : outcome?.summary || agent.scope,
      activity: outcome ? `Letzte Ausführung: ${outcome.status}` : 'Bereit für eine Hermes-Aufgabe'
    }
  })
}

export function memoryTelemetry(memory: MemoryStatus | null) {
  if (!memory) return { state: 'Nicht verfügbar', active: 0, stored: '—', lastAccess: '—' }
  const active = memory.providers.filter(provider => provider.configured || provider.status === 'ready').length
  const files = memory.builtin_files.memory + memory.builtin_files.user
  return {
    state: memory.active || 'Nicht konfiguriert',
    active,
    stored: `${files} lokale Dateien`,
    lastAccess: 'Vom bestehenden Memory-Endpunkt nicht geliefert'
  }
}

export function configuredIntegration(status: JarvisStatusResponse | null, fragment: string): boolean {
  return (status?.integrations ?? []).some(integration =>
    integration.id.toLowerCase().includes(fragment) && ['available', 'configured'].includes(integration.status)
  )
}
