import { LockKeyhole, MemoryStick, Mic, Radio } from 'lucide-react'
import type { JarvisOrchestrationResponse, JarvisStatusResponse, MemoryStatus } from '@/lib/api'
import { configuredIntegration, memoryTelemetry } from '../../cinematic/live-runtime'

interface CinematicHudProps { status: JarvisStatusResponse | null; memory: MemoryStatus | null; voiceBusy: 'recording' | 'transcribing' | 'speaking' | null; result: JarvisOrchestrationResponse | null }
export function CinematicHud({ status, memory, voiceBusy, result }: CinematicHudProps) {
  const memoryState = memoryTelemetry(memory)
  const configured = (status?.integrations ?? []).filter(item => ['available', 'configured'].includes(item.status)).length
  const pending = status?.approvals.pending.length ?? 0
  const mailMcp = configuredIntegration(status, 'mail')
  const lastAction = result?.status ?? 'Keine Ausführung'
  return <><div className="jarvis-glass sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs"><span className="flex items-center gap-2 font-medium tracking-[.18em] text-cyan-100"><span className={`h-2 w-2 rounded-full ${status?.ok ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`} />JARVIS {status?.ok ? 'ONLINE' : 'OFFLINE'}</span><span className="text-slate-400">MODEL <b className="ml-1 text-slate-200">{status?.models.available ? 'VERFÜGBAR' : 'NICHT VERFÜGBAR'}</b></span><span className="text-slate-400">RUNTIME <b className="ml-1 text-cyan-200">{lastAction.toUpperCase()}</b></span></div><div className="jarvis-glass sticky bottom-2 z-20 mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 px-4 py-2 text-[11px] text-slate-400"><span className="flex items-center gap-1"><Mic className="h-3.5 w-3.5 text-cyan-300" />Mikrofon {voiceBusy ?? 'standby'}</span><span className="flex items-center gap-1"><MemoryStick className="h-3.5 w-3.5 text-cyan-300" />Memory {memoryState.state}</span><span className="flex items-center gap-1"><LockKeyhole className="h-3.5 w-3.5 text-amber-300" />{pending} Freigaben offen</span><span className="flex items-center gap-1"><Radio className="h-3.5 w-3.5 text-cyan-300" />{configured} Integrationen · Mail MCP {mailMcp ? 'bereit' : 'nicht gemeldet'}</span></div></>
}
