/**
 * Plan de la salle des Archives de 2040 — fonction pure et déterministe : mêmes entrées → même sortie.
 * Propriétaire : workflow « Archives de 2040 » (module salle 3D, WEL-881). Contrat : voir docs/ARCHITECTURE.md.
 *
 * Frise chronologique en rangées : le joueur arrive au sud (face au nord) et remonte les rangées de
 * vitrines (toujours face à +Z, jamais accrochées à un mur) jusqu'à l'Archiviste, au fond nord. Voir
 * `room/constants.ts` pour la justification de « toujours +Z ».
 */
import type { AABB, ArchivesLayout, ArchiveSlot, EveningSession, MuseumLayout, Placement, Vec2 } from '../types'
import { hallReservedSpots, wingThemes } from '../styles/tokens'
import { aabb, xWall, zWall } from '../world/collision'
import { archivesRoomStrings } from './strings'
import {
  ENTRANCE_CLEARANCE,
  NORTH_CLEARANCE,
  ROOM_HALF_DEPTH,
  ROOM_HALF_WIDTH,
  ROW_DEPTH,
  ROW_X_OFFSETS,
  SOCLE_HEIGHT,
  VITRINE_FOOTPRINT_RADIUS,
  VITRINE_VIEW_DISTANCE,
  WALL_THICKNESS,
} from './room/constants'

/** Centre de la salle des Archives : loin du musée, on y arrive par la Porte de 2040 (téléportation, jamais à pied). */
export const ARCHIVES_ORIGIN = { x: 0, z: 80 } as const

interface Candidate {
  position: [number, number, number]
  rotationY: number
  viewPoint: Vec2
}

function sortSessions(sessions: EveningSession[]): EveningSession[] {
  return [...sessions].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

/**
 * Candidats de la frise, rangée par rangée en descendant depuis l'entrée (sud) vers l'Archiviste
 * (nord) : chaque rangée aligne `ROW_X_OFFSETS.length` vitrines, toutes face à +Z. Fonction pure,
 * indépendante du nombre de séquences réelles : testée pour une capacité ≥ 24 (voir layout.test.ts).
 *
 * Rangées en serpentin (une sur deux part de l'autre côté) : deux séquences consécutives du
 * programme restent donc toujours des vitrines VOISINES. Avec des rangées systématiquement dans le
 * même sens (ouest → est à chaque fois), le tracé au sol qui relie les vitrines dans l'ordre du
 * programme (`room/textures.ts::paintArchivesFloor`) devait sinon revenir d'un bord à l'autre de la
 * salle à chaque changement de rangée — une ligne en diagonale qui barrait l'image, régression
 * constatée à la vérification visuelle.
 */
function buildCandidates(bounds: AABB, originX: number): Candidate[] {
  const candidates: Candidate[] = []
  const firstRowZ = bounds.maxZ - ENTRANCE_CLEARANCE
  const lastRowZ = bounds.minZ + NORTH_CLEARANCE
  let rowIndex = 0
  for (let z = firstRowZ; z >= lastRowZ; z -= ROW_DEPTH) {
    const offsets = rowIndex % 2 === 0 ? ROW_X_OFFSETS : [...ROW_X_OFFSETS].reverse()
    for (const dx of offsets) {
      const x = originX + dx
      candidates.push({ position: [x, SOCLE_HEIGHT, z], rotationY: 0, viewPoint: { x, z: z + VITRINE_VIEW_DISTANCE } })
    }
    rowIndex += 1
  }
  return candidates
}

/** Colliders de la salle (murs + socles des vitrines + podium de l'Archiviste), pour le plan complet. */
function buildColliders(bounds: AABB, slots: ArchiveSlot[], archivist: Placement): AABB[] {
  const colliders: AABB[] = [
    // Mur sud (côté caméra), coupé bas au rendu (voir ArchivesRoom) mais collider plein comme les autres.
    xWall(bounds.maxZ, bounds.minX, bounds.maxX, WALL_THICKNESS),
    xWall(bounds.minZ, bounds.minX, bounds.maxX, WALL_THICKNESS),
    zWall(bounds.minX, bounds.minZ, bounds.maxZ, WALL_THICKNESS),
    zWall(bounds.maxX, bounds.minZ, bounds.maxZ, WALL_THICKNESS),
  ]
  const r = VITRINE_FOOTPRINT_RADIUS
  for (const s of slots) {
    colliders.push(aabb(s.position[0] - r, s.position[0] + r, s.position[2] - r, s.position[2] + r))
  }
  const pr = 0.4
  colliders.push(aabb(archivist.position.x - pr, archivist.position.x + pr, archivist.position.z - pr, archivist.position.z + pr))
  return colliders
}

/** Plan de la salle des Archives pour les séquences données (une vitrine par séquence, 0 à 24). */
export function buildArchivesLayout(sessions: EveningSession[]): ArchivesLayout {
  const theme = wingThemes.archives
  const { x, z } = ARCHIVES_ORIGIN
  const bounds = aabb(x - ROOM_HALF_WIDTH, x + ROOM_HALF_WIDTH, z - ROOM_HALF_DEPTH, z + ROOM_HALF_DEPTH)

  const ordered = sortSessions(sessions)
  const candidates = buildCandidates(bounds, x)
  const slots: ArchiveSlot[] = ordered.slice(0, candidates.length).map((s, i) => ({
    sessionId: s.id,
    position: candidates[i].position,
    rotationY: candidates[i].rotationY,
    viewPoint: candidates[i].viewPoint,
  }))

  const archivist: Placement = { position: { x, z: bounds.minZ + 1.6 }, rotationY: 0 }
  const arrival: Placement = { position: { x: x - 2.5, z: bounds.maxZ - 1.6 }, rotationY: Math.PI }
  const returnPortal: Placement = { position: { x: x + 2.5, z: bounds.maxZ - 1.6 }, rotationY: 0 }
  const hallPortal: Placement = { position: { x: hallReservedSpots.timePortal.x, z: hallReservedSpots.timePortal.z }, rotationY: 0 }

  return {
    room: {
      id: 'archives',
      bounds,
      label: archivesRoomStrings.roomLabel,
      floorColor: theme.floor,
      wallColor: theme.wall,
      accentColor: theme.accent,
    },
    colliders: buildColliders(bounds, slots, archivist),
    slots,
    arrival,
    hallPortal,
    returnPortal,
    archivist,
  }
}

/** Ajoute la salle des Archives au plan du musée (salles, colliders, emprise). Ne modifie pas `museum`. */
export function mergeArchivesIntoLayout(museum: MuseumLayout, archives: ArchivesLayout): MuseumLayout {
  const b = archives.room.bounds
  return {
    ...museum,
    rooms: [...museum.rooms, archives.room],
    colliders: [...museum.colliders, ...archives.colliders],
    bounds: {
      minX: Math.min(museum.bounds.minX, b.minX),
      maxX: Math.max(museum.bounds.maxX, b.maxX),
      minZ: Math.min(museum.bounds.minZ, b.minZ),
      maxZ: Math.max(museum.bounds.maxZ, b.maxZ),
    },
  }
}

/** Nombre maximal de vitrines que la salle peut accueillir (capacité de la frise). Utilisé par les tests. */
export function archivesCapacity(): number {
  const { x, z } = ARCHIVES_ORIGIN
  const bounds = aabb(x - ROOM_HALF_WIDTH, x + ROOM_HALF_WIDTH, z - ROOM_HALF_DEPTH, z + ROOM_HALF_DEPTH)
  return buildCandidates(bounds, x).length
}
