/**
 * Machine d'état de la présence temps réel, hors de React (importable depuis Node : aucun `window`,
 * `document`, React, three ni zustand — tout ce qui dépend de l'environnement passe par les options).
 * `usePresence.ts` n'est plus qu'un câblage (client, joueur, visibilité de l'onglet) autour de ceci ; les
 * tests unitaires et le banc de charge pilotent la même machine avec un faux client et une fausse horloge.
 *
 * Cycle de vie d'un joueur :
 *   idle → waiting (gigue d'arrivée) → joining → subscribed ⇄ (saut direct de salle : joining → subscribed)
 *   subscribed → backoff → joining (canal en erreur/fermé) … → solo (échecs répétés, musée plein)
 *   joining | subscribed → solo DIRECTEMENT quand le serveur signale un quota dépassé (voir `quota.ts` : 200 connexions,
 *     jointures/s, messages/s, présence…) : ni reconnexion, WebSocket fermée, nouvelle tentative seulement après
 *     `quotaSoloRetryMs` (5 min environ) sur une seule salle sondée.
 *   tout état → hidden (onglet caché trop longtemps) → waiting → joining → … ; tout état → stopped.
 *
 * Où l'on entre : room-1 par défaut en production (les arrivées se remplissent salle après salle : 7 salles pour ~200
 * joueurs, voir README) ou une salle tirée au hasard dans 1..maxRooms (`VITE_PRESENCE_START=random`), la dernière
 * salle connue au retour d'un onglet caché, et pour une nouvelle tentative depuis le solo une seule salle « sondée »
 * (pas de traversée, pas de position publiée si elle est pleine).
 *
 * Invariants (chacun répond à un bug confirmé par l'audit du SDK, voir README) :
 * - Un ancien canal, même jamais abonné, est TOUJOURS retiré (`unsubscribe`) et sa résolution attendue avant
 *   de recréer un canal : `client.channel(topic)` ne ressort alors jamais l'instance périmée, sur laquelle
 *   `on('presence')` lèverait.
 * - Une génération invalide tous les rappels d'un canal abandonné ; aucun rappel, minuteur ou promesse ne
 *   laisse remonter d'exception.
 * - Aucun envoi hors canal SUBSCRIBED et rejoint (sinon le SDK bascule chaque `send` en POST REST).
 * - Aucune synchronisation des clients : gigue à l'arrivée, avant chaque saut, sur chaque reconnexion.
 */
import {
  peerStore,
  upsertPeer,
  removePeer,
  recordPosition,
  pruneStale,
  clearPeers,
  shouldSendPosition,
  IDLE_HEARTBEAT_MS,
  MOVE_SEND_INTERVAL_MS,
  PEER_SILENCE_TIMEOUT_MS,
  type PeerStore,
  type SendState,
} from './peers'
import { MAX_ROOMS, ROOM_CAPACITY, roomName, sortByJoinOrder, targetRoomForRank, type RoomMember } from './roomSelection'
import { POSITION_EVENT, encodePosition, encodePresence, decodePosition, decodePresence } from './protocol'
import { classifyQuota, errorTexts, quotaFromSystemPayload, type QuotaKind } from './quota'
import type { ChannelStatus, RealtimeChannelLike, RealtimeClientLike } from './realtimeClient'

export interface PresenceConfig {
  roomCapacity: number
  maxRooms: number
  /** Intervalle minimal entre deux envois de position en mouvement. */
  moveSendIntervalMs: number
  /** Battement à l'arrêt. */
  idleHeartbeatMs: number
  /** Gigue uniforme [0, x[ avant la toute première jointure. */
  initialJoinJitterMs: number
  /** Gigue uniforme [min, max[ avant un saut de salle (et avant la jointure au retour d'un onglet caché). */
  hopDelayMinMs: number
  hopDelayMaxMs: number
  /** Reconnexions tentées après un échec de canal, avant de passer en solo (échec n° max+1 = solo). */
  reconnectMaxAttempts: number
  reconnectBaseMs: number
  reconnectMaxMs: number
  /** Nouvelle tentative (une seule salle sondée) après cette durée (× gigue 0,75–1,25) ; 0 = rester solo. */
  soloRetryMs: number
  /**
   * Idem après un quota dépassé (serveur saturé : retenter aussitôt l'aggraverait), 5 min environ ; 0 = rester solo.
   * Un retour d'onglet caché pendant ce délai ne le raccourcit pas.
   */
  quotaSoloRetryMs: number
  /** Onglet caché depuis plus longtemps que ça : on quitte la présence (pas de fantôme). */
  hiddenLeaveMs: number
  /** Silence après lequel un pair est retiré du rendu (filet de sécurité). */
  peerTimeoutMs: number
}

