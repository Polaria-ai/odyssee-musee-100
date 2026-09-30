/**
 * Sélection déterministe de la « salle » Realtime.
 *
 * Le plan gratuit Supabase limite les connexions simultanées et les messages/s d'un projet.
 * On partitionne donc les visiteurs en petits canaux (« salles ») plutôt que d'utiliser un
 * canal unique : `musee:v1:room-1`, `room-2`, … `room-{MAX_ROOMS}`. Fonctions pures, aucune
 * dépendance réseau — le canal lui-même vit dans `realtimeClient.ts` / `presenceSession.ts`.
 */

export const ROOM_PREFIX = 'musee:v1:room-'
export const ROOM_CAPACITY = 8
export const MAX_ROOMS = 12

/**
 * Nom du canal Realtime pour la salle `index` (1..MAX_ROOMS).
 * `namespace` isole un groupe de salles (tests E2E) : `musee:v1:<namespace>:room-<index>`.
 */
export function roomName(index: number, namespace?: string | null): string {
  return namespace ? `musee:v1:${namespace}:room-${index}` : `${ROOM_PREFIX}${index}`
}

/** Espace de salles demandé par `?presenceRoom=` (tests uniquement), nettoyé, ou null. */
export function sanitizeNamespace(raw: string | null | undefined): string | null {
  if (!raw) return null
  const clean = raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
  return clean.length > 0 ? clean : null
}

export interface RoomMember {
  id: string
  /** Horodatage local (ms) auquel ce membre a rejoint la salle courante. */
  joinTs: number
}

/**
 * Ordre d'arrivée stable dans la salle : `joinTs` croissant, `id` en repli pour départager
 * les ex-æquo (même horodatage). Tous les clients calculent le même classement à partir du
 * même état de présence : c'est ce qui rend la décision de rester/partir déterministe.
 */
export function sortByJoinOrder(members: readonly RoomMember[]): RoomMember[] {
  return [...members].sort((a, b) => a.joinTs - b.joinTs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Faut-il rester dans cette salle ? Si elle dépasse `capacity` membres, seuls les `capacity`
 * premiers arrivés restent ; les suivants (les derniers arrivés) partent. Comme chaque client
 * calcule le même classement à partir du même instantané de présence, jamais deux personnes
 * ne « négocient » différemment : soit on est dans les `capacity` premiers, soit on part —
 * et personne d'autre ne part en même temps pour la même raison.
 */
export function shouldStayInRoom(selfId: string, members: readonly RoomMember[], capacity: number = ROOM_CAPACITY): boolean {
  if (members.length <= capacity) return true
  const rank = sortByJoinOrder(members).findIndex((m) => m.id === selfId)
  return rank >= 0 && rank < capacity
}

/** Prochaine salle à essayer, ou `null` si on a atteint `maxRooms` (mode solo silencieux). */
export function nextRoomIndex(current: number, maxRooms: number = MAX_ROOMS): number | null {
  return current < maxRooms ? current + 1 : null
}

/**
 * Salle cible d'un joueur selon son rang d'arrivée dans sa salle courante (`rank` = position 0-based
 * dans l'ordre `sortByJoinOrder`, `0` = premier arrivé). Les `capacity` premiers restent ; les suivants
 * sautent directement de `floor(rank / capacity)` salles plus loin (au lieu d'une salle à la fois :
 * chaque salle traversée coûte une jointure et une salve de présence pour tout le monde). `null` si la
 * cible dépasse `maxRooms` (musée plein : mode solo). Jamais de retour en arrière : la cible est
 * toujours `>= currentRoom`.
 */
export function targetRoomForRank(currentRoom: number, rank: number, capacity: number, maxRooms: number): number | null {
  if (rank < capacity) return currentRoom
  const target = currentRoom + Math.floor(rank / capacity)
  return target > maxRooms ? null : target
}
