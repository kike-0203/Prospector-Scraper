import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemoLifecycle, applyDemoEvent, DEMO_EVENTS } from './lifecycle.mjs'

const uuid = '01234567-89ab-cdef-0123-456789abcdef'
const event = (id, type) => ({ id, type })

test('simula contratación, primera aprobación, renovación, fallo, recuperación y cancelación', () => {
  let state = createDemoLifecycle(uuid)
  assert.equal(state.state, 'demo_pendiente')
  const trace = [
    ['event_0001', DEMO_EVENTS.PAYMENT_APPROVED, 'demo_activa'],
    ['event_0002', DEMO_EVENTS.RENEWAL_APPROVED, 'demo_activa'],
    ['event_0003', DEMO_EVENTS.RENEWAL_FAILED, 'demo_pago_pendiente'],
    ['event_0004', DEMO_EVENTS.RENEWAL_APPROVED, 'demo_activa'],
    ['event_0005', DEMO_EVENTS.CANCEL, 'demo_cancelada'],
  ]
  for (const [id, type, expected] of trace) {
    state = applyDemoEvent(state, event(id, type))
    assert.equal(state.state, expected)
    assert.equal(state.liveAccess, false)
    assert.equal(state.charged, false)
  }
  assert.equal(state.paidCycles, 3)
  assert.equal(state.failedCycles, 1)
  assert.equal(state.events.length, 5)
  assert.equal(state.amount_centavos, 29900)
})

test('idempotencia: retransmitir el mismo evento no cuenta dos pagos', () => {
  const first = applyDemoEvent(createDemoLifecycle(uuid), event('same_event_01', DEMO_EVENTS.PAYMENT_APPROVED))
  const repeat = applyDemoEvent(first, event('same_event_01', DEMO_EVENTS.PAYMENT_APPROVED))
  assert.equal(repeat.paidCycles, 1)
  assert.equal(repeat.events.length, 1)
  assert.equal(repeat.duplicated, true)
})

test('rechaza eventos fuera de orden y evita resucitar cancelaciones', () => {
  const initial = createDemoLifecycle(uuid)
  assert.throws(() => applyDemoEvent(initial, event('wrong_event_1', DEMO_EVENTS.RENEWAL_APPROVED)))
  const cancelled = applyDemoEvent(initial, event('cancel_event_1', DEMO_EVENTS.CANCEL))
  assert.throws(() => applyDemoEvent(cancelled, event('late_event_01', DEMO_EVENTS.PAYMENT_APPROVED)))
  assert.throws(() => applyDemoEvent(initial, event('invalid_event', 'payment.approved')))
})

test('estados sin acceso real aunque simulen pago aprobado', () => {
  const paid = applyDemoEvent(createDemoLifecycle(uuid), event('paid_event_01', DEMO_EVENTS.PAYMENT_APPROVED))
  assert.equal(paid.state, 'demo_activa')
  assert.equal(paid.liveAccess, false)
  assert.equal(paid.charged, false)
})
