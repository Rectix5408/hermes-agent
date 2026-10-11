import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Bot, BrainCircuit, Gauge, LockKeyhole, Mic, Radio, Settings, ShieldCheck, Sparkles } from 'lucide-react'
import { Spinner } from '@nous-research/ui/ui/components/spinner'
import { JarvisDashboard } from './JarvisDashboard'
import { CommandBar } from './components/dashboard/CommandBar'
import { useProfileScope } from '@/contexts/useProfileScope'
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
const MemoryUniverse = lazy(() => import('./components/memory-universe/MemoryUniverse').then(module => ({ default: module.MemoryUniverse })))
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
import './styles/command-center.css'

type NavigationGroup = 'COMMAND CENTER' | 'INTELLIGENCE' | 'OPERATIONS' | 'COMMUNICATION' | 'SYSTEM'
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
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useProfileScope()
  const workspace = workspaceFor(location.pathname)
  const shell = useRef<HTMLDivElement>(null)
  const onNavigate = (path: string) => {
    const target = new URL(path, window.location.origin)
    if (profile) target.searchParams.set('profile', profile)
    navigate(target.pathname + target.search + target.hash)
  }
  useEffect(() => {
    const element = shell.current
    if (!element) return
    const visibility = () => { element.dataset.paused = String(document.hidden) }
    document.addEventListener('visibilitychange', visibility)
    visibility()
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])
  const scoped = { ...props, onNavigate }
  return <div ref={shell} className="jarvis-cinematic jarvis-command-shell">
    <CommandBar {...scoped} />
    <nav className="command-workspace-nav" aria-label="Jarvis Workspaces">
      {entries.map(({ id, label, icon: Icon }) => <button key={id} type="button"
        aria-current={workspace === id ? 'page' : undefined}
        onClick={() => onNavigate(id === 'dashboard' ? '/jarvis' : `/jarvis/${id}`)}>
        <Icon size={16} /><span>{label}</span><i aria-hidden="true" />
      </button>)}
    </nav>
    {props.error && <div className="command-error" role="alert">{props.error}</div>}
    <main className="command-main" aria-busy={props.loading}>
      {props.loading ? <LoadingWorkspace /> : <Suspense fallback={<LoadingWorkspace />}><Workspace workspace={workspace} {...scoped} /></Suspense>}
    </main>
    <footer className="command-footer">
      <SystemMetric label="HERMES" value={props.status?.ok ? 'Erreichbar' : 'Nicht verbunden'} />
      <SystemMetric label="Memory" value={props.memory?.active || 'Nicht verfügbar'} />
      <SystemMetric label="Mikrofon" value={props.voiceBusy === 'recording' ? 'Aufnahme aktiv' : 'Keine Aufnahme angefordert'} />
      <SystemMetric label="Security" value={props.status ? `${props.status.approvals.pending.length} Freigaben offen` : 'Nicht verfügbar'} />
    </footer>
  </div>
}

