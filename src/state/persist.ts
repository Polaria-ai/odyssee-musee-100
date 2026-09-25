/**
 * Persistance locale best-effort. Le navigateur peut refuser le stockage
 * (navigation privée, iOS en mode restreint) : le jeu doit tourner quand même.
 */
const KEY = 'odyssee-musee-100:v1'

export interface PersistedState {
  lang?: 'fr' | 'en'
  avatar?: unknown
  visited?: Record<string, number>
  stamps?: Record<string, number>
  visitedSessions?: Record<string, number>
  visitorId?: string
}

export function loadPersisted(): PersistedState {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as PersistedState) : {}
  } catch {
    return {}
  }
}

export function savePersisted(patch: PersistedState): void {
  try {
    const next = { ...loadPersisted(), ...patch }
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next))
  } catch {
    // Stockage indisponible : on continue sans mémoire.
  }
}

export function clearPersisted(): void {
  try {
    globalThis.localStorage?.removeItem(KEY)
  } catch {
    // ignore
  }
}
