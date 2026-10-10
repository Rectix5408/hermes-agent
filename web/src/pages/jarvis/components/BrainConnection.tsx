import type { JarvisRuntimeEvent } from '../types'

interface Point { x: number; y: number }
interface BrainConnectionProps { from: Point; to: Point; active: boolean; event?: JarvisRuntimeEvent }

export function BrainConnection({ from, to, active, event }: BrainConnectionProps) {
  const id = `flow-${from.x}-${from.y}-${to.x}-${to.y}`
  return <g><defs><linearGradient id={id} x1="0" x2="1"><stop stopColor="#22d3ee" stopOpacity={active ? 0.9 : 0.18} /><stop offset="1" stopColor="#a78bfa" stopOpacity={active ? 0.9 : 0.18} /></linearGradient></defs><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={`url(#${id})`} strokeWidth={active ? 1.2 : 0.55} strokeDasharray={active ? '3 2' : undefined}>{active && <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.8s" repeatCount="indefinite" />}</line><title>{event?.message ?? 'Runtime-Verbindung'}</title></g>
}
