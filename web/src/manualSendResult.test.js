import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmManualSend, manualSendWarningForLead } from './manualSendResult.js'

const response = body => ({ ok: true, json: async () => body })
const confirmed = {
  ok: true,
  confirmed: true,
  lead_id: 'test-lead',
  waha_message_id: 'test-message',
  seguimiento_id: 'test-followup',
}

test('accepts a complete response and a persisted sent lead', async () => {
  const result = await confirmManualSend(response(confirmed), 'test-lead', async () => ({
    id: 'test-lead', estado: 'enviado_manual', estado_mensaje: 'enviado',
  }))
  assert.deepEqual(result, confirmed)
})

test('rejects an incomplete response before reading PocketBase', async () => {
  let loaded = false
  await assert.rejects(
    confirmManualSend(response({ ...confirmed, lead_id: '{{ literal }}' }), 'test-lead', async () => {
      loaded = true
    }),
    /confirmación completa/,
  )
  assert.equal(loaded, false)
})

test('rejects a response when the lead was not persisted as sent', async () => {
  await assert.rejects(
    confirmManualSend(response(confirmed), 'test-lead', async () => ({
      id: 'test-lead', estado: 'envio_no_confirmado', estado_mensaje: 'generado',
    })),
    /no quedó confirmado en PocketBase/,
  )
})

test('keeps an old attempt warning off the next lead', () => {
  const warning = { leadId: 'first-lead', message: 'Revisar el primer intento' }
  assert.equal(manualSendWarningForLead({ id: 'first-lead' }, warning, true), warning.message)
  assert.equal(manualSendWarningForLead({ id: 'next-lead', estado: 'nuevo' }, warning, false), '')
  assert.match(
    manualSendWarningForLead({ id: 'next-lead', estado: 'envio_no_confirmado' }, warning, false),
    /intento sin confirmar/,
  )
})
