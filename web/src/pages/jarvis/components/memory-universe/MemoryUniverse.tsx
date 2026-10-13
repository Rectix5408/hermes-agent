import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Crosshair, LoaderCircle, Maximize2, Minimize2, Network, RotateCcw, Search, ShieldCheck, ZoomIn } from 'lucide-react'
import { Button } from '@nous-research/ui/ui/components/button'
import { api } from '@/lib/api'
import type { MemoryUniverseCluster, MemoryUniverseEdge, MemoryUniverseNode, MemoryUniverseStats } from '@/lib/api-memory-universe'
import type { JarvisWorkspaceProps } from '../../shell-types'
import { MemoryUniverseScene } from './MemoryUniverseScene'
import { isEmptyMemoryUniverse, MEMORY_UNIVERSE_LIMITS, semanticLevel } from './memory-universe-model'

type NodePage = { profile: string; nodes: MemoryUniverseNode[]; next_cursor: string | null; has_more: boolean }

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

function dateLabel(timestamp: number | null): string {
  return timestamp ? new Date(timestamp * 1000).toLocaleString() : 'Nicht verfügbar'
}

function webglIsAvailable(): boolean {
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
}

export function MemoryUniverse({ status, busy, onNavigate }: Pick<JarvisWorkspaceProps, 'status' | 'onNavigate'> & { busy: boolean }) {
  const [clusters, setClusters] = useState<MemoryUniverseCluster[]>([])
  const [nodes, setNodes] = useState<MemoryUniverseNode[]>([])
  const [edges, setEdges] = useState<MemoryUniverseEdge[]>([])
  const [stats, setStats] = useState<MemoryUniverseStats | null>(null)
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<MemoryUniverseNode[]>([])
  const [content, setContent] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [error, setError] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [webglAvailable] = useState(webglIsAvailable)
  const hostRef = useRef<HTMLElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const searchRequestRef = useRef<AbortController | null>(null)
  const edgeRequestRef = useRef<AbortController | null>(null)
  const reducedMotion = useReducedMotion()
  const selected = useMemo(() => nodes.find(node => node.id === selectedNodeId) ?? searchResults.find(node => node.id === selectedNodeId) ?? null, [nodes, searchResults, selectedNodeId])
  const level = semanticLevel(selectedClusterId, selectedNodeId, content !== null)
  const emptyUniverse = isEmptyMemoryUniverse(nodes, loading)

  const loadNodes = useCallback(async (clusterId: string | null, cursor: string | null, append: boolean) => {
    if (requestRef.current) requestRef.current.abort()
    const controller = new AbortController()
    requestRef.current = controller
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const response = await api.getMemoryUniverseNodes({ clusterId: clusterId ?? undefined, cursor: cursor ?? undefined, limit: MEMORY_UNIVERSE_LIMITS.initialNodes, signal: controller.signal }) as NodePage
      if (controller.signal.aborted) return
      setNodes(previous => append ? [...previous, ...response.nodes.filter(node => !previous.some(item => item.id === node.id))] : response.nodes)
      setNextCursor(response.next_cursor)
      setError('')
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Memory Universe ist derzeit nicht verfügbar.')
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setLoadingMore(false) }
    }
  }, [])

  useEffect(() => {
    void Promise.all([api.getMemoryUniverseClusters(), api.getMemoryUniverseStats()])
      .then(([clusterResponse, statsResponse]) => { setClusters(clusterResponse.clusters); setStats(statsResponse) })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Memory-Status konnte nicht geladen werden.'))
    void loadNodes(null, null, false)
    return () => {
      if (requestRef.current) requestRef.current.abort()
      if (searchRequestRef.current) searchRequestRef.current.abort()
      if (edgeRequestRef.current) edgeRequestRef.current.abort()
    }
  }, [loadNodes])

  useEffect(() => {
    if (!search.trim()) return
    const timer = window.setTimeout(() => {
      if (searchRequestRef.current) searchRequestRef.current.abort()
      const controller = new AbortController()
      searchRequestRef.current = controller
      void api.searchMemoryUniverse(search.trim(), { limit: 12, signal: controller.signal })
        .then(response => { if (!controller.signal.aborted) setSearchResults(response.nodes) })
        .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Suche ist nicht verfügbar.') })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const selectCluster = (clusterId: string) => {
    setSelectedClusterId(clusterId)
    setSelectedNodeId(null)
    setContent(null)
    void loadNodes(clusterId, null, false)
  }
  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    setContent(null)
    if (edgeRequestRef.current) edgeRequestRef.current.abort()
    const controller = new AbortController()
    edgeRequestRef.current = controller
    void api.getMemoryUniverseEdges(nodeId, { limit: MEMORY_UNIVERSE_LIMITS.maxVisibleEdges, signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setEdges(response.edges) })
      .catch(cause => { if (!controller.signal.aborted) { setEdges([]); setError(cause instanceof Error ? cause.message : 'Verbindungen konnten nicht geladen werden.') } })
  }
  const reset = () => {
    setSelectedClusterId(null); setSelectedNodeId(null); setContent(null); setEdges([]); setSearch(''); setSearchResults([])
    void loadNodes(null, null, false)
  }
  const openContent = async () => {
    if (!selected || selected.kind !== 'memory') return
    setContentLoading(true)
    try {
      const response = await api.getMemoryUniverseContent(selected.id)
      setContent(response.content)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Geschützte Memory-Details konnten nicht geladen werden.')
    } finally { setContentLoading(false) }
  }
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await hostRef.current?.requestFullscreen()
    } catch { setError('Vollbild ist in diesem Browser nicht verfügbar.') }
  }
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const clusterLabel = clusters.find(cluster => cluster.id === selectedClusterId)?.label
  return <section ref={hostRef} className={`memory-universe jarvis-glass overflow-hidden p-0 ${fullscreen ? 'memory-universe-fullscreen' : ''}`}>
    <header className="memory-universe-header relative overflow-hidden px-5 py-4">
      <span className="jarvis-scanline" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[.24em] text-cyan-300/80">Hermes Infinite Memory</p><h2 className="mt-1 text-2xl font-medium text-slate-50">Memory Universe</h2><p className="mt-1 text-sm text-slate-400">Metadata-only Wissensraum · {level.toUpperCase()} Ebene</p></div>
        <div className="flex flex-wrap gap-2"><Button size="sm" outlined onClick={reset}><RotateCcw className="h-3.5 w-3.5" />Reset</Button><Button size="sm" outlined onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}{fullscreen ? 'Beenden' : 'Vollbild'}</Button></div>
      </div>
      <div className="memory-universe-breadcrumb relative mt-4 flex flex-wrap items-center gap-2 text-xs"><button type="button" onClick={reset}>Gesamtes Gedächtnis</button>{clusterLabel && <><ChevronLeft className="h-3 w-3" /><button type="button" onClick={() => selectCluster(selectedClusterId!)}>{clusterLabel}</button></>}{selected && <><ChevronLeft className="h-3 w-3" /><span>{selected.label}</span></>}</div>
    </header>
    <div className="grid min-h-[42rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="relative min-h-[34rem] border-y border-cyan-300/15 bg-[#020712] xl:border-l-0 xl:border-r">
        <label className="memory-universe-search absolute left-4 top-4 z-10 flex items-center gap-2"><Search className="h-4 w-4" /><input value={search} onChange={event => { setSearch(event.target.value); if (!event.target.value) setSearchResults([]) }} placeholder="Sichere Metadaten durchsuchen" aria-label="Memory Universe durchsuchen" /></label>
        {searchResults.length > 0 && <div className="memory-universe-search-results absolute left-4 top-16 z-20 w-72"><p className="px-3 py-2 text-[10px] uppercase tracking-[.16em] text-cyan-200/80">Suchergebnisse</p>{searchResults.map(node => <button type="button" key={node.id} onClick={() => { setSearch(''); setSearchResults([]); selectCluster(node.visual.cluster_id); selectNode(node.id) }}><span>{node.label}</span><small>{node.category}</small></button>)}</div>}
        {loading ? <LoadingUniverse /> : webglAvailable ? <MemoryUniverseScene clusters={clusters} nodes={nodes} edges={edges} selectedNodeId={selectedNodeId} selectedClusterId={selectedClusterId} reducedMotion={reducedMotion} onSelectNode={selectNode} onSelectCluster={selectCluster} /> : <FallbackUniverse clusters={clusters} nodes={nodes} onSelectCluster={selectCluster} onSelectNode={selectNode} />}
        {emptyUniverse && <EmptyUniverseNotice webglAvailable={webglAvailable} />}
        <div className="memory-universe-overlay bottom-4 left-4"><span>{nodes.length} sichtbare Nodes</span><span>{edges.length} sichtbare Kanten</span><span>{reducedMotion ? 'Bewegung reduziert' : 'Ambient Mode'}</span></div>
        <div className="memory-universe-overlay right-4 top-4"><Crosshair className="h-3.5 w-3.5" /><span>Drag: Kamera · Scroll: Zoom</span></div>
        <UniverseMinimap clusters={clusters} selectedClusterId={selectedClusterId} onSelectCluster={selectCluster} />
        {nextCursor && nodes.length < MEMORY_UNIVERSE_LIMITS.maxVisibleNodes && <Button className="absolute bottom-4 right-4" size="sm" onClick={() => void loadNodes(selectedClusterId, nextCursor, true)} disabled={loadingMore}>{loadingMore ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ZoomIn className="h-3.5 w-3.5" />}Mehr laden</Button>}
        {error && <p className="memory-universe-error absolute bottom-14 left-4 max-w-md">{error}</p>}
      </div>
      <aside className="memory-universe-inspector p-4"><Inspector node={selected} edges={edges} content={content} loadingContent={contentLoading} onLoadContent={() => void openContent()} onFocus={() => selected && selectCluster(selected.visual.cluster_id)} onNavigateChat={() => onNavigate('/chat')} /><Stats stats={stats} /><section className="memory-universe-activity"><p>HERMES Aktivität</p><strong>Keine Live-Aktivitätsquelle verbunden</strong><span>Ambient Mode ist dekorativ. Es werden keine Modellgedanken simuliert.</span></section><section className="memory-universe-agent-status"><p>Agentenstatus</p>{status?.agents.length ? <span>{status.agents.length} registrierte Hermes-Agenten · {busy ? 'aktive Orchestrierung' : 'keine aktuelle Ausführung'}</span> : <span>Keine Agentenstatusdaten verfügbar</span>}</section></aside>
    </div>
  </section>
}

