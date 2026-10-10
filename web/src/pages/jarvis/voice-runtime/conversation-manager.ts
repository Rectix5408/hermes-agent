import type { Transcript, VoiceInput, VoiceOutput } from './types'
export class ConversationManager {
  private active = false
  private history: Transcript[] = []
  private currentResponse?: VoiceOutput
  startSession(): void { this.active = true }
  endSession(): void { this.active = false; this.currentResponse = undefined }
  addUserMessage(text: string): VoiceInput { const input = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }; this.history = [...this.history, { ...input, speaker: 'user' }]; return input }
  addJarvisResponse(text: string): VoiceOutput { const output = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString(), paused: false }; this.currentResponse = output; this.history = [...this.history, { id: output.id, text, createdAt: output.createdAt, speaker: 'jarvis' }]; return output }
  getHistory(): Transcript[] { return this.history }
  getCurrentResponse(): VoiceOutput | undefined { return this.currentResponse }
  isActive(): boolean { return this.active }
}
