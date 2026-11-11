// Contrato de la integración futura. No realiza solicitudes a Mercado Pago.
// No acepta token ni genera links de checkout, incluso si se invoca desde la API demo.
export const MERCADOPAGO_TEST_TOPICS = Object.freeze([
  'subscription_preapproval',
  'subscription_authorized_payment',
  'payment',
])

export function planProspectorDemo() {
  return {
    code: 'prospector-mensual-299-demo',
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: 299,
    currency_id: 'MXN',
    setup_fee: 0,
    provider: 'mercadopago',
    mode: 'disabled',
  }
}

// No confiar en el mensaje HTTP recibido para dar por aprobado un pago.
// En una futura integración real, validar firma, consultar API oficial y
// conciliar ID, monto, moneda, propietario, suscripción y pago con deduplicación.
export function interpretUnverifiedNotification() {
  return { verified: false, paid: false, activate: false, action: 'ignore' }
}
