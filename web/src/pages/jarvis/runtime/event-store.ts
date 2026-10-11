import { useMemo, useSyncExternalStore } from 'react'
import { useProfileScope } from '@/contexts/useProfileScope'
import { emit, getHistory, subscribe } from './event-bus'
import type { JarvisRuntimeEvent } from './event-types'

let snapshot = getHistory()
const subscriptions = new Set<() => void>()
subscribe(() => { snapshot = getHistory(); subscriptions.forEach(notify => notify()) })

const empty: JarvisRuntimeEvent[] = []
export function useRuntimeEvents(): JarvisRuntimeEvent[] {
  const { profile } = useProfileScope()
  const events = useSyncExternalStore(listener => {
    subscriptions.add(listener)
    return () => subscriptions.delete(listener)
  }, () => snapshot, () => empty)
  return useMemo(() => events.filter(event => event.profile === profile), [events, profile])
}

let seeded = false
export function seedRuntimeEvents(): void {
  if (seeded) return
  seeded = true
  emit({ source: 'system', type: 'JARVIS_RUNTIME_READY', status: 'completed', timestamp: new Date(Date.now() - 6_000).toISOString() })
  emit({ source: 'voice', type: 'LISTENING_STARTED', status: 'running', timestamp: new Date(Date.now() - 4_000).toISOString(), payload: { input: 'Analysiere meine E-Mails' } })
  emit({ source: 'task', type: 'TASK_STARTED', status: 'started', timestamp: new Date(Date.now() - 2_000).toISOString(), payload: { task: 'Morgenbriefing vorbereiten' } })
  emit({ source: 'agent', type: 'RESEARCH_AGENT_RUNNING', status: 'running', timestamp: new Date().toISOString(), payload: { agent: 'Research Agent' } })
}
