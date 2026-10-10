export type VoiceSessionState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'responding' | 'speaking' | 'executing'
export interface VoiceInput { id: string; text: string; createdAt: string }
export interface VoiceOutput { id: string; text: string; createdAt: string; paused: boolean }
export interface Transcript { id: string; speaker: 'user' | 'jarvis'; text: string; createdAt: string }
export interface SpeechEvent { id: string; type: 'input_started' | 'transcript_ready' | 'response_started' | 'response_paused' | 'response_finished'; timestamp: string }
export interface BackgroundTask { id: string; agent: string; status: 'running' | 'waiting' | 'completed'; progress: number; startedAt: string }
