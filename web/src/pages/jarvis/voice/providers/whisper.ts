import type { SttProvider } from './types'

/** Local Whisper seam. Transport wiring intentionally belongs to a future local runtime adapter. */
export const whisperLocalProvider: SttProvider = {
  id: 'whisper-local', label: 'Whisper Local', available: () => false,
  async transcribe() { throw new Error('Whisper Local ist noch nicht mit einem lokalen Runtime-Adapter verbunden.') }
}
