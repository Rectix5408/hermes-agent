import type { MemoryUniverseCluster, MemoryUniverseNode } from '@/lib/api-memory-universe'

export interface UniversePoint { x: number; y: number; z: number }

export const MEMORY_UNIVERSE_LIMITS = {
  initialNodes: 80,
  maxVisibleNodes: 160,
  maxVisibleEdges: 240,
  maxLabels: 18,
} as const

export type SemanticLevel = 'universe' | 'cluster' | 'nodes' | 'detail' | 'content'

export function semanticLevel(selectedClusterId: string | null, selectedNodeId: string | null, detailOpen: boolean): SemanticLevel {
  if (detailOpen) return 'content'
  if (selectedNodeId) return 'detail'
  if (selectedClusterId) return 'nodes'
  return 'universe'
}

function hash(value: string): number {
  let state = 2166136261
  for (let index = 0; index < value.length; index += 1) state = Math.imul(state ^ value.charCodeAt(index), 16777619)
  return state >>> 0
}

function unit(value: string, offset: number): number {
  return ((hash(`${value}:${offset}`) % 10_000) / 10_000) * 2 - 1
}

export function clusterPosition(cluster: MemoryUniverseCluster, index: number, total: number): UniversePoint {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2
  const radius = 5.5 + (cluster.node_count > 20 ? 1.2 : 0)
  return { x: Math.cos(angle) * radius, y: Math.sin(angle * 2) * 1.5, z: Math.sin(angle) * radius * 0.5 }
}

export function nodePosition(node: MemoryUniverseNode, clusterIndex: number, clusterTotal: number): UniversePoint {
  const clusterAngle = (clusterIndex / Math.max(clusterTotal, 1)) * Math.PI * 2
  const center = { x: Math.cos(clusterAngle) * 5.5, y: Math.sin(clusterAngle * 2) * 1.5, z: Math.sin(clusterAngle) * 2.75 }
  const radius = 0.8 + Math.min(node.connection_count, 8) * 0.08
  return {
    x: center.x + unit(node.id, 1) * radius * 2.4,
    y: center.y + unit(node.id, 2) * radius,
    z: center.z + unit(node.id, 3) * radius * 2.4,
  }
}

export function categoryColor(category: string, kind: MemoryUniverseNode['kind']): string {
  if (kind === 'memory') return '#67e8f9'
  const hue = hash(category) % 2 ? '#60a5fa' : '#a78bfa'
  return hue
}

export function visibleNodes(nodes: MemoryUniverseNode[]): MemoryUniverseNode[] {
  return nodes.slice(0, MEMORY_UNIVERSE_LIMITS.maxVisibleNodes)
}

/** A zero-node response is a real, honest empty profile — never a demo graph. */
export function isEmptyMemoryUniverse(nodes: MemoryUniverseNode[], loading: boolean): boolean {
  return !loading && nodes.length === 0
}
