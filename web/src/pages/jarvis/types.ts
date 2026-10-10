import type { JarvisOrchestrationResponse, JarvisStatusResponse } from '@/lib/api'

export type AgentState = 'idle' | 'thinking' | 'working' | 'finished' | 'error'
export type BrainNodeStatus = 'idle' | 'active' | 'thinking' | 'processing' | 'success' | 'warning' | 'error'
export type JarvisRuntimeEventType =
  | 'AGENT_STARTED'
  | 'AGENT_FINISHED'
  | 'MEMORY_READ'
  | 'MEMORY_WRITE'
  | 'TOOL_EXECUTED'
  | 'MODEL_SWITCH'
  | 'VOICE_INPUT'
  | 'VOICE_OUTPUT'

export interface BrainNodeData {
  id: 'core' | 'model' | 'memory' | 'agents' | 'tools' | 'skills' | 'voice' | 'tasks' | 'session'
  type: 'core' | 'runtime' | 'knowledge' | 'interface'
  label: string
  status: BrainNodeStatus
  activity: number
  lastUpdate: number | null
  connections: string[]
}

export interface JarvisRuntimeEvent {
  id: string
  timestamp: number
  source: string
  target: string
  type: JarvisRuntimeEventType
  message: string
}

export interface JarvisVisualProps {
  status: JarvisStatusResponse | null
  loading: boolean
  busy: 'plan' | 'run' | null
  result: JarvisOrchestrationResponse | null
  voiceBusy: 'recording' | 'transcribing' | 'speaking' | null
}

export interface ActivityEntry {
  id: string
  timestamp: number
  label: string
  detail: string
  state: AgentState
}

export function agentState(props: JarvisVisualProps): AgentState {
  if (props.busy === 'run') return 'working'
  if (props.busy === 'plan') return 'thinking'
  if (props.result?.status === 'failed') return 'error'
  if (props.result?.status === 'completed') return 'finished'
  return 'idle'
}

export function activityEntries(props: JarvisVisualProps): ActivityEntry[] {
  const runs = props.status?.runs ?? []
  const entries: ActivityEntry[] = runs.slice(0, 5).map((run, index) => ({
    id: `${run.created_at}-${index}`,
    timestamp: run.created_at * 1000,
    label: run.agents.length ? `${run.agents.join(', ')} gestartet` : 'Jarvis-Lauf gestartet',
    detail: run.request || 'Verarbeitet eine Jarvis-Aufgabe',
    state: run.status === 'failed' ? ('error' as const) : run.status === 'completed' ? ('finished' as const) : ('working' as const)
  }))
  if (props.busy) {
    entries.unshift({
      id: 'active-run',
      timestamp: Date.now(),
      label: props.busy === 'run' ? 'Agent Network arbeitet' : 'Ausführungsplan wird erstellt',
      detail: 'Live-Status aus der aktuellen Dashboard-Sitzung',
      state: agentState(props)
    })
  }
  return entries
}

export function runtimeEvents(props: JarvisVisualProps): JarvisRuntimeEvent[] {
  const events: JarvisRuntimeEvent[] = []
  for (const [index, run] of (props.status?.runs ?? []).slice(0, 8).entries()) {
    const agent = run.agents[0] ?? 'Jarvis'
    events.push({ id: `run-start-${run.created_at}-${index}`, timestamp: run.created_at * 1000, source: 'tasks', target: 'agents', type: 'AGENT_STARTED', message: `${agent} gestartet` })
    if (run.status === 'completed') events.push({ id: `run-finish-${run.created_at}-${index}`, timestamp: run.created_at * 1000 + 1, source: 'agents', target: 'tasks', type: 'AGENT_FINISHED', message: `${agent} abgeschlossen` })
  }
  if (props.status?.skill.available) events.push({ id: 'memory-ready', timestamp: 0, source: 'memory', target: 'core', type: 'MEMORY_READ', message: 'Memory-Schicht verfügbar' })
  if (props.busy) events.push({ id: 'current-work', timestamp: Date.now(), source: 'core', target: 'agents', type: 'AGENT_STARTED', message: props.busy === 'run' ? 'Agentenlauf aktiv' : 'Ausführungsplan wird erstellt' })
  if (props.voiceBusy === 'recording' || props.voiceBusy === 'transcribing') events.push({ id: 'voice-input', timestamp: Date.now(), source: 'voice', target: 'core', type: 'VOICE_INPUT', message: 'Spracheingabe wird verarbeitet' })
  if (props.voiceBusy === 'speaking') events.push({ id: 'voice-output', timestamp: Date.now(), source: 'core', target: 'voice', type: 'VOICE_OUTPUT', message: 'Antwort wird ausgegeben' })
  return events.sort((left, right) => right.timestamp - left.timestamp)
}

export function brainNodes(props: JarvisVisualProps, events: JarvisRuntimeEvent[]): BrainNodeData[] {
  const now = events[0]?.timestamp ?? null
  const activeTargets = new Set(events.slice(0, 3).flatMap(event => [event.source, event.target]))
  const coreStatus: BrainNodeStatus = props.busy === 'run' ? 'processing' : props.busy === 'plan' ? 'thinking' : props.result?.status === 'failed' ? 'error' : props.result?.status === 'completed' ? 'success' : 'idle'
  const statusFor = (id: BrainNodeData['id']): BrainNodeStatus => id === 'core' ? coreStatus : activeTargets.has(id) ? 'active' : 'idle'
  return [
    { id: 'core', type: 'core', label: 'JARVIS CORE', status: statusFor('core'), activity: props.busy ? 100 : 24, lastUpdate: now, connections: ['model', 'memory', 'agents', 'tools', 'skills', 'voice', 'tasks', 'session'] },
    { id: 'model', type: 'runtime', label: 'MODEL', status: statusFor('model'), activity: props.status?.models.available ? 45 : 0, lastUpdate: now, connections: ['core'] },
    { id: 'memory', type: 'knowledge', label: 'MEMORY', status: statusFor('memory'), activity: props.status?.skill.available ? 35 : 0, lastUpdate: now, connections: ['core', 'skills'] },
    { id: 'agents', type: 'runtime', label: 'AGENTS', status: statusFor('agents'), activity: props.status?.agents.length ?? 0, lastUpdate: now, connections: ['core', 'tools', 'tasks'] },
    { id: 'tools', type: 'runtime', label: 'TOOLS', status: statusFor('tools'), activity: props.status?.integrations.length ?? 0, lastUpdate: now, connections: ['core', 'agents'] },
    { id: 'skills', type: 'knowledge', label: 'SKILLS', status: statusFor('skills'), activity: props.status?.skill.available ? 1 : 0, lastUpdate: now, connections: ['core', 'memory'] },
    { id: 'voice', type: 'interface', label: 'VOICE', status: statusFor('voice'), activity: props.voiceBusy ? 100 : 0, lastUpdate: now, connections: ['core'] },
    { id: 'tasks', type: 'runtime', label: 'TASKS', status: statusFor('tasks'), activity: props.status?.runs.length ?? 0, lastUpdate: now, connections: ['core', 'agents'] },
    { id: 'session', type: 'interface', label: 'SESSION', status: statusFor('session'), activity: props.status ? 1 : 0, lastUpdate: now, connections: ['core'] }
  ]
}
