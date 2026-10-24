import { useEffect, useRef, useState } from 'react'
import PocketBase from 'pocketbase'
import { confirmManualSend, manualSendWarningForLead } from './manualSendResult'
import { reconcileLocalAttempt } from './reconcileLocalAttempt'
import './App.css'

const PB_URL = import.meta.env.VITE_PB_URL;

const N8N_SEND_WEBHOOK =
  import.meta.env.VITE_N8N_SEND_WEBHOOK;

const N8N_SCRAPER_WEBHOOK =
  import.meta.env.VITE_N8N_SCRAPER_WEBHOOK;


// const PB_URL =
//  import.meta.env.VITE_PB_URL ||
//  'https://above-observe-sometimes-justice.trycloudflare.com'

// const N8N_SEND_WEBHOOK =
//  import.meta.env.VITE_N8N_SEND_WEBHOOK ||
//  'https://erupt-theater-sectional.ngrok-free.dev/webhook/enviar-lead-manual'

// const N8N_SCRAPER_WEBHOOK =
//  import.meta.env.VITE_N8N_SCRAPER_WEBHOOK ||
//  'https://erupt-theater-sectional.ngrok-free.dev/webhook/iniciar-scraper'

const pb = new PocketBase(PB_URL)
pb.autoCancellation(false)

pb.autoCancellation(false)


