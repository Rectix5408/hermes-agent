import { expect, it } from 'vitest'
import { memoryTelemetry } from './live-runtime'

it('reports byte sizes from the memory API, not invented file counts', () => {
  const telemetry = memoryTelemetry({ active: 'builtin', providers: [], builtin_files: { memory: 1024, user: 512 } })
  expect(telemetry.stored).toBe('1.536 Byte lokaler Speicher')
  expect(memoryTelemetry(null).stored).toBe('—')
})
