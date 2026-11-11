// Adaptador deliberadamente limitado a un PocketBase LOCAL y a datos ficticios.
// No requiere ni acepta credenciales de Mercado Pago.
const localHosts = new Set(['localhost', '127.0.0.1', '::1'])

export function validateLocalPocketBaseUrl(value) {
  const parsed = new URL(value)
  if (parsed.protocol !== 'http:' || !localHosts.has(parsed.hostname) ||
      parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('PocketBase de demostración solo permite HTTP local (localhost/127.0.0.1).')
  }
  return parsed.origin
}

export function buildDemoSubscription({ id, amountCentavos = 29900 }) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('Identificador inválido')
  if (amountCentavos !== 29900) throw new Error('Precio de demo no autorizado')
  return {
    referencia_demo: id,
    plan_codigo: 'prospector-mensual-299-demo',
    monto_centavos: amountCentavos,
    moneda: 'MXN',
    estado: 'demo_pendiente',
    pago_confirmado: false,
    acceso_activado: false,
  }
}

export async function saveDemoSubscription({ url, token, record, fetchImpl = fetch }) {
  const base = validateLocalPocketBaseUrl(url)
  if (!token || typeof token !== 'string') throw new Error('Falta credencial privada del servidor')
  const response = await fetchImpl(base + '/api/collections/suscripciones_demo/records', {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(record),
    signal: AbortSignal.timeout(6000),
  })
  if (!response.ok) throw new Error('PocketBase demo rechazó el registro (' + response.status + ')')
  const stored = await response.json()
  return { id: stored.id }
}
