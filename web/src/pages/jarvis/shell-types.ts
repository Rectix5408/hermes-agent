import type { JarvisOrchestrationResponse, JarvisStatusResponse, MemoryStatus } from '@/lib/api'
import type { JarvisVisualProps } from './types'
import type { ProductionVoiceState, VoiceHistoryEntry } from './voice-runtime/production-state'
import type { VoiceApprovalDisplay, VoiceApprovalChoice, VoiceToolActivity } from './voice-runtime/hermes-conversation'

export interface JarvisWorkspaceProps extends JarvisVisualProps {
  memory: MemoryStatus | null
  selectedAgent: string
  request: string
  payloadText: string
  payload: Record<string, unknown> | null
  error: string
  autoSpeak: boolean
  voiceState: ProductionVoiceState
  voiceHistory: VoiceHistoryEntry[]
  continuousVoice?: boolean
  voiceStream?: MediaStream | null
  voiceResponse?: string
  voiceProgress?: number
  voiceApproval?: VoiceApprovalDisplay | null
  voiceTools?: VoiceToolActivity[]
  onContinueVoiceInChat?: () => void
  onVoiceApprovalDecision?: (id: string, choice: VoiceApprovalChoice) => void
  onCancelVoice?: () => void
  onContinuousVoiceChange?: (enabled: boolean) => void
  approvalBusy?: boolean
  approvalHistory?: string[]
  onNavigate: (path: string) => void
  onRequestChange: (value: string) => void
  onPayloadChange: (value: string) => void
  onAgentSelect: (id: string) => void
  onRun: (mode: 'plan' | 'run') => void
  onRecordVoice: () => void
  onStopVoice: () => void
  onVoiceTranscript: (transcript: string) => void
  onSpeak: (text: string, speed?: number) => void
  onAutoSpeakChange: (value: boolean) => void
  onApprovalDecision: (id: string, decision: 'approve' | 'deny') => void
  onRoutingModeChange: (mode: string) => void
}

export type JarvisWorkspace = 'dashboard' | 'voice' | 'agents' | 'memory' | 'runtime' | 'security' | 'settings'
export type { JarvisOrchestrationResponse, JarvisStatusResponse }
