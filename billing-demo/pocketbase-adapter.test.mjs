import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDemoSubscription, validateLocalPocketBaseUrl, saveDemoSubscription } from './pocketbase-adapter.mjs'

const id = '01234567-89ab-cdef-0123-456789abcdef'

test('rechaza conexiones de PocketBase no locales', () => {
  for (const candidate of ['https://pb.example.com', 'http://192.168.1.86:8090', 'https://127.0.0.1:8090', 'http://user:pass@127.0.0.1:8090']) {
    assert.throws(() => validateLocalPocketBaseUrl(candidate))
  }
  assert.equal(validateLocalPocketBaseUrl('http://127.0.0.1:8091'), 'http://127.0.0.1:8091')
})

test('registro simulado nunca marca pago ni servicio activos', () => {
  const payload = buildDemoSubscription({ id })
  assert.equal(payload.monto_centavos, 29900)
  assert.equal(payload.pago_confirmado, false)
  assert.equal(payload.acceso_activado, false)
  assert.equal(payload.estado, 'demo_pendiente')
  assert.throws(() => buildDemoSubscription({ id, amountCentavos: 1 }))
})

test('envía solo datos ficticios a la colección demo y mantiene credencial en servidor', async () => {
  let captured
  const saved = await saveDemoSubscription({
    url: 'http://127.0.0.1:8091',
    token: 'test-server-only-token',
    record: buildDemoSubscription({ id }),
    fetchImpl: async (url, options) => {
      captured = { url, options }
      return { ok: true, json: async () => ({ id: 'test-record' }) }
    },
  })
  assert.equal(saved.id, 'test-record')
  assert.match(captured.url, /suscripciones_demo\/records$/)
  assert.equal(captured.options.headers.Authorization, 'test-server-only-token')
  const payload = JSON.parse(captured.options.body)
  assert.equal(payload.pago_confirmado, false)
  assert.equal(payload.acceso_activado, false)
  assert.equal(payload.email, undefined)
})
