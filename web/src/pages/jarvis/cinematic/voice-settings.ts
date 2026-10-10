export interface VoiceSettings { sttEngine: 'whisper'; language: 'de'; ttsProvider: 'elevenlabs'; voice: string; speed: number; microphoneRequested: boolean }
export interface VoiceSettingsTransport { save(settings: VoiceSettings): Promise<void> }
const key = 'jarvis.cinematic.voice-settings.v2'
const defaults: VoiceSettings = { sttEngine: 'whisper', language: 'de', ttsProvider: 'elevenlabs', voice: 'Jarvis Voice', speed: .95, microphoneRequested: false }
export function loadVoiceSettings(): VoiceSettings { try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) ?? '{}') } } catch { return defaults } }
export function saveVoiceSettings(settings: VoiceSettings): void { localStorage.setItem(key, JSON.stringify(settings)) }
