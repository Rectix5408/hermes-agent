import type { ActionRisk } from '../../security/types'
const colors: Record<ActionRisk, string> = { low: 'border-slate-500/30 text-slate-300', medium: 'border-sky-400/30 text-sky-300', high: 'border-amber-400/30 text-amber-300', critical: 'border-rose-400/30 text-rose-300' }
export function RiskBadge({ risk }: { risk: ActionRisk }) { return <span className={`border px-2 py-1 text-xs font-medium uppercase tracking-[.1em] ${colors[risk]}`}>{risk}</span> }
