import type { JarvisRuntimeEvent, JarvisRuntimeListener } from './event-types'

const HISTORY_LIMIT = 100
const listeners = new Set<JarvisRuntimeListener>()
let history: JarvisRuntimeEvent[] = []

export function emit(event: Omit<JarvisRuntimeEvent, 'id' | 'timestamp'> & Partial<Pick<JarvisRuntimeEvent, 'id' | 'timestamp'>>): JarvisRuntimeEvent {
  const runtimeEvent: JarvisRuntimeEvent = { ...event, id: event.id ?? crypto.randomUUID(), timestamp: event.timestamp ?? new Date().toISOString() }
  history = [runtimeEvent, ...history].slice(0, HISTORY_LIMIT)
  listeners.forEach(listener => listener(runtimeEvent))
  return runtimeEvent
}

export function subscribe(listener: JarvisRuntimeListener): () => void { listeners.add(listener); return () => listeners.delete(listener) }
export function getHistory(): JarvisRuntimeEvent[] { return history }
