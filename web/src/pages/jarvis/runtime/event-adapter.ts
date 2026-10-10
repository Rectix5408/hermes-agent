import { emit } from './event-bus'
import type { JarvisRuntimeEvent } from './event-types'

export interface JarvisEventAdapter { connect(): void; disconnect(): void; handleEvent(event: JarvisRuntimeEvent): void }

export function createEventAdapter(): JarvisEventAdapter {
  return { connect() {}, disconnect() {}, handleEvent(event) { emit(event) } }
}
