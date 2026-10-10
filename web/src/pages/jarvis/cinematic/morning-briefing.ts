import type { JarvisStatusResponse, MemoryStatus } from '@/lib/api'
import { liveAgents, memoryTelemetry } from './live-runtime'

export interface BriefingItem { label: string; value: string; detail: string }

/** Builds a briefing from already-loaded runtime status; it performs no model inference or I/O. */
export function buildMorningBriefing(status: JarvisStatusResponse | null, memory: MemoryStatus | null): BriefingItem[] {
  const integrations = status?.integrations ?? []
  const mail = integrations.find(item => item.id.toLowerCase().includes('mail'))
  const agents = liveAgents(status, false, null)
  const telemetry = memoryTelemetry(memory)
  return [
    { label: 'E-Mail', value: mail?.status ?? 'Nicht gemeldet', detail: mail?.reason || 'Keine Mail-Zählung über den vorhandenen Status-Endpunkt.' },
    { label: 'Kalender', value: integrations.find(item => item.id.toLowerCase().includes('calendar'))?.status ?? 'Nicht gemeldet', detail: 'Termine werden erst über eine vorhandene Kalender-Integration ausgewertet.' },
    { label: 'Agenten', value: `${agents.length} verfügbar`, detail: `${agents.filter(agent => agent.status === 'RUNNING').length} laufen gerade.` },
    { label: 'System', value: status?.ok ? 'Normal' : 'Nicht erreichbar', detail: status?.models.note || 'Hermes-Status' },
    { label: 'Memory', value: telemetry.state, detail: telemetry.stored }
  ]
}
