declare module 'three' {
  export class Vector3 {
    constructor(x?: number, y?: number, z?: number)
    x: number
    y: number
    z: number
    lengthSq(): number
    lerp(target: Vector3, alpha: number): Vector3
    set(x: number, y: number, z: number): Vector3
  }
  export class Matrix4 {
    makeTranslation(x: number, y: number, z: number): Matrix4
    scale(vector: Vector3): Matrix4
  }
  export class Color { set(value: string): Color }
  export class BufferGeometry {
    setAttribute(name: string, attribute: Float32BufferAttribute): BufferGeometry
    dispose(): void
  }
  export class Float32BufferAttribute { constructor(values: number[], itemSize: number) }
  export class Mesh { rotation: { x: number; y: number; z: number } }
  export class InstancedMesh {
    count: number
    computeBoundingSphere(): void
    setMatrixAt(index: number, matrix: Matrix4): void
    setColorAt(index: number, color: Color): void
    instanceMatrix: { needsUpdate: boolean }
    instanceColor: { needsUpdate: boolean } | null
  }
}
