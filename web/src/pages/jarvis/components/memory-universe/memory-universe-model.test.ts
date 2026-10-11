import { describe, expect, it } from 'vitest'
import { MEMORY_UNIVERSE_LIMITS, nodePosition, semanticLevel, visibleNodes } from './memory-universe-model'
import type { MemoryUniverseNode } from '@/lib/api-memory-universe'

const node: MemoryUniverseNode = {
  id: 'mu_s_test', kind: 'skill', label: 'Test', category: 'tools', profile: 'default', project: null,
  timestamp: null, connection_count: 3, visual: { cluster_id: 'mu_c_tools', tier: 'detail', weight: 3 },
}

describe('memory universe model', () => {
  it('uses deterministic positions and bounded visible nodes', () => {
    expect(nodePosition(node, 0, 1)).toEqual(nodePosition(node, 0, 1))
    expect(visibleNodes(Array.from({ length: 1_000 }, () => node))).toHaveLength(MEMORY_UNIVERSE_LIMITS.maxVisibleNodes)
  })

  it('maps navigation state to semantic detail levels', () => {
    expect(semanticLevel(null, null, false)).toBe('universe')
    expect(semanticLevel('cluster', null, false)).toBe('nodes')
    expect(semanticLevel('cluster', 'node', false)).toBe('detail')
    expect(semanticLevel('cluster', 'node', true)).toBe('content')
  })
})
