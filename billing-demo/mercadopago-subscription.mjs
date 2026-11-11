// Definición, validación y preparación OFFLINE de una suscripción Mercado Pago.
// No hay cliente HTTP real en este módulo: la creación está intencionalmente bloqueada.
export const MP_SUBSCRIPTION_PLAN = Object.freeze({
  reason: 'Prospector · Automatización WhatsApp mensual',
  frequency: 1,
  frequency_type: 'months',
  transaction_amount: 299,
  currency_id: 'MXN',
})

export function prepareMpPreapproval({ payerEmail, externalReference, backUrl }) {
  if (typeof payerEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
    throw new Error('Correo del pagador inválido')
  }
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(String(externalReference ?? ''))) {
    throw new Error('Referencia inválida')
  }
  let parsed
  try { parsed = new URL(backUrl) } catch { throw new Error('URL de retorno inválida') }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) {
    throw new Error('El retorno debe utilizar HTTPS público')
  }
  return Object.freeze({
    reason: MP_SUBSCRIPTION_PLAN.reason,
    external_reference: externalReference,
    payer_email: payerEmail.trim().toLowerCase(),
    auto_recurring: {
      frequency: MP_SUBSCRIPTION_PLAN.frequency,
      frequency_type: MP_SUBSCRIPTION_PLAN.frequency_type,
      transaction_amount: MP_SUBSCRIPTION_PLAN.transaction_amount,
      currency_id: MP_SUBSCRIPTION_PLAN.currency_id,
    },
    back_url: parsed.toString(),
    // Sin status autorizado, sin tarjeta, sin credencial y sin cobro.
  })
}

// No exportar una operación create() que pueda llamar API accidentalmente.
// El único modo habilitado es un contrato de solicitud offline.
export function inspectMpSubscriptionResponse(response, reference) {
  if (!response || typeof response !== 'object') throw new Error('Respuesta inválida')
  const status = String(response.status || '')
  return {
    providerId: String(response.id || ''),
    providerStatus: status,
    referenceMatches: String(response.external_reference || '') === reference,
    // IMPORTANTE: un preapproval autorizado NO demuestra que el primer cargo haya sido pagado.
    paymentConfirmed: false,
    activateService: false,
  }
}
