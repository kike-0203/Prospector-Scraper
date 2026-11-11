# Integración opcional con PocketBase de pruebas

**No aplicar sobre PocketBase operativo (Dell vieja ni Dell nueva).** Antes de desplegar una integración real, respaldar y verificar colecciones y reglas. Este módulo exige URL HTTP local para evitar escrituras accidentales en servidores remotos.

## Colección dedicada de laboratorio

Crear manualmente en una **instancia PocketBase de laboratorio aislada** una colección base llamada `suscripciones_demo` con API rules de `list/view/create/update/delete` bloqueadas (vacías no, **null** o locked en panel). Campos:
- `referencia_demo`: text, required, unique index; UUID de prueba
- `plan_codigo`: text, required
- `monto_centavos`: number, required
- `moneda`: text, required
- `estado`: text, required
- `pago_confirmado`: bool
- `acceso_activado`: bool
- `snapshot_json`: json, historial ficticio de eventos e identificadores usados

No guardar nombre, correo, teléfono ni referencias de leads reales en la demo. El token de acceso debe quedarse en el servidor, nunca en `VITE_*`.

## Uso en laboratorio

Iniciar un PocketBase independiente en `http://127.0.0.1:8099`, con base de datos nueva, sin copiar los datos del proyecto. Crear la colección anterior y un token con autorización de escritura exclusiva para el laboratorio.

Activar explícitamente en el entorno **del servidor**:
- `BILLING_DEMO_PB_URL=http://127.0.0.1:8099`
- `BILLING_DEMO_PB_TOKEN=<token privado solo de laboratorio>`
- `BILLING_DEMO_PB_WRITE=1`

Sin estas tres variables juntas, el backend opera únicamente en memoria. La respuesta del formulario sigue mostrando **demo** y nunca activa servicios.

## Conexión con Mercado Pago (aún deshabilitada)

`mercadopago-contract.mjs` documenta el plan y los eventos, pero **no utiliza API, checkout, tokens ni webhooks reales**.

Al implementar integración de prueba real, se deben validar las restricciones particulares de suscripciones del entorno de pruebas de Mercado Pago, los webhooks firmados y la consulta del pago al proveedor. Solo un pago confirmado por consulta confiable permitiría activar un cliente en la fase futura. Las notificaciones `subscription_preapproval`, `subscription_authorized_payment` y `payment` se tratan como información, no como prueba de cobro.

Documentación:
- https://www.mercadopago.com.mx/developers/es/reference/online-payments/subscriptions/create-preapproval/post
- https://www.mercadopago.com.mx/developers/es/docs/subscriptions/subscription-management
- https://www.mercadopago.com.mx/developers/es/docs/woocomerce/additional-content/your-integrations/notifications/webhooks
- https://pocketbase.io/docs/api-records/

## Validación automatizada con PocketBase real

El workflow `.github/workflows/billing-demo-validation.yml` descarga PocketBase **v0.38.0** en un runner efímero de GitHub Actions, crea `pb_data` totalmente nuevo y lo elimina al terminar. Valida:
- creación de la colección con reglas cerradas y un identificador único;
- guardado de una solicitud de prueba de $299 MXN sin cobro;
- recuperación tras reiniciar el proceso PocketBase;
- aprobación ficticia, reinicio de la API, relectura del snapshot, rechazo de duplicados, cancelación y segundo reinicio;
- permanencia de `charged=false` y `liveAccess=false`.

**Limitación deliberada:** las actualizaciones de eventos se serializan solo dentro de un proceso Node. No hay control de concurrencia multiinstancia, pagos reales, reintentos de webhooks externos ni verificación criptográfica. Los snapshots JSON y el token de laboratorio no deben reutilizarse como arquitectura final de facturación. La prueba no despliega nada en nuestros servidores.
