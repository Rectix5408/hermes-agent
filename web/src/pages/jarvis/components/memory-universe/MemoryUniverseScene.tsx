
import {
  Canvas,
  useFrame,
  useThree,
} from '@react-three/fiber'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from 'react'

import * as THREE from 'three'

import type {
  MemoryUniverseCluster,
  MemoryUniverseEdge,
  MemoryUniverseNode,
} from '@/lib/api-memory-universe'

import {
  MEMORY_UNIVERSE_LIMITS,
  categoryColor,
  clusterPosition,
  nodePosition,
  visibleNodes,
  type UniversePoint,
} from './memory-universe-model'

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

interface OrbitState {
  azimuth: number
  elevation: number
  distance: number
}

interface SceneEvent {
  stopPropagation: () => void
  instanceId?: number
}

const ThreeGroup = 'group' as ElementType
const ThreeMesh = 'mesh' as ElementType
const ThreeInstancedMesh = 'instancedMesh' as ElementType

const ThreeSphereGeometry = 'sphereGeometry' as ElementType
const ThreeIcoGeometry = 'icosahedronGeometry' as ElementType
const ThreeTorusGeometry = 'torusGeometry' as ElementType

const ThreeBasicMaterial = 'meshBasicMaterial' as ElementType
const ThreeStandardMaterial = 'meshStandardMaterial' as ElementType

const ThreePointLight = 'pointLight' as ElementType
const ThreeAmbientLight = 'ambientLight' as ElementType
const ThreeFog = 'fog' as ElementType

const ThreeLineSegments = 'lineSegments' as ElementType
const ThreeLineMaterial = 'lineBasicMaterial' as ElementType

const ThreePoints = 'points' as ElementType
const ThreePointsMaterial = 'pointsMaterial' as ElementType

const CAMERA_MIN_DISTANCE = 3
const CAMERA_MAX_DISTANCE = 30
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

const clamp = (
  value: number,
  minimum: number,
  maximum: number,
): number => Math.max(minimum, Math.min(maximum, value))

function toVector(point: UniversePoint): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z)
}

/**
 * Camera controller
 *
 * Keeps the existing orbit / zoom interaction, while
 * following selected memory clusters and individual nodes.
 *
 * The controller intentionally does not persist camera
 * coordinates in browser storage or Hermes memory.
 */
function CameraRig({
  target,
  reducedMotion,
}: {
  target: THREE.Vector3
  reducedMotion: boolean
}) {
  const { camera, gl, invalidate } = useThree()

  const orbit = useRef<OrbitState>({
    azimuth: 0.65,
    elevation: 0.35,
    distance: 15,
  })

  const currentTarget = useRef(new THREE.Vector3())

  const drag = useRef<{
    pointerId: number
    x: number
    y: number
    azimuth: number
    elevation: number
  } | null>(null)

  useEffect(() => {
    orbit.current.distance =
      target.lengthSq() > 0.01 ? 9 : 15

    invalidate()
  }, [target, invalidate])

  useEffect(() => {
    const element = gl.domElement
    const previousTouchAction = element.style.touchAction

    element.style.setProperty('touch-action', 'none')

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return
      }

      drag.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        azimuth: orbit.current.azimuth,
        elevation: orbit.current.elevation,
      }

      element.setPointerCapture?.(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      const active = drag.current

      if (!active || active.pointerId !== event.pointerId) {
        return
      }

      const deltaX = event.clientX - active.x
      const deltaY = event.clientY - active.y

      orbit.current.azimuth =
        active.azimuth - deltaX * 0.006

      orbit.current.elevation = clamp(
        active.elevation + deltaY * 0.005,
        -1.35,
        1.35,
      )

      invalidate()
    }

    const stopDragging = (event: PointerEvent) => {
      if (drag.current?.pointerId !== event.pointerId) {
        return
      }

      drag.current = null

      if (element.hasPointerCapture?.(event.pointerId)) {
        element.releasePointerCapture(event.pointerId)
      }
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()

      const factor = Math.exp(event.deltaY * 0.001)

      orbit.current.distance = clamp(
        orbit.current.distance * factor,
        CAMERA_MIN_DISTANCE,
        CAMERA_MAX_DISTANCE,
      )

      invalidate()
    }

    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', stopDragging)
    element.addEventListener('pointercancel', stopDragging)
    element.addEventListener('wheel', onWheel, {
      passive: false,
    })

    return () => {
      element.style.setProperty('touch-action', previousTouchAction)
      drag.current = null

      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', stopDragging)
      element.removeEventListener('pointercancel', stopDragging)
      element.removeEventListener('wheel', onWheel)
    }
  }, [gl, invalidate])

  useFrame(({ clock }, delta) => {
    const smoothing = reducedMotion
      ? 1
      : 1 - Math.exp(-delta * 5.5)

    currentTarget.current.lerp(target, smoothing)

    const {
      azimuth,
      elevation,
      distance,
    } = orbit.current

    const pulse = reducedMotion
      ? 0
      : Math.sin(clock.elapsedTime * 0.35) * 0.08

    const radius = distance + pulse

    camera.position.set(
      currentTarget.current.x +
        Math.cos(azimuth) *
          Math.cos(elevation) *
          radius,

      currentTarget.current.y +
        Math.sin(elevation) * radius,

      currentTarget.current.z +
        Math.sin(azimuth) *
          Math.cos(elevation) *
          radius,
    )

    camera.lookAt(currentTarget.current)
  })

  return null
}

