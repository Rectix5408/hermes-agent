import { Bot, Mail, Search } from 'lucide-react'
import type { JarvisOrchestrationResponse, JarvisStatusResponse } from '@/lib/api'
import { liveAgents } from '../../cinematic/live-runtime'

function iconFor(name: string) { if (name.toLowerCase().includes('mail')) return Mail; if (name.toLowerCase().includes('research')) return Search; return Bot }
export function CinematicAgentCards({ status, busy, result }: { status: JarvisStatusResponse | null; busy: boolean; result: JarvisOrchestrationResponse | null }) {
  const agents = liveAgents(status, busy, result)
  return <section className="jarvis-glass p-5"><p className="text-xs uppercase tracking-[.2em] text-cyan-300/80">Agent Grid · Hermes Runtime</p><div className="mt-4 grid gap-3 md:grid-cols-3">{agents.map(agent => { const Icon = iconFor(agent.name); return <div key={agent.id} className="border border-white/10 bg-black/15 p-4"><div className="flex items-center justify-between"><Icon className="h-4 w-4 text-cyan-300" /><span className={`flex items-center gap-1 text-xs ${agent.status === 'ERROR' ? 'text-rose-300' : agent.status === 'RUNNING' ? 'text-cyan-200' : 'text-emerald-300'}`}><span className={`h-1.5 w-1.5 rounded-full ${agent.status === 'RUNNING' ? 'animate-pulse bg-cyan-300' : 'bg-emerald-400'}`} />{agent.status}</span></div><p className="mt-4 text-sm font-medium text-slate-100">{agent.name}</p><p className="mt-2 text-xs text-slate-500">{agent.tools.join(' · ') || 'Keine Toolsets gemeldet'}</p><p className="mt-3 text-xs text-cyan-100">{agent.activity}</p></div> })}</div>{!agents.length && <p className="mt-4 text-xs text-slate-500">Die Hermes-API meldet keine Agenten.</p>}</section>
}