function LoadingUniverse() { return <div className="memory-universe-loading"><LoaderCircle className="h-5 w-5 animate-spin" />Memory Universe wird geladen…</div> }

function EmptyUniverseNotice({ webglAvailable }: { webglAvailable: boolean }) { return <div className="memory-universe-empty-notice" role="status"><Network className="h-6 w-6" /><h3>Dieses Profil hat aktuell keine Memory-Einträge.</h3><p>{webglAvailable ? 'Der zentrale HERMES-Kern bleibt als dekorativer Leerzustand sichtbar. Es wurden keine Knoten, Cluster oder Verbindungen erzeugt.' : 'Die zugängliche Leeransicht enthält keine künstlichen Memory-Daten.'}</p></div> }

function UniverseMinimap({ clusters, selectedClusterId, onSelectCluster }: { clusters: MemoryUniverseCluster[]; selectedClusterId: string | null; onSelectCluster: (id: string) => void }) {
  return <nav className="memory-universe-minimap" aria-label="Memory-Cluster Übersicht"><p>Cluster Map</p>{clusters.slice(0, 8).map(cluster => <button type="button" key={cluster.id} aria-pressed={selectedClusterId === cluster.id} onClick={() => onSelectCluster(cluster.id)}><i /><span>{cluster.label}</span><small>{cluster.node_count}</small></button>)}</nav>
}

