// Verificación criptográfica local de la firma documentada por Mercado Pago.
// No habilita cobros, no expone HTTP y no activa servicios.
// En producción: acompañar con consulta al proveedor, idempotencia durable y conciliación.
import { createHmac, timingSafeEqual } from 'node:crypto'

export function buildManifest({ dataId, requestId, ts }) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(String(dataId)) ||
      !/^[a-zA-Z0-9-]{1,128}$/.test(String(requestId)) ||
      !/^\d{10,13}$/.test(String(ts))) {
    throw new Error('Cabeceras de notificación inválidas')
  }
  // Mercado Pago especifica data.id del query string; se normaliza a minúsculas.
  return `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`
}

export function signFixture({ secret, dataId, requestId, ts }) {
  if (!secret) throw new Error('Secreto no proporcionado')
  return createHmac('sha256', secret).update(buildManifest({ dataId, requestId, ts })).digest('hex')
}

export function verifyMpWebhook({ secret, signature, requestId, dataId, nowMs = Date.now(), maxAgeMs = 300000 }) {
  if (!secret || !signature || !requestId || !dataId || !Number.isFinite(nowMs)) return false
  const parts = {}
  for (const part of String(signature).split(',')) {
    const [key, value] = part.trim().split('=')
    if (key && value && !parts[key]) parts[key] = value
  }
  if (!/^\d{10,13}$/.test(String(parts.ts || '')) || !/^[a-f0-9]{64}$/i.test(String(parts.v1 || ''))) return false
  const timestamp = Number(parts.ts) * (String(parts.ts).length === 10 ? 1000 : 1)
  if (!Number.isFinite(timestamp) || Math.abs(nowMs - timestamp) > maxAgeMs) return false
  try {
    const expected = Buffer.from(signFixture({ secret, dataId, requestId, ts: parts.ts }), 'hex')
    const received = Buffer.from(parts.v1, 'hex')
    return expected.length === received.length && timingSafeEqual(expected, received)
  } catch {
    return false
  }
}
