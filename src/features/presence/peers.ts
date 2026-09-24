/**
 * Registre mutable des autres visiteurs, volontairement hors de React (comme `state/runtime.ts`) :
 * `usePresence` y écrit à chaque message reçu, `RemoteVisitors` y lit à chaque image. Aucune de ces
 * écritures ne doit provoquer un rendu React à 60 i/s — seul un changement de *roster* (arrivée/départ
 * d'un pair, ou de son avatar) notifie les abonnés ; les positions se lisent à la demande dans `useFrame`.
 *
 * Fonctions pures et testables : upsert/expiration du registre, interpolation, sélection des pairs
 * visibles, décision d'envoi (throttle). `createPeerStore()` donne une instance isolée pour les tests ;
 * `peerStore` est l'instance partagée utilisée par le jeu.
 */
import type { AvatarConfig } from '../../types'

// ---------------------------------------------------------------------------------------------
// Registre

export interface PositionSample {
  x: number
  z: number
  /** Rotation Y, radians. */
  r: number
  m: boolean
}

interface BufferedSample extends PositionSample {
  /** Horodatage LOCAL de réception (ms) — jamais l'horloge de l'émetteur, non envoyée sur le réseau. */
  recvT: number
}

export interface PeerRecord {
  id: string
  /** `null` tant que la présence (avatar) n'est pas encore arrivée pour cet id. */
  avatar: AvatarConfig | null
  /** Au plus `MAX_POSITION_BUFFER` échantillons, du plus ancien au plus récent. */
  buffer: BufferedSample[]
  /** Dernier signal reçu de ce pair (position ou battement), pour l'expiration par silence. */
  lastSeen: number
}

export interface PeerStore {
  peers: Map<string, PeerRecord>
  rosterListeners: Set<() => void>
}

/** Instance isolée, pour les tests (ou une future salle indépendante). */
export function createPeerStore(): PeerStore {
  return { peers: new Map(), rosterListeners: new Set() }
}

/** Registre partagé du jeu : `usePresence` écrit, `RemoteVisitors` lit. */
export const peerStore: PeerStore = createPeerStore()

function notifyRoster(store: PeerStore): void {
  for (const listener of store.rosterListeners) listener()
}

/** S'abonne aux changements de *roster* (arrivée/départ/avatar) — pas aux positions. */
export function subscribeRoster(store: PeerStore, listener: () => void): () => void {
  store.rosterListeners.add(listener)
  return () => store.rosterListeners.delete(listener)
}

function getOrCreate(store: PeerStore, id: string): PeerRecord {
  let rec = store.peers.get(id)
  if (!rec) {
    rec = { id, avatar: null, buffer: [], lastSeen: 0 }
    store.peers.set(id, rec)
  }
  return rec
}

function avatarEquals(a: AvatarConfig, b: AvatarConfig): boolean {
  return (
    a.name === b.name &&
    a.skinTone === b.skinTone &&
    a.hairColor === b.hairColor &&
    a.outfit === b.outfit &&
    a.outfitColor === b.outfitColor &&
    a.accessory === b.accessory
  )
}

/**
 * Pair vu via `presence.track` (identité + avatar). Notifie le roster seulement si le pair est
 * nouveau ou si son avatar a changé — pas à chaque appel (la présence resynchronise tout le monde
 * à chaque arrivée/départ dans la salle).
 */
export function upsertAvatar(store: PeerStore, id: string, avatar: AvatarConfig, now: number): void {
  const existing = store.peers.get(id)
  const rec = getOrCreate(store, id)
  const changed = !existing || !existing.avatar || !avatarEquals(existing.avatar, avatar)
  rec.avatar = avatar
  rec.lastSeen = now
  if (changed) notifyRoster(store)
}

/** Retire un pair (départ de présence explicite, ou nettoyage de salle). */
export function removePeer(store: PeerStore, id: string): void {
  if (store.peers.delete(id)) notifyRoster(store)
}

/** Vide entièrement le registre (changement de salle, démontage de `usePresence`). */
export function clearPeers(store: PeerStore): void {
  if (store.peers.size === 0) return
  store.peers.clear()
  notifyRoster(store)
}

export const MAX_POSITION_BUFFER = 2

/**
 * Nouvelle position reçue par broadcast. Ne notifie le roster qu'à la toute première position
 * reçue pour un pair déjà connu par sa présence (transition `buffer` vide → non vide) : c'est ce
 * qui rend ce pair sélectionnable par `selectVisiblePeers` (avatar connu *et* position connue), et
 * `RemoteVisitors` met en cache la liste des pairs visibles entre deux notifications de roster — sans
 * cette notification ponctuelle, un pair dont l'avatar arrive avant sa première position resterait
 * invisible jusqu'au prochain aléa de roster (arrivée/départ d'un tiers), parfois jamais. Les
 * positions suivantes, elles, ne notifient jamais (elles arrivent plusieurs fois par seconde ; seul
 * `RemoteVisitors` en `useFrame` doit réagir à chaque image, pas le roster React).
 */
export function recordPosition(store: PeerStore, id: string, sample: PositionSample, now: number): void {
  const rec = getOrCreate(store, id)
  const becomesVisible = rec.avatar !== null && rec.buffer.length === 0
  rec.buffer.push({ ...sample, recvT: now })
  if (rec.buffer.length > MAX_POSITION_BUFFER) rec.buffer.shift()
  rec.lastSeen = now
  if (becomesVisible) notifyRoster(store)
}

export function getPeer(store: PeerStore, id: string): PeerRecord | undefined {
  return store.peers.get(id)
}

export const PEER_SILENCE_TIMEOUT_MS = 6000

