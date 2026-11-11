import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { makeWebhookTestServer } from './server.mjs'
import { signFixture } from '../billing-demo/mercadopago-webhook.mjs'

const secret = 'lab-secret-key-not-real-test-abcdef'
const ts = '1794363000'
const nowMs = Number(ts) * 1000
const id = 'fake123'
const requestId = 'lab-request-0001'
const signature = 'ts=' + ts + ',v1=' + signFixture({ secret, dataId: id, requestId, ts })

test('receptor HTTP seguro acepta firmas ficticias y rechaza falsificaciones', async t => {
  const server = makeWebhookTestServer({ secret, clock: () => nowMs })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const base = 'http://127.0.0.1:' + server.address().port
  const health = await fetch(base + '/healthz').then(x => x.json())
  assert.equal(health.payments_enabled, false)
  const send = async (path, sig = signature, body = { type: 'subscription_authorized_payment', data: { id }, live_mode: false }) => {
    const r = await fetch(base + path, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': sig, 'x-request-id': requestId },
      body: JSON.stringify(body),
    })
    return { status: r.status, value: await r.json() }
  }
  const ok = await send('/webhooks/mercadopago/test?data.id=' + id)
  assert.equal(ok.status, 200)
  assert.equal(ok.value.payment_confirmed, false)
  assert.equal(ok.value.service_activated, false)
  assert.equal((await send('/webhooks/mercadopago/test?data.id=' + id, 'ts=' + ts + ',v1=' + '0'.repeat(64))).status, 401)
  assert.equal((await send('/webhooks/mercadopago/test?data.id=' + id, signature, { type: 'payment', data: { id }, live_mode: true })).status, 422)
  assert.equal((await send('/webhooks/mercadopago/test?data.id=' + id + '&data.id=' + id)).status, 400)
  assert.equal((await send('/webhooks/mercadopago/test?data.id=' + id, signature, { type: 'payment', data: { id: 'other' }, live_mode: false })).status, 422)
  assert.equal((await send('/webhooks/mercadopago/test?data.id=' + id, signature, { type: 'unexpected', data: { id }, live_mode: false })).status, 422)
})

test('sin clave privada de firma no arranca', () => {
  assert.throws(() => makeWebhookTestServer({ secret: '' }))
})