/**
 * Holographic Jarvis core.
 *
 * Every ring is decorative. No animation here claims
 * to represent hidden model reasoning or memory reads.
 */
function HolographicCore({
  reducedMotion,
}: {
  reducedMotion: boolean
}) {
  const primaryRing = useRef<THREE.Mesh>(null)
  const secondaryRing = useRef<THREE.Mesh>(null)
  const tertiaryRing = useRef<THREE.Mesh>(null)
  const core = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (reducedMotion) return

    const time = clock.elapsedTime

    if (primaryRing.current) {
      primaryRing.current.rotation.z = time * 0.12
    }

    if (secondaryRing.current) {
      secondaryRing.current.rotation.x = time * -0.17
      secondaryRing.current.rotation.y = time * 0.08
    }

    if (tertiaryRing.current) {
      tertiaryRing.current.rotation.y = time * 0.1
    }

    if (core.current) {
      core.current.rotation.y = time * 0.045
    }
  })

  return (
    <ThreeGroup>
      <ThreeMesh ref={core}>
        <ThreeIcoGeometry args={[1.15, 3]} />

        <ThreeStandardMaterial
          color="#38bdf8"
          emissive="#075985"
          emissiveIntensity={1.6}
          wireframe
          transparent
          opacity={0.85}
        />
      </ThreeMesh>

      <ThreeMesh>
        <ThreeSphereGeometry args={[0.92, 24, 16]} />

        <ThreeBasicMaterial
          color="#0ea5e9"
          transparent
          opacity={0.065}
          depthWrite={false}
        />
      </ThreeMesh>

      <ThreeMesh
        ref={primaryRing}
        rotation={[Math.PI / 2.4, 0, 0]}
      >
        <ThreeTorusGeometry args={[1.66, 0.022, 8, 96]} />

        <ThreeBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </ThreeMesh>

      <ThreeMesh
        ref={secondaryRing}
        rotation={[0.7, 0.2, 0.4]}
      >
        <ThreeTorusGeometry args={[1.98, 0.012, 8, 96]} />

        <ThreeBasicMaterial
          color="#818cf8"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </ThreeMesh>

      <ThreeMesh
        ref={tertiaryRing}
        rotation={[0.3, 1.2, 0.6]}
      >
        <ThreeTorusGeometry args={[2.2, 0.008, 6, 96]} />

        <ThreeBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </ThreeMesh>

      <ThreePointLight
        color="#38bdf8"
        intensity={4}
        distance={14}
      />
    </ThreeGroup>
  )
}

/**
 * Subtle static background depth field.
 *
 * These points are decorative stars, not memory nodes.
 * They never enter the memory search or node selection.
 */
