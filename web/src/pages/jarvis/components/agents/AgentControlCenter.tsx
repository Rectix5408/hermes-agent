import { useState } from 'react'
import { AgentActivity } from './AgentActivity'
import { AgentCard } from './AgentCard'
import { AgentInspector } from './AgentInspector'
import { AgentNetwork } from './AgentNetwork'
import { AGENT_DEMO_DATA } from './agent-data'

export function AgentControlCenter() { const [selectedId, setSelectedId] = useState('research'); const selected = AGENT_DEMO_DATA.find(agent => agent.id === selectedId) ?? null; return <section className="border border-cyan-300/20 bg-slate-950/40 p-5"><div><p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Jarvis Agent Control Center</p><h2 className="mt-1 text-xl font-medium text-slate-100">Autonomous Agent Network</h2><p className="mt-1 text-sm text-slate-500">Lokaler Demo-State · bereit für künftige Runtime-Events</p></div><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]"><AgentNetwork agents={AGENT_DEMO_DATA} selectedId={selectedId} onSelect={setSelectedId} /><AgentInspector agent={selected} /></div><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{AGENT_DEMO_DATA.map(agent => <AgentCard key={agent.id} agent={agent} selected={agent.id === selectedId} onSelect={setSelectedId} />)}</div><AgentActivity agents={AGENT_DEMO_DATA} /></div></section> }
