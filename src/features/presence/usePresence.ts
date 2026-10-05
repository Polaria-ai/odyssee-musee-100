/**
 * Câblage React de la présence temps réel : construit une `PresenceSession` (toute la machine d'état vit
 * dans `presenceSession.ts`, testable sans React) quand `enabled`, la démarre, la connecte à la visibilité
 * de l'onglet et l'arrête au nettoyage. No-op sans Supabase, sans exception non gérée, sans boucle de
 * reconnexion agressive.
 *
 * Le second paramètre (`deps`) n'est là que pour les tests : il permet d'injecter un faux client Realtime
 * et une horloge contrôlée, sans changer la signature utilisée par `App.tsx` (`usePresence(playing)`, un
 * seul argument, la valeur par défaut s'applique).
 */
import { useEffect, useRef } from 'react'
import { useGame } from '../../state/gameStore'
import { player } from '../../state/runtime'
import { debugEnabled } from '../../scene/debugApi'
import { sanitizeNamespace } from './roomSelection'
import { EFFECTIVE_PEER_TIMEOUT_MS, createPresenceSession, type PresenceConfig } from './presenceSession'
import { defaultRealtimeClient, type RealtimeClientLike } from './realtimeClient'

// Conservé : l'ancien module exportait ce délai (le test de cohérence des battements l'importe d'ici).
export { EFFECTIVE_PEER_TIMEOUT_MS }

export interface PresenceDeps {
  getClient: () => RealtimeClientLike | null
  now: () => number
  /** Tests : salle d'entrée déterministe (défaut : tirage aléatoire dans 1..maxRooms). */
  pickStartRoom?: () => number
}

const defaultDeps: PresenceDeps = {
  getClient: defaultRealtimeClient,
  now: () => Date.now(),
}

/** Capacité maximale d'une salle réglable par `VITE_PRESENCE_ROOM_CAPACITY` (le défaut est de 30). */
const MAX_CONFIGURABLE_CAPACITY = 40

/** Nombre lu dans une variable Vite, borné ; `undefined` si absent, illisible ou hors bornes. */
function readBounded(raw: unknown, min: number, max: number, integer: boolean): number | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < min || n > max) return undefined
  if (integer && !Number.isInteger(n)) return undefined
  return n
}

/**
 * Réglages optionnels par variables Vite, chacun borné, avec repli sur `DEFAULT_PRESENCE_CONFIG` si absent ou
 * invalide (une faute de frappe en production ne doit jamais casser la présence) :
 * `VITE_PRESENCE_ROOM_CAPACITY` (2..40), `VITE_PRESENCE_MAX_ROOMS` (1..50), `VITE_PRESENCE_SEND_HZ`
 * (0.5..4, envois de position par seconde en mouvement).
 */
export function presenceConfigFromEnv(env: Record<string, unknown>): Partial<PresenceConfig> {
  const config: Partial<PresenceConfig> = {}
  const capacity = readBounded(env.VITE_PRESENCE_ROOM_CAPACITY, 2, MAX_CONFIGURABLE_CAPACITY, true)
  if (capacity !== undefined) config.roomCapacity = capacity
  const maxRooms = readBounded(env.VITE_PRESENCE_MAX_ROOMS, 1, 50, true)
  if (maxRooms !== undefined) config.maxRooms = maxRooms
  const hz = readBounded(env.VITE_PRESENCE_SEND_HZ, 0.5, 4, false)
  if (hz !== undefined) config.moveSendIntervalMs = Math.round(1000 / hz)
  return config
}

export function usePresence(enabled: boolean, deps: PresenceDeps = defaultDeps): void {
  const visitorId = useGame((s) => s.visitorId)
  const setPeersCount = useGame((s) => s.setPeersCount)

  // `deps` n'a pas besoin d'être une dépendance d'effet : c'est une fabrique stable en usage
  // normal (la valeur par défaut), et le lire via une ref évite de tout reconnecter si un
  // appelant (typiquement un test) passe un nouvel objet littéral à chaque rendu.
  const depsRef = useRef(deps)
  depsRef.current = deps

  useEffect(() => {
    if (!enabled) return
    if (import.meta.env.VITE_PRESENCE === 'off') return
    const client = depsRef.current.getClient()
    if (!client) return // Supabase non configuré : mode solo silencieux, rien à nettoyer.

    // Les tests E2E s'isolent dans leurs propres salles (`?e2e=1&presenceRoom=…`) pour ne jamais
    // croiser de vrais visiteurs ni se gêner entre eux.
    const debug = debugEnabled()
    let namespace: string | null = null
    if (debug) {
      try {
        namespace = sanitizeNamespace(new URLSearchParams(window.location.search).get('presenceRoom'))
      } catch {
        namespace = null
      }
    }

    const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

    const session = createPresenceSession({
      client,
      visitorId,
      namespace,
      getPlayer: () => ({ x: player.x, z: player.z, rotY: player.rotY, moving: player.moving }),
      onPeersCount: setPeersCount,
      now: () => depsRef.current.now(),
      // Salle d'entrée : room-1 par défaut (les petits groupes se retrouvent) ; `VITE_PRESENCE_START=random` tire la
      // salle au hasard, ce qui réduit les jointures d'une arrivée groupée (QR code de fin de soirée) mais disperse les
      // joueurs tant qu'ils sont peu nombreux. L'espace de test (?presenceRoom=) entre toujours par room-1 pour que deux
      // onglets de test se retrouvent. Voir README.
      pickStartRoom:
        depsRef.current.pickStartRoom ?? (namespace || import.meta.env.VITE_PRESENCE_START !== 'random' ? () => 1 : undefined),
      config: presenceConfigFromEnv(import.meta.env as Record<string, unknown>),
      hidden: isHidden(),
      // Hors debug, un seul message au passage en solo, avec la raison (jamais de bruit par ailleurs).
      log: (msg) => console.info(msg),
    })

    const onVisibility = () => session.setHidden(isHidden())
    document.addEventListener('visibilitychange', onVisibility)

    // Mode debug / E2E : les compteurs de la session sont lisibles depuis `window.__musee.presence()`.
    const statsReader = () => session.stats()
    if (debug && typeof window !== 'undefined' && window.__musee) window.__musee.presence = statsReader

    session.start()

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (typeof window !== 'undefined' && window.__musee?.presence === statsReader) delete window.__musee.presence
      session.stop()
    }
    // depsRef porte la valeur courante : pas besoin de relancer cet effet si l'appelant passe un nouvel
    // objet `deps` à chaque rendu (tests).
  }, [enabled, visitorId, setPeersCount])
}
