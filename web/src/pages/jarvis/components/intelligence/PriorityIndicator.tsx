import type { JarvisDecision } from '../../intelligence/types'
const colors: Record<JarvisDecision['priority'], string> = { low: 'text-slate-400 border-slate-500/30', medium: 'text-sky-300 border-sky-400/30', high: 'text-amber-300 border-amber-400/30', critical: 'text-rose-300 border-rose-400/30' }
export function PriorityIndicator({ priority }: { priority: JarvisDecision['priority'] }) { return <span className={`border px-2 py-1 text-xs font-medium uppercase tracking-[0.1em] ${colors[priority]}`}>{priority}</span> }
