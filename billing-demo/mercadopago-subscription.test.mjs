import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareMpPreapproval, inspectMpSubscriptionResponse } from './mercadopago-subscription.mjs'

test('preapproval payload is monthly $299 MXN with no installation fee', () => {
  const payload = prepareMpPreapproval({
    payerEmail: 'CLIENTE@example.test', externalReference: 'prospector_demo_2026',
    backUrl: 'https://example.test/contratar/resultado',
  })
  assert.equal(payload.payer_email, 'cliente@example.test')
  assert.deepEqual(payload.auto_recurring, { frequency: 1, frequency_type: 'months', transaction_amount: 299, currency_id: 'MXN' })
  assert.equal(payload.card_token_id, undefined)
  assert.equal(payload.status, undefined)
  assert.equal(payload.setup_fee, undefined)
})

test('invalid callback, customer or ID is rejected', () => {
  const valid = { payerEmail: 'cliente@example.test', externalReference: 'demo_12345678', backUrl: 'https://example.test' }
  assert.throws(() => prepareMpPreapproval({ ...valid, backUrl: 'http://localhost:5173' }))
  assert.throws(() => prepareMpPreapproval({ ...valid, payerEmail: 'bad-email' }))
  assert.throws(() => prepareMpPreapproval({ ...valid, externalReference: 'bad reference' }))
})

test('authorized subscription response never activates the service without verified charge', () => {
  const inspected = inspectMpSubscriptionResponse({ id: 'preapproval-test', status: 'authorized', external_reference: 'demo_12345678' }, 'demo_12345678')
  assert.equal(inspected.referenceMatches, true)
  assert.equal(inspected.paymentConfirmed, false)
  assert.equal(inspected.activateService, false)
})
