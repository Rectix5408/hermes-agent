import type { VoiceOutput } from './types'
export class InterruptManager {
  private interrupted?: VoiceOutput
  interrupt(output: VoiceOutput): VoiceOutput { this.interrupted = { ...output, paused: true }; return this.interrupted }
  resume(): VoiceOutput | undefined { const output = this.interrupted ? { ...this.interrupted, paused: false } : undefined; this.interrupted = undefined; return output }
  cancel(): void { this.interrupted = undefined }
}
