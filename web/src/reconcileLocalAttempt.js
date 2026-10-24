export async function reconcileLocalAttempt({ lead, storage, getLead, getFollowups, fetchManifest }) {
  if (!lead || lead.estado !== 'nuevo' || lead.estado_mensaje !== 'generado') return false
  const key = `prospector-send:${lead.id}`
  const attemptedAt = storage.getItem(key)
  if (!attemptedAt || !Number.isFinite(Date.parse(attemptedAt))) return false

  const response = await fetchManifest()
  if (!response.ok) return false
  const manifest = await response.json()
  const bytes = new TextEncoder().encode(lead.id)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  const leadHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const reconciliation = manifest.reconciliations?.find(entry =>
    entry.lead_sha256 === leadHash && Date.parse(attemptedAt) <= Date.parse(entry.before))
  if (!reconciliation) return false

  const [current, followups] = await Promise.all([getLead(lead.id), getFollowups(lead.id)])
  if (current.id !== lead.id || current.estado !== 'nuevo' ||
      current.estado_mensaje !== 'generado' || followups.totalItems !== 0 ||
      Date.parse(current.updated) > Date.parse(reconciliation.before)) return false

  if (storage.getItem(key) !== attemptedAt) return false
  storage.removeItem(key)
  return true
}
