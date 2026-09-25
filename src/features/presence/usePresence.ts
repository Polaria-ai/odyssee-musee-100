/**
 * Rejoint le canal temps réel quand `enabled` et publie la position du joueur. No-op sans
 * Supabase, sans exception non gérée, sans boucle de reconnexion agressive.
 *
 * Le second paramètre (`deps`) n'est là que pour les tests : il permet d'injecter un faux client
 * Realtime et une horloge contrôlée, sans changer la signature utilisée par `App.tsx`
 * (`usePresence(playing)`, un seul argument, la valeur par défaut s'applique).
 */
import { useEffect, useRef } from 'react'
import { useGame } from '../../state/gameStore'
import { player } from '../../state/runtime'
import type { AvatarConfig } from '../../types'
import {
  peerStore,
  upsertAvatar,
  removePeer,
  recordPosition,
  pruneStale,
  clearPeers,
  shouldSendPosition,
  PEER_SILENCE_TIMEOUT_MS,
  IDLE_HEARTBEAT_MS,
  type SendState,
} from './peers'
import { roomName, sanitizeNamespace, shouldStayInRoom, nextRoomIndex, MAX_ROOMS, ROOM_CAPACITY, type RoomMember } from './roomSelection'
import { debugEnabled } from '../../scene/debugApi'
import { POSITION_EVENT, encodePosition, encodePresence, decodePosition, decodePresence, type PresenceWireMessage } from './protocol'
import { defaultRealtimeClient, type RealtimeClientLike, type RealtimeChannelLike } from './realtimeClient'

export interface PresenceDeps {
  getClient: () => RealtimeClientLike | null
  now: () => number
}

const defaultDeps: PresenceDeps = {
  getClient: defaultRealtimeClient,
  now: () => Date.now(),
}

/** Vérifie la décision d'envoi 10x/s ; `shouldSendPosition` fait le vrai throttle (2/s en mouvement). */
const SEND_TICK_MS = 100
const PRUNE_TICK_MS = 2000
const MAX_RECONNECT_ATTEMPTS = 3
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 8000

/** Onglet caché depuis plus longtemps que ça : on quitte le canal (voir `onVisibility` plus bas). */
const HIDDEN_LEAVE_MS = 30000

/**
 * Marge de sécurité au-dessus du battement au repos : le délai effectif doit rester strictement
 * supérieur à `1.5 × IDLE_HEARTBEAT_MS`, sans quoi un battement qui glisse un peu (`setInterval`
 * n'est pas exact, et `pruneStale` n'est lui-même vérifié que toutes les `PRUNE_TICK_MS`) ferait
 * clignoter un pair pourtant toujours connecté juste avant l'arrivée du battement suivant. `1.6`
 * (et non `1.5` pile) laisse une vraie marge, pas une égalité fragile. Voir `usePresence.test.ts`.
 */
const PEER_TIMEOUT_SAFETY_FACTOR = 1.6

/**
 * Délai d'expiration réellement utilisé pour un pair silencieux. Volontairement plus large que
 * `PEER_SILENCE_TIMEOUT_MS` (la valeur par défaut, testée isolément dans `peers.test.ts`) : le
 * battement au repos n'arrive que toutes les `IDLE_HEARTBEAT_MS`, donc un pair immobile mais
 * toujours connecté ne doit jamais dépasser ce délai entre deux battements, sous peine de
 * clignoter côté receveur avant de réapparaître.
 */
export const EFFECTIVE_PEER_TIMEOUT_MS = Math.max(PEER_SILENCE_TIMEOUT_MS, Math.round(IDLE_HEARTBEAT_MS * PEER_TIMEOUT_SAFETY_FACTOR))

function parsePresenceState(state: Record<string, unknown[]>): PresenceWireMessage[] {
  const out: PresenceWireMessage[] = []
  for (const metas of Object.values(state)) {
    for (const meta of metas) {
      const decoded = decodePresence(meta)
      if (decoded) out.push(decoded)
    }
  }
  return out
}

