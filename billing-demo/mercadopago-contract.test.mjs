import test from 'node:test'
import assert from 'node:assert/strict'
import { planProspectorDemo, interpretUnverifiedNotification, MERCADOPAGO_TEST_TOPICS } from './mercadopago-contract.mjs'

test('contrato comercial fijo $299 mensual sin instalación', () => {
  const plan = planProspectorDemo()
  assert.equal(plan.transaction_amount, 299)
  assert.equal(plan.frequency_type, 'months')
  assert.equal(plan.setup_fee, 0)
  assert.equal(plan.mode, 'disabled')
  assert.ok(MERCADOPAGO_TEST_TOPICS.includes('payment'))
})

test('un webhook sin verificar nunca habilita acceso', () => {
  const output = interpretUnverifiedNotification({ type: 'payment', data: { id: 'fake' }, status: 'approved' })
  assert.equal(output.verified, false)
  assert.equal(output.activate, false)
  assert.equal(output.paid, false)
})
