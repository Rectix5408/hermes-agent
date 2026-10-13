import { describe, expect, it } from 'vitest'
import type { JarvisStatusResponse } from '@/lib/api'
import { brainStateFor } from './jarvis-brain-state'

const online = { ok: true, approvals: { pending: [] } } as unknown as JarvisStatusResponse

describe('brainStateFor', () => {
  it('uses only reported activity and prioritizes approval', () => {
    expect(brainStateFor({ status: online })).toBe('ready')
    expect(brainStateFor({ status: online, voiceBusy: 'recording' })).toBe('listening')
    expect(brainStateFor({ status: online, tools: [{ name: 'search', status: 'started' }] })).toBe('tool')
    expect(brainStateFor({ status: online, approval: { id: 'a', command: '', description: '', toolName: '', allowOnce: true }, voiceBusy: 'speaking' })).toBe('approval')
  })

  it('does not claim activity when Hermes is unavailable', () => {
    expect(brainStateFor({ status: null })).toBe('offline')
  })
})
