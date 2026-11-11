# Ciclo de suscripción simulado · Prospector $299 MXN/mes

## Ejecutar
- `node billing-demo/run-lifecycle.mjs`: imprime la secuencia completa sin conexiones de red ni escrituras.
- `node --test billing-demo/*.test.mjs`: pruebas de estados, duplicados, entrada y adaptadores.
- La CI del PR también compila el frontend.

## Estados (exclusivamente ficticios)
`demo_pendiente` → aprobación ficticia → `demo_activa` → renovación ficticia o `demo_pago_pendiente` → recuperación ficticia → `demo_activa` → cancelación → `demo_cancelada`.

Los campos `charged` y `liveAccess` siempre son `false`. **demo_activa no significa que se haya pagado dinero ni autoriza a activar un servicio.** La simulación nunca contacta Mercado Pago.

## Controles
1. Cada evento usa un identificador único; el repetido no incrementa ciclos.
2. Eventos fuera de secuencia se rechazan. Una cancelación no puede revertirse por un evento tardío.
3. El monto lo determina el servidor de prueba, nunca un campo editable del cliente.
4. El adaptador de PocketBase sigue opcional, limitado a loopback local y a una colección separada de laboratorio.
5. No existen webhooks públicos de pago, credenciales reales ni cobro automático.

## Diferencias respecto de producción
Esta máquina de estados es una **simulación didáctica**, no la lógica definitiva de facturación. Una integración real requiere idempotencia durable en base de datos, firma de webhooks verificada, consulta al proveedor, conciliación de importe, moneda, titular y suscripción, períodos de facturación, reintentos, devoluciones y manejo de carreras. Antes de cobrar hay que definir alcance y condiciones comerciales, cancelar conforme a los términos y probar las restricciones actuales de la API de Mercado Pago.

No tocar la Dell vieja, servicios Tamales, PB operativo, n8n ni WAHA.
