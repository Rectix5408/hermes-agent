import type { ProductionVoiceState } from '../../voice-runtime/production-state'
import type {
  VoiceApprovalDisplay,
  VoiceToolActivity,
} from '../../voice-runtime/hermes-conversation'

export type JarvisAvatarState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'tool-execution'
  | 'awaiting-approval'
  | 'speaking'
  | 'error'

export interface AvatarAppearance {
  label: string
  description: string
}

export const avatarAppearances: Record<JarvisAvatarState, AvatarAppearance> = {
  idle: { label: 'Bereit', description: 'Jarvis wartet auf eine bewusst gestartete Spracheingabe.' },
  listening: { label: 'Hört zu', description: 'Das geöffnete Mikrofon steuert die sichtbare Eingabewelle.' },
  transcribing: { label: 'Transkribiert', description: 'Die Spracheingabe wird verarbeitet.' },
  thinking: { label: 'Verarbeitet', description: 'Hermes bearbeitet die Anfrage.' },
  'tool-execution': { label: 'Werkzeugschritt aktiv', description: 'Hermes hat einen laufenden Werkzeugschritt gemeldet.' },
  'awaiting-approval': { label: 'Freigabe erforderlich', description: 'Eine bestehende Freigabe wartet auf eine explizite Auswahl.' },
  speaking: { label: 'Spricht', description: 'Jarvis gibt eine Antwort wieder.' },
  error: { label: 'Unterbrochen', description: 'Die Voice-Sitzung benötigt Aufmerksamkeit.' },
}

export function avatarStateFor(
  voiceState: ProductionVoiceState,
  approval?: VoiceApprovalDisplay | null,
  tools: readonly VoiceToolActivity[] = [],
): JarvisAvatarState {
  if (approval) return 'awaiting-approval'
  if (tools.at(-1)?.status === 'started') return 'tool-execution'
  if (voiceState === 'processing') return 'transcribing'
  return voiceState
}
