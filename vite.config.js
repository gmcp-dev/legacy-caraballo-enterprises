import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const packageJson = JSON.parse(readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
