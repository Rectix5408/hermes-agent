import { Bot, Play, Send, SquareCode, Volume2 } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { Spinner } from '@nous-research/ui/ui/components/spinner'
import type { JarvisWorkspaceProps } from '../../shell-types'

/** Existing orchestration only: this is not another chat transport. */
export function CommandConsole(props: JarvisWorkspaceProps) {
  const summary = props.result?.consolidated?.summary
  const disabled = !!props.busy || !props.status?.orchestrator.available || !props.payload || !props.request.trim()
  return <section className="command-panel command-console" id="jarvis-command-console" aria-labelledby="console-title">
    <header><div><p className="command-eyebrow">Command console</p><h2 id="console-title">Von der Idee zur Aufgabe</h2></div>
      <Button size="sm" outlined onClick={() => props.onNavigate('/chat')}><Send size={16} />Hermes Chat öffnen</Button></header>
    <p>Planung und Ausführung über Hermes. Externe Aktionen bleiben freigabepflichtig.</p>
    <label className="command-field">Aufgabe<textarea id="jarvis-task-input" aria-label="Jarvis Aufgabe" placeholder="Welche Aufgabe soll Hermes vorbereiten?" value={props.request} onChange={event => props.onRequestChange(event.target.value)} /></label>
    <details><summary>Agent und Kontext</summary><div className="command-agent-selection">
      {[{ agent_id: 'auto', title: 'Automatisch' }, ...(props.status?.agents ?? [])].map(agent => <Button key={agent.agent_id} size="sm" outlined={agent.agent_id !== props.selectedAgent} aria-pressed={agent.agent_id === props.selectedAgent} onClick={() => props.onAgentSelect(agent.agent_id)}><Bot size={14} />{agent.title}</Button>)}
    </div><p>Planen nutzt immer die Orchestrierung. Die Agentenauswahl gilt für Ausführen.</p><label className="command-field">Kontext (JSON)<textarea aria-label="Jarvis Kontext JSON" value={props.payloadText} onChange={event => props.onPayloadChange(event.target.value)} spellCheck={false} /></label></details>
    <div className="command-actions">
      <Button onClick={() => props.onRun('plan')} disabled={disabled}>{props.busy === 'plan' ? <Spinner /> : <SquareCode size={16} />}Planen</Button>
      <Button outlined onClick={() => props.onRun('run')} disabled={disabled}>{props.busy === 'run' ? <Spinner /> : <Play size={16} />}Ausführen</Button>
      <Button size="sm" outlined onClick={props.onRecordVoice} disabled={!!props.voiceBusy}>Spracheingabe</Button>
      <Button size="sm" outlined onClick={() => summary && props.onSpeak(summary)} disabled={!summary || !!props.voiceBusy}><Volume2 size={16} />Vorlesen</Button>
      <label><input type="checkbox" checked={props.autoSpeak} onChange={event => props.onAutoSpeakChange(event.target.checked)} /> Auto-TTS</label>
    </div>
    {!props.payload && <p role="alert">Kontext muss ein JSON-Objekt sein.</p>}
    {!props.status?.orchestrator.available && <p>Orchestrierung nicht verbunden. Der bestehende Hermes Chat bleibt erreichbar.</p>}
    {props.result && <div className="command-result" role="status"><strong>Ergebnis · {props.result.status}</strong><p>{summary || 'Plan oder Agentenergebnis liegt vor.'}</p><details><summary>Plan und Agentenergebnisse ansehen</summary><pre>{JSON.stringify(props.result, null, 2)}</pre></details></div>}
  </section>
}
