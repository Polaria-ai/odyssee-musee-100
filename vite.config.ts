/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * En-têtes servis par Vercel sur toutes les pages (CSP comprise), repris tels quels par `vite preview`
 * pour que les E2E locaux tournent sous la même politique que la production. Sans cela, le blocage
 * des textures GLB par `connect-src` (29/09 : Cyril et Rémi tout blancs en ligne) passait inaperçu.
 * Pas sur le serveur de dev : son rechargement à chaud injecte des scripts que la CSP refuserait.
 */
function vercelPageHeaders(): Record<string, string> {
  const cfg = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers?: { source: string; headers: { key: string; value: string }[] }[]
  }
  const page = cfg.headers?.find((h) => h.source === '/(.*)')
  return Object.fromEntries((page?.headers ?? []).map((h) => [h.key, h.value]))
}

export default defineConfig({
  plugins: [react()],
  preview: { headers: vercelPageHeaders() },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three'
          if (id.includes('node_modules/@react-three/')) return 'r3f'
          if (id.includes('node_modules/@supabase/')) return 'supabase'
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    css: false,
  },
})
