// Receptor HTTP para poner detrás de un proxy HTTPS en un entorno de pruebas.
// No consulta Mercado Pago, NO altera suscripciones y NO activa servicios.
// Requiere clave de Webhooks de pruebas suministrada en variable de entorno privada.
import { createServer } from 'node:http'
import { verifyMpWebhook } from '../billing-demo/mercadopago-webhook.mjs'

const TOPICS = new Set([
  'payment', 'subscription_preapproval', 'subscription_authorized_payment',
  'subscription_preapproval_plan',
])

export function makeWebhookTestServer({ secret, clock = () => Date.now() }) {
  if (typeof secret !== 'string' || secret.length < 16) throw new Error('Falta secreto de firma de TEST seguro')
  return createServer(async (req, res) => {
    const reply = (status, message) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(JSON.stringify(message))
    }
    if (req.method === 'GET' && req.url === '/healthz') {
      return reply(200, { ok: true, mode: 'test-only', payments_enabled: false })
    }
    if (req.method !== 'POST') return reply(404, { error: 'No disponible' })
    let target
    try { target = new URL(req.url, 'http://localhost') } catch { return reply(404, { error: 'No disponible' }) }
    if (target.pathname !== '/webhooks/mercadopago/test') return reply(404, { error: 'No disponible' })
    const resourceIds = target.searchParams.getAll('data.id')
    if (resourceIds.length !== 1) return reply(400, { error: 'Referencia invalida' })
    const rawId = resourceIds[0]
    if (!verifyMpWebhook({
      secret, dataId: rawId, signature: req.headers['x-signature'],
      requestId: req.headers['x-request-id'], nowMs: clock(),
    })) return reply(401, { error: 'Firma no valida' })
    const chunks = []
    let bytes = 0
    try {
      for await (const part of req) {
        bytes += part.length
        if (bytes > 16_384) return reply(413, { error: 'Notificacion demasiado grande' })
        chunks.push(part)
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!body || body.live_mode !== false || !TOPICS.has(body.type) ||
          String(body.data?.id || '').toLowerCase() !== rawId.toLowerCase()) {
        return reply(422, { error: 'Notificacion de prueba inconsistente' })
      }
      // Solo se confirma recepción. No se considera pago, no se escribe en PB,
      // no se envía WhatsApp y no se registran IDs/datos del remitente.
      return reply(200, { received: true, verified_signature: true, payment_confirmed: false, service_activated: false })
    } catch {
      return reply(400, { error: 'Notificacion invalida' })
    }
  })
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const secret = process.env.MP_TEST_WEBHOOK_SECRET
  const port = Number(process.env.MP_TEST_WEBHOOK_PORT || '8790')
  const host = '127.0.0.1'
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto incorrecto')
  makeWebhookTestServer({ secret }).listen(port, host, () => {
    console.log('Mercado Pago test webhook: 127.0.0.1:' + port + ' (sin cobros)')
  })
}
