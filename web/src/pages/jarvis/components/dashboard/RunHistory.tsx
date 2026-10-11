import { useState } from 'react'
import { Button } from '@nous-research/ui/ui/components/button'
import type { JarvisWorkspaceProps } from '../../shell-types'

export function RunHistory({ agentId, ...props }: JarvisWorkspaceProps & { agentId?: string }) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState('all')
  const source = (props.status?.runs ?? []).filter(run => !agentId || run.agents.includes(agentId))
  const runs = source.filter(run => (state === 'all' || run.status === state) && `${run.request} ${run.agents.join(' ')}`.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE')))
    .slice().sort((a, b) => b.created_at - a.created_at)
  return <section className="command-panel" aria-label="Gemeldete Aufträge">
    <header><h2>Gemeldete Aufträge</h2><span>{source.length} Einträge</span></header>
    <p>Vorhandene Profilhistorie, kein Live-Eventstream. Erneutes Vorbereiten führt nichts aus und übernimmt keine alte Freigabe.</p>
    <div className="operations-filters">
      <label className="command-field">Aufträge durchsuchen<input value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label className="command-field">Auftragsstatus<select value={state} onChange={event => setState(event.target.value)}><option value="all">Alle</option>{[...new Set(source.map(run => run.status))].map(status => <option key={status}>{status}</option>)}</select></label>
    </div>
    {props.busy && <p role="status">{props.busy === 'plan' ? 'Planung' : 'Ausführung'} in diesem Workspace angefordert · {props.selectedAgent}</p>}
    {runs.length ? <ol className="operations-history">{runs.map((run, index) => <li key={`${run.created_at}-${index}`}>
      <details><summary><time>{new Date(run.created_at * 1000).toLocaleString('de-DE')}</time> · {run.status} · {run.agents.join(', ') || 'Orchestrierung'}</summary>
        <p>{run.request || 'Kein Auftragstext gespeichert.'}</p>
        <p>Integrationsprobleme: {run.missing_integrations.join(', ') || 'Keine gemeldet'}</p>
        <p>Erforderliche Freigaben: {run.approval_required.length} · Externe Aktionen: {run.external_actions_executed ? 'Gemeldet' : 'Keine gemeldet'}</p>
        <p>Historische Ergebnisse werden von dieser API nicht mitgeliefert.</p>
        <Button size="sm" outlined disabled={!!props.busy || !run.request} onClick={() => {
          props.onRequestChange(run.request); props.onPayloadChange('{}')
          props.onAgentSelect(run.agents.length === 1 && props.status?.agents.some(agent => agent.agent_id === run.agents[0]) ? run.agents[0] : 'auto')
          props.onNavigate('/jarvis#jarvis-command-console')
        }}>Erneut vorbereiten</Button>
      </details>
    </li>)}</ol> : <p>Keine passenden Aufträge von Hermes gemeldet.</p>}
  </section>
}
