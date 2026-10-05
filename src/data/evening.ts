/**
 * Charge le programme de la soirée et les archives déposées par l'Archiviste :
 *  - programme : Supabase (`evening_sessions`) si peuplée, sinon le programme embarqué
 *    (`EVENING_PROGRAM`) — un programme vide n'a pas de sens, le musée doit toujours en montrer un.
 *  - archives : Supabase (`session_archives`, `published = true`) si Supabase est joignable —
 *    y compris quand la table est encore vide, ce qui est l'état normal tant que l'Archiviste n'a
 *    rien déposé — sinon `/data/evening.json` (filtré aux archives publiées), sinon aucune archive.
 *    Contrairement au programme, une réponse Supabase vide n'est PAS un repli : c'est l'état attendu
 *    pendant presque toute la soirée.
 * Ne rejette jamais, n'affiche rien en console dans les cas normaux (table vide, pas d'archive).
 * Propriétaire : workflow « Archives de 2040 ».
 */
import type { EveningSession, EveningSource, SessionArchive } from '../types'
import { EveningSessionSchema, SessionArchiveSchema } from './eveningSchema'
import { EVENING_PROGRAM } from './eveningProgram'
import { getSupabase } from './supabaseClient'

const SUPABASE_TIMEOUT_MS = 4000

let warned = false
/** Avertit une seule fois par session, quelle que soit la raison du repli. */
function warnOnce(message: string): void {
  if (warned) return
  warned = true
  console.warn(`[data/evening] ${message}`)
}

/** Résout `value`, ou `'timeout'` si `ms` s'écoulent avant. Annule toujours son minuteur. */
function withTimeout<T>(value: PromiseLike<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), ms)
  })
  return Promise.race([Promise.resolve(value), timeout]).finally(() => clearTimeout(timer))
}

// ---------------------------------------------------------------------------
// Lignes Supabase (snake_case) → objets bruts (camelCase), à valider ensuite.
// ---------------------------------------------------------------------------

function mapSessionRow(row: unknown): unknown {
  if (!row || typeof row !== 'object') return row
  const r = row as Record<string, unknown>
  return {
    id: r.id,
    order: r.ord,
    startTime: r.start_time,
    durationMin: r.duration_min,
    kind: r.kind,
    title: { fr: r.title_fr ?? '', en: r.title_en ?? '' },
    theme: r.theme_fr || r.theme_en ? { fr: r.theme_fr ?? '', en: r.theme_en ?? '' } : undefined,
    speakers: Array.isArray(r.speakers) ? r.speakers : [],
    provisional: r.provisional ?? true,
  }
}

function mapArchiveRow(row: unknown): unknown {
  if (!row || typeof row !== 'object') return row
  const r = row as Record<string, unknown>
  return {
    sessionId: r.session_id,
    summary: { fr: r.summary_fr ?? '', en: r.summary_en ?? '' },
    quotes: Array.isArray(r.quotes) ? r.quotes : [],
    archivedAt: r.archived_at,
    published: r.published ?? false,
  }
}

// ---------------------------------------------------------------------------
// Programme.
// ---------------------------------------------------------------------------

