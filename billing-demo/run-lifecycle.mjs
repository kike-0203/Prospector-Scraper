// Ejecutar: node billing-demo/run-lifecycle.mjs
// No utiliza red ni escribe datos: únicamente muestra un ejemplo completamente ficticio.
import { randomUUID } from 'node:crypto'
import { createDemoLifecycle, applyDemoEvent, DEMO_EVENTS } from './lifecycle.mjs'

let state = createDemoLifecycle(randomUUID())
console.log(JSON.stringify({ step: 'solicitud', state: state.state, charged: state.charged }))
for (const [i, type] of [
  DEMO_EVENTS.PAYMENT_APPROVED,
  DEMO_EVENTS.RENEWAL_APPROVED,
  DEMO_EVENTS.RENEWAL_FAILED,
  DEMO_EVENTS.RENEWAL_APPROVED,
  DEMO_EVENTS.CANCEL,
].entries()) {
  state = applyDemoEvent(state, { id: 'demo_event_' + String(i + 1).padStart(4, '0'), type })
  console.log(JSON.stringify({ step: type, state: state.state, cycles: state.paidCycles, charged: state.charged, liveAccess: state.liveAccess }))
}
