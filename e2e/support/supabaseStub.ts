/**
 * Faux projet Supabase des E2E en CI. Sans `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` dans le
 * build, `getSupabase()` (`src/data/supabaseClient.ts`) renvoie `null` : le jeu ne fait alors aucune
 * requête Supabase, et un test qui intercepte les lectures `/rest/v1/…` n'est jamais sollicité (c'est
 * ce qui rendait rouge `archives.spec.ts` › « transcription publiée pendant la visite » en CI, où il n'y a
 * ni `.env.local` ni secret). `playwright.config.ts` fournit donc ces deux valeurs factices au build E2E
 * de la CI, et `stubSupabase` (appelé par `gotoMusee`) répond à leur place : aucun réseau, aucun vrai
 * projet, et aucun changement du code applicatif.
 *
 * L'URL est sous `https://*.supabase.co` pour passer la CSP de production (`connect-src`,
 * `vercel.json`, reprise telle quelle par `vite preview`). Rien ici n'est un secret.
 */
import type { BrowserContext } from '@playwright/test'

export const STUB_SUPABASE_URL = 'https://e2e-stub.supabase.co'
/** Ni clé publishable ni JWT : `createClient` exige seulement une valeur non vide. */
export const STUB_SUPABASE_ANON_KEY = 'e2e-stub-anon-key'

const stubbed = new WeakSet<BrowserContext>()

/**
 * Répond au faux projet à la place d'un serveur : toute lecture REST renvoie une table vide (le jeu
 * retombe alors sur `/data/people.json` et le programme embarqué, comme avec un projet vide), le
 * websocket Realtime est fermé aussitôt (présence en mode solo après ses tentatives, comme dans
 * `presence.spec.ts`), tout autre appel répond 404 pour ne pas passer inaperçu. Une seule fois par
 * contexte ; les routes d'une page (`page.route`) restent prioritaires sur celles-ci, un test peut
 * donc surcharger une table (voir `archives.spec.ts`).
 */
export async function stubSupabase(context: BrowserContext): Promise<void> {
  if (stubbed.has(context)) return
  stubbed.add(context)
  await context.route(`${STUB_SUPABASE_URL}/**`, (route) => {
    const rest = route.request().url().includes('/rest/v1/')
    return route.fulfill({ status: rest ? 200 : 404, contentType: 'application/json', body: rest ? '[]' : '{}' })
  })
  await context.routeWebSocket(`${STUB_SUPABASE_URL.replace('https:', 'wss:')}/**`, (ws) => {
    ws.close()
  })
}
