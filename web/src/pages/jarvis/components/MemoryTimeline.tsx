import { CheckCircle2, CircleDot, LoaderCircle, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityEntry } from '../types'

export function MemoryTimeline({ entries }: { entries: ActivityEntry[] }) {
  return <section className="border border-white/10 bg-slate-950/80 p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Activity stream</p><div className="mt-4 space-y-4">{entries.length ? entries.map(entry => <div key={entry.id} className="grid grid-cols-[1rem_3.5rem_minmax(0,1fr)] gap-3"><TimelineIcon state={entry.state} /><time className="pt-0.5 text-xs text-slate-500">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><div><p className="text-sm text-slate-200">{entry.label}</p><p className="mt-0.5 truncate text-xs text-slate-500">{entry.detail}</p></div></div>) : <p className="text-sm text-slate-500">Noch keine Aktivitäten erfasst.</p>}</div></section>
}
function TimelineIcon({ state }: { state: ActivityEntry['state'] }) { const Icon = state === 'error' ? TriangleAlert : state === 'finished' ? CheckCircle2 : state === 'working' || state === 'thinking' ? LoaderCircle : CircleDot; return <Icon className={cn('mt-0.5 h-4 w-4', state === 'error' ? 'text-rose-300' : state === 'finished' ? 'text-emerald-300' : 'text-cyan-300', (state === 'working' || state === 'thinking') && 'animate-spin')} /> }
