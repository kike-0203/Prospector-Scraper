import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '^/webhook/enviar-lead-manual(?:\\?.*)?$': {
        target: 'http://127.0.0.1:5678',
        changeOrigin: true,
      },
      '^/webhook/iniciar-scraper(?:\\?.*)?$': {
        target: 'http://127.0.0.1:5678',
        changeOrigin: true,
      },
    },
  }
})
