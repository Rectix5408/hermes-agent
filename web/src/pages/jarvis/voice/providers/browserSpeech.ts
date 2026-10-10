import type { SttProvider } from './types'

export const browserSpeechProvider: SttProvider = {
  id: 'browser-speech', label: 'Browser Speech', available: () => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  async transcribe() { throw new Error('Browser Speech wird erst nach einer expliziten lokalen Sprachsession aktiviert.') }
}
