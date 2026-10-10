import type { BrainNodeStatus } from '../types'

const states: Array<{ status: BrainNodeStatus; label: string; color: string }> = [{ status: 'idle', label: 'Idle', color: 'bg-slate-500' }, { status: 'active', label: 'Active', color: 'bg-cyan-400' }, { status: 'thinking', label: 'Thinking', color: 'bg-violet-400' }, { status: 'processing', label: 'Processing', color: 'bg-sky-400' }, { status: 'error', label: 'Error', color: 'bg-rose-400' }]
export function BrainLegend() { return <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.1em] text-slate-500">{states.map(state => <span key={state.status} className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${state.color}`} />{state.label}</span>)}</div> }
