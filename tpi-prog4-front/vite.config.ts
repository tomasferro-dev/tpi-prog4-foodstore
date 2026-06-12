import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const BACKEND = 'http://localhost:8000'

// followRedirects: true → el proxy sigue los 307 de FastAPI internamente,
// el browser nunca ve la URL de localhost (evita mixed-content y CORS).
const p = { target: BACKEND, changeOrigin: true, followRedirects: true }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      // Todo el backend cuelga de /api/v1 (integrador.md §5)
      '/api/v1': p,
    },
  },
})
