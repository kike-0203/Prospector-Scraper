// Modelo determinista de pagos FICTICIOS. Ningún evento representa dinero real.
// Nunca transferir estos estados a colecciones de producción o habilitar servicios.
export const DEMO_PLAN = Object.freeze({ amount_centavos: 29900, currency: 'MXN', interval: 'month' })
export const DEMO_EVENTS = Object.freeze({
  PAYMENT_APPROVED: 'demo.payment_approved',
  RENEWAL_APPROVED: 'demo.renewal_approved',
  RENEWAL_FAILED: 'demo.renewal_failed',
  CANCEL: 'demo.cancel',
})

export function createDemoLifecycle(id) {
  if (!/^[a-f0-9-]{36}$/.test(String(id))) throw new Error('ID demo inválido')
  return {
    id, state: 'demo_pendiente', paidCycles: 0, failedCycles: 0,
    cancellation: false, events: [], seenEventIds: [], amount_centavos: DEMO_PLAN.amount_centavos,
    currency: DEMO_PLAN.currency, liveAccess: false, charged: false,
  }
}

export function applyDemoEvent(previous, event) {
  if (!previous || !event || typeof event !== 'object') throw new Error('Evento inválido')
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(String(event.id ?? ''))) throw new Error('ID de evento inválido')
  if (!Object.values(DEMO_EVENTS).includes(event.type)) throw new Error('Tipo de evento no soportado')
  if (previous.seenEventIds.includes(event.id)) return { ...previous, duplicated: true }

  const next = {
    ...previous, events: [...previous.events], seenEventIds: [...previous.seenEventIds],
    duplicated: false, charged: false, liveAccess: false,
  }
  if (next.cancellation) {
    // Una suscripción cancelada no se reactiva con eventos tardíos.
    if (event.type !== DEMO_EVENTS.CANCEL) throw new Error('Suscripción demo cancelada')
  } else if (event.type === DEMO_EVENTS.PAYMENT_APPROVED) {
    if (next.state !== 'demo_pendiente') throw new Error('Primera aprobación fuera de orden')
    next.state = 'demo_activa'
    next.paidCycles += 1
  } else if (event.type === DEMO_EVENTS.RENEWAL_APPROVED) {
    if (!['demo_activa','demo_pago_pendiente'].includes(next.state)) throw new Error('Renovación fuera de orden')
    next.state = 'demo_activa'
    next.paidCycles += 1
  } else if (event.type === DEMO_EVENTS.RENEWAL_FAILED) {
    if (next.state !== 'demo_activa') throw new Error('Fallo de renovación fuera de orden')
    next.state = 'demo_pago_pendiente'
    next.failedCycles += 1
  } else if (event.type === DEMO_EVENTS.CANCEL) {
    next.state = 'demo_cancelada'
    next.cancellation = true
  }
  next.seenEventIds.push(event.id)
  next.events.push({ id: event.id, type: event.type, state: next.state })
  return next
}
