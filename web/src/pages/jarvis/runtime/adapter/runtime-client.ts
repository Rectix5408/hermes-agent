import type { HermesRuntimeEvent, HermesRuntimeListener, RuntimeConnection, RuntimeConnectionStatus } from './types'
export class RuntimeClient {
  private connection: RuntimeConnection = { status: 'disconnected' }
  private listeners = new Set<HermesRuntimeListener>()
  connect(): void { this.setStatus('syncing'); this.setStatus('connected') }
  disconnect(): void { this.setStatus('disconnected') }
  subscribe(listener: HermesRuntimeListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  getStatus(): RuntimeConnection { return this.connection }
  /** Transport adapters call this after receiving a Hermes event. */
  receive(event: HermesRuntimeEvent): void { this.listeners.forEach(listener => listener(event)) }
  private setStatus(status: RuntimeConnectionStatus): void { this.connection = { status } }
}
