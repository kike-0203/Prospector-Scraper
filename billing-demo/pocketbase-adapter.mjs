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
    snapshot_json: { id, state: 'demo_pendiente', paidCycles: 0, failedCycles: 0, cancellation: false, events: [], seenEventIds: [], amount_centavos: 29900, currency: 'MXN', liveAccess: false, charged: false },
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

export async function findDemoLifecycle({ url, token, reference, fetchImpl = fetch }) {
  const base = validateLocalPocketBaseUrl(url)
  if (!token) throw new Error('Falta token de laboratorio')
  if (!/^[a-f0-9-]{36}$/.test(String(reference))) throw new Error('Referencia inválida')
  const query = new URLSearchParams({ filter: 'referencia_demo="' + reference + '"', perPage: '1' })
  const response = await fetchImpl(base + '/api/collections/suscripciones_demo/records?' + query, {
    headers: { Authorization: token }, signal: AbortSignal.timeout(6000),
  })
  if (!response.ok) throw new Error('Error al consultar PocketBase de laboratorio')
  const page = await response.json()
  const record = page.items?.[0]
  if (!record) return null
  if (!record.snapshot_json || record.snapshot_json.id !== reference) throw new Error('Snapshot demo inválido')
  return { recordId: record.id, snapshot: record.snapshot_json }
}

export async function writeDemoLifecycle({ url, token, recordId, snapshot, fetchImpl = fetch }) {
  const base = validateLocalPocketBaseUrl(url)
  if (!token || !/^[a-z0-9]{15}$/.test(String(recordId))) throw new Error('Identificador PB o token inválido')
  if (!snapshot || snapshot.liveAccess !== false || snapshot.charged !== false ||
      snapshot.amount_centavos !== 29900 || snapshot.currency !== 'MXN') throw new Error('Snapshot inseguro')
  const response = await fetchImpl(base + '/api/collections/suscripciones_demo/records/' + recordId, {
    method: 'PATCH',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snapshot_json: snapshot,
      estado: snapshot.state,
      pago_confirmado: false,
      acceso_activado: false,
    }),
    signal: AbortSignal.timeout(6000),
  })
  if (!response.ok) throw new Error('PocketBase de laboratorio rechazó el cambio (' + response.status + ')')
}
