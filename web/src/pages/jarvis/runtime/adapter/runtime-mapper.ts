import type { JarvisRuntimeEvent, JarvisRuntimeSource, JarvisRuntimeStatus } from '../event-types'
import type { HermesRuntimeEvent } from './types'
const sources: Record<string, JarvisRuntimeSource> = { voice: 'voice', agent: 'agent', memory: 'memory', task: 'task', tool: 'tool', model: 'model', system: 'system' }
export function mapRuntimeEvent(event: HermesRuntimeEvent): JarvisRuntimeEvent { const status: JarvisRuntimeStatus = event.severity === 'error' ? 'failed' : event.type.includes('COMPLETED') || event.type.includes('FINISHED') ? 'completed' : event.type.includes('STARTED') ? 'started' : 'running'; return { id: event.id, timestamp: event.timestamp, source: sources[event.source.toLowerCase()] ?? 'system', type: event.type, status, payload: event.payload } }
