# Página y cobros simulados de Prospector

## Alcance
- Plan único de **$299 MXN por mes**, sin cuota de instalación; precio tentativo.
- Landing pública en `/contratar` dentro del frontend Vite existente. Las rutas restantes siguen mostrando la aplicación interna sin cambios funcionales.
- Formulario de **demostración** con validación básica. No captura tarjeta ni hace cobros.
- Simulador opcional de API en `billing-demo/server.mjs`, sin Mercado Pago, PocketBase, WAHA ni n8n.
- No hay acceso activado, cuentas creadas ni datos de clientes persistidos. El simulador guarda únicamente estados ficticios en memoria.

## Probar localmente
1. En `web/`, instalar dependencias según el README existente e iniciar Vite.
2. Visitar `http://localhost:5173/contratar`.
3. Para probar también la API simulada, ejecutar desde la raíz `node billing-demo/server.mjs`, y poner `VITE_BILLING_DEMO_API=http://127.0.0.1:8787` en el entorno de Vite (reiniciar Vite).
4. Completar el formulario con datos **ficticios**, nunca clientes reales. La pantalla de éxito solo indica fin del recorrido de prueba.

## Cómo pasar de demo a integración de pagos (pendiente, no implementado)
1. Añadir backend autenticado separado, con claves privadas del proveedor solo del lado servidor.
2. Definir `planes_servicio`, `clientes_servicio`, `suscripciones`, `pagos_servicio` y `eventos_pago` en PocketBase, con reglas de acceso privadas y unicidad/idempotencia.
3. Crear suscripción mediante la API de Mercado Pago (`POST /preapproval`) tras validar consentimiento, plan y precio del lado servidor, y recibir `init_point`.
4. Configurar webhooks y validar la firma antes de consultar el recurso real en Mercado Pago; manejar `subscription_preapproval` y `subscription_authorized_payment`.
5. Registrar pago aprobado de forma idempotente, confirmar importe/moneda/beneficiario y solo entonces habilitar onboarding por n8n/WAHA.
6. Implementar cancelaciones, renovaciones fallidas, alertas y conciliación periódica.
7. Verificar condiciones comerciales, privacidad, impuestos, términos y alcance antes de habilitar cobros reales.

## Seguridad y despliegue
- No desplegar el simulador a Internet ni usarlo como fuente de verdad de pagos.
- Nunca poner tokens de Mercado Pago o credenciales de PocketBase en variables `VITE_*`.
- Esta rama no cambia flujos existentes de Leads, Scraper, Campañas, n8n, PocketBase, WAHA ni contenedores de Tamales.
- Revisión y pruebas antes de fusionar a main y desplegar en Dell vieja.

Referencias:
- https://www.mercadopago.com.mx/developers/es/reference/online-payments/subscriptions/create-preapproval/post
- https://www.mercadopago.com.mx/developers/es/docs/subscriptions/subscription-management
- https://www.mercadopago.com.mx/developers/es/docs/adobe-commerce/resources/notifications/webhooks