function AmbientField() {
  const geometry = useMemo(() => {
    const positions: number[] = []
    const count = 220

    for (let index = 0; index < count; index += 1) {
      const vertical =
        1 - (2 * (index + 0.5)) / count

      const horizontal = Math.sqrt(
        Math.max(0, 1 - vertical * vertical),
      )

      const angle = index * GOLDEN_ANGLE
      const radius = 17 + (index % 7) * 1.25

      positions.push(
        Math.cos(angle) * horizontal * radius,
        vertical * radius,
        Math.sin(angle) * horizontal * radius,
      )
    }

    const buffer = new THREE.BufferGeometry()

    buffer.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    )

    return buffer
  }, [])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  return (
    <ThreePoints geometry={geometry}>
      <ThreePointsMaterial
        color="#38bdf8"
        size={0.055}
        sizeAttenuation
        transparent
        opacity={0.36}
        depthWrite={false}
      />
    </ThreePoints>
  )
}

/**
 * Category clusters remain derived from the API.
 * This component never invents categories or counts.
 */
function ClusterCloud({
  clusters,
  selectedClusterId,
  onSelectCluster,
}: Pick<
  MemoryUniverseSceneProps,
  'clusters' | 'selectedClusterId' | 'onSelectCluster'
>) {
  const { gl } = useThree()

  return (
    <>
      {clusters.map((cluster, index) => {
        const point = clusterPosition(
          cluster,
          index,
          clusters.length,
        )

        const active = cluster.id === selectedClusterId

        const radius =
          0.38 +
          Math.min(cluster.node_count, 30) * 0.012

        const color = active
          ? '#e0f2fe'
          : categoryColor(cluster.label, 'skill')

        const chooseCluster = (event: SceneEvent) => {
          event.stopPropagation()
          onSelectCluster(cluster.id)
        }

        return (
          <ThreeGroup
            key={cluster.id}
            position={[point.x, point.y, point.z]}
            onClick={chooseCluster}
            onDoubleClick={chooseCluster}
            onPointerOver={() => {
              gl.domElement.style.setProperty('cursor', 'pointer')
            }}
            onPointerOut={() => {
              gl.domElement.style.setProperty('cursor', 'grab')
            }}
          >
            <ThreeMesh scale={active ? 1.18 : 1}>
              <ThreeIcoGeometry args={[radius, 1]} />

              <ThreeBasicMaterial
                color={color}
                wireframe
                transparent
                opacity={active ? 1 : 0.78}
              />
            </ThreeMesh>

            <ThreeMesh rotation={[Math.PI / 2, 0, 0]}>
              <ThreeTorusGeometry
                args={[radius * 1.45, 0.012, 6, 48]}
              />

              <ThreeBasicMaterial
                color={color}
                transparent
                opacity={active ? 0.7 : 0.3}
                depthWrite={false}
              />
            </ThreeMesh>
          </ThreeGroup>
        )
      })}
    </>
  )
}

/**
 * GPU-instanced memory nodes.
 *
 * One draw call handles the visible node cloud rather
 * than allocating a separate mesh for every memory.
 */
