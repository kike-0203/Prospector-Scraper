import { useState } from 'react'
import './ContratarDemo.css'

const PRICE_MXN = 299

const initialForm = { negocio: '', responsable: '', email: '', telefono: '', acepta: false }

export default function ContratarDemo() {
  const [form, setForm] = useState(initialForm)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (name, value) => setForm(previous => ({ ...previous, [name]: value }))

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!form.acepta) { setError('Confirma que entiendes que esta es una demostración sin cobro.'); return }
    if (!form.negocio.trim() || !form.responsable.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Completa el nombre del negocio, responsable y un correo válido.')
      return
    }
    setBusy(true)
    try {
      // El simulador es opcional. Nunca se invoca una pasarela real.
      const demoApi = import.meta.env.VITE_BILLING_DEMO_API
      if (demoApi) {
        const response = await fetch(`${demoApi.replace(/\/$/, '')}/api/billing/demo/subscriptions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            negocio: form.negocio.trim(),
            responsable: form.responsable.trim(),
            email: form.email.trim(),
            telefono: form.telefono.trim(),
          }),
        })
        if (!response.ok) throw new Error('No se pudo conectar con el simulador de suscripciones.')
      }
      // Sin VITE_BILLING_DEMO_API solo se visualiza el recorrido, sin enviar datos.
      setSent(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="prospector-sales">
    <header className="sales-header">
      <a href="/contratar" className="sales-brand"><span className="sales-brand-icon">✳</span> Prospector</a>
      <a href="#precio" className="sales-header-link">Ver precio</a>
    </header>
    <main>
      <section className="sales-hero">
        <div className="sales-pill">ATENCIÓN POR WHATSAPP PARA NEGOCIOS</div>
        <h1>Que tu negocio no deje conversaciones sin respuesta.</h1>
        <p>Organiza tu atención por WhatsApp con una automatización inicial y un acompañamiento sencillo. La configuración exacta se acuerda durante el alta.</p>
        <a className="sales-cta" href="#contratar">Conocer el plan <span aria-hidden="true">↗</span></a>
        <p className="sales-muted">Disponible como demostración. Sin cobros reales.</p>
      </section>
      <section className="sales-benefits" aria-label="Beneficios">
        <article><span>💬</span><h2>Respuestas oportunas</h2><p>Prepara mensajes para las preguntas más frecuentes.</p></article>
        <article><span>🗂️</span><h2>Menos desorden</h2><p>Organiza el seguimiento de las conversaciones.</p></article>
        <article><span>🛠️</span><h2>Configuración inicial</h2><p>Te ayudamos a definir tu flujo básico de atención.</p></article>
      </section>
      <section id="precio" className="sales-pricing">
        <div className="sales-pricing-copy">
          <div className="sales-pill">UN PLAN, SIN SORPRESAS</div>
          <h2>Un precio claro para comenzar.</h2>
          <p>Tarifa tentativa sujeta a definición final del alcance, impuestos y condiciones antes de habilitar la contratación real.</p>
        </div>
        <div className="sales-price-card">
          <strong>Plan Prospector</strong>
          <div className="sales-price">${PRICE_MXN} <small>MXN / mes</small></div>
          <p>Sin cobro de instalación.</p>
          <ul><li>Modelo de suscripción mensual</li><li>Configuración básica por definir</li><li>Cancelación y soporte según condiciones publicadas</li></ul>
          <a className="sales-cta" href="#contratar">Continuar en demostración</a>
        </div>
      </section>
      <section id="contratar" className="sales-signup">
        <div><div className="sales-pill">MODO DEMOSTRACIÓN</div><h2>Simula tu contratación</h2><p>El formulario no procesa pagos, no solicita tarjetas y no activa servicios.</p></div>
        {sent ? <div className="sales-success" role="status">
          <h3>Recorrido de demostración completado</h3>
          <p>Esta pantalla no confirma una compra, no crea una suscripción real y no activa ningún servicio.</p>
          <button type="button" onClick={() => { setSent(false); setForm(initialForm) }}>Volver a probar</button>
        </div> : <form onSubmit={submit} className="sales-form">
          <label>Nombre del negocio<input required maxLength="100" value={form.negocio} onChange={e => update('negocio', e.target.value)} autoComplete="organization" /></label>
          <label>Persona responsable<input required maxLength="100" value={form.responsable} onChange={e => update('responsable', e.target.value)} autoComplete="name" /></label>
          <label>Correo electrónico<input required type="email" maxLength="160" value={form.email} onChange={e => update('email', e.target.value)} autoComplete="email" /></label>
          <label>WhatsApp (opcional)<input type="tel" maxLength="25" value={form.telefono} onChange={e => update('telefono', e.target.value)} autoComplete="tel" /></label>
          <label className="sales-consent"><input type="checkbox" checked={form.acepta} onChange={e => update('acepta', e.target.checked)} /> Entiendo que este formulario es una prueba sin pago ni contratación real.</label>
          {error && <p className="sales-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? 'Simulando...' : 'Simular solicitud · $299 MXN/mes'}</button>
          <small>Sin tarjeta, sin cargo y sin renovación real.</small>
        </form>}
      </section>
      <section className="sales-faq"><h2>Preguntas frecuentes</h2>
        <details><summary>¿Tengo que pagar instalación?</summary><p>No. La propuesta comercial considera instalación inicial sin cargo para la configuración básica que se defina.</p></details>
        <details><summary>¿Ya puedo pagar aquí?</summary><p>No. Esta versión es exclusivamente una demostración. No hay conexión con Mercado Pago.</p></details>
        <details><summary>¿Puedo cancelar mi suscripción?</summary><p>El proceso y las condiciones de cancelación se publicarán antes de habilitar cobros reales.</p></details>
      </section>
    </main>
    <footer>Prospector · Prototipo comercial · Ningún cobro habilitado</footer>
  </div>
}