/**
 * Retire les pairs silencieux depuis `timeoutMs`. Retourne les ids retirés.
 *
 * Filet de sécurité pour une connexion morte sans événement `leave` propre (onglet qui plante,
 * réseau coupé) : le départ normal passe par `removePeer` sur l'événement de présence, immédiat.
 * `usePresence` appelle cette fonction avec une marge supérieure au battement au repos (voir son
 * commentaire) pour ne pas faire clignoter un pair immobile mais toujours connecté.
 */
export function pruneStale(store: PeerStore, now: number, timeoutMs: number = PEER_SILENCE_TIMEOUT_MS): string[] {
  const removed: string[] = []
  for (const [id, rec] of store.peers) {
    if (now - rec.lastSeen > timeoutMs) removed.push(id)
  }
  for (const id of removed) store.peers.delete(id)
  if (removed.length > 0) notifyRoster(store)
  return removed
}

// ---------------------------------------------------------------------------------------------
// Interpolation (rendu)

export const INTERP_DELAY_MS = 150
export const EXTRAPOLATE_CAP_MS = 300

export interface RenderTransform {
  x: number
  z: number
  rotY: number
  moving: boolean
}

/** Interpolation d'angle par le chemin le plus court (évite le tour complet à ±π). */
function lerpAngle(a: number, b: number, t: number): number {
  const twoPi = Math.PI * 2
  let diff = (b - a) % twoPi
  if (diff > Math.PI) diff -= twoPi
  else if (diff < -Math.PI) diff += twoPi
  return a + diff * t
}

/**
 * Transformation à afficher pour ce pair à l'instant `now`, en rendu retardé de `INTERP_DELAY_MS`
 * (technique classique d'interpolation d'entités : on affiche le passé récent pour toujours avoir
 * deux échantillons entre lesquels interpoler, sans dépendre de l'horloge de l'émetteur puisque le
 * réseau n'envoie aucun horodatage). Au-delà du dernier échantillon, extrapole linéairement,
 * borné à `EXTRAPOLATE_CAP_MS`. `null` si aucun échantillon n'a encore été reçu.
 */
export function getRenderTransform(rec: Pick<PeerRecord, 'buffer'> | undefined, now: number): RenderTransform | null {
  const buffer = rec?.buffer
  if (!buffer || buffer.length === 0) return null

  const older = buffer[0]
  if (buffer.length === 1) return { x: older.x, z: older.z, rotY: older.r, moving: older.m }

  const newer = buffer[1]
  const renderTime = now - INTERP_DELAY_MS
  if (renderTime <= older.recvT) return { x: older.x, z: older.z, rotY: older.r, moving: older.m }

  const span = newer.recvT - older.recvT
  if (span <= 0) return { x: newer.x, z: newer.z, rotY: newer.r, moving: newer.m }

  // t ∈ [0, 1] = interpolation ; t > 1 = extrapolation (bornée) au-delà du dernier échantillon.
  const extra = renderTime > newer.recvT ? Math.min(renderTime - newer.recvT, EXTRAPOLATE_CAP_MS) : 0
  const t = extra > 0 ? 1 + extra / span : (renderTime - older.recvT) / span

  return {
    x: older.x + (newer.x - older.x) * t,
    z: older.z + (newer.z - older.z) * t,
    rotY: lerpAngle(older.r, newer.r, t),
    moving: newer.m,
  }
}

// ---------------------------------------------------------------------------------------------
// Sélection des pairs visibles

export const MAX_VISIBLE_PEERS = 40

function distSq(rec: PeerRecord, px: number, pz: number): number {
  const last = rec.buffer[rec.buffer.length - 1]
  const dx = last.x - px
  const dz = last.z - pz
  return dx * dx + dz * dz
}

/**
 * Pairs à afficher : ceux dont l'avatar est connu et qui ont émis au moins une position, triés
 * par distance au joueur croissante, limités à `limit` (mobile : pas plus de 40 pairs rendus).
 */
export function selectVisiblePeers(store: PeerStore, playerX: number, playerZ: number, limit: number = MAX_VISIBLE_PEERS): PeerRecord[] {
  const candidates: PeerRecord[] = []
  for (const rec of store.peers.values()) {
    if (rec.avatar && rec.buffer.length > 0) candidates.push(rec)
  }
  candidates.sort((a, b) => distSq(a, playerX, playerZ) - distSq(b, playerX, playerZ))
  return candidates.slice(0, limit)
}

// ---------------------------------------------------------------------------------------------
// Décision d'envoi (throttle sortant)

/** 2 envois/s maximum pendant le déplacement. */
export const MOVE_SEND_INTERVAL_MS = 500
/** Rien à l'arrêt, sauf un battement toutes les 10 s (garde la présence vivante côté serveur). */
export const IDLE_HEARTBEAT_MS = 10000

export interface SendState {
  lastSentAt: number
  lastSentMoving: boolean
}

/**
 * Faut-il émettre notre position maintenant ? `state` = dernier envoi effectué, `null` avant le
 * tout premier. Publie immédiatement la position d'arrêt quand on vient de s'immobiliser (sinon
 * les autres nous verraient glisser jusqu'au prochain battement), puis retombe sur le battement.
 */
export function shouldSendPosition(state: SendState | null, moving: boolean, now: number): boolean {
  if (!state) return true
  if (moving) return now - state.lastSentAt >= MOVE_SEND_INTERVAL_MS
  if (state.lastSentMoving) return true
  return now - state.lastSentAt >= IDLE_HEARTBEAT_MS
}

/** Arrondi à 2 décimales — charge utile réseau minimale. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