function NodeCloud({
  nodes,
  clusters,
  selectedNodeId,
  onSelectNode,
}: Pick<
  MemoryUniverseSceneProps,
  'nodes' | 'clusters' | 'selectedNodeId' | 'onSelectNode'
>) {
  const mesh = useRef<THREE.InstancedMesh>(null)

  const { gl, invalidate } = useThree()

  const [hoveredNodeId, setHoveredNodeId] =
    useState<string | null>(null)

  const shown = useMemo(
    () => visibleNodes(nodes),
    [nodes],
  )

  const positions = useMemo(() => {
    const clusterIndices = new Map(
      clusters.map((cluster, index) => [
        cluster.id,
        index,
      ]),
    )

    return shown.map(node =>
      nodePosition(
        node,
        clusterIndices.get(node.visual.cluster_id) ?? 0,
        clusters.length,
      ),
    )
  }, [shown, clusters])

  useEffect(() => {
    const current = mesh.current

    if (!current) return

    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    const scale = new THREE.Vector3()

    current.count = shown.length

    shown.forEach((node, index) => {
      const point = positions[index]

      const selected = node.id === selectedNodeId
      const hovered = node.id === hoveredNodeId

      const degree = Number.isFinite(node.connection_count)
        ? Math.max(0, node.connection_count)
        : 0

      const radius =
        0.085 +
        Math.min(degree, 12) * 0.009 +
        (selected ? 0.085 : hovered ? 0.035 : 0)

      matrix.makeTranslation(
        point.x,
        point.y,
        point.z,
      )

      matrix.scale(
        scale.set(radius, radius, radius),
      )

      current.setMatrixAt(index, matrix)

      color.set(
        selected
          ? '#f0f9ff'
          : hovered
            ? '#a5f3fc'
            : categoryColor(node.category, node.kind),
      )

      current.setColorAt(index, color)
    })

    current.instanceMatrix.needsUpdate = true

    if (current.instanceColor) {
      current.instanceColor.needsUpdate = true
    }

    current.computeBoundingSphere()
    invalidate()
  }, [
    shown,
    positions,
    selectedNodeId,
    hoveredNodeId,
    invalidate,
  ])

  useEffect(() => {
    return () => {
      gl.domElement.style.removeProperty('cursor')
    }
  }, [gl])

  if (shown.length === 0) {
    return null
  }

  return (
    <ThreeInstancedMesh
      ref={mesh}
      args={[undefined, undefined, shown.length]}
      onClick={(event: SceneEvent) => {
        event.stopPropagation()

        if (event.instanceId === undefined) {
          return
        }

        const node = shown[event.instanceId]

        if (node) onSelectNode(node.id)
      }}
      onPointerMove={(event: SceneEvent) => {
        const node = event.instanceId === undefined
          ? undefined
          : shown[event.instanceId]

        const nextId = node?.id ?? null

        setHoveredNodeId(previous =>
          previous === nextId ? previous : nextId,
        )

        gl.domElement.style.setProperty('cursor', node ? 'pointer' : 'grab')
      }}
      onPointerOut={() => {
        setHoveredNodeId(null)
        gl.domElement.style.setProperty('cursor', 'grab')
      }}
    >
      <ThreeSphereGeometry args={[1, 12, 12]} />

      <ThreeBasicMaterial
        toneMapped={false}
      />
    </ThreeInstancedMesh>
  )
}

/**
 * Selection marker for a visible real memory node.
 */
function SelectedNodeMarker({
  node,
  clusters,
}: {
  node: MemoryUniverseNode | null
  clusters: MemoryUniverseCluster[]
}) {
  if (!node) return null

  const clusterIndex = clusters.findIndex(
    cluster => cluster.id === node.visual.cluster_id,
  )

  const point = nodePosition(
    node,
    Math.max(clusterIndex, 0),
    clusters.length,
  )

  return (
    <ThreeGroup
      position={[point.x, point.y, point.z]}
    >
      <ThreeMesh
        rotation={[Math.PI / 2, 0, 0]}
      >
        <ThreeTorusGeometry
          args={[0.32, 0.012, 8, 48]}
        />

        <ThreeBasicMaterial
          color="#e0f2fe"
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </ThreeMesh>

      <ThreeMesh>
        <ThreeSphereGeometry args={[0.23, 14, 10]} />

        <ThreeBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </ThreeMesh>
    </ThreeGroup>
  )
}

/**
 * Draws only edges returned by Hermes and whose endpoints
 * are both present in the current visible node set.
 *
 * No synthetic relationships are generated.
 */
function EdgeLines({
  nodes,
  clusters,
  edges,
  selectedNodeId,
}: Pick<
  MemoryUniverseSceneProps,
  'nodes' | 'clusters' | 'edges' | 'selectedNodeId'
>) {
  const { invalidate } = useThree()

  const shown = useMemo(
    () => visibleNodes(nodes),
    [nodes],
  )

  const geometry = useMemo(() => {
    const clusterIndices = new Map(
      clusters.map((cluster, index) => [
        cluster.id,
        index,
      ]),
    )

    const positions = new Map<string, UniversePoint>()

    shown.forEach(node => {
      positions.set(
        node.id,
        nodePosition(
          node,
          clusterIndices.get(node.visual.cluster_id) ?? 0,
          clusters.length,
        ),
      )
    })

    const segments: number[] = []

    for (const edge of edges.slice(
      0,
      MEMORY_UNIVERSE_LIMITS.maxVisibleEdges,
    )) {
      if (
        selectedNodeId &&
        edge.source_id !== selectedNodeId &&
        edge.target_id !== selectedNodeId
      ) {
        continue
      }

      const source = positions.get(edge.source_id)
      const target = positions.get(edge.target_id)

      if (!source || !target) continue

      segments.push(
        source.x,
        source.y,
        source.z,
        target.x,
        target.y,
        target.z,
      )
    }

    const buffer = new THREE.BufferGeometry()

    buffer.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        segments,
        3,
      ),
    )

    return buffer
  }, [
    shown,
    clusters,
    edges,
    selectedNodeId,
  ])

  useEffect(() => {
    invalidate()

    return () => geometry.dispose()
  }, [geometry, invalidate])

  return (
    <ThreeLineSegments geometry={geometry}>
      <ThreeLineMaterial
        color="#38bdf8"
        transparent
        opacity={selectedNodeId ? 0.72 : 0.24}
        depthWrite={false}
      />
    </ThreeLineSegments>
  )
}

