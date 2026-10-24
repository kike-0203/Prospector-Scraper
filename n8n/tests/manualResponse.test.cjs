const test = require('node:test')
const assert = require('node:assert/strict')
const workflow = require('../06_EnviarLeadManual.json')

const nodes = Object.fromEntries(workflow.nodes.map(node => [node.name, node]))
const run = ({ lead, followup, textFollowup, waha }) => {
  const records = {
    CODE_NormalizarEnvio: { lead_id: 'test-lead' },
    CODE_RevisarRespuestaWAHA: waha,
    PB_CrearSeguimiento: followup,
    PB_RegistrarTextoConfirmado: textFollowup,
  }
  const input = { first: () => ({ json: lead }) }
  const lookup = name => ({ first: () => ({ json: records[name] }) })
  return new Function('$input', '$', nodes.CODE_ConfirmarPersistencia.parameters.jsCode)(input, lookup)[0].json
}

const lead = { id: 'test-lead', estado: 'enviado_manual', estado_mensaje: 'enviado' }
const followup = { id: 'test-followup', lead_id: 'test-lead', resultado: 'enviado' }
const textFollowup = { id: 'text-followup', lead_id: 'test-lead', resultado: 'enviado', nota: 'Texto ID: test-message' }
const waha = { enviado_por_waha: true, waha_message_id: 'test-message', text_message_id: 'test-message', requiere_video: false, video_message_id: '' }

test('responds only after WAHA, lead and followup are confirmed', () => {
  assert.deepEqual(run({ lead, followup, textFollowup, waha }), {
    ok: true, confirmed: true, lead_id: 'test-lead',
    waha_message_id: 'test-message', seguimiento_id: 'test-followup',
    texto_enviado: true, texto_message_id: 'test-message',
    seguimiento_texto_id: 'text-followup',
    video_requerido: false, video_enviado: false,
    video_message_id: '', seguimiento_video_id: '',
  })
  assert.equal(nodes.RESP_EnviarLeadManual.parameters.responseBody, '={{ JSON.stringify($json) }}')
  assert.equal(workflow.connections.PB_MarcarLeadEnviado.main[0][0].node, 'CODE_ConfirmarPersistencia')
})

test('rejects a lead whose sent state was not saved', () => {
  assert.throws(() => run({
    lead: { ...lead, estado: 'envio_no_confirmado' }, followup, textFollowup, waha,
  }), /PocketBase no confirmo el estado/)
})

test('rejects a missing followup or WAHA message ID', () => {
  assert.throws(() => run({ lead, followup: { ...followup, id: '' }, textFollowup, waha }), /seguimiento/)
  assert.throws(() => run({ lead, followup, textFollowup, waha: { ...waha, waha_message_id: '' } }), /WAHA/)
})

test('requires a separate video ID persisted in the final followup', () => {
  const video = { ...waha, requiere_video: true, video_message_id: 'video-message' }
  assert.throws(() => run({ lead, followup, textFollowup, waha: video }), /video/)
  assert.equal(run({
    lead, followup: { ...followup, nota: 'Video ID: video-message' }, textFollowup, waha: video,
  }).video_message_id, 'video-message')
})

test('formats an HTTP failure before send without a normalizer output', () => {
  const input = { first: () => ({ json: {
    lead_id: 'test-lead', error: { message: '422 - session FAILED' },
  } }) }
  const lookup = name => ({
    isExecuted: name === 'CODE_NormalizarEnvio',
    first: () => name === 'Webhook_EnviarLeadManual'
      ? { json: { body: { lead_id: 'test-lead' } } }
      : undefined,
  })
  const result = new Function('$input', '$', '$execution',
    nodes.CODE_FormatearErrorEnvio.parameters.jsCode)(input, lookup, { id: 'test-execution' })[0].json
  assert.equal(result.lead_id, 'test-lead')
  assert.equal(result.retry_blocked, false)
  assert.equal(result.phase, 'validacion')
  assert.match(result.error.message, /session FAILED/)
})
