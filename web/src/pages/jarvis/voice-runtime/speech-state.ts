import type { SpeechEvent, VoiceInput, VoiceOutput, VoiceSessionState } from './types'
export interface SpeechState { state: VoiceSessionState; input?: VoiceInput; output?: VoiceOutput; events: SpeechEvent[] }
export function createSpeechState(): SpeechState { return { state: 'idle', events: [] } }
export function updateSpeechState(state: SpeechState, next: VoiceSessionState, event: Omit<SpeechEvent, 'id' | 'timestamp'>): SpeechState { return { ...state, state: next, events: [{ ...event, id: crypto.randomUUID(), timestamp: new Date().toISOString() }, ...state.events].slice(0, 100) } }
