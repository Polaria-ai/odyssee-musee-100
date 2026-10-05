/**
 * Archives publiées de la soirée (table Supabase `session_archives`), lues côté serveur pour que l'Archiviste · IA
 * ne dise que ce qui a été relu et publié (`published = true`). Module sans état partagé : chaque source a son
 * cache, sa file d'attente et son horloge, injectés pour les tests.
 *
 * Lecture : l'API REST de Supabase (PostgREST) avec la clé publique `anon` déjà utilisée par le navigateur
 * (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, lisibles dans l'environnement de la fonction). La politique de
 * sécurité de la table ne laisse lire que les archives publiées : aucune clé de service ici, jamais. Pas de client
 * `@supabase/supabase-js` : un `fetch` suffit et la fonction reste légère.
 *
 * Trois garanties :
 *  - délai court (`ARCHIVES_TIMEOUT_MS`) : une panne de Supabase ne ralentit jamais le chat de plus de ce délai ;
 *  - cache d'environ 60 s (`ARCHIVES_CACHE_MS`) et lecture unique en vol : 200 visiteurs ne font pas 200 requêtes ;
 *  - jamais d'exception : tout échec devient `null` (« je ne peux pas lire les archives »), distinct de `[]`
 *    (« rien n'est publié »). L'échec n'est mémorisé que `ARCHIVES_FAILURE_CACHE_MS`, pour que le retour de Supabase
 *    soit vite pris en compte sans marteler un service en panne.
 *
 * Les lignes sont revalidées ici (le contenu vient d'une base, pas du code) : une archive mal formée est écartée
 * seule, sans faire échouer les autres. Les imports du dossier `src/` sont interdits (voir `docs/REMI-IA.md` :
 * Vercel exécute `api/` en ESM, où un import sans extension ne se résout pas).
 */
import type { EveningSession } from '../../src/types/index.js'
import { ARCHIVE_SESSION_IDS } from '../../src/data/eveningProgram.js'
import { ARCHIVES_CACHE_MS, ARCHIVES_FAILURE_CACHE_MS, ARCHIVES_TIMEOUT_MS, MAX_ARCHIVE_TRANSCRIPT_CHARS } from './config.js'

export interface ArchivesEnv {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

export interface PublishedArchive {
  sessionId: string
  transcript: { fr: string; en: string }
}

/**
 * `PublishedArchive[]` : les archives publiées (liste vide : rien n'est publié, l'état normal avant la fin de
 * soirée). `null` : lecture impossible (Supabase absent, en panne, trop lent, réponse illisible).
 */
export type PublishedArchives = PublishedArchive[] | null

export interface ArchivesSource {
  load(): Promise<PublishedArchives>
}

export interface ArchivesSourceDeps {
  getEnv: () => ArchivesEnv
  fetchImpl: typeof fetch
  now: () => number
  /** Durées de mémorisation et délai de lecture (valeurs de `config.ts` par défaut). */
  cacheMs?: number
  failureCacheMs?: number
  timeoutMs?: number
}

/** Caractères de contrôle, sauf tabulation et saut de ligne : un texte injecté dans un prompt n'en porte aucun. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const SESSION_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.replace(CONTROL_CHARS, '').trim()
  return text.length > max ? null : text
}

/**
 * Lignes brutes de `session_archives` → archives valides. Seules les lignes `published = true` sont gardées (la
 * politique de la table le garantit déjà ; on ne s'y fie pas pour un texte qui part dans un prompt). Une ligne
 * invalide est ignorée, les autres restent. Les doublons de séquence gardent la première ligne.
 */
export function parseArchiveRows(rows: unknown): PublishedArchive[] {
  if (!Array.isArray(rows)) return []
  const out: PublishedArchive[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (!isRecord(row) || row.published !== true) continue
    const sessionId = typeof row.session_id === 'string' ? row.session_id : ''
    if (!SESSION_ID_RE.test(sessionId) || !ARCHIVE_SESSION_IDS.has(sessionId) || seen.has(sessionId)) continue
    const fr = cleanText(row.transcript_fr, MAX_ARCHIVE_TRANSCRIPT_CHARS)
    const en = cleanText(row.transcript_en ?? '', MAX_ARCHIVE_TRANSCRIPT_CHARS)
    if (!fr || en === null) continue
    seen.add(sessionId)
    out.push({ sessionId, transcript: { fr, en } })
  }
  return out
}

/** Archives dans l'ordre du programme (celui des vitrines) ; une séquence inconnue du programme passe à la fin. */
export function orderByProgram(archives: readonly PublishedArchive[], program: readonly EveningSession[]): PublishedArchive[] {
  const rank = new Map(program.map((s) => [s.id, s.order]))
  const of = (a: PublishedArchive) => rank.get(a.sessionId) ?? Number.MAX_SAFE_INTEGER
  return [...archives].sort((a, b) => of(a) - of(b) || a.sessionId.localeCompare(b.sessionId))
}

function archivesUrl(base: string): string | null {
  try {
    const url = new URL('/rest/v1/session_archives', base)
    url.searchParams.set('select', 'session_id,transcript_fr,transcript_en,published')
    url.searchParams.set('published', 'eq.true')
    return url.toString()
  } catch {
    return null
  }
}

export function createArchivesSource(deps: ArchivesSourceDeps): ArchivesSource {
  const cacheMs = deps.cacheMs ?? ARCHIVES_CACHE_MS
  const failureCacheMs = deps.failureCacheMs ?? ARCHIVES_FAILURE_CACHE_MS
  const timeoutMs = deps.timeoutMs ?? ARCHIVES_TIMEOUT_MS

  let cached: { value: PublishedArchives; until: number } | null = null
  let inFlight: Promise<PublishedArchives> | null = null

  async function fetchArchives(): Promise<PublishedArchives> {
    const env = deps.getEnv()
    const base = env.VITE_SUPABASE_URL?.trim()
    const key = env.VITE_SUPABASE_ANON_KEY?.trim()
    if (!base || !key) return null
    const url = archivesUrl(base)
    if (!url) return null

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await deps.fetchImpl(url, {
        method: 'GET',
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined)
        return null
      }
      // La lecture du corps compte dans le même délai : le signal l'interrompt aussi.
      const json: unknown = await response.json()
      if (!Array.isArray(json)) return null
      return parseArchiveRows(json)
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async load() {
      const t = deps.now()
      if (cached && t < cached.until) return cached.value
      if (!inFlight) {
        inFlight = fetchArchives()
          .then((value) => {
            cached = { value, until: deps.now() + (value === null ? failureCacheMs : cacheMs) }
            return value
          })
          .finally(() => {
            inFlight = null
          })
      }
      return inFlight
    },
  }
}
