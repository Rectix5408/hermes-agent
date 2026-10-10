import { cn } from '@/lib/utils'
import type { BrainNodeData } from '../types'

interface BrainNodeProps { node: BrainNodeData; x: number; y: number }
const NODE_COLOR: Record<BrainNodeData['status'], string> = { idle: '#64748b', active: '#22d3ee', thinking: '#a78bfa', processing: '#38bdf8', success: '#34d399', warning: '#fbbf24', error: '#fb7185' }

export function BrainNode({ node, x, y }: BrainNodeProps) {
  const color = NODE_COLOR[node.status]
  const active = ['active', 'thinking', 'processing'].includes(node.status)
  const radius = node.type === 'core' ? 12 : 7
  return <g className={cn(active && 'animate-pulse')} style={{ transformOrigin: `${x}px ${y}px` }}>
    {active && <circle cx={x} cy={y} r={radius + 4} fill={color} opacity="0.12" />}
    <circle cx={x} cy={y} r={radius} fill="#07111f" stroke={color} strokeWidth={node.type === 'core' ? 1 : 0.7} />
    <circle cx={x} cy={y} r={node.type === 'core' ? 4 : 1.8} fill={color} />
    <text x={x} y={y + radius + 6} textAnchor="middle" className="fill-slate-300 text-[3.3px] font-medium tracking-[0.5px]">{node.label}</text>
  </g>
}
