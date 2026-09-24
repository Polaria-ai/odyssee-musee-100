/**
 * Sélection déterministe de la « salle » Realtime.
 *
 * Le plan gratuit Supabase limite les connexions simultanées et les messages/s d'un projet.
 * On partitionne donc les visiteurs en petits canaux (« salles ») plutôt que d'utiliser un
 * canal unique : `musee:v1:room-1`, `room-2`, … `room-{MAX_ROOMS}`. Fonctions pures, aucune
 * dépendance réseau — le canal lui-même vit dans `realtimeClient.ts` / `usePresence.ts`.
 */

export const ROOM_PREFIX = 'musee:v1:room-'
export const ROOM_CAPACITY = 8
export const MAX_ROOMS = 12

/** Nom du canal Realtime pour la salle `index` (1..MAX_ROOMS). */
export function roomName(index: number): string {
  return `${ROOM_PREFIX}${index}`
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