function FallbackUniverse({ clusters, nodes, onSelectCluster, onSelectNode }: { clusters: MemoryUniverseCluster[]; nodes: MemoryUniverseNode[]; onSelectCluster: (id: string) => void; onSelectNode: (id: string) => void }) {
  return <div className="memory-universe-fallback"><p className="text-xs uppercase tracking-[.18em] text-cyan-300">Kompatibilitätsansicht</p><h3>WebGL ist nicht verfügbar</h3><p>Die sichere, zugängliche Memory-Navigation bleibt verfügbar.</p><div>{clusters.map(cluster => <button type="button" key={cluster.id} onClick={() => onSelectCluster(cluster.id)}>{cluster.label}<small>{cluster.node_count} Nodes</small></button>)}</div><ol>{nodes.slice(0, 20).map(node => <li key={node.id}><button type="button" onClick={() => onSelectNode(node.id)}>{node.label}<small>{node.kind} · {node.connection_count} Verbindungen</small></button></li>)}</ol></div>
}

function Inspector({ node, edges, content, loadingContent, onLoadContent, onFocus, onNavigateChat }: { node: MemoryUniverseNode | null; edges: MemoryUniverseEdge[]; content: string | null; loadingContent: boolean; onLoadContent: () => void; onFocus: () => void; onNavigateChat: () => void }) {
  if (!node) return <section className="memory-universe-empty"><Network className="h-5 w-5" /><p>Wähle einen Knoten im Universe aus.</p><span>Details werden erst nach Auswahl angefordert.</span></section>
  return <section className="memory-universe-node-detail"><p>Gedächtnisdetails</p><h3>{node.label}</h3><dl><Detail label="Typ" value={node.kind} /><Detail label="Kategorie" value={node.category} /><Detail label="Bereich" value={node.project ?? 'Nicht zugeordnet'} /><Detail label="Zeitstempel" value={dateLabel(node.timestamp)} /><Detail label="Verbindungen" value={String(node.connection_count)} /></dl><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" outlined onClick={onFocus}><ZoomIn className="h-3.5 w-3.5" />Fokus</Button><Button size="sm" outlined onClick={onNavigateChat}>Im Chat öffnen</Button></div><p className="mt-5 text-xs uppercase tracking-[.15em] text-slate-500">Autorisierte Details</p>{node.kind === 'memory' ? content !== null ? <pre className="memory-universe-content">{content}</pre> : <Button className="mt-2" size="sm" onClick={onLoadContent} disabled={loadingContent}>{loadingContent ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}Geschützte Details öffnen</Button> : <p className="mt-2 text-xs text-slate-500">Skill-Inhalte werden in dieser Ansicht nicht vorab geladen.</p>}<p className="mt-5 text-xs uppercase tracking-[.15em] text-slate-500">Sichtbare Kanten</p><p className="mt-2 text-sm text-cyan-100">{edges.length ? `${edges.length} autorisierte Verbindung${edges.length === 1 ? '' : 'en'} geladen` : 'Keine sichtbaren Verbindungen'}</p></section>
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }

function Stats({ stats }: { stats: MemoryUniverseStats | null }) { return <section className="memory-universe-stats"><p>Universe Status</p>{stats ? <div><span><b>{stats.nodes}</b> Nodes</span><span><b>{stats.edges}</b> Kanten</span><span><b>{stats.clusters}</b> Cluster</span></div> : <span>Statistik wird geladen…</span>}</section> }
