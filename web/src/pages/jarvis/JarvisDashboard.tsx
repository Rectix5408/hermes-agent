import { AlertTriangle, Bot, Play, Send, Sparkles, SquareCode, Volume2 } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { Spinner } from '@nous-research/ui/ui/components/spinner'
import { AgentActivity } from './components/AgentActivity'
import { AgentControlCenter } from './components/agents/AgentControlCenter'
import { BrainEventStream } from './components/BrainEventStream'
import { BrainVisualization } from './components/BrainVisualization'
import { MemoryGraph } from './components/MemoryGraph'
import { RuntimeEventStream } from './components/RuntimeEventStream'
import { IntelligenceCenter } from './components/intelligence/IntelligenceCenter'
import { ApprovalCenter } from './components/security/ApprovalCenter'
import { ContextCenter } from './components/context/ContextCenter'
import { SkillOverview } from './components/SkillOverview'
import { SystemStatus } from './components/SystemStatus'
import { VoiceStatus } from './components/VoiceStatus'
import { VoiceCore } from './components/voice/VoiceCore'
import { VoiceRuntimePanel } from './components/voice-runtime/VoiceRuntimePanel'
import { TaskCenter } from './components/tasks/TaskCenter'
import { JarvisCore } from './components/visual/JarvisCore'
import { runtimeEvents, type JarvisVisualProps } from './types'

interface JarvisDashboardProps extends JarvisVisualProps {
  selectedAgent: string
  request: string
  payloadText: string
  payload: Record<string, unknown> | null
  error: string
  autoSpeak: boolean
  onNavigate: (path: string) => void
  onRequestChange: (value: string) => void
  onPayloadChange: (value: string) => void
  onAgentSelect: (id: string) => void
  onRun: (mode: 'plan' | 'run') => void
  onRecordVoice: () => void
  onSpeak: (text: string) => void
  onAutoSpeakChange: (value: boolean) => void
  onApprovalDecision: (id: string, decision: 'approve' | 'deny') => void
  onRoutingModeChange: (mode: string) => void
}

export function JarvisDashboard(props: JarvisDashboardProps) {
  const visualProps: JarvisVisualProps = props
  const events = runtimeEvents(visualProps)
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 text-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-cyan-300/15 pb-4">
        <div><p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Hermes intelligence layer</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-50">Jarvis Command Center</h1></div>
        <div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Runtime data only · no visualization LLM calls</div>
      </div>
      <JarvisCore />
      <SystemStatus {...visualProps} />
      <section className="grid gap-5 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(22rem,1.1fr)_minmax(18rem,0.75fr)]">
        <AgentActivity {...visualProps} /><BrainVisualization {...visualProps} /><SkillOverview {...visualProps} />
      </section>
      <MemoryGraph />
      <AgentControlCenter />
      <VoiceCore />
      <VoiceRuntimePanel />
      <TaskCenter />
      <RuntimeEventStream />
      <IntelligenceCenter />
      <ApprovalCenter />
      <ContextCenter />
      <section className="grid gap-5 xl:grid-cols-2"><BrainEventStream events={events} /><VoiceStatus {...visualProps} /></section>
      <CommandPanel {...props} />
    </div>
  )
}

function CommandPanel(props: JarvisDashboardProps) {
  const agents = props.status?.agents ?? []
  const summary = props.result?.consolidated?.summary
  return <section className="border border-white/10 bg-slate-950/80 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Command console</p><p className="mt-1 text-sm text-slate-300">Sichere Planung und Ausführung bleiben über die bestehende Jarvis-Orchestrierung angebunden.</p></div><Button size="sm" outlined onClick={() => props.onNavigate('/chat')}><Send className="h-4 w-4" />Chat</Button></div>
    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]"><textarea aria-label="Jarvis Aufgabe" value={props.request} onChange={event => props.onRequestChange(event.target.value)} className="min-h-28 w-full resize-y border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-cyan-300/60" /><textarea aria-label="Jarvis Kontext JSON" value={props.payloadText} onChange={event => props.onPayloadChange(event.target.value)} className="min-h-28 w-full resize-y border border-white/10 bg-black/30 p-3 font-mono text-xs outline-none focus:border-cyan-300/60" spellCheck={false} /></div>
    <div className="mt-3 flex flex-wrap gap-2"><AgentButton id="auto" label="Auto" selected={props.selectedAgent} onSelect={props.onAgentSelect} />{agents.map(agent => <AgentButton key={agent.agent_id} id={agent.agent_id} label={agent.title} selected={props.selectedAgent} onSelect={props.onAgentSelect} />)}</div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><Button onClick={() => props.onRun('plan')} disabled={!!props.busy || !props.status?.orchestrator.available}>{props.busy === 'plan' ? <Spinner /> : <SquareCode className="h-4 w-4" />}Planen</Button><Button onClick={() => props.onRun('run')} disabled={!!props.busy || !props.status?.orchestrator.available}>{props.busy === 'run' ? <Spinner /> : <Play className="h-4 w-4" />}Ausführen</Button><Button size="sm" outlined onClick={props.onRecordVoice} disabled={!!props.voiceBusy}>{props.voiceBusy ? <Spinner /> : <Sparkles className="h-4 w-4" />}Spracheingabe</Button><Button size="sm" outlined onClick={() => summary && props.onSpeak(summary)} disabled={!summary || !!props.voiceBusy}><Volume2 className="h-4 w-4" />Vorlesen</Button><label className="ml-auto flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={props.autoSpeak} onChange={event => props.onAutoSpeakChange(event.target.checked)} />Auto-TTS</label></div>
    <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-2"><label className="text-xs text-slate-400">Routingmodus<select value={String(props.status?.config.routing_mode ?? 'local_first')} onChange={event => props.onRoutingModeChange(event.target.value)} className="mt-1 block w-full border border-white/10 bg-black/30 p-2 text-sm text-slate-200"><option value="local_only">local_only</option><option value="local_first">local_first</option><option value="smart">smart</option><option value="cloud">cloud</option></select></label><div>{props.status?.approvals.pending.length ? props.status.approvals.pending.map(item => <div key={item.id} className="flex items-center justify-between gap-2 border border-amber-300/20 bg-amber-950/20 p-2 text-xs text-amber-100"><span className="truncate">Freigabe: {item.action}</span><span className="flex gap-1"><Button size="sm" onClick={() => props.onApprovalDecision(item.id, 'approve')}>Genehmigen</Button><Button size="sm" outlined onClick={() => props.onApprovalDecision(item.id, 'deny')}>Ablehnen</Button></span></div>) : <p className="pt-5 text-xs text-slate-500">Keine offenen Freigaben.</p>}</div></div>
    {!props.payload && <p className="mt-3 text-xs text-rose-300">Kontext muss ein JSON-Objekt sein.</p>}{props.error && <p className="mt-3 flex items-center gap-2 text-sm text-rose-200"><AlertTriangle className="h-4 w-4" />{props.error}</p>}{props.result && <pre className="mt-4 max-h-64 overflow-auto border border-white/10 bg-black/30 p-3 text-xs text-slate-300">{JSON.stringify(props.result, null, 2)}</pre>}
  </section>
}

function AgentButton({ id, label, selected, onSelect }: { id: string; label: string; selected: string; onSelect: (id: string) => void }) { return <Button size="sm" outlined={id !== selected} onClick={() => onSelect(id)}><Bot className="h-3.5 w-3.5" />{label}</Button> }
