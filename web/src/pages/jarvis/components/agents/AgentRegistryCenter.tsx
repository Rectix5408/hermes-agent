import { useState } from 'react'
import { Bot } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { CommandConsole } from '../dashboard/CommandConsole'
import { RunHistory } from '../dashboard/RunHistory'
import type { JarvisWorkspaceProps } from '../../shell-types'

/** The API catalogue is authoritative; no aliases, demo agents or inferred live status. */
export function AgentRegistryCenter(props: JarvisWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [capability, setCapability] = useState('all')
  const [availability, setAvailability] = useState('all')
  const [sort, setSort] = useState('name')
  const [view, setView] = useState('list')
  const agents = props.status?.agents ?? []
  const available = props.status?.orchestrator.available === true
  const lastRun = (id: string) => Math.max(0, ...(props.status?.runs ?? []).filter(run => run.agents.includes(id)).map(run => run.created_at))
  const visible = agents.filter(agent =>
    `${agent.title} ${agent.agent_id}`.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE')) &&
    (capability === 'all' || agent.skills.includes(capability)) &&
    (availability === 'all' || availability === (available ? 'available' : 'unavailable'))
  ).slice().sort((a, b) => sort === 'activity' ? lastRun(b.agent_id) - lastRun(a.agent_id) || a.title.localeCompare(b.title, 'de') : a.title.localeCompare(b.title, 'de'))
  const selected = agents.find(agent => agent.agent_id === props.selectedAgent)
  const outcome = props.result?.results?.find(result => result.agent_id === selected?.agent_id)
  const approvals = props.status?.approvals.pending.filter(approval => approval.agent_id === selected?.agent_id) ?? []
  return <section aria-label="Agentenverwaltung" className="operations-layout">
    <div className="command-panel operations-catalog">
      <header><h2>Agentenkatalog</h2><span>{agents.length} registriert</span></header>
      <p>{available ? 'Orchestrierung erreichbar. Einzelne Integrationen können trotzdem fehlen.' : 'Orchestrierung nicht verfügbar. Katalog zuletzt gemeldet.'}</p>
      <label className="command-field">Agenten suchen<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name oder Kennung" /></label>
      <div className="operations-filters">
        <label className="command-field">Verfügbarkeit<select value={availability} onChange={event => setAvailability(event.target.value)}><option value="all">Alle</option><option value="available">Orchestrierung verfügbar</option><option value="unavailable">Orchestrierung nicht verfügbar</option></select></label>
        <label className="command-field">Fähigkeit / Skill<select value={capability} onChange={event => setCapability(event.target.value)}><option value="all">Alle</option>{[...new Set(agents.flatMap(agent => agent.skills))].sort().map(skill => <option key={skill}>{skill}</option>)}</select></label>
        <label className="command-field">Sortierung<select value={sort} onChange={event => setSort(event.target.value)}><option value="name">Name</option><option value="activity">Letzter gemeldeter Auftrag</option></select></label>
        <label className="command-field">Ansicht<select value={view} onChange={event => setView(event.target.value)}><option value="list">Liste</option><option value="cards">Kompakte Karten</option></select></label>
      </div>
      <div className={`operations-list operations-list-${view}`}>{visible.map(agent => <button type="button" key={agent.agent_id} aria-pressed={selected?.agent_id === agent.agent_id} onClick={() => props.onAgentSelect(agent.agent_id)}>
        <Bot size={18} /><span><strong>{agent.title}</strong><small>{agent.agent_id} · Registriert</small><small>{agent.skills.join(' · ') || 'Keine Skills gemeldet'}</small></span>
      </button>)}</div>
      {!visible.length && <p>Keine passenden registrierten Agenten.</p>}
    </div>
    <div className="operations-detail">
      <section className="command-panel" aria-label="Agenteninspektor">
        {selected ? <>
          <header><div><p className="command-eyebrow">Agenteninspektor</p><h2>{selected.title}</h2></div><span className="command-chip">Registriert</span></header>
          <p>{selected.scope || 'Keine Beschreibung gemeldet.'}</p>
          <dl className="operations-facts">
            <Fact label="Kennung" value={selected.agent_id} /><Fact label="Fähigkeiten / Skills" value={selected.skills.join(', ') || 'Keine gemeldet'} />
            <Fact label="Toolsets" value={selected.toolsets.join(', ') || 'Keine gemeldet'} /><Fact label="Berechtigungen" value={selected.permissions.join(', ') || 'Keine gemeldet'} />
            <Fact label="Modellroute" value={selected.model_route || 'Nicht gemeldet'} /><Fact label="Ausführungslimits" value={`${selected.max_steps} Schritte · ${selected.max_input_chars} Eingabezeichen`} />
            <Fact label="Letzter gemeldeter Auftrag" value={lastRun(selected.agent_id) ? new Date(lastRun(selected.agent_id) * 1000).toLocaleString('de-DE') : 'Keine Historie vorhanden'} />
          </dl>
          <p>Toolsets sind deklarierte Fähigkeiten, kein Nachweis aktiver Toolprozesse. Individuelle Modell-, Skill- und Berechtigungsänderungen haben hier keinen unterstützten Speicherweg.</p>
          <div className="command-actions"><Button size="sm" outlined onClick={() => props.onNavigate('/jarvis/security')}>Freigaben öffnen ({approvals.length})</Button><Button size="sm" outlined onClick={() => props.onNavigate('/jarvis/settings')}>Profil-Routing einstellen</Button></div>
          {outcome && <details open><summary>Letztes Ergebnis · {outcome.status}</summary><p>{outcome.summary}</p><p>{outcome.missing_integrations.join(', ')}</p></details>}
          {approvals.map(item => <p key={item.id}>Freigabe ausstehend: {item.action} · {item.reason}</p>)}
          <details><summary>Gemeldete Integrationszustände des Profils</summary>{props.status?.integrations.map(item => <p key={item.id}>{item.label} · {item.status === 'not_configured' ? 'Noch nicht eingerichtet' : item.status} · {item.reason}</p>)}</details>
        </> : <><h2>Agent auswählen</h2><p>Fähigkeiten, Berechtigungen und Aufträge werden nach Auswahl angezeigt.</p></>}
      </section>
      {selected && <><CommandConsole {...props} /><RunHistory {...props} agentId={selected.agent_id} /></>}
    </div>
  </section>
}
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }
