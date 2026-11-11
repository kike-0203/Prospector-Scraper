// Prueba de integración REAL con un PocketBase efímero y vacío.
// Nunca usa bases de Prospector, ni credenciales del usuario.
// Requiere PB_BINARY apuntando al ejecutable descargado por CI.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { setTimeout as pause } from 'node:timers/promises'
import { buildDemoSubscription, saveDemoSubscription } from './pocketbase-adapter.mjs'

const binary = process.env.PB_BINARY

async function waitForApi(base, child) {
  for (let i = 0; i < 90; i++) {
    if (child.exitCode !== null) throw new Error('PocketBase terminó prematuramente')
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })
      if (response.ok) return
    } catch {}
    await pause(100)
  }
  throw new Error('PocketBase de laboratorio no inició')
}

async function stop(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    pause(3000).then(() => { child.kill('SIGKILL') }),
  ])
}

test('PocketBase real: guarda registros ficticios y los recupera después de reiniciar', {
  skip: !binary ? 'Se activa en GitHub Actions con PB_BINARY' : false,
  timeout: 45000,
}, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'prospector-pb-lab-'))
  const dataDir = join(dir, 'data')
  const email = 'lab@example.test'
  const password = randomBytes(24).toString('hex')
  const port = 24000 + Math.floor(Math.random() * 1000)
  const base = 'http://127.0.0.1:' + port
  let child
  t.after(async () => { await stop(child); await rm(dir, { recursive: true, force: true }) })

  execFileSync(binary, ['superuser', 'create', email, password, '--dir', dataDir], { timeout: 20000 })
  const start = async () => {
    child = spawn(binary, ['serve', '--http', '127.0.0.1:' + port, '--dir', dataDir], { stdio: 'ignore' })
    await waitForApi(base, child)
  }
  await start()

  const authResponse = await fetch(base + '/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  })
  assert.equal(authResponse.status, 200, 'Autenticación de superusuario de laboratorio')
  const { token } = await authResponse.json()
  const headers = { Authorization: token, 'Content-Type': 'application/json' }
  const fields = [
    { name: 'referencia_demo', type: 'text', required: true },
    { name: 'plan_codigo', type: 'text', required: true },
    { name: 'monto_centavos', type: 'number', required: true },
    { name: 'moneda', type: 'text', required: true },
    { name: 'estado', type: 'text', required: true },
    { name: 'pago_confirmado', type: 'bool' },
    { name: 'acceso_activado', type: 'bool' },
    { name: 'snapshot_json', type: 'json' },
  ]
  const collectionResponse = await fetch(base + '/api/collections', {
    method: 'POST', headers,
    body: JSON.stringify({
      name: 'suscripciones_demo', type: 'base', fields,
      indexes: ['CREATE UNIQUE INDEX idx_demo_reference ON suscripciones_demo (referencia_demo)'],
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    }),
  })
  const collectionData = await collectionResponse.json()
  assert.equal(collectionResponse.status, 200, JSON.stringify(collectionData))

  const record = buildDemoSubscription({ id: randomUUID() })
  const created = await saveDemoSubscription({ url: base, token, record })
  assert.ok(created.id)
  assert.equal(record.pago_confirmado, false)
  assert.equal(record.acceso_activado, false)

  // Comprobar que usuarios anónimos no pueden enumerar suscripciones.
  const anonymous = await fetch(base + '/api/collections/suscripciones_demo/records')
  assert.notEqual(anonymous.status, 200)

  await stop(child)
  await start()
  const again = await fetch(base + '/api/collections/suscripciones_demo/records/' + created.id, { headers })
  assert.equal(again.status, 200)
  const saved = await again.json()
  assert.equal(saved.referencia_demo, record.referencia_demo)
  assert.equal(saved.monto_centavos, 29900)
  assert.equal(saved.moneda, 'MXN')
  assert.equal(saved.estado, 'demo_pendiente')
  assert.equal(saved.pago_confirmado, false)
  assert.equal(saved.acceso_activado, false)
  assert.equal(saved.snapshot_json.state, 'demo_pendiente')

  // API de facturación ficticia: persistencia de eventos entre reinicios.
  const demoPort = port + 1100
  const demoBase = 'http://127.0.0.1:' + demoPort + '/api/billing/demo'
  let demoProcess
  const startDemo = async () => {
    demoProcess = spawn(process.execPath, [join(process.cwd(), 'billing-demo/server.mjs')], {
      env: {
        ...process.env, BILLING_DEMO_PORT: String(demoPort), BILLING_DEMO_PB_WRITE: '1',
        BILLING_DEMO_PB_URL: base, BILLING_DEMO_PB_TOKEN: token,
      }, stdio: 'ignore',
    })
    for (let i = 0; i < 40; i++) {
      try {
        const probe = await fetch(demoBase + '/state/invalid')
        if (probe.status === 404) return
      } catch {}
      await pause(100)
    }
    throw new Error('API demo no inició')
  }
  t.after(async () => stop(demoProcess))
  await startDemo()
  const postDemo = async (endpoint, payload) => {
    const response = await fetch(demoBase + endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    return { status: response.status, body: await response.json() }
  }
  const subscription = await postDemo('/subscriptions', { negocio: 'Laboratorio', email: 'test@example.test' })
  assert.equal(subscription.status, 201, JSON.stringify(subscription.body))
  const subId = subscription.body.id
  const approval = await postDemo('/events', { subscriptionId: subId, eventId: 'test_demo_approval', type: 'demo.payment_approved' })
  assert.equal(approval.status, 200, JSON.stringify(approval.body))
  assert.equal(approval.body.state, 'demo_activa')
  await stop(demoProcess)
  await startDemo()
  const afterRestart = await fetch(demoBase + '/state/' + subId)
  assert.equal(afterRestart.status, 200)
  const reloaded = await afterRestart.json()
  assert.equal(reloaded.state, 'demo_activa')
  assert.equal(reloaded.paidCycles, 1)
  const duplicate = await postDemo('/events', { subscriptionId: subId, eventId: 'test_demo_approval', type: 'demo.payment_approved' })
  assert.equal(duplicate.status, 200)
  assert.equal(duplicate.body.duplicated, true)
  assert.equal(duplicate.body.paidCycles, 1)
  const cancellation = await postDemo('/events', { subscriptionId: subId, eventId: 'test_demo_cancel_1', type: 'demo.cancel' })
  assert.equal(cancellation.status, 200)
  assert.equal(cancellation.body.state, 'demo_cancelada')
  await stop(demoProcess)
  await startDemo()
  const finalResponse = await fetch(demoBase + '/state/' + subId)
  const finalState = await finalResponse.json()
  assert.equal(finalState.state, 'demo_cancelada')
  assert.equal(finalState.liveAccess, false)
  assert.equal(finalState.charged, false)
})
