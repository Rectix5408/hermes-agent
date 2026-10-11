export interface VoiceSettings { sttEngine: 'whisper-local' | 'browser-speech' | 'disabled'; language: 'de'; ttsProvider: 'elevenlabs'; voice: string; voiceId: string; speed: number; microphoneRequested: boolean; deviceId?: string }
export interface VoiceSettingsTransport { save(settings: VoiceSettings): Promise<void> }
const key = 'jarvis.cinematic.voice-settings.v2'
const defaults: VoiceSettings = { sttEngine: 'whisper-local', language: 'de', ttsProvider: 'elevenlabs', voice: 'Jarvis Voice', voiceId: '', speed: .95, microphoneRequested: false }
const listeners = new Set<{ profile: string; listener: (settings: VoiceSettings) => void }>()
function storageKey(profile: string) { return profile ? `${key}:${encodeURIComponent(profile)}` : key }
export function loadVoiceSettings(profile = ''): VoiceSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(profile)) ?? '{}') as Record<string, unknown>
    const engine = saved.sttEngine === 'whisper' ? 'whisper-local' : saved.sttEngine
    return { ...defaults,
      speed: typeof saved.speed === 'number' && Number.isFinite(saved.speed) ? Math.max(.75, Math.min(1.25, saved.speed)) : defaults.speed,
      deviceId: typeof saved.deviceId === 'string' ? saved.deviceId : '',
      sttEngine: engine === 'whisper-local' || engine === 'browser-speech' || engine === 'disabled' ? engine : defaults.sttEngine,
    }
  } catch { return { ...defaults } }
}
export function saveVoiceSettings(settings: VoiceSettings, profile = ''): boolean {
  let saved = true
  try { localStorage.setItem(storageKey(profile), JSON.stringify(settings)) } catch { saved = false }
  listeners.forEach(entry => { if (entry.profile === profile) entry.listener(settings) })
  return saved
}
export function subscribeVoiceSettings(listener: (settings: VoiceSettings) => void, profile = ''): () => void {
  const entry = { profile, listener }; listeners.add(entry); return () => { listeners.delete(entry) }
}
export function applyVoiceSpeedCommand(transcript: string, profile = ''): VoiceSettings | null {
  const normalized = transcript.toLocaleLowerCase('de-DE')
  if (!/^(?:jarvis[,!\s]+)?(?:(?:bitte|sprich|mach deine stimme)\s+)*(?:um\s+)?(?:\d+\s*(?:prozent|%)\s+)?(?:langsamer|schneller)[.!?\s]*$/.test(normalized)) return null
  const current = loadVoiceSettings(profile)
  const percentage = Number(normalized.match(/(\d+)\s*(?:prozent|%)/)?.[1] ?? 10) / 100
  const next = { ...current, speed: Math.min(1.25, Math.max(.75, Number((current.speed * (1 + (normalized.includes('langsamer') ? -percentage : percentage))).toFixed(2)))) }
  saveVoiceSettings(next, profile)
  return next
}
