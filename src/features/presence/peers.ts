/**
 * Registre mutable des autres visiteurs, volontairement hors de React (comme `state/runtime.ts`) :
 * `usePresence` y écrit à chaque message reçu, `RemoteVisitors` y lit à chaque image. Aucune de ces
 * écritures ne doit provoquer un rendu React à 60 i/s — seul un changement de *roster* (arrivée/départ
 * d'un pair) notifie les abonnés ; les positions se lisent à la demande dans `useFrame`.
 *
 * Fonctions pures et testables : upsert/expiration du registre, interpolation, sélection des pairs
 * visibles, décision d'envoi (throttle). `createPeerStore()` donne une instance isolée pour les tests ;
 * `peerStore` est l'instance partagée utilisée par le jeu.
 */
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
  /** Faux tant que la présence (`presence.track`) n'est pas encore arrivée pour cet id. */
  present: boolean
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

/** S'abonne aux changements de *roster* (arrivée/départ) — pas aux positions. */
export function subscribeRoster(store: PeerStore, listener: () => void): () => void {
  store.rosterListeners.add(listener)
  return () => store.rosterListeners.delete(listener)
}

function getOrCreate(store: PeerStore, id: string): PeerRecord {
  let rec = store.peers.get(id)
  if (!rec) {
    rec = { id, present: false, buffer: [], lastSeen: 0 }
    store.peers.set(id, rec)
  }
  return rec
}

/**
 * Pair vu via `presence.track` (identité seule : tous les visiteurs sont Cyril). Notifie le roster
 * seulement si le pair est nouveau (ou connu par ses positions mais pas encore par sa présence) — pas à
 * chaque appel (la présence resynchronise tout le monde à chaque arrivée/départ dans la salle).
 */
