import { emit } from '../event-bus'
import { normalizeEvent } from './event-normalizer'
import { mapRuntimeEvent } from './runtime-mapper'
import { RuntimeClient } from './runtime-client'
import type { HermesRuntimeEvent, RuntimeConnection } from './types'

/** Bridges an optional Hermes transport to Jarvis without taking ownership of either runtime. */
export class HermesAdapter {
  private unsubscribe?: () => void
  private readonly client: RuntimeClient
  constructor(client = new RuntimeClient()) { this.client = client }
  connect(): void { if (this.unsubscribe) return; this.unsubscribe = this.client.subscribe(event => this.handleEvent(event)); this.client.connect() }
  disconnect(): void { this.unsubscribe?.(); this.unsubscribe = undefined; this.client.disconnect() }
  getStatus(): RuntimeConnection { return this.client.getStatus() }
  handleEvent(event: HermesRuntimeEvent): void { emit(mapRuntimeEvent(normalizeEvent(event))) }
  getClient(): RuntimeClient { return this.client }
}
