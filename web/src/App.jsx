import { useEffect, useState } from 'react'
import PocketBase from 'pocketbase'
import './App.css'
import './debug-env.js'

const PB_URL = import.meta.env.VITE_PB_URL;

const N8N_SEND_WEBHOOK =
  import.meta.env.VITE_N8N_SEND_WEBHOOK;

const N8N_SCRAPER_WEBHOOK =
  import.meta.env.VITE_N8N_SCRAPER_WEBHOOK;

console.log("ENV:", import.meta.env);
console.log("VITE_PB_URL:", import.meta.env.VITE_PB_URL);
console.log("VITE_N8N_SEND_WEBHOOK:", import.meta.env.VITE_N8N_SEND_WEBHOOK);
console.log("VITE_N8N_SCRAPER_WEBHOOK:", import.meta.env.VITE_N8N_SCRAPER_WEBHOOK);

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

console.log('PB URL:', PB_URL)
pb.autoCancellation(false)

console.log('PB URL:', import.meta.env.VITE_PB_URL)

const filtroPendientes =
  `mensaje_generado=true && whatsapp_verificado=true && estado_mensaje="generado" && estado_whatsapp="verificado"`

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
  const [tab, setTab] = useState('leads')
  const [nicho, setNicho] = useState('Tamales')
  const [alcaldia, setAlcaldia] = useState('Coyoacan')
  const [cantidadCps, setCantidadCps] = useState(5)
  const [scraperLoading, setScraperLoading] = useState(false)
  const [cpsDisponibles, setCpsDisponibles] = useState(0)
  const [ultimaCampana, setUltimaCampana] = useState(null)
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

  const cargarStats = async (campanaId = ultimaCampana?.id) => {
    try {
      const filtroCampana = campanaId ? ` && campana_id="${campanaId}"` : ''

      const pendientes = await pb.collection('leads').getList(1, 1, {
        filter: `${filtroPendientes}${filtroCampana}`,
      })

      const enviados = await pb.collection('leads').getList(1, 1, {
        filter: `(estado="enviado_manual" || estado_mensaje="enviado")${filtroCampana}`,
      })

      const saltados = await pb.collection('leads').getList(1, 1, {
        filter: `(estado="saltado_manual" || estado_mensaje="saltado")${filtroCampana}`,
      })

      setStats({
        pendientes: pendientes.totalItems,
        enviados: enviados.totalItems,
        saltados: saltados.totalItems,
      })
    } catch (error) {
      console.error('ERROR STATS:', error)
      log(`❌ Error cargando contadores: ${error.message}`)
    }
  }

 const cargarLead = async () => {
  setLoading(true)
  log('🔎 Buscando lead pendiente')

  try {
    const filtroCampana = ultimaCampana?.id
      ? ` && campana_id="${ultimaCampana.id}"`
      : ''

    const res = await pb.collection('leads').getList(1, 1, {
      filter: `${filtroPendientes}${filtroCampana}`,
      sort: '-score',
    })

    console.log('RESPUESTA LEADS:', res)

    if (!res.items || res.items.length === 0) {
      setLead(null)
      setMensaje('')
      log('🏁 No hay más leads pendientes')
      return
    }

    const item = res.items[0]

    console.log('LEAD CARGADO:', item)

    setLead(item)
    setMensaje(item.mensaje || '')
    log(`📋 Lead: ${item.nombre || 'sin nombre'}`)
  } catch (error) {
    console.error('ERROR CARGAR LEAD:', error)
    log(`❌ Error cargando lead: ${error.message}`)
  } finally {
    setLoading(false)
  }
}

 const enviar = async () => {
  if (!lead) return
  setLoading(true)

  try {
    log('📤 Enviando WhatsApp...')

    const resp = await fetch(N8N_SEND_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: lead.id,
        telefono: lead.telefono_limpio,
        mensaje,
        campana_id: ultimaCampana?.id || lead.campana_id || '',
      }),
    })

    if (!resp.ok) throw new Error('WAHA')

    log(`✅ Mensaje enviado: ${lead.nombre}`)
    log('🧾 Seguimiento registrado')
    await cargarStats(ultimaCampana?.id)
    await cargarLead()
  } catch (error) {
    log(`❌ Error enviando: ${error.message}`)
  } finally {
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
        setUltimaCampana(campanaActual)

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

          setUltimaCampana(actualizada)
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

  cargarLead()
  cargarStats(ultimaCampana.id)
}, [ultimaCampana])

  

  useEffect(() => {
  cargarInfoScraper()
  }, [alcaldia])

  useEffect(() => {
  if (tab === 'campanas') {
    cargarCampanas()
  }
  }, [tab])

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
            {campanas.map((c) => (
              <button
                key={c.id}

                onClick={async () => {
                  setUltimaCampana(c)
                  setMostrarCampanas(false)
                  setLead(null)
                  setMensaje('')

                  if (c.material_id) {
                    const material = await pb.collection('materiales_marketing').getOne(c.material_id)
                    setMaterialActivo(material)
                  } else {
                    setMaterialActivo(null)
                  }

                  await cargarStats(c.id)

                  const filtroCampana = ` && campana_id="${c.id}"`
                  const res = await pb.collection('leads').getList(1, 1, {
                    filter: `${filtroPendientes}${filtroCampana}`,
                    sort: '-score',
                  })

                  if (res.items.length > 0) {
                    const item = res.items[0]
                    setLead(item)
                    setMensaje(item.mensaje || '')
                    log(`📣 Campaña activa: ${c.nicho}`)
                    log(`📋 Lead: ${item.nombre || 'sin nombre'}`)
                  } else {
                    log(`📣 Campaña activa: ${c.nicho}`)
                    log('🏁 No hay leads pendientes en esta campaña')
                  }
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