function LoadingWorkspace() { return <div className="jarvis-glass flex min-h-80 items-center justify-center gap-3 text-sm text-cyan-100"><Spinner />Jarvis-Workspace lädt…</div> }
function SystemMetric({ label, value }: { label: string; value: string }) { return <span><b className="mr-1 font-medium text-cyan-200">{label}</b>{value}</span> }
function Workspace({ workspace, ...props }: JarvisWorkspaceProps & { workspace: JarvisWorkspace }) { switch (workspace) { case 'voice': return <VoiceWorkspace {...props} />; case 'agents': return <AgentsWorkspace {...props} />; case 'memory': return <MemoryWorkspace {...props} />; case 'runtime': return <RuntimeWorkspace {...props} />; case 'security': return <SecurityWorkspace {...props} />; case 'settings': return <SettingsWorkspace {...props} />; default: return <JarvisDashboard {...props} /> } }
function VoiceWorkspace(props: JarvisWorkspaceProps) { const { profile } = useProfileScope(); const [wakeWordArmed, setWakeWordArmed] = useState(false); const changeWakeWord = (armed: boolean) => { setWakeWordArmed(armed); emit({ profile, source: 'voice', type: armed ? 'WAKE_WORD_READY' : 'WAKE_WORD_OFF', status: armed ? 'running' : 'completed' }) }; return <div className="space-y-5"><WorkspaceTitle icon={Mic} title="Voice Intelligence Center" detail="Lokale Aufnahme, Hermes-STT und sichere TTS-Wiedergabe." /><WakeWordControl armed={wakeWordArmed} onChange={changeWakeWord} /><CinematicVoiceConsole status={props.status} voiceBusy={props.voiceBusy} voiceState={props.voiceState} history={props.voiceHistory} response={props.result?.consolidated?.summary} onRecordVoice={props.onRecordVoice} onStopVoice={props.onStopVoice} onTranscript={props.onVoiceTranscript} onSpeak={props.onSpeak} /><VoiceCore /><VoiceRuntimePanel /><VoiceStatus {...props} /></div> }
function AgentsWorkspace(props: JarvisWorkspaceProps) { return <div className="space-y-5"><WorkspaceTitle icon={Bot} title="Agent Command Center" detail="Spezialisierte Hermes-Agenten mit transparenten Fähigkeiten und Freigabekontext." /><AgentRegistryCenter status={props.status} busy={!!props.busy} result={props.result} /><CinematicAgentCards status={props.status} busy={!!props.busy} result={props.result} /><AgentCommandRoster status={props.status} busy={!!props.busy} result={props.result} /><AgentAutomationCenter status={props.status} busy={!!props.busy} result={props.result} /><AgentControlCenter /></div> }
function MemoryWorkspace(props: JarvisWorkspaceProps) { return <div className="space-y-5"><WorkspaceTitle icon={BrainCircuit} title="Memory Intelligence" detail="Nur freigegebene Metadaten, keine privaten Erinnerungsinhalte." /><MemoryUniverse status={props.status} busy={props.busy === 'run'} onNavigate={props.onNavigate} /><MemoryIntelligence memory={props.memory} /><ContextCenter /></div> }
function RuntimeWorkspace(props: JarvisWorkspaceProps) { const events = runtimeEvents(props); return <div className="space-y-5"><WorkspaceTitle icon={Radio} title="Live Runtime" detail="Event-basierte Runtime-Telemetrie und visualisierte Hermes-Ereignisse." /><LiveSystemCore status={props.status} memory={props.memory} /><RuntimeEventStream /><details className="command-panel"><summary>Visualisierungsdemo aus Statusdaten · keine beobachteten Ereignisse</summary><div className="grid gap-5 xl:grid-cols-2"><BrainVisualization {...props} /><BrainEventStream events={events} /></div></details><IntelligenceCenter /></div> }
function SecurityWorkspace(props: JarvisWorkspaceProps) { return <div className="space-y-5"><WorkspaceTitle icon={LockKeyhole} title="Security Center" detail="Externe Aktionen bleiben durch die vorhandene Jarvis-Freigabe geschützt." /><UnifiedApprovalPanel approvals={props.status?.approvals.pending ?? []} onDecision={props.onApprovalDecision} /><SecurityCenter status={props.status} result={props.result} /><ApprovalCenter /></div> }
function SettingsWorkspace(props: JarvisWorkspaceProps) { return <div className="space-y-5"><WorkspaceTitle icon={Settings} title="Jarvis Settings" detail="Status- und Konfigurationssicht ohne neue Backend-Einstellungen." /><LiveSystemCore status={props.status} memory={props.memory} /><SystemStatus {...props} /><SkillOverview {...props} /></div> }
function WorkspaceTitle({ icon: Icon, title, detail }: { icon: typeof Gauge; title: string; detail: string }) { return <header className="jarvis-glass relative overflow-hidden p-5"><span className="jarvis-scanline" /><div className="relative flex items-start gap-3"><Icon className="mt-1 h-5 w-5 text-cyan-300" /><div><p className="text-xs uppercase tracking-[.22em] text-cyan-300/80">Jarvis Desktop</p><h1 className="mt-1 text-3xl font-medium text-slate-50">{title}</h1><p className="mt-2 text-sm text-slate-400">{detail}</p></div></div></header> }
