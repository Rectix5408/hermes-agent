export type ConnectionState = 'connected' | 'offline' | 'syncing'

export class ConnectionManager {
  private state: ConnectionState = 'offline'
  private listeners = new Set<(state: ConnectionState) => void>()

  connect(): void { this.setState('connected') }
  disconnect(): void { this.setState('offline') }
  reconnect(): void { this.setState('syncing'); this.setState('connected') }
  getState(): ConnectionState { return this.state }
  subscribe(listener: (state: ConnectionState) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }

  private setState(state: ConnectionState): void { this.state = state; this.listeners.forEach(listener => listener(state)) }
}
