## 📱 Demo de la aplicación

<table align="center">
  <tr>
    <td align="center">
      <img src="docs/1.gif" width="320"><br>
      <b>Crear campaña</b>
    </td>
    <td width="30"></td>
    <td align="center">
      <img src="docs/2.gif" width="320"><br>
      <b>Dashboard en tiempo real</b>
    </td>
  </tr>
</table>


# Prospector-Scraper

## Arranque local en Windows

1. Copia `launcher.local.ps1.example` a `launcher.local.ps1` y configura las rutas de PocketBase, cloudflared y ngrok para tu equipo.
2. Copia `web/.env.example` a `web/.env` y configura solo URLs públicas. Las variables `VITE_*` se incluyen en el navegador; nunca pongas claves o contraseñas allí.
3. Para una instalación nueva de WAHA, copia `.env.example` a `.env`, configura las credenciales privadas y las rutas absolutas de sesiones y videos. Después ejecuta `docker compose -p waha-test -f docker-compose.waha.yml up -d waha`. Las sesiones se guardan en `WAHA_SESSIONS_DIR`.
4. Ejecuta `ABRIR_PROSPECTOR_SCRAPER.bat`. También admite `--start` y `--status` para usarlo sin menú. WAHA se publica en `http://localhost:3001` porque el puerto 3000 está ocupado por Gotenberg en la instalación actual.

En la instalación existente, el Compose de WAHA está fuera de este repositorio y conserva su propio `.env` y directorio de sesiones. El launcher reutiliza el contenedor `waha-test-waha-1`. Los workflows n8n exportados en `n8n/` usan el puerto 3001 y leen la clave WAHA desde `$env.WAHA_API_KEY`. Si ya están importados en n8n, actualiza las URLs de WAHA y las credenciales de esas copias activas antes de ejecutarlos. Configura `WAHA_API_KEY` en el entorno local de n8n; nunca la pongas en `web/.env`.

## Vista general de workflows

<p align="center">
  <a href="docs/1.jpg">
    <img src="docs/1.jpg" width="48%">
  </a>
  <a href="docs/2.jpg">
    <img src="docs/2.jpg" width="48%">
  </a>
</p>

<p align="center">
  <a href="docs/3.jpg">
    <img src="docs/3.jpg" width="48%">
  </a>
  <a href="docs/4.jpg">
    <img src="docs/4.jpg" width="48%">
  </a>
</p>

<p align="center">
  <a href="docs/5.jpg">
    <img src="docs/5.jpg" width="48%">
  </a>
  <a href="docs/6.jpg">
    <img src="docs/6.jpg" width="48%">
  </a>
</p>

---

## Flujo General

## Flujo General

1. Usuario crea campaña
2. Se generan lotes de códigos postales
3. Scraper obtiene negocios
4. Se extraen teléfonos
5. Se detecta WhatsApp
6. Se generan mensajes personalizados
7. Se envían mensajes
8. Se registran respuestas
9. Agente IA continúa conversación
10. Dashboard muestra métricas

![Dashboard](docs/pantalla_flujos.jpg)
![Dashboard](docs/flujo_1.jpg)
![Dashboard](docs/iphone.jpg)
