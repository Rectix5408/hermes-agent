import type { JarvisStatusResponse } from '@/lib/api'
import type { VoiceApprovalDisplay, VoiceToolActivity } from '../../voice-runtime/hermes-conversation'

export type JarvisBrainState = 'ready' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'tool' | 'approval' | 'offline'

export function brainStateFor(input: { status: JarvisStatusResponse | null; voiceBusy?: 'recording' | 'transcribing' | 'thinking' | 'speaking' | null; busy?: 'plan' | 'run' | null; approval?: VoiceApprovalDisplay | null; tools?: VoiceToolActivity[] }): JarvisBrainState {
  if (input.approval || input.status?.approvals.pending.length) return 'approval'
  if (input.tools?.at(-1)?.status === 'started') return 'tool'
  if (input.voiceBusy === 'recording') return 'listening'
  if (input.voiceBusy === 'speaking') return 'speaking'
  if (input.voiceBusy === 'thinking' || input.busy === 'plan') return 'thinking'
  if (input.voiceBusy === 'transcribing' || input.busy === 'run') return 'processing'
  return input.status?.ok ? 'ready' : 'offline'
}
