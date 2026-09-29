/**
 * Plan de la salle des Archives de 2040 — fonction pure et déterministe : mêmes entrées → même sortie.
 * Propriétaire : workflow « Archives de 2040 » (module salle 3D, WEL-881). Contrat : voir docs/ARCHITECTURE.md.
 *
 * Plan en croix (décision de Baptiste du 27/09, WEL-888) : la salle est accrochée au sud du hall,
 * derrière le point d'arrivée, et rejointe à pied par la porte `tokens.archivesDoor` du mur sud du
 * hall — plus aucun portail. Le joueur entre au nord et descend une frise chronologique en rangées
 * de vitrines (toujours face à +Z, jamais accrochées à un mur, voir `room/constants.ts`).
 */
import type { AABB, ArchivesLayout, ArchiveSlot, EveningSession, MuseumLayout, Placement, Vec2 } from '../types'
import { archivesDoor, wingThemes } from '../styles/tokens'
import { aabb, xWall, zWall } from '../world/collision'
import { archivesRoomStrings } from './strings'
import {
  DOOR_CLEARANCE,
  ROOM_DEPTH,
  ROOM_HALF_WIDTH,
  ROW_DEPTH,
  ROW_X_OFFSETS,
  SOCLE_HEIGHT,
  SOUTH_CLEARANCE,
  VITRINE_FOOTPRINT_RADIUS,
  VITRINE_VIEW_DISTANCE,
  WALL_THICKNESS,
} from './room/constants'

/** Pupitre du panneau d'entrée (à l'ouest de la porte) : demi-emprise au sol, en mètres. */
export const ENTRANCE_LECTERN = { dx: -3.4, dz: 1.6, halfWidth: 1.15, halfDepth: 0.3 } as const
/** Archiviste, à l'est de la porte : assez loin du mur pour ne jamais répondre à un joueur resté dans le hall. */
const ARCHIVIST_OFFSET = { dx: 3.6, dz: 2.8 } as const

/** Emprise de la salle accrochée au mur sud d'un hall donné (fonction pure). */
export function archivesBounds(hall: AABB): AABB {
  return aabb(archivesDoor.x - ROOM_HALF_WIDTH, archivesDoor.x + ROOM_HALF_WIDTH, hall.maxZ, hall.maxZ + ROOM_DEPTH)
}

interface Candidate {
  position: [number, number, number]
  rotationY: number
  viewPoint: Vec2
}

function sortSessions(sessions: EveningSession[]): EveningSession[] {
  return [...sessions].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

/**
 * Candidats de la frise, rangée par rangée en descendant depuis la porte (nord) vers le fond de la
 * salle (sud) : chaque rangée aligne `ROW_X_OFFSETS.length` vitrines, toutes face à +Z. Fonction pure,
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
  const firstRowZ = bounds.minZ + DOOR_CLEARANCE
  const lastRowZ = bounds.maxZ - SOUTH_CLEARANCE
  let rowIndex = 0
  for (let z = firstRowZ; z <= lastRowZ + 1e-9; z += ROW_DEPTH) {
    const offsets = rowIndex % 2 === 0 ? ROW_X_OFFSETS : [...ROW_X_OFFSETS].reverse()
    for (const dx of offsets) {
      const x = originX + dx
      candidates.push({ position: [x, SOCLE_HEIGHT, z], rotationY: 0, viewPoint: { x, z: z + VITRINE_VIEW_DISTANCE } })
    }
    rowIndex += 1
  }
  return candidates
}

/**
 * Colliders de la salle, pour le plan complet. Le mur nord est percé de la porte (il double le mur
 * sud du hall, déjà percé au même endroit) : la salle reste close même testée seule.
 */
function buildColliders(bounds: AABB, slots: ArchiveSlot[], archivist: Placement): AABB[] {
  const doorMin = archivesDoor.x - archivesDoor.width / 2
  const doorMax = archivesDoor.x + archivesDoor.width / 2
  const colliders: AABB[] = [
    // Mur sud (côté caméra), coupé bas au rendu (voir RoomShell) mais collider plein comme les autres.
    xWall(bounds.maxZ, bounds.minX, bounds.maxX, WALL_THICKNESS),
    xWall(bounds.minZ, bounds.minX, doorMin, WALL_THICKNESS),
    xWall(bounds.minZ, doorMax, bounds.maxX, WALL_THICKNESS),
    zWall(bounds.minX, bounds.minZ, bounds.maxZ, WALL_THICKNESS),
    zWall(bounds.maxX, bounds.minZ, bounds.maxZ, WALL_THICKNESS),
  ]
  const r = VITRINE_FOOTPRINT_RADIUS
  for (const s of slots) {
    colliders.push(aabb(s.position[0] - r, s.position[0] + r, s.position[2] - r, s.position[2] + r))
  }
  const pr = 0.4
  colliders.push(aabb(archivist.position.x - pr, archivist.position.x + pr, archivist.position.z - pr, archivist.position.z + pr))
  const lx = archivesDoor.x + ENTRANCE_LECTERN.dx
  const lz = bounds.minZ + ENTRANCE_LECTERN.dz
  colliders.push(aabb(lx - ENTRANCE_LECTERN.halfWidth, lx + ENTRANCE_LECTERN.halfWidth, lz - ENTRANCE_LECTERN.halfDepth, lz + ENTRANCE_LECTERN.halfDepth))
  return colliders
}

/**
 * Plan de la salle des Archives pour les séquences données (une vitrine par séquence, 0 à 24),
 * accrochée au mur sud de `hall` (emprise du hall, voir `src/world/layout.ts`).
 */
export function buildArchivesLayout(sessions: EveningSession[], hall: AABB): ArchivesLayout {
  const theme = wingThemes.archives
  const x = archivesDoor.x
  const bounds = archivesBounds(hall)

  const ordered = sortSessions(sessions)
  const candidates = buildCandidates(bounds, x)
  const slots: ArchiveSlot[] = ordered.slice(0, candidates.length).map((s, i) => ({
    sessionId: s.id,
    position: candidates[i].position,
    rotationY: candidates[i].rotationY,
    viewPoint: candidates[i].viewPoint,
  }))

  const archivist: Placement = { position: { x: x + ARCHIVIST_OFFSET.dx, z: bounds.minZ + ARCHIVIST_OFFSET.dz }, rotationY: 0 }
  // Juste après le seuil, face au sud (rotationY 0 : le modèle regarde +Z), dans l'axe de la porte.
  const arrival: Placement = { position: { x, z: bounds.minZ + 1.6 }, rotationY: 0 }

  return {
    room: {
      id: 'archives',
      bounds,
      label: archivesRoomStrings.roomShortLabel,
      floorColor: theme.floor,
      wallColor: theme.wall,
      accentColor: theme.accent,
    },
    colliders: buildColliders(bounds, slots, archivist),
    slots,
    arrival,
    door: { x, z: bounds.minZ, width: archivesDoor.width },
    archivist,
    northWall: [
      xWall(hall.maxZ, hall.minX, archivesDoor.x - archivesDoor.width / 2, WALL_THICKNESS),
      xWall(hall.maxZ, archivesDoor.x + archivesDoor.width / 2, hall.maxX, WALL_THICKNESS),
    ],
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
  const bounds = archivesBounds(aabb(-1, 1, -1, 0))
  return buildCandidates(bounds, archivesDoor.x).length
}
