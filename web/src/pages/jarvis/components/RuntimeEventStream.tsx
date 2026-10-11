import { useState } from 'react'
import { Activity, Bot, BrainCircuit, Cpu, Mic, Wrench, Workflow } from 'lucide-react'
import { useRuntimeEvents } from '../runtime/event-store'
import type { JarvisRuntimeEvent } from '../runtime/event-types'


export function RuntimeEventStream() {
  const events = useRuntimeEvents()
  const [source, setSource] = useState('all')
  const [query, setQuery] = useState('')
  const visible = events.filter(event => (source === 'all' || event.source === source) && event.type.toLowerCase().includes(query.toLowerCase()))
  return <section className="command-panel">
    <h2>Lokale Bedienereignisse</h2><p>Profilgebunden · letzte {events.length}/100 Ereignisse. Kein autoritativer Backend-Eventstream.</p>
    <div className="operations-filters">
      <label className="command-field">Ereignisse suchen<input value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label className="command-field">Ereignisquelle<select value={source} onChange={event => setSource(event.target.value)}><option value="all">Alle</option>{[...new Set(events.map(event => event.source))].map(item => <option key={item}>{item}</option>)}</select></label>
    </div>
    <div className="mt-4 max-h-72 space-y-3 overflow-auto">{visible.map(event => <EventRow key={event.id} event={event} />)}</div>
    {!visible.length && <p>Keine passenden lokalen Ereignisse.</p>}
  </section>
}
function EventRow({ event }: { event: JarvisRuntimeEvent }) { const Icon = event.source === 'voice' ? Mic : event.source === 'agent' ? Bot : event.source === 'memory' ? BrainCircuit : event.source === 'task' ? Workflow : event.source === 'tool' ? Wrench : event.source === 'model' ? Cpu : Activity; return <div className="grid grid-cols-[4.5rem_1rem_minmax(0,1fr)_auto] gap-3 border-l border-cyan-300/20 pl-3"><time className="text-xs tabular-nums text-slate-500">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><Icon className="h-4 w-4 text-cyan-300" /><div><p className="text-sm text-slate-200">{event.type.replaceAll('_', ' ')}</p><p className="text-xs text-slate-500">{event.source}</p></div><span className="text-xs capitalize text-slate-400">{event.status}</span></div> }
