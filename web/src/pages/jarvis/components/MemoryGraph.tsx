import { useRef, useState } from 'react'
import { Maximize2, Minus, Move, Plus } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { MemoryConnection } from './MemoryConnection'
import { MemoryInspector } from './MemoryInspector'
import { MemoryLegend } from './MemoryLegend'
import { MemoryNode } from './MemoryNode'
import { MemorySearch } from './MemorySearch'
import { MEMORY_EVENTS, MEMORY_NODES } from './memory-data'

const POSITIONS: Record<string, { x: number; y: number }> = { user: { x: 50, y: 10 }, 'jarvis-project': { x: 30, y: 34 }, 'virus-event': { x: 14, y: 61 }, 'social-media': { x: 28, y: 79 }, 'email-agent': { x: 48, y: 68 }, 'coding-agent': { x: 42, y: 53 }, 'token-optimization': { x: 61, y: 35 }, 'agent-architecture': { x: 71, y: 56 }, 'architecture-docs': { x: 84, y: 76 }, preferences: { x: 75, y: 14 }, 'instagram-agent': { x: 14, y: 91 }, 'automation-workflow': { x: 56, y: 89 } }

export function MemoryGraph() {
  const [selectedId, setSelectedId] = useState<string | null>('jarvis-project')
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragOrigin = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const filtered = MEMORY_NODES.filter(node => `${node.label} ${node.description ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  const visibleIds = new Set(filtered.flatMap(node => [node.id, ...node.connections]))
  const selected = MEMORY_NODES.find(node => node.id === selectedId) ?? null
  const isHighlighted = (from: string, to: string) => Boolean(selected && (selected.id === from || selected.id === to) && (selected.connections.includes(from) || selected.connections.includes(to)))
  return <section className="border border-cyan-300/20 bg-slate-950/90 p-5 shadow-[0_0_70px_-36px_rgba(34,211,238,0.5)]"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Jarvis Memory Core</p><h2 className="mt-1 text-xl font-medium text-slate-100">Knowledge Graph</h2></div><div className="w-full sm:w-72"><MemorySearch value={query} onChange={setQuery} /></div></div><div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]"><div className="relative min-h-[28rem] overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(8,145,178,0.18),transparent_45%)] touch-none" onPointerDown={event => { dragOrigin.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => { if (dragOrigin.current) setPan({ x: dragOrigin.current.panX + event.clientX - dragOrigin.current.x, y: dragOrigin.current.panY + event.clientY - dragOrigin.current.y }) }} onPointerUp={() => { dragOrigin.current = null }}><svg viewBox="0 0 100 100" className="h-full min-h-[28rem] w-full" role="img" aria-label="Interaktiver Jarvis Memory Graph"><g transform={`translate(${pan.x / 5} ${pan.y / 5}) scale(${zoom})`} style={{ transformOrigin: '50px 50px' }}>{MEMORY_NODES.flatMap(node => node.connections.filter(target => node.id < target).map(target => <MemoryConnection key={`${node.id}-${target}`} from={POSITIONS[node.id]} to={POSITIONS[target]} highlighted={isHighlighted(node.id, target)} />))}{MEMORY_NODES.map(node => <g key={node.id} opacity={query && !visibleIds.has(node.id) ? 0.18 : 1}><MemoryNode node={node} {...POSITIONS[node.id]} selected={selectedId === node.id} connected={Boolean(selected && (selected.connections.includes(node.id) || node.connections.includes(selected.id)))} onSelect={setSelectedId} /></g>)}</g></svg><div className="absolute bottom-3 left-3 flex gap-1" onPointerDown={event => event.stopPropagation()}><Button size="sm" outlined onClick={() => setZoom(value => Math.min(1.5, value + 0.1))} aria-label="Vergrößern"><Plus className="h-3.5 w-3.5" /></Button><Button size="sm" outlined onClick={() => setZoom(value => Math.max(0.7, value - 0.1))} aria-label="Verkleinern"><Minus className="h-3.5 w-3.5" /></Button><Button size="sm" outlined onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} aria-label="Ansicht zurücksetzen"><Maximize2 className="h-3.5 w-3.5" /></Button></div><div className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-slate-500"><Move className="h-3 w-3" /> Drag to pan</div></div><MemoryInspector node={selected} allNodes={MEMORY_NODES} /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><MemoryLegend /><span className="text-xs text-slate-500">{MEMORY_EVENTS.length} lokale Memory-Events · Demo-State</span></div></section>
}
