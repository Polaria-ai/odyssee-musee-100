/**
 * Lecture directe de `.env.local` (jamais committé, voir `.gitignore`) pour savoir si Supabase est
 * joignable AVANT de lancer un test `@live` (présence à deux contextes, `e2e/presence.spec.ts`) :
 * sans réseau (sandbox CI, pare-feu) ou sans `.env.local` renseigné, Supabase Realtime ne pourra de
 * toute façon jamais se connecter — mieux vaut l'ignorer proprement (`test.skip`) que le voir
 * échouer pour une raison d'infrastructure. Ne fait qu'une requête REST anonyme (comme
 * `loadPeople()`, `src/data/repository.ts`) : un indicateur de joignabilité réseau, jamais une
 * vraie connexion Realtime (websocket) — Realtime peut en théorie être injoignable alors que ce
 * contrôle passe, mais l'inverse (réseau coupé) est le cas qu'on veut surtout éviter de faire
 * échouer bruyamment.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SUPPORT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.resolve(SUPPORT_DIR, '..', '..', '.env.local')
const REACHABILITY_TIMEOUT_MS = 4_000

interface SupabaseTestEnv {
  url: string
  anonKey: string
}

function readEnvLocal(): SupabaseTestEnv | null {
  let raw: string
  try {
    raw = readFileSync(ENV_FILE, 'utf8')
  } catch {
    return null
  }
  const vars: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  const url = vars.VITE_SUPABASE_URL
  const anonKey = vars.VITE_SUPABASE_ANON_KEY
  return url && anonKey ? { url, anonKey } : null
}

/**
 * Vrai si un GET REST anonyme aboutit (n'importe quel statut HTTP, même une erreur applicative) —
 * signe que le réseau et l'hôte Supabase répondent. `false` si `.env.local` est absent/incomplet
 * (pas de projet configuré, ex. CI) ou si la requête échoue/expire (pas de réseau).
 */
export async function isSupabaseReachable(): Promise<boolean> {
  const env = readEnvLocal()
  if (!env) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS)
  try {
    const res = await fetch(`${env.url}/rest/v1/people?select=id&limit=1`, {
      headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}` },
      signal: controller.signal,
    })
    return res.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
