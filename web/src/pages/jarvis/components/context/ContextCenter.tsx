import { useState } from 'react'
import { Layers3 } from 'lucide-react'
import { contextSources } from '../../context/context-sources'
import { getRelevantContext } from '../../context/context-resolver'
import { useJarvisContext } from '../../context/context-store'
import { ContextCard } from './ContextCard'
import { ContextInspector } from './ContextInspector'
import { ContextSourceList } from './ContextSourceList'
export function ContextCenter() { const context = useJarvisContext(); const items = getRelevantContext(context); const [selectedId, setSelectedId] = useState(items[0]?.id ?? ''); const selected = items.find(item => item.id === selectedId) ?? null; return <section className="border border-cyan-300/20 bg-slate-950/40 p-5"><div><p className="flex items-center gap-2 text-xs uppercase tracking-[.22em] text-cyan-300/80"><Layers3 className="h-4 w-4" /> Jarvis Context Layer</p><h2 className="mt-1 text-xl font-medium text-slate-100">Active Context</h2><p className="mt-1 text-sm text-slate-500">Lokale Quellen und Prioritäten · bereit für spätere Hermes- und Memory-Daten</p></div><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => <ContextCard key={item.id} item={item} selected={item.id === selectedId} onSelect={setSelectedId} />)}</div><ContextInspector item={selected} /></div><div className="mt-5"><ContextSourceList sources={contextSources} /></div></section> }
