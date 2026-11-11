import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('frontend isolates /contratar and does not redirect existing routes', async () => {
  const entry = await readFile(path.join(root, 'web/src/main.jsx'), 'utf8')
  assert.match(entry, /pathname\.replace/)
  assert.match(entry, /'\/contratar'/)
  assert.match(entry, /<ContratarDemo\s*\/>/)
  assert.match(entry, /<App\s*\/>/)
})

test('public demo contains no real payment integration', async () => {
  const form = await readFile(path.join(root, 'web/src/ContratarDemo.jsx'), 'utf8')
  const server = await readFile(path.join(root, 'billing-demo/server.mjs'), 'utf8')
  assert.match(form, /PRICE_MXN = 299/)
  assert.match(form, /Simular solicitud/)
  assert.doesNotMatch(form + server, /api\.mercadopago\.com|access_token|preapproval\/|WAHA_API_KEY/i)
})

test('local demo API returns a fictitious subscription, no payment', async t => {
  const port = 19000 + Math.floor(Math.random() * 1000)
  const processServer = spawn(process.execPath, [path.join(root, 'billing-demo/server.mjs')], {
    env: { ...process.env, BILLING_DEMO_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  t.after(() => processServer.kill())
  let ready = false
  for (let i = 0; i < 30; i++) {
    if (processServer.exitCode !== null) break
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/billing/demo/subscriptions`)
      if (response.status === 404) { ready = true; break }
    } catch {}
    await delay(100)
  }
  assert.ok(ready, 'demo server must start')
  const response = await fetch(`http://127.0.0.1:${port}/api/billing/demo/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ negocio: 'Prueba local', email: 'demo@example.test' })
  })
  assert.equal(response.status, 201)
  const payload = await response.json()
  assert.equal(payload.estado, 'demo_pendiente')
  assert.equal(payload.monto_centavos, 29900)
  assert.equal(payload.cargo_realizado, false)
  assert.equal(payload.acceso_activado, false)
})
