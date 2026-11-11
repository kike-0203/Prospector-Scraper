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

test('API local simula renovación, duplicados y cancelación sin cargos', async t => {
  const port = 21000 + Math.floor(Math.random() * 1000)
  const child = spawn(process.execPath, [path.join(root, 'billing-demo/server.mjs')], {
    env: { ...process.env, BILLING_DEMO_PORT: String(port), BILLING_DEMO_PB_WRITE: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  t.after(() => child.kill())
  const base = `http://127.0.0.1:${port}/api/billing/demo`
  let ready = false
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const probe = await fetch(base + '/state/invalid')
      if (probe.status === 404) { ready = true; break }
    } catch {}
    await delay(100)
  }
  assert.ok(ready, 'demo API did not start')
  const post = async (url, body) => {
    const response = await fetch(base + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: response.status, value: await response.json() }
  }
  const created = await post('/subscriptions', { negocio: 'Negocio ficticio', email: 'demo@example.test' })
  assert.equal(created.status, 201)
  const subscriptionId = created.value.id
  const events = [
    ['demo_event_0001', 'demo.payment_approved', 'demo_activa'],
    ['demo_event_0002', 'demo.renewal_approved', 'demo_activa'],
    ['demo_event_0003', 'demo.renewal_failed', 'demo_pago_pendiente'],
    ['demo_event_0004', 'demo.renewal_approved', 'demo_activa'],
    ['demo_event_0005', 'demo.cancel', 'demo_cancelada'],
  ]
  for (const [eventId, type, state] of events) {
    const result = await post('/events', { subscriptionId, eventId, type })
    assert.equal(result.status, 200)
    assert.equal(result.value.state, state)
    assert.equal(result.value.cargo_realizado, false)
    assert.equal(result.value.acceso_activado, false)
  }
  const repeated = await post('/events', { subscriptionId, eventId: 'demo_event_0005', type: 'demo.cancel' })
  assert.equal(repeated.status, 200)
  assert.equal(repeated.value.duplicated, true)
  const late = await post('/events', { subscriptionId, eventId: 'late_event_0006', type: 'demo.renewal_approved' })
  assert.equal(late.status, 409)
  const final = await fetch(base + '/state/' + subscriptionId).then(response => response.json())
  assert.equal(final.state, 'demo_cancelada')
  assert.equal(final.paidCycles, 3)
  assert.equal(final.events.length, 5)
})
