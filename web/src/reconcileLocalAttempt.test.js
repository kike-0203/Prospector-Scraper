import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { reconcileLocalAttempt } from './reconcileLocalAttempt.js'

const lead = { id: 'target-lead', estado: 'nuevo', estado_mensaje: 'generado' }
const before = '2026-10-24T16:30:00.000Z'
const leadHash = createHash('sha256').update(lead.id).digest('hex')

function setup({ attempt = '2026-10-24T16:20:00.000Z', hash = leadHash, followups = 0 } = {}) {
  const values = new Map([[`prospector-send:${lead.id}`, attempt]])
  return {
    storage: {
      getItem: key => values.get(key) || null,
      removeItem: key => values.delete(key),
    },
    values,
    getLead: async () => ({ ...lead, updated: '2026-10-21T06:37:46.740Z' }),
    getFollowups: async () => ({ totalItems: followups }),
    fetchManifest: async () => ({ ok: true, json: async () => ({
      reconciliations: [{ lead_sha256: hash, before }],
    }) }),
  }
}

test('clears only the verified old attempt for the matching lead', async () => {
  const input = setup()
  assert.equal(await reconcileLocalAttempt({ lead, ...input }), true)
  assert.equal(input.values.size, 0)
})

test('preserves later, unmatched, and followed-up attempts', async () => {
  for (const input of [
    setup({ attempt: '2026-10-24T16:31:00.000Z' }),
    setup({ hash: 'another-lead-hash' }),
    setup({ followups: 1 }),
  ]) {
    assert.equal(await reconcileLocalAttempt({ lead, ...input }), false)
    assert.equal(input.values.size, 1)
  }
})
