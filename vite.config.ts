/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createApiMiddleware } from './api/_lib/nodeAdapter.ts'

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

/**
 * Sert `POST /api/remi` en `pnpm dev`, comme la fonction Vercel `api/remi.ts` (le serveur de dev ne sait
 * exécuter que le front). La clé OpenRouter est lue dans `.env.local` (ou l'environnement) par
 * `loadEnv(…, '')` et n'entre que dans le processus du serveur de dev : elle n'a pas de préfixe `VITE_`,
 * donc ni le navigateur ni le bundle ne la voient. Sans clé, la fonction répond `unavailable`.
 * Seulement en `serve` : ni `vite build` ni `vite preview` n'exécutent la fonction (le client y reçoit une
 * erreur et le jeu garde ses répliques scriptées) ; ni sous Vitest (`mode === 'test'`).
 */
function remiApiDev(mode: string): Plugin {
  return {
    name: 'remi-api-dev',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '')
      for (const key of ['OPENROUTER_API_KEY', 'REMI_CHAT_DISABLED'] as const) {
        if (process.env[key] === undefined && env[key] !== undefined) process.env[key] = env[key]
      }
      server.middlewares.use(
        '/api/remi',
        createApiMiddleware(() => server.ssrLoadModule('/api/remi.ts'), 'api/remi'),
      )
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'test' ? [] : [remiApiDev(mode)])],
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
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'api/**/*.test.ts'],
    css: false,
  },
}))