/**
 * Marge de sécurité au-dessus du battement au repos : le délai effectif doit rester strictement
 * supérieur à `1.5 × IDLE_HEARTBEAT_MS`, sans quoi un battement qui glisse un peu (`setInterval` n'est pas
 * exact, et `pruneStale` n'est lui-même vérifié que toutes les `PRUNE_TICK_MS`) ferait clignoter un pair
 * pourtant toujours connecté juste avant l'arrivée du battement suivant. `1.6` (et non `1.5` pile) laisse
 * une vraie marge, pas une égalité fragile.
 */
const PEER_TIMEOUT_SAFETY_FACTOR = 1.6

/**
 * Délai d'expiration réellement utilisé pour un pair silencieux. Volontairement plus large que
 * `PEER_SILENCE_TIMEOUT_MS` (la valeur par défaut, testée isolément dans `peers.test.ts`) : le battement
 * au repos n'arrive que toutes les `IDLE_HEARTBEAT_MS`, donc un pair immobile mais toujours connecté ne doit
 * jamais dépasser ce délai entre deux battements, sous peine de clignoter côté receveur.
 */
export const EFFECTIVE_PEER_TIMEOUT_MS = Math.max(PEER_SILENCE_TIMEOUT_MS, Math.round(IDLE_HEARTBEAT_MS * PEER_TIMEOUT_SAFETY_FACTOR))

export const DEFAULT_PRESENCE_CONFIG: PresenceConfig = {
  // Décision du 01/10 : 8 salles de 30 (240 places pour ~200 joueurs), 1 envoi/s en mouvement.
  roomCapacity: ROOM_CAPACITY,
  maxRooms: MAX_ROOMS,
  moveSendIntervalMs: MOVE_SEND_INTERVAL_MS,
  idleHeartbeatMs: 10000,
  initialJoinJitterMs: 2500,
  hopDelayMinMs: 150,
  hopDelayMaxMs: 600,
  reconnectMaxAttempts: 4,
  reconnectBaseMs: 1000,
  reconnectMaxMs: 15000,
  soloRetryMs: 180000,
  quotaSoloRetryMs: 300000,
  hiddenLeaveMs: 30000,
  peerTimeoutMs: EFFECTIVE_PEER_TIMEOUT_MS,
}

export type PresenceState = 'idle' | 'waiting' | 'joining' | 'subscribed' | 'backoff' | 'solo' | 'hidden' | 'stopped'

export interface PresenceStats {
  state: PresenceState
  room: number | null
  /** Canaux créés (tentatives de jointure, réussies ou non). */
  joins: number
  /** Sauts de salle décidés par le rang (hors reconnexions). */
  hops: number
  /** Jointures relancées après un échec de canal. */
  reconnects: number
  /** CLOSED non demandés par nous (le serveur a fermé le canal). */
  closedByServer: number
  /** Erreurs par clé (début du message de l'Error du SDK, ou statut). */
  errors: Record<string, number>
  lastError: string | null
  /** `'quota'` quand le serveur a signalé un quota dépassé ; sinon le motif en clair (« musée plein », « connexion impossible… »). */
  soloReason: string | null
  /** Type du quota signalé par le serveur (voir `quota.ts`), tant que ce quota est la raison du solo ; sinon `null`. */
  quota: QuotaKind | null
  sent: number
  received: number
}

export interface PresenceTimers {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(h: unknown): void
  setInterval(fn: () => void, ms: number): unknown
  clearInterval(h: unknown): void
}

