/**
 * Plan du musée — fonction pure et déterministe : mêmes entrées → même sortie.
 * Propriétaire : agent monde. Contrat (types, signature) : voir docs/ARCHITECTURE.md.
 */
import type { AABB, ExhibitWingId, FrameSlot, MuseumLayout, Person, Placement, RoomLayout, StampStationSlot, Vec2 } from '../types'
import { EXHIBIT_WINGS } from '../types'
import { wingThemes } from '../styles/tokens'
import {
  CIMAISE_THICKNESS,
  COUNTER_HALF_DEPTH,
  COUNTER_HALF_WIDTH,
  CURATOR_COUNTER_OFFSET_Z,
  DOOR_WIDTH,
  dims,
  END_MARGIN,
  EPI_DEPTH,
  EPI_THICKNESS,
  FRAME_WALL_OFFSET,
  HALL_HALF_DEPTH,
  HALL_HALF_WIDTH,
  NEAR_MARGIN,
  ROW_STEP,
  STAMP_STATION_SIZE,
  VIEW_DISTANCE,
  WING_WIDTH,
} from './constants'
import { aabb, aabbUnion, xWall, zWall } from './collision'
import { roomLabels } from './strings'

const HALF_PI = Math.PI / 2
const DOOR_HALF = DOOR_WIDTH / 2

/** Emplacement d'un cadre avant qu'on lui attribue une personne. */
interface FrameCandidate {
  position: [number, number, number]
  rotationY: number
  viewPoint: Vec2
}

/** Boîte annotée pour le rendu : nature (mur / meuble) et si elle est « coupée » côté caméra. */
export interface ArchBox {
  box: AABB
  kind: 'wall' | 'furniture'
  cut: boolean
}

interface WingBuild {
  room: RoomLayout
  walls: ArchBox[]
  slots: FrameCandidate[]
  stampStation: Vec2
}

/** Décor fixe du hall (piliers, bancs, jardinières) : partagé avec le rendu (`Museum.tsx`). */
export interface HallDecor {
  pillars: Vec2[]
  benches: Placement[]
  planters: Vec2[]
}

export function hallDecor(): HallDecor {
  return {
    pillars: [
      { x: -6.5, z: -5.5 },
      { x: 6.5, z: -5.5 },
      { x: -6.5, z: 3.5 },
      { x: 6.5, z: 3.5 },
    ],
    benches: [
      { position: { x: -3.2, z: 5.4 }, rotationY: 0 },
      { position: { x: 3.2, z: 5.4 }, rotationY: 0 },
    ],
    planters: [
      { x: -9.8, z: 7.2 },
      { x: 9.8, z: 7.2 },
      { x: -9.8, z: -7.2 },
      { x: 9.8, z: -7.2 },
    ],
  }
}

/** Linteau décoratif au-dessus d'une porte ouverte, à la couleur de l'aile (mission : « arches des portes »). */
export interface DoorArch {
  box: AABB
  color: string
}

/** Plan complet, pour le rendu (`Museum.tsx`) : mêmes salles que `MuseumLayout`, murs annotés. */
export interface MuseumArchitecture {
  rooms: Array<{ room: RoomLayout; walls: ArchBox[] }>
  decor: HallDecor
  doorArches: DoorArch[]
}

