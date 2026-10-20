const test = require('node:test')
const assert = require('node:assert/strict')
const workflow = require('../06_EnviarLeadManual.json')

const nodes = Object.fromEntries(workflow.nodes.map(node => [node.name, node]))
const run = ({ lead, followup, waha }) => {
  const records = {
    CODE_NormalizarEnvio: { lead_id: 'test-lead' },
    CODE_RevisarRespuestaWAHA: waha,
    PB_CrearSeguimiento: followup,
  }
  const input = { first: () => ({ json: lead }) }
  const lookup = name => ({ first: () => ({ json: records[name] }) })
  return new Function('$input', '$', nodes.CODE_ConfirmarPersistencia.parameters.jsCode)(input, lookup)[0].json
}

const lead = { id: 'test-lead', estado: 'enviado_manual', estado_mensaje: 'enviado' }
const followup = { id: 'test-followup', lead_id: 'test-lead', resultado: 'enviado' }
const waha = { enviado_por_waha: true, waha_message_id: 'test-message' }

test('responds only after WAHA, lead and followup are confirmed', () => {
  assert.deepEqual(run({ lead, followup, waha }), {
    ok: true, confirmed: true, lead_id: 'test-lead',
    waha_message_id: 'test-message', seguimiento_id: 'test-followup',
  })
  assert.equal(nodes.RESP_EnviarLeadManual.parameters.responseBody, '={{ JSON.stringify($json) }}')
  assert.equal(workflow.connections.PB_MarcarLeadEnviado.main[0][0].node, 'CODE_ConfirmarPersistencia')
})

test('rejects a lead whose sent state was not saved', () => {
  assert.throws(() => run({
    lead: { ...lead, estado: 'envio_no_confirmado' }, followup, waha,
  }), /PocketBase no confirmo el estado/)
})

test('rejects a missing followup or WAHA message ID', () => {
  assert.throws(() => run({ lead, followup: { ...followup, id: '' }, waha }), /seguimiento/)
  assert.throws(() => run({ lead, followup, waha: { ...waha, waha_message_id: '' } }), /WAHA/)
})
