// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { ProfileContext } from '@/contexts/profile-context'
import { emit } from './event-bus'
import { useRuntimeEvents } from './event-store'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
function Probe() { return <div>{useRuntimeEvents().map(event => event.type).join(',')}</div> }
it('shows only observed events owned by the selected profile, never unbound demos', async () => {
  const host = document.createElement('div')
  const root = createRoot(host)
  const render = async (profile: string) => {
    await act(async () => root.render(<ProfileContext.Provider value={{ profile, currentProfile: profile, profiles: [], setProfile: () => {} }}><Probe /></ProfileContext.Provider>))
  }
  try {
    emit({ source: 'system', type: 'UNBOUND_DEMO', status: 'running' })
    emit({ profile: 'A', source: 'task', type: 'A_TASK', status: 'started' })
    emit({ profile: 'B', source: 'task', type: 'B_TASK', status: 'started' })
    await render('A')
    expect(host.textContent).toBe('A_TASK')
    await render('B')
    expect(host.textContent).toBe('B_TASK')
    await act(async () => { emit({ profile: 'A', source: 'agent', type: 'A_LATE', status: 'completed' }) })
    expect(host.textContent).toBe('B_TASK')
  } finally { await act(async () => root.unmount()) }
})
