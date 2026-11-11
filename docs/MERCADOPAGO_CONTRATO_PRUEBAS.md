# Mercado Pago: contrato de pruebas sin cobros

## Confirmado en la documentación oficial (noviembre 2026)

- Suscripciones sin plan asociado: `POST /preapproval` con `payer_email`, `external_reference`, `auto_recurring` y `back_url`.
- Recurrencia propuesta: `frequency:1`, `frequency_type:"months"`, `transaction_amount:299`, `currency_id:"MXN"`.
- Webhooks: `x-signature` (`ts`, `v1`), `x-request-id`, `data.id` en query. Manifest HMAC-SHA256: `id:<data-id-minúsculas>;request-id:<x-request-id>;ts:<ts>;`.
- La suscripción `authorized` **no demuestra** el cargo. La factura/pago debe consultarse al proveedor y conciliarse antes de activar un servicio.
- Antes de salir a producción se requieren credenciales de prueba y pruebas oficiales del flujo de suscripciones para una cuenta mexicana.

Fuentes oficiales:
- https://www.mercadopago.com.mx/developers/es/reference/online-payments/subscriptions/create-preapproval/post
- https://www.mercadopago.com.mx/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks
- https://www.mercadopago.com.mx/developers/es/docs/subscriptions/integration-test/payment-approval

## Código nuevo

- `mercadopago-subscription.mjs`: prepara un payload de suscripción sin token ni solicitud de red. No crea la suscripción real.
- `mercadopago-webhook.mjs`: verifica la firma HMAC y la antigüedad del timestamp.
- `server.mjs`: `POST /api/billing/demo/mp-webhook?data.id=...` acepta **solo firmas de laboratorio** cuando `BILLING_DEMO_MP_WEBHOOK_SECRET` se define en el proceso Node; API limitada a loopback.
- Respuesta del webhook válido: HTTP 202 con `charge_confirmed:false` y `service_activated:false`.
- `mercadopago-webhook.test.mjs`, `mercadopago-subscription.test.mjs` y `server.test.mjs`: firman fixtures falsas y comprueban manipulación de ID/firma, ventana de tiempo y rechazo de inconsistencias.

## Límites de seguridad

Esto no es un webhook de producción. El endpoint no contacta Mercado Pago, no habilita servicios, no usa API token ni permite enlaces de pago.

**No** exponer este servidor a Internet ni utilizar secretos reales en el laboratorio. El secreto para la prueba es una cadena ficticia. La validación HMAC solo autentica el origen de la notificación en una integración real, pero no permite asumir que la operación fue aprobada; después debe consultarse a Mercado Pago y comprobar importe, moneda, cuenta vendedora, suscripción, cliente y estado. Se necesitan idempotencia durable, reconciliación ante fallos, protección de replay, mínimos privilegios, pruebas de carreras y monitoreo.

La carpeta `billing-demo/` no altera React operativo, WAHA, n8n ni PocketBase de la Dell vieja.

## Pendientes para integrar una cuenta de pruebas

1. Crear o acceder a una aplicación oficial de Mercado Pago de México y configurar credenciales de **prueba**, sin almacenarlas en GitHub ni variables Vite.
2. Confirmar que la funcionalidad de suscripción con el método elegido sea compatible con las cuentas de prueba.
3. Implementar un servicio backend autenticado y privado, registrar la solicitud antes de llamar al proveedor, y almacenar el ID remoto y su `init_point`.
4. Validar firma real y consultar cada recurso a Mercado Pago en modo de pruebas antes de marcar pagos, con estado sin activar por defecto.
5. Completar pruebas de aprobación, rechazo, cancelación, duplicados y conciliación/reintentos; auditar políticas comerciales y datos personales antes de habilitar cobros.

