import { describe, expect, it } from 'vitest'
import type { JarvisStatusResponse } from '@/lib/api'
import { registeredAgents } from './agent-registry'

function status(overrides: Partial<JarvisStatusResponse> = {}): JarvisStatusResponse {
  return {
    ok: true,
    skill: { name: 'jarvis', available: true, path: '' },
    orchestrator: { available: true, schema: '', path: '', error: '' },
    agents: [],
    config: {},
    integrations: [],
    models: { available: true, local: [], cloud: [], fallback_rules: [], note: '' },
    voice: { stt: { provider: null, configured: false, available: '' }, tts: { provider: null, configured: false, available: '' }, note: '' },
    automations: { jarvis_jobs: [], count: 0, activation_policy: '' },
    runs: [],
    approvals: { pending: [] },
    ...overrides
  }
}

describe('registeredAgents', () => {
  it('keeps unavailable registry entries explicitly offline', () => {
    const agents = registeredAgents(status(), false, null)

    expect(agents).toHaveLength(4)
    expect(agents.find(agent => agent.id === 'mail')?.status).toBe('OFFLINE')
  })

  it('uses live Hermes permissions and exposes a matching pending approval', () => {
    const agents = registeredAgents(status({
      agents: [{ agent_id: 'instagram-agent', title: 'Instagram Agent', scope: '', skills: [], toolsets: [], permissions: ['draft:create'], max_steps: 1, max_input_chars: 1, model_route: '' }],
      approvals: { pending: [{ id: 'approval-1', created_at: 0, status: 'pending', action: 'Instagram post veröffentlichen', reason: '', agent_id: 'instagram-agent', items: [], params_hash: '' }] }
    }), false, null)

    const instagram = agents.find(agent => agent.id === 'instagram')
    expect(instagram).toMatchObject({ status: 'ONLINE', approval: 'PENDING APPROVAL', permissions: ['draft:create'] })
  })
})