export interface PresenceSessionOptions {
  client: RealtimeClientLike
  visitorId: string
  namespace?: string | null
  getPlayer: () => { x: number; z: number; rotY: number; moving: boolean }
  onPeersCount?: (n: number) => void
  onStats?: (s: PresenceStats) => void
  /** Défaut : le registre partagé du jeu (`peerStore`). */
  store?: PeerStore
  now?: () => number
  /** [0, 1) */
  random?: () => number
  timers?: PresenceTimers
  config?: Partial<PresenceConfig>
  /** État initial de visibilité de l'onglet. */
  hidden?: boolean
  log?: (msg: string) => void
  /** Salle (1..maxRooms) où entrer à l'arrivée et pour un sondage depuis le solo. Défaut : tirage uniforme via `random`. */
  pickStartRoom?: () => number
}

export interface PresenceSession {
  start(): void
  stop(): void
  setHidden(hidden: boolean): void
  stats(): PresenceStats
}

/** Vérifie la décision d'envoi 10x/s ; `shouldSendPosition` fait le vrai throttle. */
const SEND_TICK_MS = 100
const PRUNE_TICK_MS = 2000
/** Nouvelle tentative de `track` après un refus : entre 1 et 2 s. */
const TRACK_RETRY_MIN_MS = 1000
const TRACK_RETRY_MAX_MS = 2000
/**
 * Un canal n'est jugé sain (compteur d'échecs remis à zéro) qu'après un `track` accepté ET cette durée sans
 * erreur ni fermeture : un serveur qui accepte le join puis refuse `track` ou referme aussitôt ne doit pas
 * relancer le recul à 1 s à chaque cycle (boucle sans fin qui entretient la surcharge).
 */
const STABLE_CHANNEL_MS = 30000
/** Un sondage depuis le solo qui n'a reçu aucun sync dans ce délai (après `track` accepté) publie sa position. */
const PROBE_MAX_MS = 5000
/** Garde-fou : `unsubscribe` qui ne se résoudrait jamais ne doit pas bloquer la session. */
const UNSUBSCRIBE_SAFETY_MS = 15000

const defaultTimers: PresenceTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
}

function parsePresenceState(state: Record<string, unknown[]>): RoomMember[] {
  const out: RoomMember[] = []
  for (const metas of Object.values(state)) {
    for (const meta of metas) {
      const decoded = decodePresence(meta)
      if (decoded) out.push({ id: decoded.id, joinTs: decoded.joinTs })
    }
  }
  return out
}

/** Un seul membre par id : on garde le plus petit `joinTs` (la plus ancienne arrivée). */
function dedupeById(members: readonly RoomMember[]): RoomMember[] {
  const byId = new Map<string, RoomMember>()
  for (const m of members) {
    const known = byId.get(m.id)
    if (!known || m.joinTs < known.joinTs) byId.set(m.id, m)
  }
  return [...byId.values()]
}

interface Slot {
  set(fn: () => void, ms: number): void
  clear(): void
  readonly active: boolean
}