/**
 * Main 3D scene composition.
 *
 * The memory API is the only source for actual nodes,
 * categories and relationships.
 */
function Scene(props: MemoryUniverseSceneProps) {
  const shown = useMemo(
    () => visibleNodes(props.nodes),
    [props.nodes],
  )

  const selectedNode = useMemo(
    () =>
      shown.find(
        node => node.id === props.selectedNodeId,
      ) ?? null,
    [shown, props.selectedNodeId],
  )

  const target = useMemo(() => {
    if (selectedNode) {
      const index = props.clusters.findIndex(
        cluster =>
          cluster.id === selectedNode.visual.cluster_id,
      )

      return toVector(
        nodePosition(
          selectedNode,
          Math.max(index, 0),
          props.clusters.length,
        ),
      )
    }

    if (props.selectedClusterId) {
      const index = props.clusters.findIndex(
        cluster => cluster.id === props.selectedClusterId,
      )

      if (index >= 0) {
        return toVector(
          clusterPosition(
            props.clusters[index],
            index,
            props.clusters.length,
          ),
        )
      }
    }

    return new THREE.Vector3()
  }, [
    selectedNode,
    props.clusters,
    props.selectedClusterId,
  ])

  return (
    <>
      <color
        attach="background"
        args={['#020712']}
      />

      <ThreeFog
        attach="fog"
        args={['#020712', 15, 40]}
      />

      <ThreeAmbientLight intensity={0.55} />

      <AmbientField />

      <HolographicCore
        reducedMotion={props.reducedMotion}
      />

      <ClusterCloud
        clusters={props.clusters}
        selectedClusterId={props.selectedClusterId}
        onSelectCluster={props.onSelectCluster}
      />

      <NodeCloud
        nodes={props.nodes}
        clusters={props.clusters}
        selectedNodeId={props.selectedNodeId}
        onSelectNode={props.onSelectNode}
      />

      <EdgeLines
        nodes={props.nodes}
        clusters={props.clusters}
        edges={props.edges}
        selectedNodeId={props.selectedNodeId}
      />

      <SelectedNodeMarker
        node={selectedNode}
        clusters={props.clusters}
      />

      <CameraRig
        target={target}
        reducedMotion={props.reducedMotion}
      />
    </>
  )
}

/**
 * Public component contract remains unchanged.
 *
 * Reduced-motion preferences and hidden browser tabs
 * use on-demand rendering to conserve GPU resources.
 */
export function MemoryUniverseScene(
  props: MemoryUniverseSceneProps,
) {
  const [hidden, setHidden] = useState(
    () =>
      typeof document !== 'undefined' &&
      document.hidden,
  )

  useEffect(() => {
    const updateVisibility = () => {
      setHidden(document.hidden)
    }

    document.addEventListener(
      'visibilitychange',
      updateVisibility,
    )

    return () => {
      document.removeEventListener(
        'visibilitychange',
        updateVisibility,
      )
    }
  }, [])

  const staticScene = props.reducedMotion || hidden

  return (
    <Canvas
      className="memory-universe-canvas"
      dpr={[1, 1.5]}
      camera={{
        fov: 48,
        near: 0.1,
        far: 100,
        position: [9, 7, 12],
      }}
      frameloop={staticScene ? 'demand' : 'always'}
    >
      <Scene
        {...props}
        reducedMotion={staticScene}
      />
    </Canvas>
  )
}
