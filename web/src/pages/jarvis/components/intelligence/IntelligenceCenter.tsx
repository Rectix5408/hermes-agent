import { useMemo } from 'react'
import { automationSuggestion } from '../../intelligence/automation-rules'
import { decide } from '../../intelligence/decision-engine'
import { routeIntent } from '../../intelligence/intent-router'
import { memoryContext } from '../../intelligence/memory-context'
import { useRuntimeEvents } from '../../runtime/event-store'
import { DecisionCard } from './DecisionCard'
import { IntentTimeline } from './IntentTimeline'
export function IntelligenceCenter() { const events = useRuntimeEvents(); const results = useMemo(() => events.map(event => { const intent = routeIntent(event); return { intent, decision: decide(intent, event), eventType: event.type, automationSuggestion: automationSuggestion(intent, event) } }), [events]); return <section className="border border-cyan-300/20 bg-slate-950/40 p-5"><div><p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Jarvis Intelligence</p><h2 className="mt-1 text-xl font-medium text-slate-100">Rule-based Decision Layer</h2><p className="mt-1 text-sm text-slate-500">Lokale Priorisierung und Empfehlungen · keine automatische Ausführung</p></div><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]"><DecisionCard result={results[0] ?? null} /><IntentTimeline results={results.slice(0, 5)} /></div><p className="mt-4 text-xs text-slate-500">Memory context: {memoryContext.projects.join(' · ')} · {memoryContext.userPreferences.length} Präferenzen</p></section> }
