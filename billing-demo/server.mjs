// Simulador aislado: sin Mercado Pago, sin PocketBase, sin WhatsApp y sin cobros.
// Ejecutar únicamente en un entorno de desarrollo local.
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const host = '127.0.0.1'
const port = Number(process.env.BILLING_DEMO_PORT || 8787)
const records = new Map()
const maxBody = 12_000

const respond = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin || ''
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    return respond(res, 403, { error: 'Solo orígenes locales de desarrollo.' })
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  if (req.url !== '/api/billing/demo/subscriptions' || req.method !== 'POST') {
    return respond(res, 404, { error: 'Ruta no disponible.' })
  }
  let size = 0; const chunks = []
  try {
    for await (const chunk of req) {
      size += chunk.length
      if (size > maxBody) return respond(res, 413, { error: 'Solicitud demasiado grande.' })
      chunks.push(chunk)
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const email = String(body.email || '').trim()
    const negocio = String(body.negocio || '').trim()
    if (!negocio || negocio.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond(res, 400, { error: 'Datos de demostración no válidos.' })
    }
    // Datos solo en memoria. No se devuelven datos personales.
    const id = randomUUID()
    records.set(id, { state: 'demo_pendiente', amount_centavos: 29900, currency: 'MXN' })
    return respond(res, 201, { id, estado: 'demo_pendiente', monto_centavos: 29900, moneda: 'MXN', cargo_realizado: false, acceso_activado: false })
  } catch {
    return respond(res, 400, { error: 'JSON inválido.' })
  }
})
server.listen(port, host, () => console.log(`Simulador sin cobros: http://${host}:${port}`))
