import type { JarvisAgentResult, JarvisOrchestrationResponse, JarvisStatusResponse } from '@/lib/api'

export type JarvisAgentKind = 'mail' | 'instagram' | 'calendar' | 'research'
export type AgentAvailability = 'ONLINE' | 'READY' | 'RUNNING' | 'ERROR' | 'OFFLINE'
export type AgentApprovalState = 'NO APPROVAL REQUIRED' | 'PENDING APPROVAL' | 'APPROVED' | 'REJECTED'

export interface JarvisRegisteredAgent {
  id: JarvisAgentKind
  name: string
  status: AgentAvailability
  capabilities: string[]
  permissions: string[]
  lastAction: string
  approval: AgentApprovalState
  pipeline?: string[]
  runtimeAgentId?: string
}

interface AgentDefinition {
  id: JarvisAgentKind
  name: string
  aliases: string[]
  capabilities: string[]
  pipeline?: string[]
  approvalByDefault: AgentApprovalState
}

const definitions: AgentDefinition[] = [
  {
    id: 'mail', name: 'Mail Agent', aliases: ['mail', 'email'],
    capabilities: ['E-Mails lesen', 'Metadaten prüfen', 'Zusammenfassung vorbereiten'],
    approvalByDefault: 'NO APPROVAL REQUIRED'
  },
  {
    id: 'instagram', name: 'Instagram Agent', aliases: ['instagram', 'social'],
    capabilities: ['Content-Ideen strukturieren', 'Entwürfe vorbereiten', 'Freigabe anfordern'],
    pipeline: ['Idee', 'Entwurf', 'PENDING APPROVAL', 'Veröffentlichung'],
    approvalByDefault: 'PENDING APPROVAL'
  },
  {
    id: 'calendar', name: 'Calendar Agent', aliases: ['calendar', 'kalender'],
    capabilities: ['Tagesübersicht vorbereiten', 'Morning Briefing erstellen', 'Termine lesend prüfen'],
    approvalByDefault: 'NO APPROVAL REQUIRED'
  },
  {
    id: 'research', name: 'Research Agent', aliases: ['research', 'recherche'],
    capabilities: ['Rechercheauftrag strukturieren', 'Ergebnisse sammeln', 'Zusammenfassung vorbereiten'],
    approvalByDefault: 'NO APPROVAL REQUIRED'
  }
]

function matches(value: string, aliases: string[]) {
  const normalized = value.toLocaleLowerCase('de-DE')
  return aliases.some(alias => normalized.includes(alias))
}

function outcomeFor(
  result: JarvisOrchestrationResponse | null,
  runtimeAgentId: string | undefined
): JarvisAgentResult | undefined {
  return (result?.results ?? []).find(outcome => outcome.agent_id === runtimeAgentId)
}

function approvalFor(
  definition: AgentDefinition,
  status: JarvisStatusResponse | null,
  outcome: JarvisAgentResult | undefined
): AgentApprovalState {
  const pending = (status?.approvals.pending ?? []).some(approval =>
    matches(approval.agent_id, definition.aliases) || matches(approval.action, definition.aliases)
  )
  if (pending || (outcome?.approval_required.length ?? 0) > 0) return 'PENDING APPROVAL'
  return definition.approvalByDefault
}

function statusFor(present: boolean, busy: boolean, outcome: JarvisAgentResult | undefined): AgentAvailability {
  if (!present) return 'OFFLINE'
  if (outcome?.status === 'failed' || outcome?.status === 'error') return 'ERROR'
  if (busy && outcome) return 'RUNNING'
  if (outcome?.status === 'completed') return 'READY'
  return 'ONLINE'
}

/**
 * Converts only the existing Jarvis status/orchestration data into a fixed,
 * user-facing command registry. Definitions never imply that an unavailable
 * Hermes agent is executable: those cards are explicitly shown as OFFLINE.
 */
export function registeredAgents(
  status: JarvisStatusResponse | null,
  busy: boolean,
  result: JarvisOrchestrationResponse | null
): JarvisRegisteredAgent[] {
  return definitions.map(definition => {
    const runtimeAgent = (status?.agents ?? []).find(agent =>
      matches(`${agent.agent_id} ${agent.title}`, definition.aliases)
    )
    const outcome = outcomeFor(result, runtimeAgent?.agent_id)
    const permissions = runtimeAgent?.permissions ?? []
    return {
      id: definition.id,
      name: runtimeAgent?.title || definition.name,
      status: statusFor(Boolean(runtimeAgent), busy, outcome),
      capabilities: runtimeAgent?.skills.length ? runtimeAgent.skills : definition.capabilities,
      permissions,
      lastAction: outcome?.summary || (runtimeAgent ? 'Bereit für einen expliziten Hermes-Auftrag' : 'Hermes-Agent nicht verfügbar'),
      approval: approvalFor(definition, status, outcome),
      pipeline: definition.pipeline,
      runtimeAgentId: runtimeAgent?.agent_id
    }
  })
}
