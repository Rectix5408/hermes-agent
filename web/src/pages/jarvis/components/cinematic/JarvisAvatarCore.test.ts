import { describe, expect, it } from 'vitest'

import { avatarStateFor } from './jarvis-avatar-core-state'

describe('avatarStateFor', () => {
  it.each([
    ['idle', undefined, [], 'idle'],
    ['listening', undefined, [], 'listening'],
    ['processing', undefined, [], 'transcribing'],
    ['thinking', undefined, [], 'thinking'],
    ['speaking', undefined, [], 'speaking'],
    ['error', undefined, [], 'error'],
  ] as const)('maps %s without inventing an activity', (voiceState, approval, tools, expected) => {
    expect(avatarStateFor(voiceState, approval, tools)).toBe(expected)
  })

  it('shows only a reported running tool step', () => {
    expect(avatarStateFor('thinking', null, [{ name: 'search', status: 'started' }]))
      .toBe('tool-execution')
    expect(avatarStateFor('thinking', null, [{ name: 'search', status: 'finished' }]))
      .toBe('thinking')
  })

  it('makes an existing approval visible without overriding the approval UI', () => {
    expect(avatarStateFor('speaking', {
      id: 'synthetic', command: 'x', description: 'x', toolName: 'x', allowOnce: true,
    })).toBe('awaiting-approval')
  })
})