function sortPeople(people: Person[]): Person[] {
  return [...people].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

function wall(box: AABB, cut = false): ArchBox {
  return { box, kind: 'wall', cut }
}
function furniture(box: AABB): ArchBox {
  return { box, kind: 'furniture', cut: false }
}

/** Aile est/ouest (axe X) : mur principal côté nord de l'aile + épis en alternance. */
function buildXWing(wing: ExhibitWingId, hallWallX: number, dir: 1 | -1, count: number): WingBuild | null {
  if (count <= 0) return null
  const wallZFar = -WING_WIDTH / 2 // mur plein (non côté caméra), porte les cadres
  const wallZNear = WING_WIDTH / 2 // côté caméra, coupé, sans cadre

  let rows = 0
  let capacity = 0
  while (capacity < count) {
    capacity += rows % 2 === 0 ? 1 : 2
    rows++
  }
  const length = NEAR_MARGIN + rows * ROW_STEP + END_MARGIN
  const farX = hallWallX + dir * length

  const slots: FrameCandidate[] = []
  const walls: ArchBox[] = [
    wall(xWall(wallZFar, hallWallX, farX, dims.wallThickness)),
    wall(xWall(wallZNear, hallWallX, farX, dims.wallThickness), true),
    wall(zWall(farX, wallZFar, wallZNear, dims.wallThickness)),
  ]

  for (let i = 0; i < rows; i++) {
    if (i % 2 === 0) {
      const u = NEAR_MARGIN + i * ROW_STEP + ROW_STEP * 0.75
      const x = hallWallX + dir * u
      const z = wallZFar + FRAME_WALL_OFFSET
      slots.push({ position: [x, dims.frameCenterY, z], rotationY: 0, viewPoint: { x, z: z + VIEW_DISTANCE } })
    } else {
      const u = NEAR_MARGIN + i * ROW_STEP + ROW_STEP * 0.25
      const xEpi = hallWallX + dir * u
      const zEpi = wallZFar + EPI_DEPTH / 2
      walls.push(wall(zWall(xEpi, wallZFar, wallZFar + EPI_DEPTH, EPI_THICKNESS)))
      const xNeg = xEpi - EPI_THICKNESS / 2 - FRAME_WALL_OFFSET
      const xPos = xEpi + EPI_THICKNESS / 2 + FRAME_WALL_OFFSET
      slots.push({ position: [xNeg, dims.frameCenterY, zEpi], rotationY: -HALF_PI, viewPoint: { x: xNeg - VIEW_DISTANCE, z: zEpi } })
      slots.push({ position: [xPos, dims.frameCenterY, zEpi], rotationY: HALF_PI, viewPoint: { x: xPos + VIEW_DISTANCE, z: zEpi } })
    }
  }

  const bounds = aabb(hallWallX, farX, wallZFar, wallZNear)
  const stampStation: Vec2 = { x: hallWallX + dir * 1.2, z: wallZFar + 2 }
  const room: RoomLayout = { id: wing, bounds, label: roomLabels[wing], floorColor: wingThemes[wing].floor, wallColor: wingThemes[wing].wall, accentColor: wingThemes[wing].accent }
  return { room, walls, slots: slots.slice(0, count), stampStation }
}

/** Aile nord (axe Z) : murs ouest/est + cimaise centrale + mur du fond. */
function buildNorthWing(count: number): WingBuild | null {
  if (count <= 0) return null
  const hallWallZ = -HALL_HALF_DEPTH
  const dir = -1
  const xWest = -WING_WIDTH / 2
  const xEast = WING_WIDTH / 2
  const backXs = [-3.6, -1.2, 1.2, 3.6]

  let rows = 0
  while (rows * 4 + backXs.length < count) rows++
  const length = NEAR_MARGIN + rows * ROW_STEP + END_MARGIN
  const farZ = hallWallZ + dir * length

  const slots: FrameCandidate[] = []
  const walls: ArchBox[] = [wall(zWall(xWest, farZ, hallWallZ, dims.wallThickness)), wall(zWall(xEast, farZ, hallWallZ, dims.wallThickness)), wall(xWall(farZ, xWest, xEast, dims.wallThickness))]

  if (rows > 0) {
    const zNear = hallWallZ + dir * NEAR_MARGIN
    const zFar = hallWallZ + dir * (NEAR_MARGIN + rows * ROW_STEP)
    walls.push(wall(zWall(0, zFar, zNear, CIMAISE_THICKNESS)))
  }

  for (let i = 0; i < rows; i++) {
    const z = hallWallZ + dir * (NEAR_MARGIN + i * ROW_STEP + ROW_STEP / 2)
    const xW = xWest + FRAME_WALL_OFFSET
    const xE = xEast - FRAME_WALL_OFFSET
    slots.push({ position: [xW, dims.frameCenterY, z], rotationY: HALF_PI, viewPoint: { x: xW + VIEW_DISTANCE, z } })
    slots.push({ position: [xE, dims.frameCenterY, z], rotationY: -HALF_PI, viewPoint: { x: xE - VIEW_DISTANCE, z } })
    const xCimNeg = -CIMAISE_THICKNESS / 2 - FRAME_WALL_OFFSET
    const xCimPos = CIMAISE_THICKNESS / 2 + FRAME_WALL_OFFSET
    slots.push({ position: [xCimNeg, dims.frameCenterY, z], rotationY: -HALF_PI, viewPoint: { x: xCimNeg - VIEW_DISTANCE, z } })
    slots.push({ position: [xCimPos, dims.frameCenterY, z], rotationY: HALF_PI, viewPoint: { x: xCimPos + VIEW_DISTANCE, z } })
  }
  for (const x of backXs) {
    const z = farZ - FRAME_WALL_OFFSET * dir
    slots.push({ position: [x, dims.frameCenterY, z], rotationY: 0, viewPoint: { x, z: z + VIEW_DISTANCE } })
  }

  const bounds = aabb(xWest, xEast, farZ, hallWallZ)
  const stampStation: Vec2 = { x: 2.5, z: hallWallZ + dir * 1.2 }
  const room: RoomLayout = {
    id: 'industrialisation',
    bounds,
    label: roomLabels.industrialisation,
    floorColor: wingThemes.industrialisation.floor,
    wallColor: wingThemes.industrialisation.wall,
    accentColor: wingThemes.industrialisation.accent,
  }
  return { room, walls, slots: slots.slice(0, count), stampStation }
}

/** Segments d'un mur du hall percé d'une porte de `DOOR_WIDTH`, ou plein si l'aile est vide. */
function hallWallSegments(axis: 'x' | 'z', fixed: number, from: number, to: number, open: boolean): ArchBox[] {
  const build = axis === 'x' ? (a: number, b: number) => xWall(fixed, a, b, dims.wallThickness) : (a: number, b: number) => zWall(fixed, a, b, dims.wallThickness)
  if (!open) return [wall(build(from, to))]
  return [wall(build(from, -DOOR_HALF)), wall(build(DOOR_HALF, to))]
}

interface MuseumBuild {
  layout: MuseumLayout
  architecture: MuseumArchitecture
}

function build(people: Person[]): MuseumBuild {
  const byWing: Record<ExhibitWingId, Person[]> = { infrastructures: [], industrialisation: [], culture: [] }
  for (const p of people) byWing[p.wing].push(p)
  for (const w of EXHIBIT_WINGS) byWing[w] = sortPeople(byWing[w])

  const wingBuilds: Partial<Record<ExhibitWingId, WingBuild>> = {
    infrastructures: buildXWing('infrastructures', -HALL_HALF_WIDTH, -1, byWing.infrastructures.length) ?? undefined,
    industrialisation: buildNorthWing(byWing.industrialisation.length) ?? undefined,
    culture: buildXWing('culture', HALL_HALF_WIDTH, 1, byWing.culture.length) ?? undefined,
  }

  const hallRoom: RoomLayout = {
    id: 'hall',
    bounds: aabb(-HALL_HALF_WIDTH, HALL_HALF_WIDTH, -HALL_HALF_DEPTH, HALL_HALF_DEPTH),
    label: roomLabels.hall,
    floorColor: wingThemes.hall.floor,
    wallColor: wingThemes.hall.wall,
    accentColor: wingThemes.hall.accent,
  }

  const hallWalls: ArchBox[] = []
  // Mur sud (côté caméra) : plein, jamais de porte.
  hallWalls.push(wall(xWall(HALL_HALF_DEPTH, -HALL_HALF_WIDTH, HALL_HALF_WIDTH, dims.wallThickness), true))
  // Mur nord → aile industrialisation.
  hallWalls.push(...hallWallSegments('x', -HALL_HALF_DEPTH, -HALL_HALF_WIDTH, HALL_HALF_WIDTH, !!wingBuilds.industrialisation))
  // Mur ouest → aile infrastructures.
  hallWalls.push(...hallWallSegments('z', -HALL_HALF_WIDTH, -HALL_HALF_DEPTH, HALL_HALF_DEPTH, !!wingBuilds.infrastructures))
  // Mur est → aile culture.
  hallWalls.push(...hallWallSegments('z', HALL_HALF_WIDTH, -HALL_HALF_DEPTH, HALL_HALF_DEPTH, !!wingBuilds.culture))

  // Linteaux décoratifs des portes ouvertes uniquement (une aile vide reste un mur plein, sans arche).
  const doorArches: DoorArch[] = []
  if (wingBuilds.industrialisation) doorArches.push({ box: xWall(-HALL_HALF_DEPTH, -DOOR_HALF, DOOR_HALF, dims.wallThickness), color: wingThemes.industrialisation.accent })
  if (wingBuilds.infrastructures) doorArches.push({ box: zWall(-HALL_HALF_WIDTH, -DOOR_HALF, DOOR_HALF, dims.wallThickness), color: wingThemes.infrastructures.accent })
  if (wingBuilds.culture) doorArches.push({ box: zWall(HALL_HALF_WIDTH, -DOOR_HALF, DOOR_HALF, dims.wallThickness), color: wingThemes.culture.accent })

  // Comptoir de Minerve, juste au sud d'elle.
  const curator: Placement = { position: { x: 0, z: -4.5 }, rotationY: 0 }
  const counterZ = curator.position.z + CURATOR_COUNTER_OFFSET_Z
  hallWalls.push(furniture(aabb(-COUNTER_HALF_WIDTH, COUNTER_HALF_WIDTH, counterZ - COUNTER_HALF_DEPTH, counterZ + COUNTER_HALF_DEPTH)))

  const decor = hallDecor()
  for (const p of decor.pillars) hallWalls.push(furniture(aabb(p.x - 0.4, p.x + 0.4, p.z - 0.4, p.z + 0.4)))
  for (const b of decor.benches) hallWalls.push(furniture(aabb(b.position.x - 0.8, b.position.x + 0.8, b.position.z - 0.25, b.position.z + 0.25)))
  for (const j of decor.planters) hallWalls.push(furniture(aabb(j.x - 0.35, j.x + 0.35, j.z - 0.35, j.z + 0.35)))

  const rooms: RoomLayout[] = [hallRoom]
  const archRooms: MuseumArchitecture['rooms'] = [{ room: hallRoom, walls: hallWalls }]
  const colliders: AABB[] = hallWalls.map((w) => w.box)
  const frames: FrameSlot[] = []
  const stampStations: StampStationSlot[] = []

  for (const wingId of EXHIBIT_WINGS) {
    const wb = wingBuilds[wingId]
    if (!wb) continue
    rooms.push(wb.room)
    // Le socle à tampon a un collider ici, mais son rendu appartient au module tampons (StampStations).
    const half = STAMP_STATION_SIZE / 2
    const stationBox = aabb(wb.stampStation.x - half, wb.stampStation.x + half, wb.stampStation.z - half, wb.stampStation.z + half)
    archRooms.push({ room: wb.room, walls: wb.walls })
    colliders.push(...wb.walls.map((w) => w.box), stationBox)
    stampStations.push({ wing: wingId, position: wb.stampStation })
    const people = byWing[wingId]
    wb.slots.forEach((slot, i) => {
      frames.push({ personId: people[i].id, wing: wingId, position: slot.position, rotationY: slot.rotationY, viewPoint: slot.viewPoint })
    })
  }

  const bounds = aabbUnion(rooms.map((r) => r.bounds))

  const layout: MuseumLayout = {
    rooms,
    colliders,
    frames,
    spawn: { position: { x: 0, z: 6.5 }, rotationY: Math.PI },
    curator,
    stampStations,
    bounds,
  }
  return { layout, architecture: { rooms: archRooms, decor, doorArches } }
}

/** Calcule le plan du musée (salles, murs, cadres) pour la liste donnée. */
export function buildMuseumLayout(people: Person[]): MuseumLayout {
  return build(people).layout
}

/** Description enrichie du musée pour le rendu 3D (`Museum.tsx`) : mêmes salles, murs annotés. */
export function buildMuseumArchitecture(people: Person[]): MuseumArchitecture {
  return build(people).architecture
}
