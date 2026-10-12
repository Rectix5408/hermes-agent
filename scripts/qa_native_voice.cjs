/* Isolated browser contract test. No model, provider, real microphone or PTY.
 * Uses existing Playwright and installed Chrome; all APIs/sockets are intercepted.
 * NODE_PATH=<existing node_modules> node scripts/qa_native_voice.cjs <preview URL>
 */
const { chromium } = require('playwright')
const assert = require('node:assert/strict')

function silentAudio() {
  const wav = Buffer.alloc(44 + 80000)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28)
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(80000, 40)
  return 'data:audio/wav;base64,' + wav.toString('base64')
}

async function run() {
  const base = process.argv[2] || 'http://127.0.0.1:5175'
  assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(base), 'Local preview only')
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
  const calls = [], decisions = [], errors = []
  let turn = 0, uploads = 0
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      window.__HERMES_SESSION_TOKEN__ = 'synthetic-qa-not-a-credential'
      window.__HERMES_DASHBOARD_EMBEDDED_CHAT__ = true
      window.qaTracks = []
      const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async constraints => {
        const stream = await capture(constraints)
        window.qaTracks.push(...stream.getTracks())
        return stream
      }
    })
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      const fixtures = {
        '/api/profiles': { profiles: [{ name: 'qa-synthetic' }] },
        '/api/profiles/active': { current: 'qa-synthetic', active: 'qa-synthetic' },
        '/api/memory': { active: 'synthetic', providers: [], builtin_files: {} },
        '/api/jarvis/status': { ok: true, config: {}, agents: [], runs: [], approvals: { pending: [] }, voice: { stt: { configured: true, provider: 'Synthetic STT' }, tts: { configured: true, provider: 'Synthetic TTS' } } },
        '/api/audio/transcribe': { transcript: 'Synthetischer Testauftrag', ok: true },
        '/api/audio/speak': { data_url: silentAudio(), mime_type: 'audio/wav', ok: true },
      }
      if (url.pathname.startsWith('/api/audio/')) assert.equal(url.searchParams.get('profile'), 'qa-synthetic')
      if (url.pathname === '/api/audio/transcribe') uploads++
      const data = fixtures[url.pathname]
      await route.fulfill({ status: data ? 200 : 503, contentType: 'application/json', body: JSON.stringify(data || { detail: 'Isolated fixture unavailable' }) })
    })
    await page.routeWebSocket('**/api/**', socket => {
      if (new URL(socket.url()).pathname !== '/api/ws') { socket.close(); return }
      const send = frame => socket.send(JSON.stringify({ jsonrpc: '2.0', ...frame }) + '\n')
      const emit = (type, payload) => send({ method: 'event', params: { type, session_id: 'qa-runtime', payload } })
      socket.onMessage(message => {
        for (const line of message.toString().trim().split('\n')) {
          const frame = JSON.parse(line)
          if (frame.method) {
            calls.push({ method: frame.method, profile: frame.params?.profile, session: frame.params?.session_id })
            const results = { 'client.capabilities': {}, 'gateway.ping': {}, 'session.create': { session_id: 'qa-runtime', stored_session_id: 'qa-stored' }, 'session.close': { closed: true }, 'session.interrupt': { status: 'interrupted' }, 'prompt.submit': { status: 'streaming' } }
            assert.ok(frame.method in results, 'Unexpected RPC: ' + frame.method)
            if (frame.method.startsWith('session.') || frame.method === 'prompt.submit') assert.equal(frame.params.profile, 'qa-synthetic')
            send({ id: frame.id, result: results[frame.method] })
            if (frame.method === 'prompt.submit') {
              turn++
              emit('message.delta', { text: 'Synthetische Antwort …' })
              emit('tool.start', { name: 'qa_tool', args: { secret: 'MUST_NOT_APPEAR' } })
              send({ id: 'qa-approval-' + turn, method: 'approval', params: { session_id: 'qa-runtime', tool_name: 'qa_tool', description: 'Isolierte Testfreigabe; keine externe Aktion', choices: ['once', 'deny'] } })
            }
          } else {
            decisions.push(frame.result)
            emit('tool.complete', { name: 'qa_tool', result: 'MUST_NOT_APPEAR' })
            emit('message.complete', { status: 'complete', text: 'Synthetische Antwort ' + turn })
          }
        }
      })
    })
    await page.goto(base + '/jarvis/voice?profile=qa-synthetic')
    const start = page.getByRole('button', { name: 'Zuhören starten', exact: true })
    const record = async () => {
      await start.click()
      await page.getByText('Aktiv', { exact: true }).waitFor()
      await page.waitForTimeout(250) // collect a nonempty fake MediaRecorder chunk
      await page.getByRole('button', { name: 'Aufnahme beenden', exact: true }).click()
      await page.getByRole('region', { name: 'Hermes Werkzeugfreigabe' }).waitFor()
    }
    await record()
    assert.equal(decisions.length, 0)
    await page.getByRole('button', { name: 'Einmal erlauben …', exact: true }).click()
    assert.equal(decisions.length, 0)
    await page.getByRole('button', { name: 'Einmalige Freigabe bestätigen', exact: true }).click()
    await page.getByRole('progressbar', { name: 'Wiedergabefortschritt' }).waitFor()
    assert.deepEqual(decisions, [{ choice: 'once', all: false }])
    assert.ok(!(await page.locator('body').innerText()).includes('MUST_NOT_APPEAR'))
    await page.getByRole('button', { name: 'Unterbrechen und sprechen', exact: true }).click()
    await page.getByText('Aktiv', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
    assert.equal(uploads, 1, 'Cancelled capture must not upload')
    await page.waitForFunction(() => window.qaTracks.every(track => track.readyState === 'ended'))
    await record()
    await page.getByRole('button', { name: 'Ablehnen', exact: true }).click()
    await page.getByRole('progressbar', { name: 'Wiedergabefortschritt' }).waitFor()
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
    assert.deepEqual(decisions[1], { choice: 'deny', all: false })
    assert.equal(calls.filter(call => call.method === 'session.create').length, 1)
    assert.equal(calls.filter(call => call.method === 'prompt.submit').length, 2)
    await page.getByRole('button', { name: 'Gespräch im Hermes Chat fortsetzen', exact: true }).click()
    await page.waitForURL('**/chat?resume=qa-stored&profile=qa-synthetic')
    assert.equal(calls.filter(call => call.method === 'session.close').length, 1)
    await page.locator('.xterm').first().waitFor()
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ data: 'isolated synthetic fixtures only', turns: turn, audioUploads: uploads, decisions: decisions.map(d => d.choice), sessionCreates: 1, checks: ['native JSON-RPC streaming', 'two-click once approval', 'deny', 'metadata-only tool activity', 'explicit barge-in', 'cancel without upload', 'microphone tracks ended', 'follow-up uses same session', 'same-history PTY handoff'], uncaughtErrors: errors }, null, 2))
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
