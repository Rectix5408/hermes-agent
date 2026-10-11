import { describe, expect, it } from 'vitest'
import { createMemoryUniverseApi } from './api-memory-universe'

function createApi() {
  const calls: Array<[string, RequestInit | undefined]> = []
  const fetchJSON = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    calls.push([url, init])
    return { profile: 'jarvis-dev', nodes: [], edges: [], next_cursor: null, has_more: false } as T
  }
  const appendProfileParam = (url: string, profile?: string) => `${url}${url.includes('?') ? '&' : '?'}profile=${profile}`
  return { api: createMemoryUniverseApi({ fetchJSON, appendProfileParam, getManagementProfile: () => 'jarvis-dev' }), calls }
}

describe('memory universe API client', () => {
  it('uses the profile-scoped, cursor-based node endpoint and forwards request cancellation', async () => {
    const { api, calls } = createApi()
    const controller = new AbortController()

    await api.getMemoryUniverseNodes({ clusterId: 'mu_c_projects', cursor: 'next', limit: 80, signal: controller.signal })

    expect(calls).toEqual([['/api/memory/universe/nodes?cluster_id=mu_c_projects&limit=80&cursor=next&profile=jarvis-dev', { signal: controller.signal }]])
  })

  it('keeps search and edges bounded and scoped to the selected profile', async () => {
    const { api, calls } = createApi()

    await api.searchMemoryUniverse('projekt', { limit: 12 })
    await api.getMemoryUniverseEdges('mu_m_1', { limit: 240 })

    expect(calls).toEqual([
      ['/api/memory/universe/search?query=projekt&limit=12&profile=jarvis-dev', { signal: undefined }],
      ['/api/memory/universe/nodes/mu_m_1/edges?limit=240&profile=jarvis-dev', { signal: undefined }],
    ])
  })
})
