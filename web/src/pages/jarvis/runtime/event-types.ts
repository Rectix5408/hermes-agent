export type JarvisRuntimeSource = 'voice' | 'agent' | 'memory' | 'task' | 'tool' | 'model' | 'system'
export type JarvisRuntimeStatus = 'started' | 'running' | 'completed' | 'failed'

export interface JarvisRuntimeEvent {
  id: string
  timestamp: string
  source: JarvisRuntimeSource
  type: string
  status: JarvisRuntimeStatus
  payload?: Record<string, unknown>
}

export type JarvisRuntimeListener = (event: JarvisRuntimeEvent) => void
