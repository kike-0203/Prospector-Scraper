export async function confirmManualSend(response, leadId, loadLead) {
  if (!response.ok) {
    throw new Error(`n8n/WAHA devolvió HTTP ${response.status}. El resultado requiere revisión.`)
  }

  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('n8n respondió con un cuerpo que no es JSON válido.')
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
  if (warning.leadId === lead.id && warning.message) return warning.message
  if (lead.estado === 'envio_no_confirmado' || hasPendingAttempt) {
    return 'Este contacto tiene un intento sin confirmar. Revisa n8n y el chat antes de cualquier nuevo envío.'
  }
  return ''
}
