export async function confirmManualSend(response, leadId, loadLead) {
  let result
  const contentType = response.headers?.get?.('content-type') || 'desconocido'
  const body = await response.text()
  try {
    result = JSON.parse(body)
  } catch {
    throw new Error(`n8n devolvió HTTP ${response.status}, Content-Type ${contentType}, ` +
      `${body.length === 0 ? 'cuerpo vacío' : 'cuerpo no JSON'}. Revisa la ejecución antes de reenviar.`)
  }

  if (!response.ok || result?.ok === false) {
    const detail = typeof result?.error?.message === 'string'
      ? result.error.message
      : 'El resultado requiere revisión.'
    const execution = result?.execution_id ? ` Ejecución ${result.execution_id}.` : ''
    const failure = new Error(`n8n devolvió HTTP ${response.status}: ${detail}${execution}`)
    failure.retryAllowed = response.status === 422 && result?.ok === false &&
      result?.confirmed === false && result?.lead_id === leadId &&
      result?.retry_blocked === false && result?.phase === 'validacion' &&
      typeof result?.execution_id === 'string' && result.execution_id.length > 0
    throw failure
  }

  const hasId = value => typeof value === 'string' && value.trim().length > 0
  if (result?.ok !== true || result?.confirmed !== true ||
      result?.lead_id !== leadId ||
      result?.texto_enviado !== true || !hasId(result?.texto_message_id) ||
      result?.waha_message_id !== result?.texto_message_id ||
      !hasId(result?.seguimiento_texto_id) ||
      typeof result?.video_requerido !== 'boolean' ||
      typeof result?.video_enviado !== 'boolean' ||
      result.video_enviado !== result.video_requerido ||
      !hasId(result?.seguimiento_id) ||
      (result.video_enviado && (!hasId(result?.video_message_id) || !hasId(result?.seguimiento_video_id))) ||
      (!result.video_enviado && (result?.video_message_id !== '' || result?.seguimiento_video_id !== ''))) {
    throw new Error('n8n response lacks independent text, video and PocketBase confirmations.')
  }

  const saved = await loadLead(leadId)
  if (saved.id !== leadId || saved.estado !== 'enviado_manual' || saved.estado_mensaje !== 'enviado') {
    throw new Error('WAHA confirmó el mensaje, pero el estado del lead no quedó confirmado en PocketBase.')
  }

  return result
}

export function manualSendWarningForLead(lead, warning, hasPendingAttempt) {
  if (!lead) return ''
  if (lead.estado === 'enviado_manual' && lead.estado_mensaje === 'enviado') {
    return 'Este contacto ya fue enviado.'
  }
  if (warning.leadId === lead.id && warning.message) return warning.message
  if (lead.estado === 'envio_no_confirmado' || hasPendingAttempt) {
    return 'Este contacto tiene un intento sin confirmar. Revisa n8n y el chat antes de cualquier nuevo envío.'
  }
  return ''
}
