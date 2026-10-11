/* Optional browser acceptance harness. Uses an existing Playwright installation;
 * never connects to real APIs, providers, or PTYs. Run against local Vite/preview.
 * NODE_PATH=<existing playwright node_modules> node scripts/qa_command_center.cjs
 */
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { mkdirSync, mkdtempSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const base = process.argv[2] || 'http://127.0.0.1:5174'
const output = process.argv[3] || mkdtempSync(join(tmpdir(), 'hermes-command-center-qa-'))
const operations = process.argv.includes('--operations')
const status = {
  ok: true, skill: { available: true, name: 'qa', path: '' },
  orchestrator: { available: true, schema: 'jarvis.multi_agent.v1', path: '', error: '' },
  config: { orchestrator_model: 'QA · local profile', max_prompt_tokens: 4000 },
  agents: ['mail', 'research', 'calendar'].map(id => ({ agent_id: id, title: id + ' · QA Agent', scope: 'Synthetic test fixture', skills: [id + '-skill'], toolsets: ['qa-read-only'], permissions: ['read-only'], max_steps: 3, max_input_chars: 500, model_route: 'local' })),
  integrations: [], models: { available: true, local: [], cloud: [], fallback_rules: [], note: 'Synthetic QA inventory' },
  voice: { stt: { provider: null, configured: false, available: 'offline' }, tts: { provider: null, configured: false, available: 'offline' }, note: '' },
  automations: { jarvis_jobs: [], count: 0, activation_policy: 'approval' },
  runs: [], approvals: { pending: [] },
}
;(async () => {
  mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    await page.addInitScript(() => {
      window.__HERMES_DASHBOARD_EMBEDDED_CHAT__ = true
      window.__HERMES_SESSION_TOKEN__ = 'synthetic-qa-not-a-credential'
    })
    const failures = []
    const requests = []
    let mode = 'ready'
    const voice = { stt: { configured: true, provider: 'Synthetic QA STT' }, tts: { configured: true, provider: 'Synthetic QA TTS' } }
    let pending = [{ id: 'qa-approval', action: 'Synthetic action', agent_id: 'mail', reason: 'QA only', created_at: 1, status: 'pending', items: [], params_hash: 'synthetic-bound-params' }]
    // Actual decodable silent WAV; no provider and no user audio.
    const wav = Buffer.alloc(44 + 16000)
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16)
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28)
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(16000, 40)
    page.on('pageerror', error => failures.push(error.message))
    await page.routeWebSocket('**/api/**', socket => { socket.close() })
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      requests.push({ path: url.pathname, profile: url.searchParams.get('profile'), method: route.request().method() })
      let response = null
      const profile = url.searchParams.get('profile') || 'qa-synthetic'
      if (url.pathname === '/api/profiles') response = { profiles: [{ name: 'qa-synthetic' }, { name: 'qa-second' }] }
      if (url.pathname === '/api/profiles/active') response = { current: 'qa-synthetic', active: 'qa-synthetic' }
      if (url.pathname === '/api/jarvis/status' && mode === 'ready') response = status
      if (response === status && operations) response = { ...status, voice, approvals: { pending } }
      if (operations && url.pathname === '/api/jarvis/orchestrator/agent/mail') response = { agent_id: 'mail', status: 'completed', summary: 'Synthetic execution result', structured: {}, approval_required: [], missing_integrations: [], handoff: [] }
      if (operations && url.pathname === '/api/jarvis/approvals/qa-approval') { response = { ok: true, executed: false }; pending = [] }
      if (operations && url.pathname === '/api/audio/transcribe') response = { ok: true, transcript: 'Jarvis Status', provider: 'Synthetic QA STT' }
      if (operations && url.pathname === '/api/audio/speak') response = { ok: true, data_url: 'data:audio/wav;base64,' + wav.toString('base64'), mime_type: 'audio/wav', provider: 'Synthetic QA TTS' }
      if (url.pathname === '/api/memory') response = { active: 'builtin · synthetic QA', providers: [], builtin_files: { memory: 0, user: 0 } }
      if (url.pathname === '/api/memory/universe/clusters') response = { profile, root: { id: 'root', kind: 'universe', label: 'Synthetic QA', node_count: 0 }, clusters: [] }
      if (url.pathname === '/api/memory/universe/stats') response = { profile, nodes: 0, edges: 0, clusters: 0, by_kind: {}, cache_ttl_seconds: 15 }
      if (url.pathname === '/api/memory/universe/nodes') response = { profile, nodes: [], next_cursor: null, has_more: false }
      if (url.pathname === '/api/jarvis/orchestrator/plan') response = { schema: 'jarvis.multi_agent.v1', status: 'planned', tasks: [], results: [], approval_required: [], missing_integrations: [], consolidated: { summary: 'Synthetic plan: no actions executed.' } }
      const code = response ? 200 : url.pathname === '/api/jarvis/status' && mode === 'permission' ? 403 : 503
      await route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(response || { detail: 'Synthetic QA: source intentionally unavailable' }) })
    })
    const started = Date.now()
    await page.goto(base + '/jarvis?profile=qa-synthetic')
    await page.locator('.command-core[data-state="ONLINE"]').waitFor()
    const readyMs = Date.now() - started
    const initialHeavyChunks = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name).filter(name => /\/(three|xterm)-[^/]+\.js/.test(name)))
    assert.deepEqual(initialHeavyChunks, [], 'Command Center should not load 3D or terminal vendors before navigation')
    await page.evaluate(() => {
      const badge = document.createElement('div')
      badge.textContent = 'ISOLIERTE SYNTHETISCHE QA · KEINE LIVE-DATEN'
      Object.assign(badge.style, { position: 'fixed', bottom: '0', right: '0', zIndex: '99999', background: '#08283b', color: '#a5f3fc', fontSize: '12px', padding: '6px 12px', pointerEvents: 'none' })
      document.body.append(badge)
    })
    const sizes = [[1920,1080],[1536,960],[1440,900],[1280,800],[768,1024],[390,844]]
    const dimensions = []
    for (const [width,height] of sizes) {
      await page.setViewportSize({ width,height })
      await page.waitForTimeout(150)
      const size = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, shell: document.querySelector('.jarvis-command-shell').getBoundingClientRect().width }))
      assert.ok(size.scroll <= width, 'Horizontal page overflow at ' + width)
      const clipped = await page.locator('.command-workspace').evaluate(element => element.scrollWidth > element.clientWidth)
      assert.equal(clipped, false, 'Workspace overflow at ' + width)
      await page.screenshot({ path: output + '/command-' + width + '.png' })
      dimensions.push({ width, height, ...size })
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    const nav = page.getByRole('navigation', { name: 'Jarvis Workspaces' })
    await nav.getByRole('button', { name: 'Memory Intelligence' }).click()
    await page.waitForURL('**/jarvis/memory?profile=qa-synthetic')
    await page.getByRole('heading', { name: 'Memory Intelligence', exact: true }).waitFor()
    await page.goBack()
    await page.waitForURL('**/jarvis?profile=qa-synthetic')
    await page.goForward()
    await page.waitForURL('**/jarvis/memory?profile=qa-synthetic')
    await page.reload()
    await page.getByRole('heading', { name: 'Memory Intelligence', exact: true }).waitFor()
    for (const label of ['Agent Operations','Voice Intelligence','Live Runtime','Security Center','Settings','Command Center']) {
      await nav.getByRole('button', { name: label, exact: true }).click()
      await page.waitForTimeout(150)
      assert.equal(new URL(page.url()).searchParams.get('profile'), 'qa-synthetic')
      await page.screenshot({ path: output + '/' + label.toLowerCase().replaceAll(' ', '-') + '.png' })
    }
    await page.getByRole('textbox', { name: 'Jarvis Command Bar' }).fill('Synthetic planning request')
    await page.getByRole('textbox', { name: 'Jarvis Command Bar' }).press('Enter')
    await page.getByRole('textbox', { name: 'Jarvis Aufgabe' }).waitFor()
    assert.equal(await page.getByRole('textbox', { name: 'Jarvis Aufgabe' }).inputValue(), 'Synthetic planning request')
    assert.equal(requests.filter(r => r.method === 'POST').length, 0, 'Command bar must not execute')
    await page.getByText('Agent und Kontext', { exact: true }).click()
    await page.getByRole('button', { name: 'mail · QA Agent', exact: true }).click()
    await page.getByRole('button', { name: 'Planen', exact: true }).click()
    await page.getByText('Synthetic plan: no actions executed.', { exact: true }).waitFor()
    await page.locator('#jarvis-command-console').screenshot({ path: output + '/command-console.png' })
    assert.ok(requests.some(r => r.path === '/api/jarvis/orchestrator/plan' && r.profile === 'qa-synthetic'))
    assert.equal(requests.some(r => r.path.includes('/orchestrator/agent/') || r.path.endsWith('/orchestrator/run')), false)
    await page.getByRole('button', { name: 'Hermes Chat öffnen', exact: true }).click()
    await page.waitForURL('**/chat?profile=qa-synthetic')
    await page.locator('.xterm').first().waitFor({ timeout: 10000 }).catch(async error => {
      console.log('Synthetic chat diagnostics:', (await page.locator('body').innerText()).slice(-1500), failures)
      throw error
    })
    if (operations) {
      await page.goto(base + '/jarvis/agents?profile=qa-synthetic')
      await page.getByRole('heading', { name: 'Agentenkatalog' }).waitFor()
      await page.getByLabel('Agenten suchen').fill('mail')
      assert.equal(await page.locator('.operations-list button').count(), 1)
      await page.locator('.operations-list button').click()
      await page.getByRole('region', { name: 'Agenteninspektor' }).getByText('Synthetic test fixture', { exact: true }).waitFor()
      await page.getByLabel('Agenten suchen').fill('')
      await page.getByLabel('Fähigkeit / Skill', { exact: true }).selectOption('research-skill')
      assert.equal(await page.locator('.operations-list button').count(), 1)
      await page.getByLabel('Fähigkeit / Skill', { exact: true }).selectOption('all')
      await page.getByRole('textbox', { name: 'Jarvis Aufgabe' }).fill('Synthetic explicit task')
      const beforeRun = requests.filter(r => r.path.includes('/orchestrator/agent/')).length
      await page.getByRole('button', { name: 'Planen', exact: true }).click()
      await page.getByText('Synthetic plan: no actions executed.', { exact: true }).waitFor()
      assert.equal(requests.filter(r => r.path.includes('/orchestrator/agent/')).length, beforeRun)
      await page.getByRole('button', { name: 'Ausführen', exact: true }).click()
      await page.locator('.command-result').getByText('Synthetic execution result', { exact: true }).waitFor()
      assert.equal(requests.filter(r => r.path.includes('/orchestrator/agent/')).length, beforeRun + 1)
      await nav.getByRole('button', { name: 'Security Center', exact: true }).click()
      await page.getByRole('button', { name: 'Erlauben', exact: true }).click()
      assert.equal(requests.some(r => r.path.includes('/approvals/')), false)
      await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
      await page.getByRole('button', { name: 'Ablehnen', exact: true }).click()
      await page.getByRole('button', { name: 'Entscheidung bestätigen', exact: true }).click()
      await page.getByText('Keine externen Aktionen warten auf Freigabe.', { exact: true }).waitFor()
      await nav.getByRole('button', { name: 'Voice Intelligence', exact: true }).click()
      await page.getByRole('button', { name: 'Zuhören starten', exact: true }).click()
      await page.getByText('Aktiv', { exact: true }).waitFor()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Aufnahme beenden', exact: true }).click()
      await page.getByRole('region', { name: 'Sprachprotokoll' }).getByText('Jarvis Status', { exact: true }).waitFor()
      await page.getByRole('heading', { name: 'Bereit', exact: true }).waitFor()
      assert.ok(requests.some(r => r.path === '/api/audio/transcribe' && r.profile === 'qa-synthetic'))
      assert.ok(requests.some(r => r.path === '/api/audio/speak' && r.profile === 'qa-synthetic'))
      await page.getByRole('button', { name: 'Zuhören starten', exact: true }).click()
      await page.getByText('Aktiv', { exact: true }).waitFor()
      const uploads = requests.filter(r => r.path === '/api/audio/transcribe').length
      await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
      await page.getByText('Nicht aktiv', { exact: true }).waitFor()
      assert.equal(requests.filter(r => r.path === '/api/audio/transcribe').length, uploads)
      await page.evaluate(() => {
        const badge = document.createElement('div'); badge.textContent = 'ISOLIERTE SYNTHETISCHE QA · KEINE LIVE-DATEN'
        Object.assign(badge.style, { position: 'fixed', bottom: '0', right: '0', zIndex: '99999', background: '#08283b', color: '#a5f3fc', fontSize: '12px', padding: '6px' }); document.body.append(badge)
      })
      for (const module of ['Agent Operations', 'Voice Intelligence', 'Live Runtime', 'Security Center', 'Settings', 'Command Center']) {
        await nav.getByRole('button', { name: module, exact: true }).click()
        for (const [width, height] of [[1920,1080],[768,1024],[390,844]]) {
          await page.setViewportSize({ width, height }); await page.waitForTimeout(250)
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), module + ' overflow ' + width)
          const running = await page.locator('.jarvis-command-shell').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).length)
          assert.equal(running, 0, module + ' idle decoration must not animate')
          if (['Agent Operations', 'Voice Intelligence', 'Command Center'].includes(module)) await page.screenshot({ path: output + '/operations-' + module.replaceAll(' ', '-') + '-' + width + '.png', fullPage: true })
        }
      }
      await page.setViewportSize({ width: 1920, height: 1080 })
    }
    await page.goto(base + '/jarvis?profile=qa-second')
    await page.locator('.command-core[data-state="ONLINE"]').waitFor()
    assert.ok(requests.some(r => r.path === '/api/jarvis/status' && r.profile === 'qa-second'))
    assert.equal(await page.getByRole('textbox', { name: 'Jarvis Aufgabe' }).inputValue(), '')
    mode = 'permission'
    await page.reload()
    await page.getByRole('alert').filter({ hasText: 'Zugriff nicht erlaubt' }).waitFor()
    mode = 'offline'
    await page.reload()
    await page.locator('.command-core[data-state="OFFLINE"]').waitFor()
    await page.screenshot({ path: output + '/command-offline.png' })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const animations = await page.locator('.jarvis-command-shell').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)
    assert.equal(animations, 0)
    assert.deepEqual(failures, [])
    const results = { data: 'synthetic only', readyMs, initialHeavyChunks, dimensions, uncaughtErrors: failures, reducedMotionRunningAnimations: animations, checks: ['six responsive sizes','scoped navigation','back/forward','refresh','all seven workspaces','command transfer without POST','specialist plan without execution','existing xterm mounts; PTY mocked','profile draft reset','permission denied','offline','reduced motion'], backendCalls: 'intercepted; no real provider or PTY activity' }
    writeFileSync(output + '/results.json', JSON.stringify(results, null, 2))
    console.log(JSON.stringify(results, null, 2))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
