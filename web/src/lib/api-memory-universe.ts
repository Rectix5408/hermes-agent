type FetchJSON = <T>(url: string, init?: RequestInit) => Promise<T>

interface MemoryUniverseApiDependencies {
  fetchJSON: FetchJSON
  appendProfileParam: (url: string, profile?: string) => string
  getManagementProfile: () => string
}

export interface MemoryUniverseCluster {
  id: string
  parent_id: string
  kind: 'category'
  label: string
  node_count: number
  project_count: number
}

export interface MemoryUniverseNode {
  id: string
  kind: 'memory' | 'skill'
  label: string
  category: string
  profile: string
  project: string | null
  timestamp: number | null
  connection_count: number
  visual: { cluster_id: string; tier: string; weight: number }
}

export interface MemoryUniverseEdge {
  source_id: string
  target_id: string
  relation: 'related_skill' | 'memory_skill_overlap'
  weight: number
}

export interface MemoryUniverseClustersResponse {
  profile: string
  root: { id: string; kind: 'universe'; label: string; node_count: number }
  clusters: MemoryUniverseCluster[]
}

export interface MemoryUniverseStats {
  profile: string
  nodes: number
  edges: number
  clusters: number
  by_kind: Record<string, number>
  cache_ttl_seconds: number
}

export interface MemoryUniverseContent {
  profile: string
  node_id: string
  content: string
}

function query(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString() ? `?${params}` : ''
}

export function createMemoryUniverseApi({ appendProfileParam, fetchJSON, getManagementProfile }: MemoryUniverseApiDependencies) {
  const scoped = (path: string, profile = getManagementProfile()) => appendProfileParam(path, profile)
  return {
    getMemoryUniverseClusters: (profile = getManagementProfile()) =>
      fetchJSON<MemoryUniverseClustersResponse>(scoped('/api/memory/universe/clusters', profile)),
    getMemoryUniverseNodes: (options: { clusterId?: string; kind?: MemoryUniverseNode['kind']; query?: string; limit?: number; cursor?: string; signal?: AbortSignal } = {}, profile = getManagementProfile()) =>
      fetchJSON<{ profile: string; nodes: MemoryUniverseNode[]; next_cursor: string | null; has_more: boolean }>(
        scoped(`/api/memory/universe/nodes${query({ cluster_id: options.clusterId, kind: options.kind, query: options.query, limit: options.limit, cursor: options.cursor })}`, profile),
        { signal: options.signal },
      ),
    searchMemoryUniverse: (search: string, options: { kind?: MemoryUniverseNode['kind']; limit?: number; cursor?: string; signal?: AbortSignal } = {}, profile = getManagementProfile()) =>
      fetchJSON<{ profile: string; nodes: MemoryUniverseNode[]; next_cursor: string | null; has_more: boolean }>(
        scoped(`/api/memory/universe/search${query({ query: search, kind: options.kind, limit: options.limit, cursor: options.cursor })}`, profile),
        { signal: options.signal },
      ),
    getMemoryUniverseEdges: (nodeId: string, options: { limit?: number; cursor?: string; signal?: AbortSignal } = {}, profile = getManagementProfile()) =>
      fetchJSON<{ profile: string; edges: MemoryUniverseEdge[]; next_cursor: string | null; has_more: boolean }>(
        scoped(`/api/memory/universe/nodes/${encodeURIComponent(nodeId)}/edges${query({ limit: options.limit, cursor: options.cursor })}`, profile),
        { signal: options.signal },
      ),
    getMemoryUniverseNode: (nodeId: string, profile = getManagementProfile()) =>
      fetchJSON<{ profile: string; node: MemoryUniverseNode }>(scoped(`/api/memory/universe/nodes/${encodeURIComponent(nodeId)}`, profile)),
    getMemoryUniverseContent: (nodeId: string, profile = getManagementProfile()) =>
      fetchJSON<MemoryUniverseContent>(scoped(`/api/memory/universe/nodes/${encodeURIComponent(nodeId)}/content`, profile)),
    getMemoryUniverseStats: (profile = getManagementProfile()) =>
      fetchJSON<MemoryUniverseStats>(scoped('/api/memory/universe/stats', profile)),
  }
}
