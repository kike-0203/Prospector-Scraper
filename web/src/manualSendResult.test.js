import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmManualSend, manualSendWarningForLead } from './manualSendResult.js'

const response = body => ({
  ok: true, status: 200,
  headers: { get: () => 'application/json; charset=utf-8' },
  text: async () => JSON.stringify(body),
})
const confirmedText = {
  ok: true, confirmed: true, lead_id: 'test-lead',
  waha_message_id: 'text-message', texto_enviado: true,
  texto_message_id: 'text-message', seguimiento_texto_id: 'text-followup',
  video_requerido: false, video_enviado: false, video_message_id: '',
  seguimiento_video_id: '', seguimiento_id: 'close-followup',
}
const savedLead = async () => ({
  id: 'test-lead', estado: 'enviado_manual', estado_mensaje: 'enviado',
})

test('accepts an independent text confirmation and persisted lead', async () => {
  const result = await confirmManualSend(response(confirmedText), 'test-lead', savedLead)
  assert.deepEqual(result, confirmedText)
})

test('accepts a complete independent text and video confirmation', async () => {
  const result = await confirmManualSend(response({
    ...confirmedText, video_requerido: true, video_enviado: true,
    video_message_id: 'video-message', seguimiento_video_id: 'video-followup',
  }), 'test-lead', savedLead)
  assert.equal(result.texto_message_id, 'text-message')
  assert.equal(result.video_message_id, 'video-message')
  assert.equal(result.seguimiento_texto_id, 'text-followup')
  assert.equal(result.seguimiento_video_id, 'video-followup')
})

test('rejects incomplete response before reading PocketBase', async () => {
  let loaded = false
  await assert.rejects(
    confirmManualSend(response({ ...confirmedText, video_enviado: true, video_requerido: true,
      video_message_id: '', seguimiento_video_id: '' }), 'test-lead', async () => { loaded = true }),
    /independent text, video and PocketBase confirmations/,
  )
  assert.equal(loaded, false)
})

test('rejects an empty HTTP 200 body as invalid JSON', async () => {
  await assert.rejects(
    confirmManualSend({ ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => '' }, 'test-lead', savedLead),
    /HTTP 200.*cuerpo vacío/,
  )
})

test('surfaces a structured workflow failure and execution ID', async () => {
  await assert.rejects(
    confirmManualSend({ ...response({ ok: false, error: { message: 'Falta telefono' }, execution_id: '14270' }), ok: false, status: 422 }, 'test-lead', savedLead),
    /HTTP 422: Falta telefono.*14270/,
  )
})

test('allows retry only for a confirmed failure before any send', async () => {
  const safe = {
    ok: false, confirmed: false, lead_id: 'test-lead',
    retry_blocked: false, phase: 'validacion', execution_id: '14296',
    error: { message: 'WAHA session unavailable before send' },
  }
  await assert.rejects(
    confirmManualSend({ ...response(safe), ok: false, status: 422 }, 'test-lead', savedLead),
    error => error.retryAllowed === true,
  )
  for (const unsafe of [
    { ...safe, retry_blocked: true },
    { ...safe, lead_id: 'another-lead' },
    { ...safe, phase: 'texto' },
  ]) {
    await assert.rejects(
      confirmManualSend({ ...response(unsafe), ok: false, status: 422 }, 'test-lead', savedLead),
      error => error.retryAllowed === false,
    )
  }
})

test('rejects when the lead was not persisted as sent', async () => {
  await assert.rejects(
    confirmManualSend(response(confirmedText), 'test-lead', async () => ({
      id: 'test-lead', estado: 'envio_no_confirmado', estado_mensaje: 'generado',
    })),
    /PocketBase/,
  )
})

test('keeps an old attempt warning off the next lead', () => {
  const warning = { leadId: 'first-lead', message: 'Review first attempt' }
  assert.equal(manualSendWarningForLead({ id: 'first-lead' }, warning, true), warning.message)
  assert.equal(manualSendWarningForLead({ id: 'next-lead', estado: 'nuevo' }, warning, false), '')
  assert.match(manualSendWarningForLead({ id: 'next-lead', estado: 'envio_no_confirmado' }, warning, false), /intento sin confirmar/)
  assert.match(manualSendWarningForLead({ id: 'first-lead', estado: 'enviado_manual', estado_mensaje: 'enviado' }, warning, true), /ya fue enviado/)
})
