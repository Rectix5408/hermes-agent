import type { HermesRuntimeEvent } from './types'
const typeMap: Record<string, string> = { AGENT_STARTED: 'AGENT_STARTED', AGENT_FINISHED: 'AGENT_FINISHED', TOOL_EXECUTED: 'TOOL_EXECUTED', TASK_COMPLETED: 'TASK_COMPLETED', TASK_STARTED: 'TASK_STARTED', MEMORY_READ: 'MEMORY_READ', MEMORY_WRITE: 'MEMORY_WRITE', VOICE_INPUT: 'VOICE_INPUT', VOICE_OUTPUT: 'VOICE_OUTPUT' }
export function normalizeEvent(event: HermesRuntimeEvent): HermesRuntimeEvent { const key = event.type.toUpperCase().replaceAll(/[ -]/g, '_'); return { ...event, type: typeMap[key] ?? key } }
