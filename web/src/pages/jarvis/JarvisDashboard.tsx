import { ArrowUpRight, Bot, BrainCircuit, ListChecks, MessageSquare, Mic, Radio } from 'lucide-react'
import { JarvisCore } from './components/visual/JarvisCore'
import { CommandConsole } from './components/dashboard/CommandConsole'
import { RunHistory } from './components/dashboard/RunHistory'
import { IntelligencePanel } from './components/dashboard/IntelligencePanel'
import { MorningBriefing } from './components/autonomy/MorningBriefing'
import type { JarvisWorkspaceProps } from './shell-types'
import { useProfileScope } from '@/contexts/useProfileScope'
import { memoryTelemetry } from './cinematic/live-runtime'

const actions = [
  { label: 'Chat öffnen', detail: 'Deine Hermes-Sitzung', path: '/chat', icon: MessageSquare },
  { label: 'Agenten', detail: 'Fähigkeiten & Berechtigungen', path: '/jarvis/agents', icon: Bot },
  { label: 'Voice', detail: 'Mit Hermes sprechen', path: '/jarvis/voice', icon: Mic },
  { label: 'Aufgaben', detail: 'Ausführungen prüfen', path: '/jarvis/runtime', icon: ListChecks },
  { label: 'Systemstatus', detail: 'Runtime & Verbindungen', path: '/jarvis/runtime', icon: Radio },
  { label: 'Gedächtnis', detail: 'Memory Universe öffnen', path: '/jarvis/memory', icon: BrainCircuit },
]

export function JarvisDashboard(props: JarvisWorkspaceProps) {
  const { profile, currentProfile } = useProfileScope()
  return <div className="command-dashboard">
    <header className="command-hero"><div><p className="command-eyebrow">Hermes Intelligence Layer · {profile || currentProfile}</p><h1>Dein persönliches <span>Command Center.</span></h1><p>Ein System. Deine Agenten, dein Wissen, deine Kontrolle.</p></div><span className="command-chip">{props.busy ? 'Aufgabe in Bearbeitung' : props.status?.ok ? 'Hermes erreichbar' : 'Verbindung ausstehend'}</span></header>
    <div className="command-workspace"><div className="command-primary">
      <JarvisCore status={props.status} voiceBusy={props.voiceBusy} busy={props.busy} voiceApproval={props.voiceApproval} voiceTools={props.voiceTools} onNavigate={props.onNavigate} />
      <section aria-label="Schnellzugriff" className="command-quick-actions">{actions.map(({ label, detail, path, icon: Icon }) => <button key={label} onClick={() => props.onNavigate(path)}><Icon size={22} /><span><strong>{label}</strong><small>{detail}</small></span><ArrowUpRight size={16} /></button>)}</section>
      <section className="command-panel command-memory-preview"><BrainCircuit size={36} /><div><p className="command-eyebrow">Infinite Memory Universe</p><h2>Wissen wird Verbindung.</h2><p>{props.memory ? `Memory-Anbieter: ${props.memory.active || 'Keiner aktiv'} · ${memoryTelemetry(props.memory).stored}. Inhalte bleiben im geschützten Memory-Workspace.` : 'Gedächtnisstatus nicht verfügbar. Verbinde dein Profil, um vorhandenes Wissen zu erkunden.'}</p></div><button className="command-text-button" onClick={() => props.onNavigate('/jarvis/memory')}>Gedächtnis öffnen <ArrowUpRight size={16} /></button></section>
      <CommandConsole {...props} />
      <details className="command-panel"><summary>Letzte gemeldete Aufträge</summary><RunHistory {...props} /></details>
      <details className="command-panel"><summary>Morgenbriefing aus vorhandenen Daten</summary><MorningBriefing status={props.status} memory={props.memory} /></details>
    </div><IntelligencePanel {...props} /></div>
  </div>
}
