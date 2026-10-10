import { Bot, CheckCircle2, Circle, LoaderCircle, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JarvisVisualProps } from '../types'
import { agentState } from '../types'

const stateStyle = { idle: 'text-slate-400', thinking: 'text-violet-300', working: 'text-cyan-300', finished: 'text-emerald-300', error: 'text-rose-300' }
export function AgentActivity(props: JarvisVisualProps) {
  const state = agentState(props)
  const StateIcon = state === 'working' || state === 'thinking' ? LoaderCircle : state === 'finished' ? CheckCircle2 : state === 'error' ? TriangleAlert : Circle
  return <section className="border border-white/10 bg-slate-950/80 p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Agent network</p><div className="mt-4 space-y-3">{(props.status?.agents ?? []).map(agent => <div key={agent.agent_id} className="flex items-center justify-between gap-3 border-l border-cyan-300/30 bg-white/[0.025] px-3 py-2"><div className="flex min-w-0 items-center gap-2"><Bot className="h-4 w-4 shrink-0 text-cyan-300" /><span className="truncate text-sm text-slate-200">{agent.title}</span></div><span className={cn('flex items-center gap-1 text-xs capitalize', stateStyle[state])}><StateIcon className={cn('h-3.5 w-3.5', (state === 'working' || state === 'thinking') && 'animate-spin')} />{state}</span></div>)}{!props.loading && !props.status?.agents.length && <p className="text-sm text-slate-500">Keine Agenten verfügbar.</p>}</div></section>
}
