import { useEffect, useState } from 'react'
import PocketBase from 'pocketbase'
import './App.css'

const pb = new PocketBase(import.meta.env.VITE_PB_URL)

const filtroPendientes =
  `estado_mensaje="generado" && estado_whatsapp="verificado" && estado!="enviado_manual" && estado!="saltado_manual"`

const oportunidadLabels = {
  pagina_web: '🌐 Página web',
  mejorar_web: '🌐 Mejorar web',
  redes_sociales: '📱 Redes sociales',
  whatsapp_ia: '🤖 WhatsApp IA',
  optimizar_bot: '⚙️ Optimizar bot',
  captura_leads: '🎯 Captura leads',
  marketing_digital: '📣 Marketing',
}

function App() {
  const [lead, setLead] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({ pendientes: 0, enviados: 0, saltados: 0 })
  const [loading, setLoading] = useState(false)
  const [ultimoLead, setUltimoLead] = useState(null)

  const log = (txt) => {
    setLogs(prev => [`${new Date().toLocaleTimeString()} · ${txt}`, ...prev].slice(0, 4))
  }

  const cargarStats = async () => {
    try {
      const pendientes = await pb.collection('leads').getList(1, 1, { filter: filtroPendientes })
      const enviados = await pb.collection('leads').getList(1, 1, {
        filter: `estado="enviado_manual" || estado_mensaje="enviado"`,
      })
      const saltados = await pb.collection('leads').getList(1, 1, {
        filter: `estado="saltado_manual" || estado_mensaje="saltado"`,
      })

      setStats({
        pendientes: pendientes.totalItems,
        enviados: enviados.totalItems,
        saltados: saltados.totalItems,
      })
    } catch {
      log('❌ Error cargando contadores')
    }
  }

  const cargarLead = async () => {
    setLoading(true)
    log('🔄 Cargando siguiente')

    try {
      const res = await pb.collection('leads').getList(1, 1, {
        filter: filtroPendientes,
        sort: '-score',
      })

      const item = res.items[0]

      if (!item) {
        setLead(null)
        setMensaje('')
        log('📭 Sin leads pendientes')
        await cargarStats()
        return
      }

      setLead(item)
      setMensaje(item.mensaje || '')
      log(`📋 Lead: ${item.nombre}`)
      await cargarStats()
    } catch {
      log('❌ Error cargando lead')
    } finally {
      setLoading(false)
    }
  }

  const enviar = async () => {
    if (!lead) return
    setLoading(true)

    try {
      const resp = await fetch(import.meta.env.VITE_N8N_SEND_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          telefono: lead.telefono_limpio,
          mensaje,
        }),
      })

      if (!resp.ok) throw new Error('WAHA')

      setUltimoLead({ ...lead, mensaje })
      log(`✅ Enviado: ${lead.nombre}`)
      await cargarLead()
    } catch {
      log('❌ Error WAHA')
    } finally {
      setLoading(false)
    }
  }

  const saltar = async () => {
    if (!lead) return
    setLoading(true)

    try {
      await pb.collection('leads').update(lead.id, {
        estado: 'saltado_manual',
        estado_mensaje: 'saltado',
        ultimo_contacto: new Date().toISOString(),
      })

      setUltimoLead({ ...lead, fueSaltado: true })
      log(`⏭ Saltado: ${lead.nombre}`)
      await cargarLead()
    } catch {
      log('❌ Error al saltar')
    } finally {
      setLoading(false)
    }
  }

  const deshacer = async () => {
    if (!ultimoLead) return
    setLoading(true)

    try {
      await pb.collection('leads').update(ultimoLead.id, {
        estado: 'nuevo',
        estado_mensaje: 'generado',
        fecha_envio: '',
        ultimo_contacto: '',
      })

      log(`↩️ Deshecho: ${ultimoLead.nombre}`)
      setUltimoLead(null)
      await cargarLead()
    } catch {
      log('❌ Error al deshacer')
    } finally {
      setLoading(false)
    }
  }

  const copiar = async () => {
    await navigator.clipboard.writeText(mensaje)
    log('📋 Mensaje copiado')
  }

  const scoreEmoji = (score = 0) => {
    if (score >= 80) return '🟢'
    if (score >= 60) return '🟡'
    return '🔴'
  }

  const oportunidades = (lead?.oportunidades || '')
    .split(',')
    .map(op => op.trim())
    .filter(Boolean)
    .slice(0, 4)

  useEffect(() => {
    cargarLead()
  }, [])

  return (
    <main className="app">
      <section className="stats">
        <div><span>Pendientes</span><strong>{stats.pendientes}</strong></div>
        <div><span>Enviados</span><strong>{stats.enviados}</strong></div>
        <div><span>Saltados</span><strong>{stats.saltados}</strong></div>
      </section>

      {!lead ? (
        <section className="card empty">
          <h1>Sin leads pendientes</h1>
          <button onClick={cargarLead}>Recargar</button>
        </section>
      ) : (
        <section className="card">
          <div className="top">
            <span className="score">{scoreEmoji(lead.score)} Score {lead.score || 0}</span>
            <span className="wa">WA verificado ✅</span>
          </div>

          <h1>{lead.nombre}</h1>
          <p className="meta">{lead.telefono}</p>

          <div className="chips">
            {oportunidades.map((op, i) => (
              <span key={i}>{oportunidadLabels[op] || op}</span>
            ))}
          </div>

          <textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />

          <button className="send" onClick={enviar} disabled={loading}>
            {loading ? 'Procesando...' : '📲 ENVIAR WHATSAPP'}
          </button>

          <div className="actions">
            <button onClick={copiar} disabled={loading}>Copiar</button>
            <button onClick={saltar} disabled={loading}>Saltar</button>
          </div>

          {ultimoLead && (
            <button className="undo" onClick={deshacer} disabled={loading}>
              ↩ Deshacer último
            </button>
          )}
        </section>
      )}

      <section className="logs">
        <strong>Log</strong>
        {logs.map((l, i) => <p key={i}>{l}</p>)}
      </section>
    </main>
  )
}

export default App