const filtroPendientes =
  `mensaje_generado=true && whatsapp_verificado=true && estado_mensaje="generado" && estado_whatsapp="verificado" && estado!="envio_no_confirmado"`

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
  const [stats, setStats] = useState({ pendientes: 0, enviados: 0, saltados: 0, revision: 0 })
  const [loading, setLoading] = useState(false)
  const [sendWarning, setSendWarning] = useState({ leadId: '', message: '' })
  const sendInProgress = useRef(false)
  const visibleSendWarning = manualSendWarningForLead(
    lead,
    sendWarning,
    lead && localStorage.getItem(`prospector-send:${lead.id}`),
  )
  const [tab, setTab] = useState('leads')
  const [nicho, setNicho] = useState('Tamales')
  const [alcaldia, setAlcaldia] = useState('Coyoacan')
  const [cantidadCps, setCantidadCps] = useState(5)
  const [scraperLoading, setScraperLoading] = useState(false)
  const [cpsDisponibles, setCpsDisponibles] = useState(0)
  const [ultimaCampana, setUltimaCampana] = useState(null)
  const campanaSeleccionadaRef = useRef(ultimaCampana)
  const seleccionarCampana = (campana) => {
    campanaSeleccionadaRef.current = campana
    setUltimaCampana(campana)
  }
  const [materialActivo, setMaterialActivo] = useState(null)
  const [campanas, setCampanas] = useState([])
  const [mostrarCampanas, setMostrarCampanas] = useState(false)
  const [campanasLoading, setCampanasLoading] = useState(false)
  const [campanaEditando, setCampanaEditando] = useState(null)
  const [tipoEnvioEdit, setTipoEnvioEdit] = useState('texto')
  const [archivoMaterial, setArchivoMaterial] = useState(null)
  const [guardandoCampana, setGuardandoCampana] = useState(false)
  const [mensajeCampana, setMensajeCampana] = useState('')


      const log = (txt) => {
      setLogs(prev => [`${new Date().toLocaleTimeString()} · ${txt}`, ...prev].slice(0, 8))
      }

      const agruparCampanas = (lista = []) => {
      const grupos = {}

      lista.forEach((c) => {
        const key = `${c.nicho || ''}|${c.alcaldia || ''}|${c.ciudad || ''}`

        if (!grupos[key]) {
          grupos[key] = {
            ...c,
            id_grupo: key,
            ids: [],
            total_busquedas: 0,
            busquedas_procesadas: 0,
            total_leads: 0,
          }
        }

        grupos[key].ids.push(c.id)
        grupos[key].total_busquedas += Number(c.total_busquedas || 0)
        grupos[key].busquedas_procesadas += Number(c.busquedas_procesadas || 0)
        grupos[key].total_leads += Number(c.total_leads || 0)

        if (!grupos[key].material_id && c.material_id) {
          grupos[key].material_id = c.material_id
          grupos[key].tipo_envio = c.tipo_envio
        }
      })

      return Object.values(grupos)
    }

    const campanasAgrupadas = agruparCampanas(campanas)

    const filtroPorCampana = (campana) => {
      const ids = campana?.ids?.length ? campana.ids : campana?.id ? [campana.id] : []

      if (ids.length === 0) return ' && campana_id=""'

      return ` && (${ids.map(id => `campana_id="${id}"`).join(' || ')})`
    }

 const cargarStats = async (campana = ultimaCampana) => {
  if (!campana) {
    setStats({ pendientes: 0, enviados: 0, saltados: 0, revision: 0 })
    return
  }
  try {
    const filtroCampana = filtroPorCampana(campana)

    const pendientes = await pb.collection('leads').getList(1, 1, {
      filter: `${filtroPendientes}${filtroCampana}`,
    })

    const enviados = await pb.collection('leads').getList(1, 1, {
      filter: `(estado="enviado_manual" || estado_mensaje="enviado")${filtroCampana}`,
    })

    const saltados = await pb.collection('leads').getList(1, 1, {
      filter: `(estado="saltado_manual" || estado_mensaje="saltado")${filtroCampana}`,
    })
    const revision = await pb.collection('leads').getList(1, 1, {
      filter: `estado="envio_no_confirmado"${filtroCampana}`,
    })

    if (campanaSeleccionadaRef.current === campana) {
      setStats({
        pendientes: pendientes.totalItems,
        enviados: enviados.totalItems,
        saltados: saltados.totalItems,
        revision: revision.totalItems,
      })
    }
  } catch (error) {
    console.error('ERROR STATS:', error)
    log(`❌ Error cargando contadores: ${error.message}`)
  }
}

 const cargarLead = async (campana = ultimaCampana) => {
  if (!campana) {
    setLead(null)
    setMensaje('')
    return
  }
  setLoading(true)
  log('🔎 Buscando lead pendiente')

  try {
    const filtroCampana = filtroPorCampana(campana)
    const res = await pb.collection('leads').getList(1, 1, {
      filter: `${filtroPendientes}${filtroCampana}`,
      sort: '-score',
    })

    console.log('RESPUESTA LEADS:', res)

    if (campanaSeleccionadaRef.current !== campana) return

    if (!res.items || res.items.length === 0) {
      setLead(null)
      setMensaje('')
      setSendWarning({ leadId: '', message: '' })
      log('🏁 No hay más leads pendientes')
      return
    }

    const item = res.items[0]

    console.log('LEAD CARGADO:', item)

    setLead(item)
    setMensaje(item.mensaje || '')
    setSendWarning(previous => previous.leadId === item.id
      ? previous
      : { leadId: item.id, message: '' })
    log(`📋 Lead: ${item.nombre || 'sin nombre'}`)
  } catch (error) {
    console.error('ERROR CARGAR LEAD:', error)
    log(`❌ Error cargando lead: ${error.message}`)
  } finally {
    if (campanaSeleccionadaRef.current === campana) setLoading(false)
  }
}

 const recargarLeads = async () => {
  const campana = ultimaCampana
  await Promise.all([cargarStats(campana), cargarLead(campana)])
 }

 const enviar = async () => {
  if (!lead || sendInProgress.current || lead.estado !== 'nuevo' || lead.estado_mensaje !== 'generado' ||
      localStorage.getItem(`prospector-send:${lead.id}`)) return
  const attemptedLead = lead
  sendInProgress.current = true
  setLoading(true)
  setSendWarning({ leadId: attemptedLead.id, message: '' })
  const attemptKey = `prospector-send:${attemptedLead.id}`
  localStorage.setItem(attemptKey, new Date().toISOString())
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)

  try {
    log('📤 Enviando WhatsApp...')

    const resp = await fetch(N8N_SEND_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        lead_id: attemptedLead.id,
        telefono: attemptedLead.telefono_limpio,
        mensaje,
        campana_id: attemptedLead.campana_id || ultimaCampana?.id || '',
      }),
    })

    await confirmManualSend(resp, attemptedLead.id, id => pb.collection('leads').getOne(id))

    localStorage.removeItem(attemptKey)
    log(`✅ Mensaje enviado: ${attemptedLead.nombre}`)
    log('🧾 Seguimiento registrado')
    await recargarLeads()
  } catch (error) {
    const detail = error.name === 'AbortError'
      ? 'La espera superó 45 segundos. Esto no demuestra que el mensaje haya fallado.'
      : error.message
    let safeRetry = false
    if (error.retryAllowed === true) {
      try {
        const current = await pb.collection('leads').getOne(attemptedLead.id)
        safeRetry = current.estado === 'nuevo' && current.estado_mensaje === 'generado'
        if (safeRetry) {
          localStorage.removeItem(attemptKey)
          setLead(current)
        }
      } catch {
        // A failed state check leaves the attempt blocked.
      }
    }
    if (safeRetry) {
      setSendWarning({ leadId: attemptedLead.id, message: '' })
      log(`⚠️ ${detail} No hubo envío; puedes intentarlo de nuevo.`)
    } else {
      const warning = `${detail} No vuelvas a pulsar Enviar hasta revisar la ejecución y el chat.`
      setSendWarning({ leadId: attemptedLead.id, message: warning })
      log(`❌ ${warning}`)
    }
  } finally {
    clearTimeout(timeout)
    sendInProgress.current = false
    setLoading(false)
  }
}

  



        const cargarCampanas = async () => {
          setCampanasLoading(true)

          try {
            const res = await pb.collection('campanas').getList(1, 10, {
              sort: '-created',
            })

            setCampanas(res.items)
          } catch {
            log('❌ Error cargando campañas')
          } finally {
            setCampanasLoading(false)
          }
        }

      const cargarInfoScraper = async () => {
      try {
        const cps = await pb.collection('catalogos_cp').getList(1, 1, {
          filter: `activo=true && usado=false && municipio="${alcaldia}"`,
        })

        const campanas = await pb.collection('campanas').getList(1, 1, {
          sort: '-created',
        })

        setCpsDisponibles(cps.totalItems)
        const campanaActual = campanas.items[0] || null
        setCampanas(campanas.items || [])
        seleccionarCampana(campanaActual)

        if (campanaActual?.material_id) {
          const material = await pb.collection('materiales_marketing').getOne(campanaActual.material_id)
          setMaterialActivo(material)
        } else {
          setMaterialActivo(null)
        }
      } catch {
        log('❌ Error cargando info scraper')
      }
    }

  const abrirEditorCampana = (campana) => {
      setCampanaEditando(campana)
      setTipoEnvioEdit(campana.tipo_envio || 'texto')
      setArchivoMaterial(null)
    }

    const guardarCampana = async () => {
        if (!campanaEditando) return

        setGuardandoCampana(true)
        setMensajeCampana('⏳ Guardando campaña...')

        try {
          let materialId = campanaEditando.material_id || ''

          if (archivoMaterial) {
            let tipo = 'video'

            if (archivoMaterial.type.startsWith('image')) tipo = 'imagen'
            if (archivoMaterial.type === 'application/pdf') tipo = 'pdf'
            if (archivoMaterial.type.startsWith('audio')) tipo = 'audio'

            const formData = new FormData()
            formData.append('nombre', archivoMaterial.name)
            formData.append('tipo', tipo)
            formData.append('archivo', archivoMaterial)
            formData.append('activo', 'true')
            formData.append('orden', '1')

            setMensajeCampana('📤 Subiendo material...')

            const material = await pb.collection('materiales_marketing').create(formData)
            materialId = material.id
          }

          setMensajeCampana('💾 Actualizando campaña...')

          const actualizada = await pb.collection('campanas').update(campanaEditando.id, {
            tipo_envio: tipoEnvioEdit,
            material_id: tipoEnvioEdit === 'texto' ? '' : materialId,
          })

          seleccionarCampana(actualizada)
          setCampanaEditando(null)
          setArchivoMaterial(null)

          await cargarCampanas()

          setMensajeCampana('✅ Campaña guardada correctamente')
          log('✅ Campaña actualizada')
        } catch (error) {
          console.error('ERROR GUARDAR CAMPAÑA:', error)
          setMensajeCampana(`❌ Error: ${error.message}`)
          log(`❌ Error guardando campaña: ${error.message}`)
        } finally {
          setGuardandoCampana(false)
        }
      }

  const iniciarScraper = async () => {
    setScraperLoading(true)

    log('🚀 Iniciando campaña')
    log(`📍 Seleccionando ${cantidadCps} códigos postales`)

    try {
      const resp = await fetch(
        N8N_SCRAPER_WEBHOOK,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nicho,
            alcaldia,
            cantidad_cps: cantidadCps,
          }),
        }
      )

      if (!resp.ok) throw new Error()

      log('✅ Flujo 1 iniciado')
      log('🌐 El pipeline continuará en n8n')
      log('📊 Revisa Campañas para ver el avance')
      await cargarInfoScraper()

    } catch {
      log('❌ Error iniciando scraper')
    } finally {
      setScraperLoading(false)
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
  cargarInfoScraper()
  }, [])

  useEffect(() => {
  if (!ultimaCampana) return

  cargarLead(ultimaCampana)
  cargarStats(ultimaCampana)
}, [ultimaCampana])

  

  useEffect(() => {
  cargarInfoScraper()
  }, [alcaldia])

  useEffect(() => {
  if (tab === 'campanas') {
    cargarCampanas()
  }
  }, [tab])

  useEffect(() => {
    if (!lead?.id) return
    let active = true
    let checking = false
    const check = async () => {
      if (checking || !localStorage.getItem(`prospector-send:${lead.id}`)) return
      checking = true
      try {
        const cleared = await reconcileLocalAttempt({
          lead,
          storage: localStorage,
          getLead: id => pb.collection('leads').getOne(id),
          getFollowups: id => pb.collection('seguimientos').getList(1, 1, {
            filter: `lead_id="${id}"`,
          }),
          fetchManifest: () => fetch('/reconciled-attempts.local.json', { cache: 'no-store' }),
        })
        if (active && cleared) {
          setSendWarning({ leadId: lead.id, message: '' })
          log('Intento sin envio reconciliado; este contacto vuelve a estar disponible.')
        }
      } catch {
        // Keep the attempt blocked when reconciliation cannot be verified.
      } finally {
        checking = false
      }
    }
    check()
    const timer = setInterval(check, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [lead])

  return (
    <main className="app">

        <div className="tabs">
          <button
            className={tab === 'leads' ? 'tab active' : 'tab'}
            onClick={() => setTab('leads')}
          >
            Leads
          </button>

          <button
            className={tab === 'scraper' ? 'tab active' : 'tab'}
            onClick={() => setTab('scraper')}
          >
            Scraper
          </button>

          <button
            className={tab === 'campanas' ? 'tab active' : 'tab'}
            onClick={() => setTab('campanas')}
          >
            Campañas
          </button>
        </div>

          {tab === 'leads' && (
              <>

      <section className="campaign-active">
        <span>Campaña activa</span>
        <strong>{ultimaCampana?.nicho || 'Sin campaña'}</strong>
        <p>{ultimaCampana?.alcaldia || 'Sin alcaldía'}</p>
        <p>
          Tipo: {ultimaCampana?.tipo_envio === 'texto_material'
            ? 'Texto + material'
            : 'Solo texto'}
        </p>
        <p>Material: {materialActivo?.nombre || 'Sin material'}</p>

        <button className="change-campaign" onClick={() => setMostrarCampanas(!mostrarCampanas)}>
          Cambiar campaña
        </button>

        {mostrarCampanas && (
          <div className="campaign-list">
            {campanasAgrupadas.map((c) => (
              <button
                key={c.id_grupo}

                onClick={async () => {
                  seleccionarCampana(c)
                  setMostrarCampanas(false)
                  setLead(null)
                  setMensaje('')

                  if (c.material_id) {
                    const material = await pb.collection('materiales_marketing').getOne(c.material_id)
                    setMaterialActivo(material)
                  } else {
                    setMaterialActivo(null)
                  }

                  log(`📣 Campaña activa: ${c.nicho}`)
                }}
              >
                {c.nicho} · {c.alcaldia}
              </button>
            ))}
          </div>
        )}

      </section>

      <section className="stats">
        <div><span>Pendientes</span><strong>{stats.pendientes}</strong></div>
        <div><span>Enviados</span><strong>{stats.enviados}</strong></div>
        <div><span>En revisión</span><strong>{stats.revision}</strong></div>
      </section>

      {!lead ? (
        <section className="card empty">
          <h1>Sin leads pendientes</h1>
          <button onClick={recargarLeads}>Recargar</button>
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

          {visibleSendWarning && <p role="alert">{visibleSendWarning}</p>}
          <button className="send" onClick={enviar} disabled={loading || Boolean(visibleSendWarning)}>
            {loading ? 'Procesando...' : '📲 ENVIAR WHATSAPP'}
          </button>

          <div className="actions">
            <button onClick={copiar} disabled={loading}>Copiar</button>
          </div>


        </section>
      )}

     <section className="logs">
      <div className="log-header">
        <strong>Log</strong>
        <button className="clear-log" onClick={() => setLogs([])}>
          limpiar
        </button>
      </div>

  {logs.length === 0 ? (
    <p>Sin actividad todavía</p>
  ) : (
    logs.map((l, i) => <p key={i}>{l}</p>)
  )}
</section>

          </>
        )}

        {tab === 'scraper' && (
      <section className="card">

        <h1>🚀 Scraper</h1>

        <label>Nicho</label>

        <select
          className="big-select"
          value={nicho}
          onChange={(e) => setNicho(e.target.value)}
        >
          <option>Tamales</option>
          <option>Talleres Mecánicos</option>
          <option>Talleres de motos</option>
          <option>Dentistas</option>
          <option>Tacos</option>
          <option>Pozolerias</option>
        </select>

        <label>Alcaldía</label>

        <select
          className="big-select"
          value={alcaldia}
          onChange={(e) => setAlcaldia(e.target.value)}
        >
          <option>Coyoacan</option>
        </select>

        <div className="scraper-info">
        <div>
          <span>CPs disponibles</span>
          <strong>{cpsDisponibles}</strong>
        </div>

        <div>
          <span>Última campaña</span>
          <strong>{ultimaCampana?.nombre || 'Sin campañas'}</strong>
        </div>

        <div>
          <span>Estado</span>
          <strong>{ultimaCampana?.estado || 'N/A'}</strong>
        </div>

        <div>
          <span>Leads</span>
          <strong>{ultimaCampana?.total_leads || 0}</strong>
        </div>
      </div>

        <label>Cantidad CPs</label>

        <div className="counter-row">

          <button
            onClick={() =>
              setCantidadCps(Math.max(1, cantidadCps - 1))
            }
          >
            -
          </button>

          <strong>{cantidadCps}</strong>

          <button
            onClick={() =>
              setCantidadCps(cantidadCps + 1)
            }
          >
            +
          </button>

        </div>


        <div className="scraper-log">

        <div className="log-header">
          <strong>Log scraper</strong>

          <button
            className="clear-log"
            onClick={() => setLogs([])}
          >
            limpiar
          </button>

        </div>

  {logs.length === 0 ? (
    <p>Sin actividad todavía</p>
  ) : (
    logs.map((l, i) => <p key={i}>{l}</p>)
  )}

</div>

        <button
          className="send"
          onClick={iniciarScraper}
          disabled={scraperLoading}
        >
          {scraperLoading
            ? 'Procesando...'
            : '🚀 Iniciar Scraping'}
        </button>

      </section>
    )}

      {tab === 'campanas' && (
      <section className="card">
        <h1>📊 Campañas</h1>

        <button
          className="send"
          onClick={cargarCampanas}
          disabled={campanasLoading}
        >
          {campanasLoading ? 'Cargando...' : 'Actualizar campañas'}
        </button>

        <div className="campanas-list">
          {campanas.length === 0 ? (
            <p>Sin campañas todavía</p>
          ) : (
            campanas.map((c) => (
              <div className="campana-item" key={c.id}>
                <strong>{c.nicho}</strong>
                <span>{c.alcaldia}</span>

                <p>Estado: {c.estado}</p>
                <p>CPs: {c.total_busquedas || 0}</p>
                <p>Procesadas: {c.busquedas_procesadas || 0}</p>
                <p>Leads: {c.total_leads || 0}</p>
                <button
                className="send"
                onClick={() => abrirEditorCampana(c)}
              >
                Configurar envío
              </button>
              </div>
            ))
          )}
        </div>
        {campanaEditando && (
          <div className="campana-editor">
            <h2>Configurar campaña</h2>

            <p><strong>{campanaEditando.nicho}</strong></p>
            <p>{campanaEditando.alcaldia}</p>

            <label>Tipo de envío</label>

            <select
              className="big-select"
              value={tipoEnvioEdit}
              onChange={(e) => setTipoEnvioEdit(e.target.value)}
            >
              <option value="texto">Solo texto</option>
              <option value="texto_material">Texto + material</option>
            </select>

            {tipoEnvioEdit === 'texto_material' && (
              <>
                <label>Subir material</label>
                <input
                  type="file"
                  accept="video/*,image/*,.pdf"
                  onChange={(e) => setArchivoMaterial(e.target.files[0])}
                />

                <p>
                  Archivo: {archivoMaterial?.name || 'Ninguno seleccionado'}
                </p>
              </>
            )}

            <button
            className="send"
            onClick={guardarCampana}
            disabled={guardandoCampana}
          >
            {guardandoCampana ? 'Guardando...' : 'Guardar cambios'}
          </button>

          {mensajeCampana && (
            <p className="campaign-status">
              {mensajeCampana}
            </p>
          )}

          <button
            className="undo"
            onClick={() => setCampanaEditando(null)}
          >
            Cancelar
          </button>



          </div>
        )}
      </section>
    )}

    </main>
  )
}

export default App

