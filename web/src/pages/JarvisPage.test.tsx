// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileContext } from '@/contexts/profile-context'
import { ApiError } from '@/lib/api-error'
import type { JarvisWorkspaceProps } from './jarvis/shell-types'
import type { JarvisStatusResponse } from '@/lib/api'

const seam = vi.hoisted(() => ({ props: null as JarvisWorkspaceProps | null }))
const mocked = vi.hoisted(() => ({
  getJarvisStatus: vi.fn(), getMemory: vi.fn(), planJarvis: vi.fn(),
  runJarvis: vi.fn(), runJarvisAgent: vi.fn(), speakText: vi.fn(),
  setEnd: vi.fn(), setTitle: vi.fn(), showToast: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ api: mocked }))
vi.mock('@/contexts/usePageHeader', () => ({ usePageHeader: () => mocked }))
vi.mock('@nous-research/ui/hooks/use-toast', () => ({ useToast: () => ({ toast: null, showToast: mocked.showToast }) }))
vi.mock('@nous-research/ui/ui/components/toast', () => ({ Toast: () => null }))
vi.mock('./jarvis/JarvisShell', () => ({ JarvisShell: (props: JarvisWorkspaceProps) => { seam.props = props; return <div>{props.error}</div> } }))
import JarvisPage from './JarvisPage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let host: HTMLDivElement
const status = { ok: true, config: {}, agents: [], runs: [], approvals: { pending: [] } } as unknown as JarvisStatusResponse
async function render(profile: string) {
  await act(async () => root.render(<MemoryRouter><ProfileContext.Provider value={{ profile, currentProfile: profile, profiles: [profile], setProfile: () => {} }}><JarvisPage /></ProfileContext.Provider></MemoryRouter>))
}
beforeEach(() => {
  vi.clearAllMocks()
  mocked.getJarvisStatus.mockResolvedValue(status)
  mocked.getMemory.mockResolvedValue(null)
  mocked.planJarvis.mockResolvedValue({ status: 'planned' })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('Jarvis session boundary', () => {
  it('aborts profile A reads, resets drafts, and ignores late responses after B is selected', async () => {
    let finish!: (value: JarvisStatusResponse) => void
    mocked.getJarvisStatus.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await render('A')
    const signal = mocked.getJarvisStatus.mock.calls[0][1] as AbortSignal
    await act(async () => seam.props!.onRequestChange('A private draft'))
    await render('B')
    expect(signal.aborted).toBe(true)
    expect(mocked.getJarvisStatus.mock.calls[1][0]).toBe('B')
    expect(seam.props!.request).toBe('')
    await act(async () => finish({ ...status, ok: false }))
    expect(seam.props!.status?.ok).toBe(true)
  })
  it('planning with a selected specialist never executes that agent', async () => {
    await render('A')
    await act(async () => { seam.props!.onRequestChange('Prepare a task'); seam.props!.onAgentSelect('mail') })
    await act(async () => seam.props!.onRun('plan'))
    expect(mocked.planJarvis).toHaveBeenCalledWith(expect.objectContaining({ request: 'Prepare a task' }), 'A', expect.any(AbortSignal))
    expect(mocked.runJarvisAgent).not.toHaveBeenCalled()
    expect(mocked.runJarvis).not.toHaveBeenCalled()
  })
  it('an unmounted run cannot trigger TTS or fetch the newly selected profile', async () => {
    let finish!: (value: unknown) => void
    mocked.runJarvis.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await render('A')
    await act(async () => { seam.props!.onRequestChange('Prepare'); seam.props!.onAutoSpeakChange(true) })
    act(() => { void seam.props!.onRun('run') })
    const signal = mocked.runJarvis.mock.calls[0][2] as AbortSignal
    await render('B')
    await act(async () => finish({ status: 'completed', consolidated: { summary: 'A result' } }))
    expect(signal.aborted).toBe(true)
    expect(mocked.speakText).not.toHaveBeenCalled()
    expect(mocked.getJarvisStatus).toHaveBeenCalledTimes(2)
    expect(seam.props!.result).toBeNull()
  })
  it('shows a permission state without leaking response details', async () => {
    mocked.getJarvisStatus.mockRejectedValueOnce(new ApiError('private diagnostic', { status: 403, body: 'private', url: '/' }))
    await render('A')
    expect(host.textContent).toContain('Zugriff nicht erlaubt')
    expect(host.textContent).not.toContain('private')
    expect(seam.props!.loading).toBe(false)
    expect(seam.props!.status).toBeNull()
  })
  it('shows offline separately and aborts on unmount', async () => {
    mocked.getJarvisStatus.mockRejectedValueOnce(new Error('offline'))
    await render('A')
    expect(host.textContent).toContain('nicht erreichbar')
    const signal = mocked.getJarvisStatus.mock.calls[0][1] as AbortSignal
    await act(async () => root.render(null))
    expect(signal.aborted).toBe(true)
  })
})
