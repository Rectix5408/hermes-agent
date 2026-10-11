import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Bot, BrainCircuit, Gauge, LockKeyhole, Mic, Radio, Settings, ShieldCheck, Sparkles } from 'lucide-react'
import { Spinner } from '@nous-research/ui/ui/components/spinner'
import { JarvisDashboard } from './JarvisDashboard'
import { CommandBar } from './components/dashboard/CommandBar'
import { useProfileScope } from '@/contexts/useProfileScope'
import { CinematicVoiceConsole } from './components/cinematic/CinematicVoiceConsole'
import { AgentRegistryCenter } from './components/agents/AgentRegistryCenter'
import { MemoryIntelligence } from './components/autonomy/MemoryIntelligence'
const MemoryUniverse = lazy(() => import('./components/memory-universe/MemoryUniverse').then(module => ({ default: module.MemoryUniverse })))
import { RunHistory } from './components/dashboard/RunHistory'
import { Button } from '@nous-research/ui/ui/components/button'
import { RuntimeEventStream } from './components/RuntimeEventStream'
import { UnifiedApprovalPanel } from './components/autonomy/UnifiedApprovalPanel'
import { SecurityCenter } from './components/autonomy/SecurityCenter'
import { LiveSystemCore } from './components/cinematic/LiveSystemCore'
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
function VoiceWorkspace(props: JarvisWorkspaceProps) {
  return <div className="space-y-5"><WorkspaceTitle icon={Mic} title="Voice Intelligence Center" detail="Bewusste Aufnahme, sichtbarer Auftrag und echte TTS-Wiedergabe über dein Hermes-Profil." /><CinematicVoiceConsole {...props} /></div>
}
function AgentsWorkspace(props: JarvisWorkspaceProps) {
  return <div className="space-y-5"><WorkspaceTitle icon={Bot} title="Agent Command Center" detail="Registrierte Agenten auswählen, Aufträge planen und bewusst ausführen." /><AgentRegistryCenter {...props} /></div>
}
function MemoryWorkspace(props: JarvisWorkspaceProps) {
  return <div className="space-y-5"><WorkspaceTitle icon={BrainCircuit} title="Memory Intelligence" detail="Autorisierte Profilquellen durchsuchen. Inhalte nur auf ausdrücklichen Detailabruf." /><MemoryUniverse status={props.status} busy={props.busy === 'run'} onNavigate={props.onNavigate} /><details className="command-panel"><summary>Memory-Anbieter und Datenschutz</summary><MemoryIntelligence memory={props.memory} /></details></div>
}
function RuntimeWorkspace(props: JarvisWorkspaceProps) {
  return <div className="space-y-5"><WorkspaceTitle icon={Radio} title="Live Runtime" detail="Gemeldete Aufträge und lokale Bedienereignisse – keine simulierten Modellgedanken." /><RunHistory {...props} /><RuntimeEventStream /><details className="command-panel"><summary>Systeminformationen und Verfügbarkeit</summary><LiveSystemCore status={props.status} memory={props.memory} /></details></div>
}
function SecurityWorkspace(props: JarvisWorkspaceProps) {
  return <div className="space-y-5"><WorkspaceTitle icon={LockKeyhole} title="Security Center" detail="Freigaben bestätigen einen konkreten Antrag. Sie starten hier keine Ausführung." /><UnifiedApprovalPanel approvals={props.status?.approvals.pending ?? []} onDecision={props.onApprovalDecision} busy={props.approvalBusy} /><SecurityCenter status={props.status} result={props.result} /><section className="command-panel"><h2>Entscheidungen dieser Sitzung</h2>{props.approvalHistory?.length ? <ul>{props.approvalHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul> : <p>Noch keine Entscheidungen in dieser Profil-Sitzung.</p>}</section></div>
}
function SettingsWorkspace(props: JarvisWorkspaceProps) {
  const [mode, setMode] = useState(String(props.status?.config.routing_mode ?? 'local_first'))
  return <div className="space-y-5"><WorkspaceTitle icon={Settings} title="Jarvis Settings" detail="Einstellungen des ausgewählten Profils. Änderungen werden nur bewusst gespeichert." />
    <section className="command-panel"><h2>Modellrouting</h2>
      <label className="command-field">Routingmodus<select value={mode} onChange={event => setMode(event.target.value)}><option value="local_first">Lokal bevorzugen</option><option value="local_only">Nur lokal</option><option value="smart">Bedarfsgerecht</option><option value="cloud">Cloud</option></select></label>
      <p>Aktuell vom Server gemeldet: {String(props.status?.config.routing_mode ?? 'Nicht verfügbar')}</p>
      <Button disabled={!props.status || !!props.busy || mode === props.status.config.routing_mode} onClick={() => props.onRoutingModeChange(mode)}>Routing speichern</Button>
    </section>
    <section className="command-panel"><h2>Sprache und Profil</h2><p>Mikrofon und Wiedergabegeschwindigkeit werden profilgebunden im Browser eingestellt. TTS-Anbieter und Stimme stammen aus der vorhandenen Hermes-Konfiguration.</p><Button outlined onClick={() => props.onNavigate('/jarvis/voice')}>Spracheinstellungen öffnen</Button></section>
    <section className="command-panel"><h2>Skills und Fähigkeiten</h2><p>Zuordnungen und Ausführungslimits sind im Agenteninspektor einsehbar.</p><Button outlined onClick={() => props.onNavigate('/jarvis/agents')}>Agentenkatalog öffnen</Button></section>
  </div>
}
function WorkspaceTitle({ icon: Icon, title, detail }: { icon: typeof Gauge; title: string; detail: string }) {
  return <header className="jarvis-glass p-5"><div className="flex items-start gap-3"><Icon className="mt-1 h-5 w-5 text-cyan-300" /><div><p className="text-xs tracking-wide text-cyan-300/80">Jarvis Workspace</p><h1 className="mt-1 text-3xl font-medium text-slate-50">{title}</h1><p className="mt-2 text-sm text-slate-400">{detail}</p></div></div></header>
}
