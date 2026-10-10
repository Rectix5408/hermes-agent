import { BackgroundWorker } from './background-worker'
import { ConversationManager } from './conversation-manager'
import { InterruptManager } from './interrupt-manager'
import { createSpeechState, updateSpeechState, type SpeechState } from './speech-state'
import type { VoiceSessionState } from './types'
export class VoiceSession {
  readonly conversation = new ConversationManager()
  readonly worker = new BackgroundWorker()
  readonly interrupts = new InterruptManager()
  private speech: SpeechState = createSpeechState()
  startSession(): void { this.conversation.startSession(); this.transition('listening', 'input_started') }
  endSession(): void { this.conversation.endSession(); this.transition('idle', 'response_finished') }
  setState(state: VoiceSessionState): void { this.transition(state, state === 'speaking' ? 'response_started' : 'transcript_ready') }
  getSpeechState(): SpeechState { return this.speech }
  private transition(state: VoiceSessionState, type: 'input_started' | 'transcript_ready' | 'response_started' | 'response_finished'): void { this.speech = updateSpeechState(this.speech, state, { type }) }
}
