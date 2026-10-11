import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ElementType } from 'react'
import * as THREE from 'three'
import type { MemoryUniverseCluster, MemoryUniverseEdge, MemoryUniverseNode } from '@/lib/api-memory-universe'
import { categoryColor, clusterPosition, nodePosition, visibleNodes } from './memory-universe-model'

interface MemoryUniverseSceneProps {
  clusters: MemoryUniverseCluster[]
  nodes: MemoryUniverseNode[]
  edges: MemoryUniverseEdge[]
  selectedNodeId: string | null
  selectedClusterId: string | null
  reducedMotion: boolean
  onSelectNode: (nodeId: string) => void
  onSelectCluster: (clusterId: string) => void
}

interface OrbitState { azimuth: number; elevation: number; distance: number }

type SceneEvent = { stopPropagation: () => void; instanceId?: number }
const ThreeGroup = 'group' as ElementType
const ThreeMesh = 'mesh' as ElementType
const ThreeIcoGeometry = 'icosahedronGeometry' as ElementType
const ThreeTorusGeometry = 'torusGeometry' as ElementType
const ThreeSphereGeometry = 'sphereGeometry' as ElementType
const ThreeStandardMaterial = 'meshStandardMaterial' as ElementType
const ThreeBasicMaterial = 'meshBasicMaterial' as ElementType
const ThreePointLight = 'pointLight' as ElementType
const ThreeLineSegments = 'lineSegments' as ElementType
const ThreeLineMaterial = 'lineBasicMaterial' as ElementType
const ThreeFog = 'fog' as ElementType
const ThreeAmbientLight = 'ambientLight' as ElementType
const ThreeInstancedMesh = 'instancedMesh' as ElementType

function CameraRig({ target, reducedMotion }: { target: THREE.Vector3; reducedMotion: boolean }) {
  const { camera, gl, invalidate } = useThree()
  const orbit = useRef<OrbitState>({ azimuth: 0.4, elevation: 0.42, distance: 14 })
  const drag = useRef<{ x: number; y: number; azimuth: number; elevation: number } | null>(null)
  const currentTarget = useRef(new THREE.Vector3())

  useEffect(() => {
    const element = gl.domElement
    const onPointerDown = (event: PointerEvent) => {
      drag.current = { x: event.clientX, y: event.clientY, azimuth: orbit.current.azimuth, elevation: orbit.current.elevation }
      element.setPointerCapture?.(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!drag.current) return
      orbit.current.azimuth = drag.current.azimuth - (event.clientX - drag.current.x) * 0.008
      orbit.current.elevation = Math.max(-1.1, Math.min(1.1, drag.current.elevation + (event.clientY - drag.current.y) * 0.006))
      invalidate()
    }
    const onPointerUp = (event: PointerEvent) => {
      drag.current = null
      element.releasePointerCapture?.(event.pointerId)
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      orbit.current.distance = Math.max(4.5, Math.min(25, orbit.current.distance + event.deltaY * 0.012))
      invalidate()
    }
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('wheel', onWheel)
    }
  }, [gl, invalidate])

  useFrame(({ clock }) => {
    currentTarget.current.lerp(target, reducedMotion ? 1 : 0.08)
    const { azimuth, elevation, distance } = orbit.current
    const pulse = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.25) * 0.18
    camera.position.set(
      currentTarget.current.x + Math.cos(azimuth) * Math.cos(elevation) * (distance + pulse),
      currentTarget.current.y + Math.sin(elevation) * (distance + pulse),
      currentTarget.current.z + Math.sin(azimuth) * Math.cos(elevation) * (distance + pulse),
    )
    camera.lookAt(currentTarget.current)
  })
  return null
}

function Core({ reducedMotion }: { reducedMotion: boolean }) {
  const ring = useRef<THREE.Mesh>(null)
  const innerRing = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (reducedMotion) return
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.18
    if (innerRing.current) innerRing.current.rotation.x = -clock.elapsedTime * 0.23
  })
  return <ThreeGroup scale={1.65}>
    <ThreeMesh>
      <ThreeIcoGeometry args={[1.15, 3]} />
      <ThreeStandardMaterial color="#0ea5e9" emissive="#075985" emissiveIntensity={1.8} wireframe />
    </ThreeMesh>
    <ThreeMesh ref={ring} rotation={[Math.PI / 2.4, 0, 0]}>
      <ThreeTorusGeometry args={[1.7, 0.025, 12, 96]} />
      <ThreeBasicMaterial color="#67e8f9" transparent opacity={0.78} />
    </ThreeMesh>
    <ThreeMesh ref={innerRing} rotation={[0.7, 0.2, 0.4]}>
      <ThreeTorusGeometry args={[1.42, 0.012, 8, 72]} />
      <ThreeBasicMaterial color="#d8b4fe" transparent opacity={0.62} />
    </ThreeMesh>
    <ThreePointLight color="#38bdf8" intensity={6} distance={12} />
  </ThreeGroup>
}

