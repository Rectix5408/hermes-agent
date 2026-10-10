import { BrainCircuit, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrainConnection } from './BrainConnection'
import { BrainLegend } from './BrainLegend'
import { BrainNode } from './BrainNode'
import { brainNodes, runtimeEvents, type BrainNodeData, type JarvisVisualProps } from '../types'

const POSITIONS: Record<BrainNodeData['id'], { x: number; y: number }> = {
  core: { x: 50, y: 49 }, model: { x: 20, y: 22 }, memory: { x: 50, y: 13 }, agents: { x: 18, y: 49 }, tools: { x: 82, y: 49 }, skills: { x: 50, y: 82 }, voice: { x: 80, y: 78 }, tasks: { x: 21, y: 78 }, session: { x: 80, y: 22 }
}

export function BrainVisualization(props: JarvisVisualProps) {
  const events = runtimeEvents(props)
  const nodes = brainNodes(props, events)
  const latest = events[0]
  const active = Boolean(latest && latest.timestamp > 0)
  return <section className="relative overflow-hidden border border-cyan-300/20 bg-slate-950/90 p-5 shadow-[0_0_70px_-28px_rgba(34,211,238,0.5)]">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(8,145,178,0.24),transparent_45%)]" />
    <div className="relative flex items-center justify-between text-xs uppercase tracking-[0.2em] text-cyan-200/70"><span className="flex items-center gap-2"><BrainCircuit className="h-4 w-4" /> Jarvis brain v2</span><span className="flex items-center gap-2"><Radio className={cn('h-3 w-3', active && 'animate-pulse')} /> {latest ? latest.type.replace('_', ' ') : 'standby'}</span></div>
    <svg viewBox="0 0 100 100" className="relative mx-auto block h-[23rem] max-w-full" role="img" aria-label="Jarvis neuronales Runtime-Netzwerk">
      <defs><filter id="jarvis-brain-glow"><feGaussianBlur stdDeviation="1.2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <circle cx="50" cy="49" r="43" fill="none" stroke="rgba(34,211,238,0.1)" /><circle cx="50" cy="49" r="34" fill="none" stroke="rgba(56,189,248,0.12)" strokeDasharray="2 4" className={active ? 'animate-[spin_22s_linear_infinite]' : ''} />
      {nodes.flatMap(node => node.connections.filter(target => node.id < target).map(target => { const event = events.find(item => (item.source === node.id && item.target === target) || (item.source === target && item.target === node.id)); return <BrainConnection key={`${node.id}-${target}`} from={POSITIONS[node.id]} to={POSITIONS[target as BrainNodeData['id']]} active={Boolean(event)} event={event} /> }))}
      {nodes.map(node => <BrainNode key={node.id} node={node} {...POSITIONS[node.id]} />)}
    </svg>
    <div className="relative border-t border-cyan-300/15 pt-3"><BrainLegend /></div>
  </section>
}