export function upsertPeer(store: PeerStore, id: string, now: number): void {
  const rec = getOrCreate(store, id)
  const changed = !rec.present
  rec.present = true
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

/**
 * Échantillons de position gardés par pair. L'affichage est retardé de `INTERP_DELAY_MS` (1,5 s), plus que
 * l'intervalle d'envoi (1 s) : l'instant affiché peut donc tomber 2 intervalles en arrière, et il faut
 * 3 échantillons pour l'encadrer ; 5 laissent de la marge si des paquets arrivent en rafale après un blocage réseau.
 */
export const MAX_POSITION_BUFFER = 5

/**
 * Borne dure du registre : une salle compte 30 visiteurs au plus, quelques-uns de plus un instant quand elle déborde.
 * Au-delà, une position reçue d'un id inconnu est ignorée (la présence, elle, fait toujours foi et crée ses pairs) :
 * le registre ne peut pas grossir sans limite si des positions arrivent d'ids que la présence ne connaît pas.
 */
export const MAX_PEER_RECORDS = 64

/**
 * Nouvelle position reçue par broadcast. Ne notifie le roster qu'à la toute première position
 * reçue pour un pair déjà connu par sa présence (transition `buffer` vide → non vide) : c'est ce
 * qui rend ce pair sélectionnable par `selectVisiblePeers` (présence connue *et* position connue), et
 * `RemoteVisitors` met en cache la liste des pairs visibles entre deux notifications de roster — sans
 * cette notification ponctuelle, un pair dont la présence arrive avant sa première position resterait
 * invisible jusqu'au prochain aléa de roster (arrivée/départ d'un tiers), parfois jamais. Les
 * positions suivantes, elles, ne notifient jamais (elles arrivent plusieurs fois par seconde ; seul
 * `RemoteVisitors` en `useFrame` doit réagir à chaque image, pas le roster React).
 */
export function recordPosition(store: PeerStore, id: string, sample: PositionSample, now: number): void {
  if (!store.peers.has(id) && store.peers.size >= MAX_PEER_RECORDS) return
  const rec = getOrCreate(store, id)
  const becomesVisible = rec.present && rec.buffer.length === 0
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

/**
 * Retard d'affichage des autres visiteurs. Ils n'envoient qu'une position par seconde en mouvement
 * (`MOVE_SEND_INTERVAL_MS`) : pour toujours disposer de deux échantillons entre lesquels interpoler, on affiche le
 * passé, à l'intervalle d'envoi PLUS une marge. L'envoi est cadencé par un tick de 100 ms (intervalle réel de 1,0 à
 * 1,1 s) et le réseau mobile fait varier le délai d'un paquet à l'autre : 1 500 ms laissent 400 ms de marge au-delà de
 * 1,1 s, soit un intervalle entre deux arrivées jusqu'à 1,5 s sans jamais extrapoler. (Avec le retard de 150 ms de
 * l'époque à 2 envois/s, chaque paquet à 1 Hz aurait fait avancer le pair de 450 ms, l'aurait figé 550 ms, puis rattrapé
 * d'un saut.) Réglé pour le défaut de 1 envoi/s : en dessous de 1 Hz (`VITE_PRESENCE_SEND_HZ`), l'extrapolation joue.
 */
export const INTERP_DELAY_MS = 1500
/**
 * Durée maximale d'extrapolation au-delà du dernier échantillon quand un paquet est en retard de plus que la marge.
 * Passé ce délai le pair est figé (et ne marche plus) : mieux vaut un arrêt qu'une dérive à vitesse constante à travers
 * un mur. La vitesse extrapolée est elle-même bornée (`MAX_EXTRAPOLATION_SPEED`).
 */
export const EXTRAPOLATE_CAP_MS = 500
/** Vitesse maximale (m/s) retenue pour extrapoler : la course du joueur est à 5,6 m/s. */
export const MAX_EXTRAPOLATION_SPEED = 6.5

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

function put(out: RenderTransform, x: number, z: number, rotY: number, moving: boolean): RenderTransform {
  out.x = x
  out.z = z
  out.rotY = rotY
  out.moving = moving
  return out
}

/**
 * Transformation à afficher pour ce pair à l'instant `now`, en rendu retardé de `INTERP_DELAY_MS` (technique
 * classique d'interpolation d'entités : on affiche le passé récent pour toujours avoir deux échantillons entre
 * lesquels interpoler, sans dépendre de l'horloge de l'émetteur puisque le réseau n'envoie aucun horodatage).
 *
 * - Dans un segment entre deux échantillons voisins : interpolation linéaire. `moving` est celui du début du segment :
 *   un pair qui s'arrête (dernier échantillon « en marche », puis position d'arrêt) marche jusqu'à son point d'arrêt ;
 *   un pair qui démarre (battement au repos, puis premier échantillon « en marche ») ne marche pas sur place avant.
 * - Avant le premier échantillon retenu (ou avec un seul) : reste sur lui, sans marcher.
 * - Au-delà du dernier échantillon (paquet en retard) : un pair en marche est extrapolé à vitesse constante,
 *   au plus `EXTRAPOLATE_CAP_MS` ; au-delà il est figé et ne marche plus. Un pair arrêté n'est jamais extrapolé
 *   (l'arrêt est propre : pas de glissade au-delà du point d'arrêt).
 *
 * `out` (optionnel) évite d'allouer un objet par pair et par image dans `useFrame`. `null` si aucun échantillon.
 */
export function getRenderTransform(
  rec: Pick<PeerRecord, 'buffer'> | undefined,
  now: number,
  out: RenderTransform = { x: 0, z: 0, rotY: 0, moving: false },
): RenderTransform | null {
  const buffer = rec?.buffer
  if (!buffer || buffer.length === 0) return null

  const first = buffer[0]
  const renderTime = now - INTERP_DELAY_MS
  if (buffer.length === 1 || renderTime <= first.recvT) return put(out, first.x, first.z, first.r, false)

  const last = buffer.length - 1
  const newest = buffer[last]

  if (renderTime >= newest.recvT) {
    // Au-delà du dernier échantillon : extrapolation bornée d'un pair en marche, sinon on reste sur place.
    const extra = renderTime - newest.recvT
    if (!newest.m || extra > EXTRAPOLATE_CAP_MS) return put(out, newest.x, newest.z, newest.r, false)
    const prev = buffer[last - 1]
    const span = newest.recvT - prev.recvT
    if (span <= 0) return put(out, newest.x, newest.z, newest.r, true)
    let vx = (newest.x - prev.x) / span
    let vz = (newest.z - prev.z) / span
    const speed = Math.hypot(vx, vz) * 1000 // m/s
    if (speed > MAX_EXTRAPOLATION_SPEED) {
      const k = MAX_EXTRAPOLATION_SPEED / speed
      vx *= k
      vz *= k
    }
    return put(out, newest.x + vx * extra, newest.z + vz * extra, newest.r, true)
  }

  // Segment qui encadre l'instant affiché : le plus récent dont le début est déjà passé.
  let i = last
  while (i > 1 && buffer[i - 1].recvT > renderTime) i--
  const older = buffer[i - 1]
  const newer = buffer[i]
  const span = newer.recvT - older.recvT
  if (span <= 0) return put(out, newer.x, newer.z, newer.r, newer.m)
  const t = (renderTime - older.recvT) / span
  return put(
    out,
    older.x + (newer.x - older.x) * t,
    older.z + (newer.z - older.z) * t,
    lerpAngle(older.r, newer.r, t),
    older.m,
  )
}

/** Vitesse maximale (m/s) à laquelle un pair affiché rattrape sa position cible après un à-coup (paquets en rafale, blocage réseau). */
export const REMOTE_MAX_CATCHUP_SPEED = 9
/** Au-delà de cet écart (m) entre l'affiché et la cible, le pair est replacé d'un coup : c'est une vraie téléportation. */
export const REMOTE_SNAP_DISTANCE = 12

/**
 * Rapproche `pos` (modifié en place : le `position` d'un objet three convient) de la cible `(tx, tz)` d'au plus
 * `REMOTE_MAX_CATCHUP_SPEED × dtSec`. Une cible qui bondit (paquets d'un blocage réseau livrés en rafale, qui
 * rendraient l'interpolation instantanée) devient une course visible et continue, jamais une téléportation ; au-delà
 * de `REMOTE_SNAP_DISTANCE`, replacement direct. Dans la marche ordinaire (≤ 5,6 m/s) la cible est suivie sans retard.
 */
export function stepToward(pos: { x: number; z: number }, tx: number, tz: number, dtSec: number): void {
  const dx = tx - pos.x
  const dz = tz - pos.z
  const dist = Math.hypot(dx, dz)
  const maxStep = REMOTE_MAX_CATCHUP_SPEED * Math.max(0, dtSec)
  if (dist <= maxStep || dist > REMOTE_SNAP_DISTANCE) {
    pos.x = tx
    pos.z = tz
    return
  }
  const k = maxStep / dist
  pos.x += dx * k
  pos.z += dz * k
}

// ---------------------------------------------------------------------------------------------
// Sélection des pairs visibles

/**
 * Visiteurs distants rendus au plus. Une salle compte jusqu'à 30 visiteurs (`ROOM_CAPACITY`), mais seuls les 8 plus
 * proches sont montés : chacun est un Cyril complet (squelette 24 os, ~12 400 triangles, un appel de dessin), donc
 * avec le joueur au plus 9 personnages animés, ~110 000 triangles : le budget d'un smartphone. Le coût du rendu ne
 * dépend ainsi pas de la taille de la salle ; les 22 autres ne coûtent qu'un échantillon de position reçu par seconde.
 */
export const MAX_VISIBLE_PEERS = 8

/**
 * Un pair déjà monté reste choisi tant qu'aucun autre n'est plus proche de 20 % au moins que lui (distance × 0,8) :
 * sans cette hystérésis, deux visiteurs à égale distance du 8e rang s'échangeraient leur place à chaque réévaluation.
 */
const MOUNTED_DISTANCE_FACTOR_SQ = 0.64

function distSq(rec: PeerRecord, px: number, pz: number): number {
  const last = rec.buffer[rec.buffer.length - 1]
  const dx = last.x - px
  const dz = last.z - pz
  return dx * dx + dz * dz
}

/**
 * Pairs à afficher : ceux dont la présence est connue et qui ont émis au moins une position, triés
 * par distance au joueur croissante, limités à `limit` (mobile : pas plus de `MAX_VISIBLE_PEERS` rendus).
 * `mounted` (optionnel) : ids déjà affichés, favorisés par l'hystérésis ci-dessus.
 */
export function selectVisiblePeers(
  store: PeerStore,
  playerX: number,
  playerZ: number,
  limit: number = MAX_VISIBLE_PEERS,
  mounted?: ReadonlySet<string>,
): PeerRecord[] {
  const candidates: PeerRecord[] = []
  for (const rec of store.peers.values()) {
    if (rec.present && rec.buffer.length > 0) candidates.push(rec)
  }
  const key = (rec: PeerRecord) => distSq(rec, playerX, playerZ) * (mounted?.has(rec.id) ? MOUNTED_DISTANCE_FACTOR_SQ : 1)
  candidates.sort((a, b) => key(a) - key(b))
  return candidates.slice(0, limit)
}

// ---------------------------------------------------------------------------------------------
// Décision d'envoi (throttle sortant)

/**
 * 1 envoi/s maximum pendant le déplacement (décision du 01/10 : salles de 30 joueurs, quotas Supabase). Les autres
 * visiteurs interpolent entre deux paquets avec un retard d'affichage de `INTERP_DELAY_MS`.
 */
export const MOVE_SEND_INTERVAL_MS = 1000
/**
 * Rien à l'arrêt, sauf un battement toutes les 10 s. Inchangé à 1 envoi/s en mouvement : c'est le battement qui
 * rend un visiteur immobile visible à un nouvel arrivant (la présence ne porte pas la position), donc l'allonger
 * ferait attendre davantage ceux qui entrent dans une salle ; et le délai d'expiration d'un pair silencieux
 * (`EFFECTIVE_PEER_TIMEOUT_MS`, 16 s) en dérive. Coût d'une salle de 30 visiteurs tous immobiles : 3 émissions/s.
 */
export const IDLE_HEARTBEAT_MS = 10000

export interface SendState {
  lastSentAt: number
  lastSentMoving: boolean
}

/**
 * Faut-il émettre notre position maintenant ? `state` = dernier envoi effectué, `null` avant le
 * tout premier. Publie immédiatement la position d'arrêt quand on vient de s'immobiliser (sinon
 * les autres nous verraient glisser jusqu'au prochain battement), puis retombe sur le battement. Les deux
 * intervalles sont réglables (`PresenceConfig`) ; les constantes ci-dessus sont les valeurs par défaut.
 */
export function shouldSendPosition(
  state: SendState | null,
  moving: boolean,
  now: number,
  moveIntervalMs: number = MOVE_SEND_INTERVAL_MS,
  idleHeartbeatMs: number = IDLE_HEARTBEAT_MS,
): boolean {
  if (!state) return true
  if (moving) return now - state.lastSentAt >= moveIntervalMs
  if (state.lastSentMoving) return true
  return now - state.lastSentAt >= idleHeartbeatMs
}

/** Arrondi à 2 décimales — charge utile réseau minimale. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
