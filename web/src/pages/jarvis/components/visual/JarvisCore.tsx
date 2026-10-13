import { Bot, BrainCircuit, Mic, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { HologramBrain } from './HologramBrain'
import { brainStateFor } from './jarvis-brain-state'
import { VisualControls, type VisualMode } from './VisualControls'
import type { JarvisVisualProps } from '../../types'
import type { JarvisWorkspaceProps } from '../../shell-types'

interface JarvisCoreProps extends Pick<JarvisVisualProps, 'status' | 'voiceBusy'> {
  busy?: JarvisVisualProps['busy']
  voiceApproval?: JarvisWorkspaceProps['voiceApproval']
  voiceTools?: JarvisWorkspaceProps['voiceTools']
  onNavigate?: (path: string) => void
}
const systems = [
  { label: 'Memory', icon: BrainCircuit, path: '/jarvis/memory' },
  { label: 'Voice', icon: Mic, path: '/jarvis/voice' },
  { label: 'Agents', icon: Bot, path: '/jarvis/agents' },
  { label: 'Tools', icon: Wrench, path: '/jarvis/security' },
]

export function JarvisCore({ status, voiceBusy, busy, voiceApproval, voiceTools, onNavigate }: JarvisCoreProps) {
  const [mode, setMode] = useState<VisualMode>('focus')
  const core = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = core.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => { element.dataset.visible = String(entry.isIntersecting) })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const state = brainStateFor({ status, voiceBusy, busy, approval: voiceApproval, tools: voiceTools })
  const active = !['ready', 'offline'].includes(state)
  return <section ref={core} className="command-panel command-core" aria-label="Jarvis Core" data-state={state.toUpperCase()} data-mode={mode}>
    <header><p className="command-eyebrow">Central intelligence</p><span className="command-chip" role="status">{state.toUpperCase()}</span></header>
    <div className="command-core-scene">
      <div className="command-core-grid" aria-hidden="true" />
      <HologramBrain active={active} state={state} />
      <div className="command-core-name"><strong>HERMES</strong><span>Personal Intelligence</span></div>
      <div className="command-core-systems">{systems.map(({ label, icon: Icon, path }) => <button key={label} onClick={() => onNavigate?.(path)} disabled={!onNavigate}><Icon size={20} /><span>{label}</span></button>)}</div>
    </div>
    <footer><span className="command-signal" />{active ? 'Gemeldeter Prozesszustand · kein interner Gedankenstrom' : state === 'offline' ? 'Hermes-Status nicht verfügbar · dekorative Visualisierung' : 'Bereit für deine nächste Idee · dekorative Visualisierung'}</footer>
    <div className="command-core-controls"><VisualControls mode={mode} onChange={setMode} /></div>
  </section>
}
