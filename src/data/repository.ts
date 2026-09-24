/**
 * Charge les 100 : Supabase (table `people`, lignes publiées) → `/data/people.json` (repli statique)
 * → fiches d'attente (repli final). Ne rejette jamais : le musée doit toujours pouvoir ouvrir.
 * Propriétaire : agent données.
 */
import type { DataSource, Person } from '../types'
import { mapSupabaseRow, parsePeople } from './schema'
import { generatePlaceholderPeople } from './placeholder'
import { getSupabase } from './supabaseClient'

const SUPABASE_TIMEOUT_MS = 4000

let warned = false
/** Avertit une seule fois par session, quelle que soit la raison du repli. */
function warnOnce(message: string): void {
  if (warned) return
  warned = true
  console.warn(`[data] ${message}`)
}

/** Résout `value`, ou `'timeout'` si `ms` s'écoulent avant (Supabase peut rester silencieux hors ligne). */
function withTimeout<T>(value: PromiseLike<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([
    Promise.resolve(value),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms)),
  ])
}

async function loadFromSupabase(): Promise<Person[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS)
  try {
    // `getSupabase()` peut lever si les variables d'environnement sont mal renseignées : on la
    // garde dans ce `try` (ceinture-bretelles, en plus de la garde dans `supabaseClient.ts`) pour
    // que cette fonction ne rejette jamais.
    const supabase = getSupabase()
    if (!supabase) return null
    const query = supabase.from('people').select('*').eq('published', true).abortSignal(controller.signal)
    const result = await withTimeout(query, SUPABASE_TIMEOUT_MS)
    if (result === 'timeout') {
      warnOnce('Supabase indisponible (délai dépassé) : repli sur les données statiques.')
      return null
    }
    const { data, error } = result
    if (error || !data) {
      warnOnce('Supabase indisponible : repli sur les données statiques.')
      return null
    }
    const { people, errors } = parsePeople(data.map(mapSupabaseRow))
    if (errors.length) warnOnce(`Supabase : ${errors.length} fiche(s) ignorée(s) (validation).`)
    return people.length ? people : null
  } catch {
    warnOnce('Supabase indisponible : repli sur les données statiques.')
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function loadFromStatic(): Promise<Person[] | null> {
  try {
    const res = await fetch('/data/people.json')
    if (!res.ok) return null
    const data: unknown = await res.json()
    const { people, errors } = parsePeople(data)
    if (errors.length) warnOnce(`/data/people.json : ${errors.length} fiche(s) ignorée(s) (validation).`)
    return people.length ? people : null
  } catch {
    return null
  }
}

/** Charge les 100 : Supabase, puis `/data/people.json`, puis fiches d'attente. Ne rejette jamais. */
export async function loadPeople(): Promise<{ people: Person[]; source: DataSource }> {
  const supabase = await loadFromSupabase()
  if (supabase) return { people: supabase, source: 'supabase' }

  const staticJson = await loadFromStatic()
  if (staticJson) return { people: staticJson, source: 'static' }

  return { people: generatePlaceholderPeople(), source: 'placeholder' }
}
