import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Bot, BrainCircuit, Gauge, LockKeyhole, Mic, Radio, Settings, ShieldCheck, Sparkles } from 'lucide-react'
import { Spinner } from '@nous-research/ui/ui/components/spinner'
import { JarvisDashboard } from './JarvisDashboard'
import { CinematicHud } from './components/cinematic/CinematicHud'
import { CinematicVoiceConsole } from './components/cinematic/CinematicVoiceConsole'
import { WakeWordControl } from './components/autonomy/WakeWordControl'
import { VoiceCore } from './components/voice/VoiceCore'
import { VoiceRuntimePanel } from './components/voice-runtime/VoiceRuntimePanel'
import { VoiceStatus } from './components/VoiceStatus'
import { CinematicAgentCards } from './components/cinematic/CinematicAgentCards'
import { AgentRegistryCenter } from './components/agents/AgentRegistryCenter'
import { AgentCommandRoster } from './components/cinematic/AgentCommandRoster'
import { AgentAutomationCenter } from './components/autonomy/AgentAutomationCenter'
import { AgentControlCenter } from './components/agents/AgentControlCenter'
import { MemoryIntelligence } from './components/autonomy/MemoryIntelligence'
import { ContextCenter } from './components/context/ContextCenter'
import { MemoryUniverse } from './components/memory-universe/MemoryUniverse'
import { RuntimeEventStream } from './components/RuntimeEventStream'
import { BrainVisualization } from './components/BrainVisualization'
import { BrainEventStream } from './components/BrainEventStream'
import { IntelligenceCenter } from './components/intelligence/IntelligenceCenter'
import { UnifiedApprovalPanel } from './components/autonomy/UnifiedApprovalPanel'
import { ApprovalCenter } from './components/security/ApprovalCenter'
import { SecurityCenter } from './components/autonomy/SecurityCenter'
import { SystemStatus } from './components/SystemStatus'
import { SkillOverview } from './components/SkillOverview'
import { LiveSystemCore } from './components/cinematic/LiveSystemCore'
import { runtimeEvents } from './types'
import { emit } from './runtime/event-bus'
import type { JarvisWorkspace, JarvisWorkspaceProps } from './shell-types'
import './jarvis-cinematic.css'

type NavigationGroup = 'COMMAND CENTER' | 'INTELLIGENCE' | 'OPERATIONS' | 'COMMUNICATION' | 'SYSTEM'
const navigationGroups: NavigationGroup[] = ['COMMAND CENTER', 'INTELLIGENCE', 'OPERATIONS', 'COMMUNICATION', 'SYSTEM']
const entries: Array<{ id: JarvisWorkspace; label: string; icon: typeof Sparkles; group: NavigationGroup }> = [
  { id: 'dashboard', label: 'Command Center', icon: Sparkles, group: 'COMMAND CENTER' },
  { id: 'memory', label: 'Memory Intelligence', icon: BrainCircuit, group: 'INTELLIGENCE' },
  { id: 'agents', label: 'Agent Operations', icon: Bot, group: 'OPERATIONS' },
  { id: 'voice', label: 'Voice Intelligence', icon: Mic, group: 'COMMUNICATION' },
  { id: 'runtime', label: 'Live Runtime', icon: Radio, group: 'SYSTEM' },
  { id: 'security', label: 'Security Center', icon: ShieldCheck, group: 'SYSTEM' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'SYSTEM' }
]

function workspaceFor(pathname: string): JarvisWorkspace {
  const segment = pathname.replace(/^\/jarvis\/?/, '').split('/')[0]
  return entries.some(entry => entry.id === segment) ? segment as JarvisWorkspace : 'dashboard'
}

