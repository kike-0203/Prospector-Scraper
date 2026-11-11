import test from 'node:test'
import assert from 'node:assert/strict'
import { buildManifest, signFixture, verifyMpWebhook } from './mercadopago-webhook.mjs'

const secret = 'fake-webhook-secret-not-from-any-account'
const ts = '1794363000' // fixed fixture; tests provide matching clock
const nowMs = Number(ts) * 1000
const dataId = 'ABC12345'
const requestId = 'dummy-request-123'
const valid = signFixture({ secret, dataId, requestId, ts })

test('Mercado Pago manifest is deterministic and lowercases data.id', () => {
  assert.equal(buildManifest({ dataId, requestId, ts }), 'id:abc12345;request-id:dummy-request-123;ts:1794363000;')
  assert.equal(valid.length, 64)
})

test('valid signed test webhook passes; tampered signatures and IDs fail', () => {
  const options = { secret, dataId, requestId, nowMs }
  assert.equal(verifyMpWebhook({ ...options, signature: 'ts=' + ts + ',v1=' + valid }), true)
  assert.equal(verifyMpWebhook({ ...options, dataId: 'ABC12346', signature: 'ts=' + ts + ',v1=' + valid }), false)
  assert.equal(verifyMpWebhook({ ...options, requestId: 'other-id', signature: 'ts=' + ts + ',v1=' + valid }), false)
  assert.equal(verifyMpWebhook({ ...options, signature: 'ts=' + ts + ',v1=' + '0'.repeat(64) }), false)
  assert.equal(verifyMpWebhook({ ...options, signature: 'garbage' }), false)
})

test('rejects replayed timestamp outside five minute window', () => {
  assert.equal(verifyMpWebhook({ secret, dataId, requestId, signature: 'ts=' + ts + ',v1=' + valid, nowMs: nowMs + 400000 }), false)
})

test('missing key never passes', () => {
  assert.equal(verifyMpWebhook({ secret: '', dataId, requestId, signature: 'ts=' + ts + ',v1=' + valid, nowMs }), false)
})
