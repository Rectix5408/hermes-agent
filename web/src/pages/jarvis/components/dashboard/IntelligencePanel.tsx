import { Activity, Bot, CircleCheck, Layers3, ShieldCheck } from 'lucide-react'
import type { JarvisWorkspaceProps } from '../../shell-types'

export function IntelligencePanel({ status, onNavigate }: JarvisWorkspaceProps) {
  const runs = status?.runs ?? []
  const activeRuns = runs.filter(run => ['running', 'started', 'waiting'].includes(run.status))
  const model = status?.config.orchestrator_model
  return <aside className="command-intelligence" aria-label="Systeminformationen">
    <section className="command-panel"><h2><Layers3 size={18} />Modell & Routing</h2><strong className="command-model">{typeof model === 'string' ? model : 'Nicht verfügbar'}</strong><p>Konfiguriertes Orchestrierungsziel · kein Nachweis eines aktiven Modells.</p><button className="command-text-button" onClick={() => onNavigate('/jarvis/settings')}>Konfiguration ansehen →</button></section>
    <section className="command-panel"><h2><Bot size={18} />Agenten</h2>
      {status?.agents.length ? <ul className="command-list">{status.agents.slice(0, 4).map(agent => <li key={agent.agent_id}><span>{agent.title}<small>{agent.permissions.length ? agent.permissions.join(' · ') : 'Keine Berechtigungen gemeldet'}</small></span><span className="command-chip">Registriert</span></li>)}</ul> : <p>{status ? 'Keine Agenten registriert.' : 'Agentenstatus nicht verfügbar.'}</p>}
      <button className="command-text-button" onClick={() => onNavigate('/jarvis/agents')}>Agent Operations →</button>
    </section>
    <section className="command-panel"><h2><Activity size={18} />Runtime-Aktivität</h2><p>{status ? `${activeRuns.length} aktive Aufgaben im letzten Statusabruf` : 'Runtime nicht verbunden.'}</p>
      {runs.length ? <ul className="command-list">{runs.slice(0, 3).map((run, index) => <li key={`${run.created_at}-${index}`}><CircleCheck size={16} /><span>{run.kind || 'Jarvis-Aufgabe'}<small>{run.status} · {new Date(run.created_at * 1000).toLocaleTimeString('de-DE')}</small></span></li>)}</ul> : <p>Noch keine Ausführungen gemeldet.</p>}
      <button className="command-text-button" onClick={() => onNavigate('/jarvis/runtime')}>Runtime öffnen →</button>
    </section>
    <section className="command-panel"><h2><ShieldCheck size={18} />Security & Health</h2><dl className="command-metrics"><div><dt>Hermes API</dt><dd>{status?.ok ? 'Erreichbar' : 'Nicht verbunden'}</dd></div><div><dt>Freigaben</dt><dd>{status ? status.approvals.pending.length : '—'}</dd></div><div><dt>CPU / RAM</dt><dd>Nicht verfügbar</dd></div><div><dt>Latenz</dt><dd>Nicht gemessen</dd></div></dl><button className="command-text-button" onClick={() => onNavigate('/jarvis/security')}>Freigaben prüfen →</button></section>
  </aside>
}