export function JarvisShell(props: JarvisWorkspaceProps) {
  const location = useLocation(); const navigate = useNavigate(); const workspace = workspaceFor(location.pathname)
  const go = (next: JarvisWorkspace) => navigate(next === 'dashboard' ? '/jarvis' : `/jarvis/${next}`)
  const activeLabel = entries.find(entry => entry.id === workspace)?.label ?? 'Dashboard'
  return <div className="jarvis-cinematic mx-auto w-full max-w-[96rem] text-slate-100"><CinematicHud status={props.status} memory={props.memory} voiceBusy={props.voiceBusy} result={props.result} /><header className="jarvis-shell-header jarvis-glass mt-5 flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="flex items-center gap-3"><span className="jarvis-core-mark flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/50 text-cyan-100"><Sparkles className="h-5 w-5" /></span><div><p className="text-[10px] uppercase tracking-[.22em] text-cyan-300/80">Jarvis Personal Intelligence OS</p><p className="text-lg text-slate-100">{activeLabel}</p></div></div><div className="flex items-center gap-2 text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${props.status?.ok ? 'animate-pulse bg-emerald-400' : 'bg-amber-300'}`} />{props.status?.ok ? 'System Online' : 'System wartet'}</div></header><div className="mt-5 grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]"><aside className="jarvis-shell-nav jarvis-glass h-fit p-3 lg:sticky lg:top-16"><p className="px-3 py-2 text-[10px] uppercase tracking-[.24em] text-cyan-300/80">Jarvis Workspace</p><nav>{navigationGroups.map(group => <div key={group} className="jarvis-shell-group"><p className="px-3 py-2 text-[9px] tracking-[.2em] text-slate-600">{group}</p>{entries.filter(entry => entry.group === group).map(entry => { const Icon = entry.icon; const active = entry.id === workspace; return <button key={entry.id} type="button" onClick={() => go(entry.id)} className={`jarvis-shell-entry flex w-full items-center gap-3 border px-3 py-3 text-left text-sm ${active ? 'jarvis-shell-entry-active border-cyan-300/50 bg-cyan-300/10 text-cyan-100' : 'border-transparent text-slate-400'}`}><Icon className="h-4 w-4" />{entry.label}<span className={`ml-auto h-1.5 w-1.5 rounded-full ${active ? 'animate-pulse bg-cyan-300' : 'bg-slate-700'}`} /></button> })}</div>)}</nav><div className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-500"><span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />{props.status?.ok ? 'Hermes verbunden' : 'Warte auf Hermes'}</div></aside><main className="min-w-0">{props.loading ? <LoadingWorkspace /> : <Workspace workspace={workspace} {...props} />}</main></div><footer className="jarvis-system-footer jarvis-glass mt-5 grid gap-2 px-4 py-3 text-[11px] text-slate-500 sm:grid-cols-5"><SystemMetric label="CPU" value="Telemetry wartet" /><SystemMetric label="RAM" value="Telemetry wartet" /><SystemMetric label="Model" value={props.status?.models.available ? 'verfügbar' : 'offline'} /><SystemMetric label="Latency" value="Event-basiert" /><SystemMetric label="Security" value={`${props.status?.approvals.pending.length ?? 0} pending`} /></footer></div>
}

function LoadingWorkspace() { return <div className="jarvis-glass flex min-h-80 items-center justify-center gap-3 text-sm text-cyan-100"><Spinner />Jarvis-Workspace lädt…</div> }
function SystemMetric({ label, value }: { label: string; value: string }) { return <span><b className="mr-1 font-medium text-cyan-200">{label}</b>{value}</span> }
function Workspace({ workspace, ...props }: JarvisWorkspaceProps & { workspace: JarvisWorkspace }) { switch (workspace) { case 'voice': return <VoiceWorkspace {...props} />; case 'agents': return <AgentsWorkspace {...props} />; case 'memory': return <MemoryWorkspace {...props} />; case 'runtime': return <RuntimeWorkspace {...props} />; case 'security': return <SecurityWorkspace {...props} />; case 'settings': return <SettingsWorkspace {...props} />; default: return <JarvisDashboard {...props} /> } }
function VoiceWorkspace(props: JarvisWorkspaceProps) { const [wakeWordArmed, setWakeWordArmed] = useState(false); const changeWakeWord = (armed: boolean) => { setWakeWordArmed(armed); emit({ source: 'voice', type: armed ? 'WAKE_WORD_READY' : 'WAKE_WORD_OFF', status: armed ? 'running' : 'completed' }) }; return <div className="space-y-5"><WorkspaceTitle icon={Mic} title="Voice Intelligence Center" detail="Lokale Aufnahme, Hermes-STT und sichere TTS-Wiedergabe." /><WakeWordControl armed={wakeWordArmed} onChange={changeWakeWord} /><CinematicVoiceConsole status={props.status} voiceBusy={props.voiceBusy} voiceState={props.voiceState} history={props.voiceHistory} response={props.result?.consolidated?.summary} onRecordVoice={props.onRecordVoice} onStopVoice={props.onStopVoice} onTranscript={props.onVoiceTranscript} onSpeak={props.onSpeak} /><VoiceCore /><VoiceRuntimePanel /><VoiceStatus {...props} /></div> }
function AgentsWorkspace(props: JarvisWorkspaceProps) { return <div className="space-y-5"><WorkspaceTitle icon={Bot} title="Agent Command Center" detail="Spezialisierte Hermes-Agenten mit transparenten Fähigkeiten und Freigabekontext." /><AgentRegistryCenter status={props.status} busy={!!props.busy} result={props.result} /><CinematicAgentCards status={props.status} busy={!!props.busy} result={props.result} /><AgentCommandRoster status={props.status} busy={!!props.busy} result={props.result} /><AgentAutomationCenter status={props.status} busy={!!props.busy} result={props.result} /><AgentControlCenter /></div> }
function MemoryWorkspace(props: JarvisWorkspaceProps) { return <div className="space-y-5"><WorkspaceTitle icon={BrainCircuit} title="Memory Intelligence" detail="Nur freigegebene Metadaten, keine privaten Erinnerungsinhalte." /><MemoryUniverse status={props.status} busy={props.busy === 'run'} onNavigate={props.onNavigate} /><MemoryIntelligence memory={props.memory} /><ContextCenter /></div> }
function RuntimeWorkspace(props: JarvisWorkspaceProps) { const events = runtimeEvents(props); return <div className="space-y-5"><WorkspaceTitle icon={Radio} title="Live Runtime" detail="Event-basierte Runtime-Telemetrie und visualisierte Hermes-Ereignisse." /><LiveSystemCore status={props.status} memory={props.memory} /><RuntimeEventStream /><div className="grid gap-5 xl:grid-cols-2"><BrainVisualization {...props} /><BrainEventStream events={events} /></div><IntelligenceCenter /></div> }
function SecurityWorkspace(props: JarvisWorkspaceProps) { return <div className="space-y-5"><WorkspaceTitle icon={LockKeyhole} title="Security Center" detail="Externe Aktionen bleiben durch die vorhandene Jarvis-Freigabe geschützt." /><UnifiedApprovalPanel approvals={props.status?.approvals.pending ?? []} onDecision={props.onApprovalDecision} /><SecurityCenter status={props.status} result={props.result} /><ApprovalCenter /></div> }
function SettingsWorkspace(props: JarvisWorkspaceProps) { return <div className="space-y-5"><WorkspaceTitle icon={Settings} title="Jarvis Settings" detail="Status- und Konfigurationssicht ohne neue Backend-Einstellungen." /><LiveSystemCore status={props.status} memory={props.memory} /><SystemStatus {...props} /><SkillOverview {...props} /></div> }
function WorkspaceTitle({ icon: Icon, title, detail }: { icon: typeof Gauge; title: string; detail: string }) { return <header className="jarvis-glass relative overflow-hidden p-5"><span className="jarvis-scanline" /><div className="relative flex items-start gap-3"><Icon className="mt-1 h-5 w-5 text-cyan-300" /><div><p className="text-xs uppercase tracking-[.22em] text-cyan-300/80">Jarvis Desktop</p><h1 className="mt-1 text-3xl font-medium text-slate-50">{title}</h1><p className="mt-2 text-sm text-slate-400">{detail}</p></div></div></header> }