export function usePresence(enabled: boolean, deps: PresenceDeps = defaultDeps): void {
  const avatar = useGame((s) => s.avatar)
  const visitorId = useGame((s) => s.visitorId)
  const setPeersCount = useGame((s) => s.setPeersCount)

  const avatarRef = useRef<AvatarConfig>(avatar)
  const channelRef = useRef<RealtimeChannelLike | null>(null)
  const joinTsRef = useRef(0)
  // `deps` n'a pas besoin d'être une dépendance d'effet : c'est une fabrique stable en usage
  // normal (la valeur par défaut), et le lire via une ref évite de tout reconnecter si un
  // appelant (typiquement un test) passe un nouvel objet littéral à chaque rendu.
  const depsRef = useRef(deps)
  avatarRef.current = avatar
  depsRef.current = deps

  // Republie l'avatar sur la salle courante quand il change, sans tout rejoindre.
  useEffect(() => {
    if (!enabled) return
    const ch = channelRef.current
    if (ch) ch.track(encodePresence(visitorId, avatar, joinTsRef.current))
  }, [avatar, enabled, visitorId])

  useEffect(() => {
    if (!enabled) return
    if (import.meta.env.VITE_PRESENCE === 'off') return
    const client = depsRef.current.getClient()
    if (!client) return // Supabase non configuré : mode solo silencieux, rien à nettoyer.

    // Les tests E2E s'isolent dans leurs propres salles (`?e2e=1&presenceRoom=…`) pour ne jamais
    // croiser de vrais visiteurs ni se gêner entre eux.
    let namespace: string | null = null
    if (debugEnabled()) {
      try {
        namespace = sanitizeNamespace(new URLSearchParams(window.location.search).get('presenceRoom'))
      } catch {
        namespace = null
      }
    }

    let cancelled = false
    let attempt = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let sendTimer: ReturnType<typeof setInterval> | undefined
    let sendState: SendState | null = null
    let hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined
    // Vrai entre le moment où l'onglet caché depuis trop longtemps nous a fait quitter le canal et
    // le retour au premier plan qui nous fait rejoindre : distingue ce cas d'une simple pause
    // courte (où `sendState` est juste remis à zéro, sans quitter/rejoindre).
    let leftForHidden = false
    // Incrémenté à chaque départ de canal (nouvelle salle, ou départ volontaire pour onglet caché).
    // Une reconnexion réseau (`CHANNEL_ERROR`/`TIMED_OUT`) crée un nouveau canal qui ne confirme sa
    // connexion (`SUBSCRIBED`) que de façon asynchrone ; si `leaveForHidden` décide de quitter entre
    // temps, cette confirmation tardive ne doit plus jamais republier notre présence (`track`) —
    // sans quoi on redevient exactement le visiteur fantôme que ce module doit éviter. Chaque
    // callback asynchrone du canal capture la génération courante à sa création et se désactive dès
    // qu'elle ne correspond plus à `generation` (voir `usePresence.test.ts`).
    let generation = 0

    const stopSendLoop = () => {
      if (sendTimer !== undefined) {
        clearInterval(sendTimer)
        sendTimer = undefined
      }
    }

    const leaveChannel = () => {
      generation += 1
      stopSendLoop()
      sendState = null
      const ch = channelRef.current
      channelRef.current = null
      if (ch) ch.unsubscribe()
    }

    const goSolo = () => {
      leaveChannel()
      clearPeers(peerStore)
      setPeersCount(0)
    }

    const startSendLoop = () => {
      if (sendTimer !== undefined) return
      sendTimer = setInterval(() => {
        if (cancelled || hidden) return
        const ch = channelRef.current
        if (!ch) return
        const now = depsRef.current.now()
        const moving = player.moving
        if (!shouldSendPosition(sendState, moving, now)) return
        sendState = { lastSentAt: now, lastSentMoving: moving }
        ch.send(POSITION_EVENT, encodePosition(visitorId, player.x, player.z, player.rotY, moving))
      }, SEND_TICK_MS)
    }

    const scheduleReconnect = (index: number) => {
      attempt += 1
      if (attempt > MAX_RECONNECT_ATTEMPTS) {
        goSolo()
        return
      }
      const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS)
      reconnectTimer = setTimeout(() => {
        if (!cancelled) joinRoom(index)
      }, delay)
    }

    /** Rejoint `index`, ou repasse en solo si on a dépassé la dernière salle (`nextRoomIndex` → `null`). */
    const enterRoom = (index: number | null) => {
      if (index === null) {
        goSolo()
        return
      }
      joinRoom(index)
    }

    const joinRoom = (index: number) => {
      if (cancelled) return
      leaveChannel()
      clearPeers(peerStore) // nouvelle salle : l'ancien roster ne concerne plus personne ici.
      joinTsRef.current = depsRef.current.now()
      const myGeneration = generation // capturée après leaveChannel() : cette tentative-ci.

      const ch = client.channel(roomName(index, namespace))

      ch.onPresenceSync(() => {
        if (cancelled || myGeneration !== generation) return
        const entries = parsePresenceState(ch.presenceState())
        const others = entries.filter((e) => e.id !== visitorId)
        const now = depsRef.current.now()
        const seen = new Set<string>()
        for (const entry of others) {
          seen.add(entry.id)
          upsertAvatar(peerStore, entry.id, entry.avatar, now)
        }
        for (const id of peerStore.peers.keys()) {
          if (!seen.has(id)) removePeer(peerStore, id)
        }
        setPeersCount(others.length)

        const members: RoomMember[] = [
          ...others.map((e) => ({ id: e.id, joinTs: e.joinTs })),
          { id: visitorId, joinTs: joinTsRef.current },
        ]
        if (!shouldStayInRoom(visitorId, members, ROOM_CAPACITY)) enterRoom(nextRoomIndex(index, MAX_ROOMS))
      })

      ch.onBroadcast(POSITION_EVENT, (payload) => {
        if (cancelled || myGeneration !== generation) return
        const decoded = decodePosition(payload)
        if (decoded && decoded.id !== visitorId) recordPosition(peerStore, decoded.id, decoded.sample, depsRef.current.now())
      })

      ch.subscribe((status) => {
        if (cancelled || myGeneration !== generation) return
        if (status === 'SUBSCRIBED') {
          attempt = 0
          channelRef.current = ch
          ch.track(encodePresence(visitorId, avatarRef.current, joinTsRef.current))
          startSendLoop()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          scheduleReconnect(index)
        }
        // CLOSED : soit nous avons nous-mêmes quitté (changement de salle, démontage), soit un
        // aléa serveur — dans les deux cas on ne relance pas depuis ici pour éviter toute boucle.
      })
    }

    const clearHiddenTimer = () => {
      if (hiddenTimer !== undefined) {
        clearTimeout(hiddenTimer)
        hiddenTimer = undefined
      }
    }

    /**
     * Onglet caché depuis plus de `HIDDEN_LEAVE_MS` : quitte proprement la présence (untrack puis
     * unsubscribe) plutôt que de rester un visiteur fantôme figé à sa dernière position pour tout
     * le monde. `leftForHidden` fait rejoindre au retour au premier plan (voir `onVisibility`).
     */
    const leaveForHidden = () => {
      if (leftForHidden) return
      leftForHidden = true
      // Une reconnexion pouvait déjà être programmée (erreur réseau juste avant le seuil) : on
      // annule cette relance en attente pour ne pas rejoindre une salle juste après avoir décidé de
      // partir (`leaveChannel()` ci-dessous invalide de toute façon toute tentative déjà en vol).
      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer)
        reconnectTimer = undefined
      }
      const ch = channelRef.current
      if (ch) ch.untrack()
      leaveChannel()
      clearPeers(peerStore)
      setPeersCount(0)
    }

    const scheduleHiddenLeave = () => {
      clearHiddenTimer()
      hiddenTimer = setTimeout(() => {
        if (!cancelled) leaveForHidden()
      }, HIDDEN_LEAVE_MS)
    }

    const onVisibility = () => {
      hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
      if (hidden) {
        scheduleHiddenLeave()
        return
      }
      clearHiddenTimer()
      sendState = null // au retour au premier plan : republier tout de suite.
      if (leftForHidden) {
        leftForHidden = false
        enterRoom(1)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    // Montage direct sur un onglet déjà caché (préchargement, ouverture en arrière-plan) : aucun
    // `visibilitychange` ne se déclenchera avant un premier passage au premier plan, donc sans ce
    // cas explicite le délai de 30 s ne démarrerait jamais et on resterait un visiteur fantôme
    // indéfiniment tant que l'onglet n'est jamais regardé.
    if (hidden) scheduleHiddenLeave()

    const pruneTimer = setInterval(() => {
      pruneStale(peerStore, depsRef.current.now(), EFFECTIVE_PEER_TIMEOUT_MS)
    }, PRUNE_TICK_MS)

    joinRoom(1)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer)
      clearHiddenTimer()
      clearInterval(pruneTimer)
      leaveChannel()
      clearPeers(peerStore)
      setPeersCount(0)
    }
    // avatarRef/depsRef portent les valeurs courantes : pas besoin de relancer cet effet quand
    // l'avatar change, ni si l'appelant passe un nouvel objet `deps` à chaque rendu (tests).
  }, [enabled, visitorId, setPeersCount])
}
