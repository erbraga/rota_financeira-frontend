import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // O CORS do backend só libera :5173 e :3000; com strictPort o servidor falha
  // em vez de subir em outra porta e ter as chamadas recusadas pelo navegador.
  server: { port: 5173, strictPort: true },
  preview: { port: 3000, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.test.{js,jsx}'],
    env: {
      VITE_API_URL: 'http://localhost:5000/api',
      TZ: 'America/Sao_Paulo',
    },
  },
})
