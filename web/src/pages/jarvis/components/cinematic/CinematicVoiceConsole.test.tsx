// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfileContext } from '@/contexts/profile-context'
import { CinematicVoiceConsole } from './CinematicVoiceConsole'
import type { JarvisWorkspaceProps } from '../../shell-types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

function workspaceProps(): JarvisWorkspaceProps {
  return {
    status: { ok: true, voice: { stt: {}, tts: { configured: true, provider: 'ElevenLabs' } } } as JarvisWorkspaceProps['status'],
    memory: null, result: null, voiceBusy: null, busy: null, loading: false,
    selectedAgent: 'auto', request: '', payloadText: '{}', payload: {}, error: '',
    autoSpeak: false, voiceState: 'idle', voiceHistory: [], onNavigate: vi.fn(),
    onRequestChange: vi.fn(), onPayloadChange: vi.fn(), onAgentSelect: vi.fn(),
    onRun: vi.fn(), onRecordVoice: vi.fn(), onStopVoice: vi.fn(),
    onVoiceTranscript: vi.fn(), onSpeak: vi.fn(), onAutoSpeakChange: vi.fn(),
    onApprovalDecision: vi.fn(), onRoutingModeChange: vi.fn(),
  }
}

describe('CinematicVoiceConsole', () => {
  it('routes server voice selection through the existing configuration page without changing a voice locally', async () => {
    const props = workspaceProps()
    await act(async () => root.render(
      <ProfileContext.Provider value={{ profile: 'jarvis-dev', currentProfile: 'default', profiles: [], setProfile: vi.fn() }}>
        <CinematicVoiceConsole {...props} />
      </ProfileContext.Provider>,
    ))

    const control = [...host.querySelectorAll('button')]
      .find(button => button.textContent === 'Serverstimme verwalten')
    expect(control).toBeDefined()
    await act(async () => control?.click())
    expect(props.onNavigate).toHaveBeenCalledWith('/config')
    expect(host.textContent).toContain('ändert keine Voice-ID')
  })
})