export function createPresenceSession(opts: PresenceSessionOptions): PresenceSession {
  const cfg: PresenceConfig = { ...DEFAULT_PRESENCE_CONFIG, ...opts.config }
  const { client, visitorId } = opts
  const namespace = opts.namespace ?? null
  const store = opts.store ?? peerStore
  const now = opts.now ?? (() => Date.now())
  const random = opts.random ?? Math.random
  const timers = opts.timers ?? defaultTimers
  const log = opts.log ?? (() => {})

  let state: PresenceState = 'idle'
  let started = false
  let stopped = false
  let hidden = opts.hidden ?? false
  /** Vrai entre le départ pour onglet caché (ou un démarrage sur onglet caché) et le retour au premier plan. */
  let leftForHidden = false
  let room: number | null = null
  let channel: RealtimeChannelLike | null = null
  let channelSubscribed = false
  /** Incrémenté à chaque abandon de canal et à chaque nouvelle jointure : invalide tous les rappels périmés. */
  let generation = 0
  let joinTs = 0
  let attempts = 0
  let sendState: SendState | null = null
  let hopWanted = false
  let hopTarget: number | null = null
  let lastEmitKey = ''
  /** Dernière salle demandée (null après un passage en solo) : on y revient après un onglet caché. */
  let lastRoom: number | null = null
  /** Sondage depuis le solo : tant que vrai, aucune position n'est publiée et une salle pleine ramène en solo. */
  let probing = false
  /** `track` accepté sur le canal courant. */
  let trackedOk = false

  let joins = 0
  let hops = 0
  let reconnects = 0
  let closedByServer = 0
  let sent = 0
  let received = 0
  let lastError: string | null = null
  let soloReason: string | null = null
  /** Quota signalé par le serveur, tant qu'il est la raison du solo. */
  let quotaKind: QuotaKind | null = null
  /** Instant (horloge `now`) avant lequel aucune nouvelle jointure n'est tentée après un quota ; `null` sinon. */
  let quotaUntil: number | null = null
  const errors: Record<string, number> = {}

  // -------------------------------------------------------------------------------------------
  // Minuteurs : tous passent par un `Slot` (un seul actif à la fois), protégé contre les exceptions.

  const safeties = new Set<Slot>()
  const inflight = new Set<Promise<void>>()

  function guard(fn: () => void): void {
    try {
      fn()
    } catch (e) {
      noteError('internal', e instanceof Error ? e.message : String(e))
    }
  }

  function slot(kind: 'timeout' | 'interval'): Slot {
    let box: { h: unknown } | null = null
    const clear = () => {
      if (!box) return
      const b = box
      box = null
      if (kind === 'timeout') timers.clearTimeout(b.h)
      else timers.clearInterval(b.h)
    }
    return {
      set(fn, ms) {
        clear()
        const b: { h: unknown } = { h: undefined }
        box = b
        if (kind === 'timeout') {
          b.h = timers.setTimeout(() => {
            if (box === b) box = null
            guard(fn)
          }, ms)
        } else {
          b.h = timers.setInterval(() => guard(fn), ms)
        }
      },
      clear,
      get active() {
        return box !== null
      },
    }
  }

  const transition = slot('timeout') // attente avant (re)jointure : arrivée, recul, retour d'onglet, nouvelle tentative solo
  const hopSlot = slot('timeout') // gigue avant un saut de salle
  const trackRetry = slot('timeout')
  const stableSlot = slot('timeout') // canal resté sain assez longtemps : le compteur d'échecs repart de zéro
  const probeSlot = slot('timeout') // filet d'un sondage qui ne reçoit jamais de sync
  const hiddenSlot = slot('timeout')
  const sendSlot = slot('interval')
  const pruneSlot = slot('interval')

  // -------------------------------------------------------------------------------------------
  // Observabilité

  function noteError(key: string, last: string): void {
    errors[key] = (errors[key] ?? 0) + 1
    lastError = last
  }

  function snapshot(): PresenceStats {
    return { state, room, joins, hops, reconnects, closedByServer, errors: { ...errors }, lastError, soloReason, quota: quotaKind, sent, received }
  }

  function emitStats(): void {
    try {
      opts.onStats?.(snapshot())
    } catch {
      // un observateur qui plante ne doit jamais casser la session.
    }
  }

  function setState(next: PresenceState): void {
    state = next
    const key = `${next}|${room}`
    if (key !== lastEmitKey) {
      lastEmitKey = key
      emitStats()
    }
  }

  function setPeers(n: number): void {
    try {
      opts.onPeersCount?.(n)
    } catch {
      // idem.
    }
  }

  function resetRoomView(): void {
    clearPeers(store) // changement de salle : l'ancien roster ne concerne plus personne ici.
    setPeers(0)
  }

  // -------------------------------------------------------------------------------------------
  // Canal : abandon et création

  /**
   * Abandonne le canal courant (s'il y en a un, abonné ou non) : invalide ses rappels, arrête la boucle
   * d'envoi, l'annonce (`untrack`) si elle a pu être publiée, puis le retire via `unsubscribe()` dont la
   * résolution est suivie dans `inflight` (la prochaine création de canal l'attend).
   */
  function detach(withUntrack: boolean): void {
    generation += 1
    sendSlot.clear()
    hopSlot.clear()
    trackRetry.clear()
    stableSlot.clear()
    probeSlot.clear()
    hopWanted = false
    sendState = null
    trackedOk = false
    probing = false
    const ch = channel
    const wasSubscribed = channelSubscribed
    channel = null
    channelSubscribed = false
    if (!ch) return

    // `untrack` sur un canal jamais rejoint lèverait dans le SDK (« before joining ») : seulement si abonné.
    if (withUntrack && wasSubscribed) {
      try {
        void Promise.resolve(ch.untrack()).catch(() => {})
      } catch {
        // rien.
      }
    }
    const safety = slot('timeout')
    safeties.add(safety)
    const p = new Promise<void>((resolve) => {
      const done = () => {
        safety.clear()
        safeties.delete(safety)
        resolve()
      }
      safety.set(() => {
        noteError('unsubscribe timeout', 'unsubscribe sans réponse')
        done()
      }, UNSUBSCRIBE_SAFETY_MS)
      try {
        Promise.resolve(ch.unsubscribe()).then(done, done)
      } catch {
        done()
      }
    })
    inflight.add(p)
    void p.then(() => inflight.delete(p))
  }

  /** Exécute `fn` quand tous les canaux abandonnés ont fini de partir, si `gen` est toujours la génération courante. */
  function afterDetach(gen: number, fn: () => void): void {
    if (inflight.size === 0) {
      fn()
      return
    }
    void Promise.all([...inflight]).then(() => {
      if (!stopped && gen === generation) guard(fn)
    })
  }

  function randomRoom(): number {
    const max = Math.max(1, cfg.maxRooms)
    return Math.min(max, 1 + Math.floor(random() * max))
  }

  function startRoom(): number {
    const max = Math.max(1, cfg.maxRooms)
    const raw = opts.pickStartRoom ? opts.pickStartRoom() : randomRoom()
    return Number.isFinite(raw) ? Math.min(max, Math.max(1, Math.floor(raw))) : 1
  }

  function joinRoom(index: number, probe = false): void {
    if (stopped) return
    detach(true)
    probing = probe
    const gen = generation
    room = index
    lastRoom = index
    resetRoomView()
    setState('joining')
    afterDetach(gen, () => createChannel(index, gen))
  }

  function createChannel(index: number, gen: number): void {
    if (stopped || gen !== generation) return
    joinTs = now()
    joins += 1
    let ch: RealtimeChannelLike
    try {
      ch = client.channel(roomName(index, namespace))
    } catch (e) {
      onFailure(gen, 'channel', e)
      return
    }
    channel = ch
    channelSubscribed = false
    try {
      ch.onPresenceSync(() => guard(() => onSync(ch, gen)))
      ch.onBroadcast(POSITION_EVENT, (payload) => guard(() => onBroadcast(gen, payload)))
      // Le `phx_close` qui suit un quota ne porte aucune erreur côté SDK (`CLOSED` seul) : la cause n'est que dans le
      // message `system` qui le précède.
      ch.onSystem?.((payload) => guard(() => onSystem(ch, gen, payload)))
      ch.subscribe((status, err) => guard(() => onStatus(ch, gen, status, err)))
    } catch (e) {
      onFailure(gen, 'subscribe', e)
    }
  }

  function onStatus(ch: RealtimeChannelLike, gen: number, status: ChannelStatus, err?: Error): void {
    if (stopped || gen !== generation || ch !== channel) return
    if (status === 'SUBSCRIBED') {
      // Le compteur d'échecs ne repart PAS de zéro ici : seulement une fois `track` accepté et le canal stable.
      channelSubscribed = true
      sendState = null
      setState('subscribed')
      tryTrack(ch, gen, 0)
      if (!probing) sendSlot.set(sendTick, SEND_TICK_MS)
    } else if (status === 'CLOSED') {
      // Nous retirons nous-mêmes nos canaux en invalidant d'abord la génération : un CLOSED qui arrive
      // ici n'est donc jamais le nôtre, c'est le serveur (message système, limite de débit…).
      closedByServer += 1
      onFailure(gen, 'CLOSED', err)
    } else {
      onFailure(gen, status, err)
    }
  }

  /** `track` avec une seule nouvelle tentative (1–2 s) avant de traiter l'échec comme une erreur de canal. */
  function tryTrack(ch: RealtimeChannelLike, gen: number, attempt: number): void {
    const stale = () => stopped || gen !== generation || ch !== channel
    const fail = (why: string) => {
      if (stale()) return
      if (attempt === 0) {
        trackRetry.set(() => {
          if (!stale()) tryTrack(ch, gen, 1)
        }, TRACK_RETRY_MIN_MS + random() * (TRACK_RETRY_MAX_MS - TRACK_RETRY_MIN_MS))
      } else {
        onFailure(gen, 'track', new Error(`track ${why}`))
      }
    }
    try {
      Promise.resolve(ch.track(encodePresence(visitorId, joinTs))).then(
        (result) => {
          if (stale()) return
          if (result === 'ok') guard(onTracked)
          else guard(() => fail(String(result)))
        },
        () => guard(() => fail('error')),
      )
    } catch {
      fail('error')
    }
  }

  /** `track` accepté : le canal devient « sain » s'il n'échoue pas pendant `STABLE_CHANNEL_MS`. */
  function onTracked(): void {
    trackedOk = true
    stableSlot.set(() => {
      attempts = 0
    }, STABLE_CHANNEL_MS)
    if (probing) probeSlot.set(() => endProbe(), PROBE_MAX_MS)
  }

  /** Le sondage est concluant (ou sans réponse) : on reste dans la salle et on publie notre position. */
  function endProbe(): void {
    if (!probing) return
    probing = false
    probeSlot.clear()
    if (channel && channelSubscribed && !sendSlot.active) {
      sendState = null
      sendSlot.set(sendTick, SEND_TICK_MS)
    }
  }

  // -------------------------------------------------------------------------------------------
  // Échec de canal, recul, solo

  function onFailure(gen: number, status: string, err?: unknown): void {
    if (stopped || gen !== generation) return
    const message = err instanceof Error ? err.message : err ? String(err) : ''
    noteError(message ? message.slice(0, 60) : status, message || status)
    // Quota dépassé (jointure refusée : 200 connexions, jointures/s… ; ou canal fermé pour le même motif) : solo tout de
    // suite, sans les reconnexions qui aggraveraient la saturation.
    const quota = classifyQuota(...errorTexts(err))
    if (quota) {
      goSolo(quota, quota)
      return
    }
    const wasProbing = probing // un sondage qui échoue reste un sondage à la reconnexion.
    detach(false) // pas d'`untrack` : le canal est déjà mort ou refusé.
    attempts += 1
    if (attempts > cfg.reconnectMaxAttempts) {
      goSolo(`connexion impossible (${lastError ?? status})`)
      return
    }
    const base = Math.min(cfg.reconnectBaseMs * 2 ** (attempts - 1), cfg.reconnectMaxMs)
    const delay = base * (0.5 + random())
    setState('backoff')
    transition.set(() => {
      reconnects += 1
      if (room !== null) joinRoom(room, wasProbing) // la MÊME salle : l'échec n'a rien à voir avec la salle.
    }, delay)
  }

  /** Message `system` du serveur : seule une erreur de quota (« Too many messages per second »…) nous intéresse. */
  function onSystem(ch: RealtimeChannelLike, gen: number, payload: unknown): void {
    if (stopped || gen !== generation || ch !== channel) return
    const quota = quotaFromSystemPayload(payload)
    if (!quota) return
    noteError(quota.message.slice(0, 60) || quota.kind, quota.message || quota.kind)
    goSolo(quota.kind, quota.kind)
  }

  /**
   * Passe en solo. `quota` : le serveur a signalé un quota dépassé. Le motif devient `'quota'`, le canal est retiré
   * sans `untrack` (il est refusé ou déjà fermé par le serveur), la WebSocket est fermée, et la prochaine tentative
   * (une seule salle sondée) attend `quotaSoloRetryMs` au lieu de `soloRetryMs`.
   */
  function goSolo(reason: string, quota: QuotaKind | null = null): void {
    detach(quota === null)
    transition.clear()
    resetRoomView()
    room = null
    lastRoom = null
    attempts = 0
    quotaKind = quota
    soloReason = quota ? 'quota' : reason
    const retryMs = quota ? cfg.quotaSoloRetryMs : cfg.soloRetryMs
    const delay = retryMs > 0 ? retryMs * (0.75 + random() * 0.5) : 0
    quotaUntil = quota && delay > 0 ? now() + delay : null
    setState('solo')
    log(quota ? `[presence] mode solo : quota (${quota})` : `[presence] mode solo : ${reason}`)
    closeSocketWhenIdle()
    if (delay > 0) scheduleSoloProbe(delay)
  }

  /** Une seule salle sondée, tirée au hasard quelle que soit la salle d'entrée : pas de traversée depuis room-1. */
  function scheduleSoloProbe(delayMs: number): void {
    transition.set(() => {
      soloReason = null
      quotaKind = null
      quotaUntil = null
      joinRoom(randomRoom(), true)
    }, delayMs)
  }

  /**
   * Plus aucun canal (solo, onglet caché) : on ferme aussi la WebSocket, sinon le SDK la garde ouverte environ
   * 50 s (2 × heartbeat) et 200 joueurs en rafale atteignent le plafond de 200 connexions. Jamais entre deux
   * canaux d'un saut ou d'une reconnexion (la génération aurait changé, ou un canal existe).
   */
  function closeSocketWhenIdle(): void {
    afterDetach(generation, () => {
      if (channel === null) client.disconnect?.()
    })
  }

  // -------------------------------------------------------------------------------------------
  // Synchronisation de présence et saut de salle

  function onSync(ch: RealtimeChannelLike, gen: number): void {
    if (stopped || gen !== generation || ch !== channel || room === null) return
    const entries = dedupeById(parsePresenceState(ch.presenceState()))
    const others = entries.filter((e) => e.id !== visitorId)
    const view = dedupeById([...others, { id: visitorId, joinTs }])
    const rank = sortByJoinOrder(view).findIndex((m) => m.id === visitorId)
    const target = targetRoomForRank(room, rank, cfg.roomCapacity, cfg.maxRooms)
    if (probing) {
      if (target !== room) {
        // Salle sondée pleine : retour immédiat en solo, sans saut plus loin ni position publiée.
        goSolo('musée plein')
        return
      }
      endProbe()
    }
    const t = now()
    const seen = new Set<string>()
    for (const other of others) {
      seen.add(other.id)
      upsertPeer(store, other.id, t)
    }
    for (const id of [...store.peers.keys()]) {
      if (!seen.has(id)) removePeer(store, id)
    }
    setPeers(others.length)

    if (target === room) {
      // La décision de partir ne tient plus (quelqu'un est parti devant nous) : on annule le saut annoncé.
      hopSlot.clear()
      hopWanted = false
      return
    }
    hopTarget = target
    if (hopWanted) return // un saut est déjà annoncé ; il relira la dernière décision à l'échéance.
    hopWanted = true
    const delay = cfg.hopDelayMinMs + random() * Math.max(0, cfg.hopDelayMaxMs - cfg.hopDelayMinMs)
    hopSlot.set(() => {
      if (stopped || gen !== generation || ch !== channel) return
      hopWanted = false
      if (hopTarget === room) return
      if (hopTarget === null) {
        goSolo('musée plein')
        return
      }
      hops += 1
      if (trackedOk) attempts = 0 // un canal qui a accepté notre présence et donné un sync n'est pas en échec.
      joinRoom(hopTarget)
    }, delay)
  }

  function onBroadcast(gen: number, payload: unknown): void {
    if (stopped || gen !== generation) return
    received += 1
    const decoded = decodePosition(payload)
    if (decoded && decoded.id !== visitorId) recordPosition(store, decoded.id, decoded.sample, now())
  }

  // -------------------------------------------------------------------------------------------
  // Boucle d'envoi

  function sendTick(): void {
    if (stopped || hidden || state !== 'subscribed' || !channel || !channelSubscribed) return
    const ch = channel
    const joined = (() => {
      try {
        return ch.isJoined()
      } catch {
        return false
      }
    })()
    if (!joined) return // jamais de repli REST : on n'envoie que sur un canal réellement rejoint.
    const player = opts.getPlayer()
    const t = now()
    if (!shouldSendPosition(sendState, player.moving, t, cfg.moveSendIntervalMs, cfg.idleHeartbeatMs)) return
    sendState = { lastSentAt: t, lastSentMoving: player.moving }
    try {
      ch.send(POSITION_EVENT, encodePosition(visitorId, player.x, player.z, player.rotY, player.moving))
      sent += 1
    } catch (e) {
      onFailure(generation, 'send', e)
    }
  }

  // -------------------------------------------------------------------------------------------
  // Onglet caché

  function leaveForHidden(): void {
    if (stopped || leftForHidden) return
    leftForHidden = true
    detach(true) // untrack + départ : plus de visiteur fantôme figé pour les autres.
    transition.clear() // une jointure ou un recul en attente ne doit pas rejoindre après cette décision.
    resetRoomView()
    room = null
    attempts = 0
    soloReason = null
    quotaKind = null // le délai (`quotaUntil`) survit : il est relu au retour au premier plan.
    setState('hidden')
    closeSocketWhenIdle()
  }

  function returnFromHidden(): void {
    leftForHidden = false
    attempts = 0
    soloReason = null
    // Quota signalé il y a moins de `quotaSoloRetryMs` : le retour au premier plan ne raccourcit pas le délai (un
    // téléphone qu'on déverrouille ne doit pas rouvrir une jointure sur un serveur saturé). On reste solo jusqu'au bout.
    const quotaWaitMs = quotaUntil !== null ? quotaUntil - now() : 0
    if (quotaWaitMs > 0) {
      soloReason = 'quota'
      setState('solo')
      scheduleSoloProbe(quotaWaitMs)
      return
    }
    quotaKind = null
    quotaUntil = null
    setState('waiting')
    // Dernière salle connue (on y reprend sa place, en ne sautant que vers l'avant) ; sinon on revient du solo :
    // un sondage sur une salle tirée au hasard ; sinon (jamais rejoint) une salle tirée au hasard.
    const back = lastRoom
    const probe = back === null && joins > 0
    transition.set(() => joinRoom(back ?? (probe ? randomRoom() : startRoom()), probe),cfg.hopDelayMinMs + random() * Math.max(0, cfg.hopDelayMaxMs - cfg.hopDelayMinMs))
  }

  // -------------------------------------------------------------------------------------------
  // API publique

  return {
    start() {
      if (started || stopped) return
      started = true
      pruneSlot.set(() => {
        pruneStale(store, now(), cfg.peerTimeoutMs)
      }, PRUNE_TICK_MS)
      if (hidden) {
        // Démarrage sur un onglet caché (préchargement, arrière-plan) : on ne rejoint rien, donc aucun
        // fantôme ; la jointure se fera au premier passage au premier plan.
        leftForHidden = true
        setState('hidden')
        return
      }
      setState('waiting')
      transition.set(() => joinRoom(startRoom()), random() * cfg.initialJoinJitterMs)
    },

    stop() {
      if (stopped) return
      stopped = true
      detach(true)
      transition.clear()
      hopSlot.clear()
      trackRetry.clear()
      stableSlot.clear()
      probeSlot.clear()
      hiddenSlot.clear()
      sendSlot.clear()
      pruneSlot.clear()
      for (const s of safeties) s.clear()
      safeties.clear()
      clearPeers(store)
      setPeers(0)
      room = null
      setState('stopped')
    },

    setHidden(next) {
      if (next === hidden) return
      hidden = next
      if (!started || stopped) return
      if (next) {
        if (!leftForHidden) hiddenSlot.set(leaveForHidden, cfg.hiddenLeaveMs)
        return
      }
      hiddenSlot.clear()
      sendState = null // retour au premier plan : republier la position tout de suite.
      if (leftForHidden) returnFromHidden()
    },

    stats: snapshot,
  }
}
