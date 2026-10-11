export type ProductionVoiceState = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'error'
export interface VoiceHistoryEntry { id: string; timestamp: string; text: string; action: string }

const transitions: Record<ProductionVoiceState, ProductionVoiceState[]> = {
  idle: ['listening', 'processing', 'thinking', 'speaking', 'error'], listening: ['processing', 'idle', 'error'],
  processing: ['thinking', 'speaking', 'idle', 'error'], thinking: ['speaking', 'idle', 'error'],
  speaking: ['idle', 'error'], error: ['idle', 'listening']
}
export function transitionVoiceState(current: ProductionVoiceState, next: ProductionVoiceState): ProductionVoiceState { return current === next || transitions[current].includes(next) ? next : 'error' }
export function microphoneErrorMessage(error: unknown): string { const name = error instanceof DOMException ? error.name : ''; if (name === 'NotAllowedError' || name === 'SecurityError') return 'Mikrofon Zugriff verweigert'; if (name === 'NotFoundError') return 'Kein Mikrofon gefunden'; if (name === 'AbortError') return 'Aufnahme wurde abgebrochen'; if (name === 'NotReadableError') return 'Mikrofon wird bereits von einer anderen Anwendung verwendet'; return 'Mikrofon ist in diesem Browser nicht verfügbar' }
export function appendVoiceHistory(history: VoiceHistoryEntry[], text: string, action: string): VoiceHistoryEntry[] { return [{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), text: text.slice(0, 240), action }, ...history].slice(0, 20) }
