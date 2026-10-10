import { CalendarDays, CheckCircle2, CircleAlert, Clock3, Mail, Search, Send, ShieldCheck, Sparkles } from 'lucide-react'
import type { JarvisOrchestrationResponse, JarvisStatusResponse } from '@/lib/api'
import { registeredAgents, type JarvisAgentKind, type JarvisRegisteredAgent } from '../../agents/agent-registry'

function AgentIcon({ id }: { id: JarvisAgentKind }) {
  if (id === 'mail') return <Mail className="h-4 w-4" />
  if (id === 'calendar') return <CalendarDays className="h-4 w-4" />
  if (id === 'research') return <Search className="h-4 w-4" />
  return <Sparkles className="h-4 w-4" />
}

function stateClass(state: JarvisRegisteredAgent['status']) {
  if (state === 'ERROR' || state === 'OFFLINE') return 'text-rose-300 border-rose-300/25 bg-rose-400/10'
  if (state === 'RUNNING') return 'text-cyan-100 border-cyan-300/40 bg-cyan-300/10'
  return 'text-emerald-200 border-emerald-300/25 bg-emerald-400/10'
}

function approvalClass(state: JarvisRegisteredAgent['approval']) {
  if (state === 'PENDING APPROVAL') return 'text-amber-200 border-amber-300/30 bg-amber-300/10'
  if (state === 'REJECTED') return 'text-rose-200 border-rose-300/30 bg-rose-300/10'
  if (state === 'APPROVED') return 'text-emerald-200 border-emerald-300/30 bg-emerald-300/10'
  return 'text-slate-300 border-white/10 bg-white/5'
}

export function AgentRegistryCenter({ status, busy, result }: { status: JarvisStatusResponse | null; busy: boolean; result: JarvisOrchestrationResponse | null }) {
  const agents = registeredAgents(status, busy, result)
  return <section className="jarvis-glass relative overflow-hidden p-5"><span className="jarvis-scanline" /><div className="relative"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[.2em] text-cyan-300/80">Specialized Agent Registry</p><h2 className="mt-1 text-xl text-slate-100">Sicheres Agent Command Center</h2><p className="mt-2 max-w-2xl text-sm text-slate-400">Agenten werden ausschließlich aus dem vorhandenen Hermes-Status abgebildet. Nicht verfügbare Agenten bleiben offline; riskante Schritte wechseln in die Freigabe-Queue.</p></div><span className="flex items-center gap-2 text-xs text-cyan-100"><ShieldCheck className="h-4 w-4" />Approval-first</span></div><div className="mt-5 grid gap-4 xl:grid-cols-2">{agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}</div></div></section>
}

function AgentCard({ agent }: { agent: JarvisRegisteredAgent }) {
  return <article className="group relative overflow-hidden border border-cyan-300/15 bg-slate-950/35 p-4 transition-colors hover:border-cyan-300/35"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent opacity-60" /><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-200"><AgentIcon id={agent.id} /></span><div><h3 className="text-sm font-medium text-slate-100">{agent.name}</h3><p className="mt-1 text-[10px] uppercase tracking-[.16em] text-slate-500">{agent.runtimeAgentId || 'Runtime nicht gemeldet'}</p></div></div><span className={`border px-2 py-1 text-[10px] tracking-[.1em] ${stateClass(agent.status)}`}>{agent.status === 'RUNNING' && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" />}{agent.status}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Detail title="Fähigkeiten" icon={CheckCircle2} values={agent.capabilities} empty="Keine Fähigkeiten aus Hermes gemeldet" /><Detail title="Berechtigungen" icon={ShieldCheck} values={agent.permissions} empty="Keine Berechtigungen gemeldet" /></div><div className="mt-4 border-t border-white/10 pt-3"><p className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-slate-500"><Clock3 className="h-3.5 w-3.5" />Letzte Aktion</p><p className="mt-1 text-xs leading-5 text-slate-300">{agent.lastAction}</p></div>{agent.pipeline && <div className="mt-4 border-t border-white/10 pt-3"><p className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-slate-500"><Send className="h-3.5 w-3.5" />Content Pipeline</p><ol className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-cyan-100">{agent.pipeline.map((step, index) => <li key={step} className="flex items-center gap-1.5"><span className={step === 'PENDING APPROVAL' ? 'border border-amber-300/35 bg-amber-300/10 px-1.5 py-1 text-amber-100' : 'border border-white/10 bg-black/20 px-1.5 py-1'}>{step}</span>{index < agent.pipeline!.length - 1 && <span className="text-slate-600">→</span>}</li>)}</ol><p className="mt-2 text-[11px] text-amber-100/80">Veröffentlichung bleibt bis zu einer vorhandenen Freigabe gesperrt.</p></div>}<div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3"><span className="text-[10px] uppercase tracking-[.14em] text-slate-500">Approval</span><span className={`border px-2 py-1 text-[10px] tracking-[.08em] ${approvalClass(agent.approval)}`}>{agent.approval === 'PENDING APPROVAL' && <CircleAlert className="mr-1 inline h-3 w-3" />}{agent.approval}</span></div></article>
}

function Detail({ title, icon: Icon, values, empty }: { title: string; icon: typeof ShieldCheck; values: string[]; empty: string }) {
  return <div><p className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-slate-500"><Icon className="h-3.5 w-3.5" />{title}</p><p className="mt-1 text-xs leading-5 text-slate-300">{values.length ? values.join(' · ') : empty}</p></div>
}
