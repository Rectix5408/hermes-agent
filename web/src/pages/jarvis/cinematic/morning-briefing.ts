import type { JarvisStatusResponse, MemoryStatus } from '@/lib/api'
import { memoryTelemetry } from './live-runtime'

export interface BriefingItem { label: string; value: string; detail: string }

/** Builds a briefing from already-loaded runtime status; it performs no model inference or I/O. */
export function buildMorningBriefing(status: JarvisStatusResponse | null, memory: MemoryStatus | null): BriefingItem[] {
  const integrations = status?.integrations ?? []
  const mail = integrations.find(item => item.id.toLowerCase().includes('mail'))
  const activeTasks = status?.runs.filter(run => ['started', 'running', 'waiting'].includes(run.status)).length
  const telemetry = memoryTelemetry(memory)
  return [
    { label: 'E-Mail', value: mail?.status ?? 'Nicht gemeldet', detail: mail?.reason || 'Keine Mail-Zählung über den vorhandenen Status-Endpunkt.' },
    { label: 'Kalender', value: integrations.find(item => item.id.toLowerCase().includes('calendar'))?.status ?? 'Nicht gemeldet', detail: 'Termine werden erst über eine vorhandene Kalender-Integration ausgewertet.' },
    { label: 'Agenten', value: status ? `${status.agents.length} registriert` : 'Nicht verfügbar', detail: status ? `${activeTasks} aktive Aufgaben im letzten Statusabruf.` : 'Keine Runtime-Daten geladen.' },
    { label: 'System', value: status?.ok ? 'API erreichbar' : 'Nicht erreichbar', detail: status?.models.note || 'Keine CPU- oder RAM-Telemetrie vorhanden.' },
    { label: 'Memory', value: telemetry.state, detail: telemetry.stored }
  ]
}
