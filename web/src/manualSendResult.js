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

  if (result?.ok !== true || result?.confirmed !== true ||
      result?.lead_id !== leadId ||
      typeof result?.waha_message_id !== 'string' || !result.waha_message_id.trim() ||
      typeof result?.seguimiento_id !== 'string' || !result.seguimiento_id.trim()) {
    throw new Error('n8n respondió sin una confirmación completa de WAHA y PocketBase.')
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