async function loadSessionsFromSupabase(): Promise<EveningSession[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS)
  try {
    const supabase = getSupabase()
    if (!supabase) return null
    const query = supabase.from('evening_sessions').select('*').order('ord').abortSignal(controller.signal)
    const result = await withTimeout(query, SUPABASE_TIMEOUT_MS)
    if (result === 'timeout') {
      warnOnce('programme Supabase indisponible (délai dépassé) : repli sur le programme embarqué.')
      return null
    }
    const { data, error } = result
    if (error || !data) {
      warnOnce('programme Supabase indisponible : repli sur le programme embarqué.')
      return null
    }
    const sessions: EveningSession[] = []
    let invalid = 0
    for (const raw of data) {
      const parsed = EveningSessionSchema.safeParse(mapSessionRow(raw))
      if (parsed.success) sessions.push(parsed.data)
      else invalid += 1
    }
    if (invalid) warnOnce(`programme Supabase : ${invalid} séquence(s) ignorée(s) (validation).`)
    sessions.sort((a, b) => a.order - b.order)
    // Une table vide n'est pas une erreur (chantier pas encore appliqué) : repli silencieux.
    return sessions.length ? sessions : null
  } catch {
    warnOnce('programme Supabase indisponible : repli sur le programme embarqué.')
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Archives.
// ---------------------------------------------------------------------------

/** `null` = Supabase indisponible ou mal configuré (repli JSON) ; `{}` est une réponse valide. */
async function loadArchivesFromSupabase(): Promise<Record<string, SessionArchive> | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS)
  try {
    const supabase = getSupabase()
    if (!supabase) return null
    const query = supabase.from('session_archives').select('*').eq('published', true).abortSignal(controller.signal)
    const result = await withTimeout(query, SUPABASE_TIMEOUT_MS)
    if (result === 'timeout') {
      warnOnce('archives Supabase indisponibles (délai dépassé) : repli sur /data/evening.json.')
      return null
    }
    const { data, error } = result
    if (error || !data) {
      warnOnce('archives Supabase indisponibles : repli sur /data/evening.json.')
      return null
    }
    const archives: Record<string, SessionArchive> = {}
    let invalid = 0
    for (const raw of data) {
      const parsed = SessionArchiveSchema.safeParse(mapArchiveRow(raw))
      if (parsed.success && parsed.data.published) archives[parsed.data.sessionId] = parsed.data
      else if (!parsed.success) invalid += 1
    }
    if (invalid) warnOnce(`archives Supabase : ${invalid} archive(s) ignorée(s) (validation).`)
    // Contrairement au programme : {} (table vide) est une réponse VALIDE, pas un repli — c'est
    // l'état normal avant que l'Archiviste dépose quoi que ce soit.
    return archives
  } catch {
    warnOnce('archives Supabase indisponibles : repli sur /data/evening.json.')
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function loadArchivesFromStatic(): Promise<Record<string, SessionArchive> | null> {
  // Même délai que Supabase : sur le réseau saturé d'une salle, un fetch sans délai pourrait
  // laisser le visiteur indéfiniment sur l'écran de chargement (répétition du 27/09).
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS)
  try {
    const res = await fetch('/data/evening.json', { signal: controller.signal })
    if (!res.ok) return null
    const data: unknown = await res.json()
    const rawArchives =
      data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).archives)
        ? (data as { archives: unknown[] }).archives
        : null
    if (!rawArchives) return null
    const archives: Record<string, SessionArchive> = {}
    for (const raw of rawArchives) {
      const parsed = SessionArchiveSchema.safeParse(raw)
      // Seules les archives publiées sont affichées : `/data/evening.json` peut contenir des
      // brouillons (published = false), écrits par `scripts/import-evening.ts` avant relecture.
      if (parsed.success && parsed.data.published) archives[parsed.data.sessionId] = parsed.data
    }
    return archives
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// API publique.
// ---------------------------------------------------------------------------

/** Charge le programme et les archives publiées : Supabase → `/data/evening.json` → programme embarqué. Ne rejette jamais. */
export async function loadEvening(): Promise<{
  sessions: EveningSession[]
  archives: Record<string, SessionArchive>
  source: EveningSource
}> {
  const [supabaseSessions, supabaseArchives] = await Promise.all([loadSessionsFromSupabase(), loadArchivesFromSupabase()])

  const sessions = supabaseSessions ?? EVENING_PROGRAM
  const source: EveningSource = supabaseSessions ? 'supabase' : 'program'

  const archives = supabaseArchives ?? (await loadArchivesFromStatic()) ?? {}

  return { sessions, archives, source }
}

/**
 * Archives publiées, relues dans Supabase seulement (rafraîchissement pendant la visite, voir
 * `src/archives/useArchivesRefresh.ts`). `null` si Supabase est injoignable : l'appelant garde alors
 * ce qu'il a, sans jamais retomber sur `/data/evening.json` en cours de partie.
 */
export function loadPublishedArchives(): Promise<Record<string, SessionArchive> | null> {
  return loadArchivesFromSupabase()
}