function NodeCloud({ nodes, clusters, selectedNodeId, onSelectNode }: Pick<MemoryUniverseSceneProps, 'nodes' | 'clusters' | 'selectedNodeId' | 'onSelectNode'>) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const shown = useMemo(() => visibleNodes(nodes), [nodes])
  const positions = useMemo(() => {
    const indexByCluster = new Map(clusters.map((cluster, index) => [cluster.id, index]))
    return shown.map(node => nodePosition(node, indexByCluster.get(node.visual.cluster_id) ?? 0, clusters.length))
  }, [clusters, shown])
  useEffect(() => {
    if (!mesh.current) return
    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    const scale = new THREE.Vector3()
    positions.forEach((position, index) => {
      const node = shown[index]
      const radius = 0.09 + Math.min(node.connection_count, 12) * 0.012 + (node.id === selectedNodeId ? 0.09 : 0)
      matrix.makeTranslation(position.x, position.y, position.z)
      matrix.scale(scale.set(radius, radius, radius))
      mesh.current?.setMatrixAt(index, matrix)
      color.set(categoryColor(node.category, node.kind))
      mesh.current?.setColorAt(index, color)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [positions, selectedNodeId, shown])
  if (!shown.length) return null
  return <ThreeInstancedMesh ref={mesh} args={[undefined, undefined, shown.length]} onClick={(event: SceneEvent) => {
    event.stopPropagation()
    const index = event.instanceId
    if (index !== undefined) onSelectNode(shown[index].id)
  }}>
    <ThreeSphereGeometry args={[1, 12, 12]} />
    <ThreeBasicMaterial toneMapped={false} />
  </ThreeInstancedMesh>
}

function ClusterCloud({ clusters, selectedClusterId, onSelectCluster }: Pick<MemoryUniverseSceneProps, 'clusters' | 'selectedClusterId' | 'onSelectCluster'>) {
  return <>{clusters.map((cluster, index) => {
    const position = clusterPosition(cluster, index, clusters.length)
    const active = cluster.id === selectedClusterId
    return <ThreeMesh key={cluster.id} position={[position.x, position.y, position.z]} scale={active ? 1.3 : 1} onDoubleClick={(event: SceneEvent) => { event.stopPropagation(); onSelectCluster(cluster.id) }} onClick={(event: SceneEvent) => { event.stopPropagation(); onSelectCluster(cluster.id) }}>
      <ThreeIcoGeometry args={[0.38 + Math.min(cluster.node_count, 30) * 0.012, 1]} />
      <ThreeBasicMaterial color={active ? '#e0f2fe' : '#38bdf8'} wireframe transparent opacity={0.8} />
    </ThreeMesh>
  })}</>
}

function EdgeLines({ nodes, clusters, edges, selectedNodeId }: Pick<MemoryUniverseSceneProps, 'nodes' | 'clusters' | 'edges' | 'selectedNodeId'>) {
  const shown = useMemo(() => visibleNodes(nodes), [nodes])
  const geometry = useMemo(() => {
    const positions = new Map<string, UniversePoint>()
    const indexByCluster = new Map(clusters.map((cluster, index) => [cluster.id, index]))
    shown.forEach(node => positions.set(node.id, nodePosition(node, indexByCluster.get(node.visual.cluster_id) ?? 0, clusters.length)))
    const values: number[] = []
    edges.slice(0, 240).forEach(edge => {
      if (selectedNodeId && ![edge.source_id, edge.target_id].includes(selectedNodeId)) return
      const source = positions.get(edge.source_id)
      const target = positions.get(edge.target_id)
      if (source && target) values.push(source.x, source.y, source.z, target.x, target.y, target.z)
    })
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(values, 3))
  }, [clusters, edges, selectedNodeId, shown])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <ThreeLineSegments geometry={geometry}><ThreeLineMaterial color="#38bdf8" transparent opacity={selectedNodeId ? 0.72 : 0.22} /></ThreeLineSegments>
}

type UniversePoint = { x: number; y: number; z: number }

function Scene(props: MemoryUniverseSceneProps) {
  const target = useMemo(() => {
    if (props.selectedClusterId) {
      const index = props.clusters.findIndex(cluster => cluster.id === props.selectedClusterId)
      const point = clusterPosition(props.clusters[Math.max(index, 0)] ?? { id: 'root', parent_id: '', kind: 'category', label: '', node_count: 0, project_count: 0 }, Math.max(index, 0), props.clusters.length)
      return new THREE.Vector3(point.x, point.y, point.z)
    }
    return new THREE.Vector3()
  }, [props.clusters, props.selectedClusterId])
  return <>
    <color attach="background" args={['#020712']} />
    <ThreeFog attach="fog" args={['#020712', 8, 30]} />
    <ThreeAmbientLight intensity={0.5} />
    <Core reducedMotion={props.reducedMotion} />
    <ClusterCloud {...props} />
    <NodeCloud {...props} />
    <EdgeLines {...props} />
    <CameraRig target={target} reducedMotion={props.reducedMotion} />
  </>
}

export function MemoryUniverseScene(props: MemoryUniverseSceneProps) {
  return <Canvas className="memory-universe-canvas" dpr={[1, 1.5]} camera={{ fov: 48, position: [9, 7, 12] }} frameloop={props.reducedMotion ? 'demand' : 'always'}>
    <Scene {...props} />
  </Canvas>
}
