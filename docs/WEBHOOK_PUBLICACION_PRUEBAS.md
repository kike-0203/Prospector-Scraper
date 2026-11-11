# Webhook de PRUEBAS de Mercado Pago para Prospector

Se creó un receptor separado del frontend y del simulador de cobros, en `billing-webhook-test/server.mjs`. **No está desplegado**. No registra pagos ni activa clientes.

## Contrato

- Método: `POST`
- Ruta: `/webhooks/mercadopago/test`
- Health: `GET /healthz`
- Firma validada con `x-signature`, `x-request-id`, `data.id`, HMAC-SHA256 y ventana de cinco minutos.
- Solo acepta `live_mode: false`; `payment`, `subscription_preapproval`, `subscription_authorized_payment`, `subscription_preapproval_plan`.
- En caso aceptado responde `200` y `payment_confirmed:false, service_activated:false`.
- Rechaza firma inválida, ID duplicado en query, tipo desconocido y mensajes productivos.
- No imprime cuerpos, firmas ni credenciales.
- No registra el evento en una base durable. Este receptor **no es apto para activar clientes ni conciliar dinero**.

## Ejecutar en una máquina de laboratorio autorizada

Requiere Node.js 22+ y una clave secreta privada de **webhooks de prueba**, guardada fuera de Git y fuera de variables `VITE_*`. No utilizar claves de producción.

`MP_TEST_WEBHOOK_SECRET=<secret de pruebas> MP_TEST_WEBHOOK_PORT=8790 node billing-webhook-test/server.mjs`

Escucha únicamente en `127.0.0.1:8790`, nunca directamente en Internet. Un proxy HTTPS separado en **dominio de pruebas** deberá terminar TLS y reenviar exclusivamente la ruta anterior a este proceso. Aplicar límites de tamaño, rate limit, logs sin datos personales y monitoreo de errores. No reutilizar la ruta de n8n abierta ni túneles temporales de campañas de Prospector.

La URL a capturar en la sección «Modo de prueba» de Mercado Pago será la **URL verificada tras despliegue**, con la ruta `/webhooks/mercadopago/test`. No utilizar valores inventados o placeholders. Mantener modo productivo sin configurar.

## Antes de registrar una URL de prueba

1. Reservar un subdominio HTTPS estable y comprobar DNS, certificado TLS, conectividad externa y ruta. No se ha realizado.
2. Proteger el secret de webhook de pruebas mediante archivos o gestor de secretos del servidor. No compartirlo por chat ni capturas.
3. Desplegar el receptor aislado y confirmar que `/healthz` y la ruta POST son accesibles mediante HTTPS externo.
4. Seleccionar en Mercado Pago **Planes y suscripciones** y **Pagos (legacy)**, para suscripciones sin plan asociado y los pagos asociados.
5. Enviar evento de prueba desde el panel y comprobar respuesta 200. Un 200 solo significa firma y forma validadas, no pago.
6. Para procesamiento futuro: consulta autenticada al proveedor, idempotencia durable por ID de evento/recurso, conciliación de dinero, retención de auditoría, seguridad multiinstancia y separación de permisos.

## Pruebas automáticas

`node --test billing-webhook-test/*.test.mjs`, incluidas en GitHub Actions, sin usar credenciales reales.

Fuente oficial:
https://www.mercadopago.com.mx/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks
