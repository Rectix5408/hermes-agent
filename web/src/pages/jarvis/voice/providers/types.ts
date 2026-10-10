export interface SttTranscription { text: string; language: string; confidence?: number }
export interface SttProvider { id: 'whisper-local' | 'browser-speech'; label: string; available(): boolean; transcribe(audio: Blob, language: string): Promise<SttTranscription> }
