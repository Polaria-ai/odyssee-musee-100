/**
 * Persistance locale best-effort. Le navigateur peut refuser le stockage
 * (navigation privée, iOS en mode restreint) : le jeu doit tourner quand même.
 */
const KEY = 'odyssee-musee-100:v1'

export interface PersistedState {
  lang?: 'fr' | 'en'
  visited?: Record<string, number>
  stamps?: Record<string, number>
  visitedSessions?: Record<string, number>
  archivesDiscovered?: boolean
  visitorId?: string
}

export function loadPersisted(): PersistedState {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const state = parsed as PersistedState & { avatar?: unknown }
    // Plus de personnalisation : tout le monde joue Cyril. Un avatar (tenue, pseudo) enregistré par une
    // version précédente est ignoré, et effacé du stockage dès cette première lecture.
    if ('avatar' in state) {
      delete state.avatar
      try {
        globalThis.localStorage?.setItem(KEY, JSON.stringify(state))
      } catch {
        // Écriture refusée : l'avatar est quand même ignoré, il partira à la prochaine écriture réussie.
      }
    }
    return state
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
