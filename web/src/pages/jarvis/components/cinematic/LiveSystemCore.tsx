import { Activity, Cpu, Gauge, Layers3, MemoryStick, Sigma } from 'lucide-react'
import type { JarvisStatusResponse, MemoryStatus } from '@/lib/api'
import { memoryTelemetry } from '../../cinematic/live-runtime'

export function LiveSystemCore({ status, memory }: { status: JarvisStatusResponse | null; memory: MemoryStatus | null }) {
  const telemetry = memoryTelemetry(memory)
  const activeTasks = (status?.runs ?? []).filter(run => !['completed', 'failed'].includes(run.status)).length
  const values = [{ label: 'CPU', value: '—', state: 'Telemetry Stream wartet', icon: Cpu }, { label: 'RAM', value: '—', state: 'Telemetry Stream wartet', icon: MemoryStick }, { label: 'MODEL', value: status?.models.available ? 'VERFÜGBAR' : 'OFFLINE', state: status?.models.note || 'Warten auf Hermes-Status', icon: Layers3 }, { label: 'TOKENS', value: String(status?.config.max_prompt_tokens ?? '—'), state: 'Prompt-Limit der Jarvis-Konfiguration', icon: Sigma }, { label: 'LATENCY', value: 'EVENT-BASED', state: 'Kein permanentes Polling', icon: Gauge }, { label: 'ACTIVE TASKS', value: String(activeTasks), state: `${telemetry.stored} · ${telemetry.state}`, icon: Activity }]
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{values.map(card => { const Icon = card.icon; return <div key={card.label} className="jarvis-glass relative overflow-hidden p-4"><span className="jarvis-scanline" /><Icon className="relative h-4 w-4 text-cyan-300" /><p className="relative mt-4 text-[10px] tracking-[.15em] text-slate-500">{card.label}</p><p className="relative mt-1 text-lg text-slate-100">{card.value}</p><p className="relative mt-2 text-[10px] uppercase text-cyan-100/80">{card.state}</p><span className="relative mt-3 block h-px bg-gradient-to-r from-cyan-300/70 via-cyan-300/10 to-transparent" /></div> })}</section>
}
