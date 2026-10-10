export type RuntimeConnectionStatus = 'connected' | 'disconnected' | 'syncing'
export interface RuntimeConnection { status: RuntimeConnectionStatus }
export interface HermesRuntimeEvent { id: string; timestamp: string; source: string; type: string; payload?: Record<string, unknown>; severity?: 'info' | 'warning' | 'error' }
export type HermesRuntimeListener = (event: HermesRuntimeEvent) => void
