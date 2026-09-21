/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Permite servir el dev server detrás del túnel de Cloudflare (URLs *.trycloudflare.com).
    // No afecta el uso local por localhost.
    allowedHosts: ['localhost', '.trycloudflare.com'],
    // Proxy same-origin: cuando se accede de forma remota (túnel) el frontend llama a
    // rutas relativas /api y /uploads, y Vite las reenvía al backend local. Así todo pasa
    // por un único origen (evita CORS y problemas de cookies sobre HTTPS).
    // El uso local por defecto sigue usando VITE_API_URL absoluto y no toca este proxy.
    proxy: {
      '/api': { target: 'http://localhost:4001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4001', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
