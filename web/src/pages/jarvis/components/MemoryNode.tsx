import type { MemoryNodeData } from './memory-data'

interface MemoryNodeProps { node: MemoryNodeData; x: number; y: number; selected: boolean; connected: boolean; onSelect: (id: string) => void }
const COLOR: Record<MemoryNodeData['type'], string> = { user: '#f8fafc', project: '#60a5fa', skill: '#a78bfa', document: '#fb923c', knowledge: '#4ade80', preference: '#facc15', agent: '#22d3ee' }

export function MemoryNode({ node, x, y, selected, connected, onSelect }: MemoryNodeProps) { const color = COLOR[node.type]; const active = node.status === 'active'; return <g className="cursor-pointer" onClick={() => onSelect(node.id)}><circle cx={x} cy={y} r={selected ? 10 : 8} fill={color} opacity={selected ? 0.16 : 0.08} className={active ? 'animate-pulse' : ''} /><circle cx={x} cy={y} r="5.5" fill="#081321" stroke={color} strokeWidth={selected ? 1.3 : connected ? 1 : 0.65} /><circle cx={x} cy={y} r="1.8" fill={color} /><text x={x} y={y + 10} textAnchor="middle" className="fill-slate-300 text-[3px] font-medium">{node.label}</text><title>{node.description ?? node.label}</title></g> }
