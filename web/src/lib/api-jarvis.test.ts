import { describe, expect, it } from 'vitest'
import { createJarvisDashboardApi } from './api-jarvis'

function client() {
  const calls: { url: string; init?: RequestInit }[] = []
  const api = createJarvisDashboardApi({
    getManagementProfile: () => 'current',
    appendProfileParam: (url, profile) => url + '?profile=' + encodeURIComponent(profile || ''),
    fetchJSON: <T>(url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return Promise.resolve({} as T)
    },
  })
  return { api, calls }
}

describe('Jarvis scoped request cancellation', () => {
  it('passes the owning profile and signal through existing status and orchestration routes', async () => {
    const { api, calls } = client()
    const signal = new AbortController().signal
    await api.getJarvisStatus('owner', signal)
    await api.planJarvis({ request: 'synthetic' }, 'owner', signal)
    expect(calls.map(call => call.url)).toEqual(['/api/jarvis/status?profile=owner', '/api/jarvis/orchestrator/plan?profile=owner'])
    expect(calls.every(call => call.init?.signal === signal)).toBe(true)
    expect(calls[1].init?.method).toBe('POST')
  })
  it('retains the audio API contracts after moving the facade methods', async () => {
    const { api, calls } = client()
    const signal = new AbortController().signal
    await api.speakText('synthetic', 'owner', signal)
    await api.transcribeAudio('data:synthetic', 'audio/webm', 'owner', signal)
    expect(calls.map(call => call.url)).toEqual(['/api/audio/speak?profile=owner', '/api/audio/transcribe?profile=owner'])
    expect(calls.every(call => call.init?.signal === signal)).toBe(true)
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ text: 'synthetic' })
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ data_url: 'data:synthetic', mime_type: 'audio/webm' })
  })
})
