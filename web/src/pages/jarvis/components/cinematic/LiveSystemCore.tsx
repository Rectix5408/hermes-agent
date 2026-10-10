import { Database, Layers3, MemoryStick, Sigma } from 'lucide-react'
import type { JarvisStatusResponse, MemoryStatus } from '@/lib/api'
import { memoryTelemetry } from '../../cinematic/live-runtime'

export function LiveSystemCore({ status, memory }: { status: JarvisStatusResponse | null; memory: MemoryStatus | null }) {
  const telemetry = memoryTelemetry(memory)
  const values = [{ label: 'MODEL', value: status?.models.available ? 'VERFÜGBAR' : '—', state: status?.models.note || 'Warten auf Hermes-Status', icon: Layers3 }, { label: 'TOKENS', value: String(status?.config.max_prompt_tokens ?? '—'), state: 'Prompt-Limit der Jarvis-Konfiguration', icon: Sigma }, { label: 'MEMORY', value: telemetry.stored, state: telemetry.state, icon: MemoryStick }, { label: 'INTEGRATIONS', value: String((status?.integrations ?? []).filter(item => ['available', 'configured'].includes(item.status)).length), state: 'Von Hermes gemeldet', icon: Database }]
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{values.map(card => { const Icon = card.icon; return <div key={card.label} className="jarvis-glass relative overflow-hidden p-4"><span className="jarvis-scanline" /><Icon className="relative h-4 w-4 text-cyan-300" /><p className="relative mt-4 text-[10px] tracking-[.15em] text-slate-500">{card.label}</p><p className="relative mt-1 text-lg text-slate-100">{card.value}</p><p className="relative mt-2 text-[10px] uppercase text-emerald-300">{card.state}</p></div> })}</section>
}
