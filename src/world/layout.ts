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
  FRAME_WALL_OFFSET,
  HALL_HALF_DEPTH,
  HALL_HALF_WIDTH,
  NEAR_MARGIN,
  NORTH_ROW_DEPTH,
  NORTH_ROW_HALF_SPAN,
  NORTH_ROW_X,
  ROW_STEP,
  STAMP_STATION_SIZE,
  VIEW_DISTANCE,
  WING_WIDTH,
  XWING_LANE_COUNT,
  XWING_LANE_ENTRY,
  XWING_LANE_STEP,
} from './constants'
import { aabb, aabbUnion, xWall, zWall } from './collision'
import { roomLabels } from './strings'

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

/**
 * Aile est/ouest (axe X) : mur principal côté nord de l'aile + cimaises intérieures, toutes
 * parallèles (jamais en épi). La caméra est fixe et ne regarde jamais que vers -Z : un cadre n'est
 * jamais lisible sauf s'il fait face à +Z (`rotationY = 0`), quelle que soit la position du joueur
 * (voir `docs/ARCHITECTURE.md` et `src/player/Player.tsx::FIXED_CAMERA_QUATERNION`). On empile donc
 * `XWING_LANE_COUNT` cimaises parallèles au mur principal (une rangée de cadres face à +Z chacune)
 * plutôt que des cloisons perpendiculaires (« épis », face ±X, invisibles de face dans tous les cas).
 * Les cimaises intérieures démarrent après `NEAR_MARGIN` : le joueur peut se répartir librement entre
 * les couloirs juste après la porte, avant la première rangée.
 */
function buildXWing(wing: ExhibitWingId, hallWallX: number, dir: 1 | -1, count: number): WingBuild | null {
  if (count <= 0) return null
  const wallZFar = -WING_WIDTH / 2 // mur plein (non côté caméra), porte la 1ère rangée de cadres
  const wallZNear = WING_WIDTH / 2 // côté caméra, coupé, jamais de cadre

  const rows = Math.ceil(count / XWING_LANE_COUNT)
  const length = NEAR_MARGIN + rows * ROW_STEP + END_MARGIN
  const farX = hallWallX + dir * length
  const laneStartX = hallWallX + dir * XWING_LANE_ENTRY

  const slots: FrameCandidate[] = []
  const walls: ArchBox[] = [
    wall(xWall(wallZFar, hallWallX, farX, dims.wallThickness)),
    wall(xWall(wallZNear, hallWallX, farX, dims.wallThickness), true),
    wall(zWall(farX, wallZFar, wallZNear, dims.wallThickness)),
  ]

  // Face « avant » (côté joueur, +Z) de chaque cimaise : le mur principal lui-même pour la 1ère,
  // puis la face sud de chaque cimaise intérieure suivante.
  const laneFrontZ: number[] = [wallZFar]
  for (let lane = 1; lane < XWING_LANE_COUNT; lane++) {
    const laneCenterZ = wallZFar + lane * XWING_LANE_STEP
    walls.push(wall(xWall(laneCenterZ, laneStartX, farX, CIMAISE_THICKNESS)))
    laneFrontZ.push(laneCenterZ + CIMAISE_THICKNESS / 2)
  }

  for (let i = 0; i < rows; i++) {
    const u = NEAR_MARGIN + i * ROW_STEP + ROW_STEP * 0.5
    const x = hallWallX + dir * u
    for (let lane = 0; lane < XWING_LANE_COUNT; lane++) {
      if (i * XWING_LANE_COUNT + lane >= count) break
      const z = laneFrontZ[lane] + FRAME_WALL_OFFSET
      slots.push({ position: [x, dims.frameCenterY, z], rotationY: 0, viewPoint: { x, z: z + VIEW_DISTANCE } })
    }
  }

  const bounds = aabb(hallWallX, farX, wallZFar, wallZNear)
  const stampStation: Vec2 = { x: hallWallX + dir * 1.2, z: wallZFar + 2 }
  const room: RoomLayout = { id: wing, bounds, label: roomLabels[wing], floorColor: wingThemes[wing].floor, wallColor: wingThemes[wing].wall, accentColor: wingThemes[wing].accent }
  return { room, walls, slots: slots.slice(0, count), stampStation }
}

/**
 * Aile nord (axe Z, on s'y enfonce en s'éloignant du hall) : murs ouest/est pleins, sans cadre (ils
 * feraient face à ±X : invisibles pour la caméra fixe, voir la note de `buildXWing`), et une rangée
 * de cadres face à +Z empilée en profondeur pour chaque tranche de `NORTH_ROW_X.length` personnes.
 * Chaque rangée est une cimaise transversale courte (`NORTH_ROW_HALF_SPAN`), pas un mur plein : elle
 * laisse un passage de chaque côté pour que le joueur atteigne les rangées suivantes, plus au nord.
 */
function buildNorthWing(count: number): WingBuild | null {
  if (count <= 0) return null
  const hallWallZ = -HALL_HALF_DEPTH
  const dir = -1
  const xWest = -WING_WIDTH / 2
  const xEast = WING_WIDTH / 2

  const rows = Math.ceil(count / NORTH_ROW_X.length)
  const length = NEAR_MARGIN + rows * NORTH_ROW_DEPTH + END_MARGIN
  const farZ = hallWallZ + dir * length

  const slots: FrameCandidate[] = []
  const walls: ArchBox[] = [wall(zWall(xWest, farZ, hallWallZ, dims.wallThickness)), wall(zWall(xEast, farZ, hallWallZ, dims.wallThickness)), wall(xWall(farZ, xWest, xEast, dims.wallThickness))]

  for (let i = 0; i < rows; i++) {
    // Point de vue à NEAR_MARGIN + i*NORTH_ROW_DEPTH du mur du hall (même logique que les autres
    // ailes) ; le cadre et sa cimaise sont plus loin encore (vers le nord), pour que le joueur les
    // découvre en s'avançant depuis le point de vue.
    const viewZ = hallWallZ + dir * (NEAR_MARGIN + i * NORTH_ROW_DEPTH)
    const frameZ = viewZ + dir * VIEW_DISTANCE
    const rowWallZ = frameZ + dir * (FRAME_WALL_OFFSET + CIMAISE_THICKNESS / 2)
    walls.push(wall(xWall(rowWallZ, -NORTH_ROW_HALF_SPAN, NORTH_ROW_HALF_SPAN, CIMAISE_THICKNESS)))
    for (let j = 0; j < NORTH_ROW_X.length; j++) {
      if (i * NORTH_ROW_X.length + j >= count) break
      const x = NORTH_ROW_X[j]
      slots.push({ position: [x, dims.frameCenterY, frameZ], rotationY: 0, viewPoint: { x, z: viewZ } })
    }
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
