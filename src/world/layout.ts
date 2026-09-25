/**
 * Plan du musée — fonction pure et déterministe : mêmes entrées → même sortie.
 * Propriétaire : agent monde. Contrat (types, signature) : voir docs/ARCHITECTURE.md.
 */
import type { AABB, ExhibitWingId, FrameSlot, MuseumLayout, Person, Placement, RoomLayout, StampStationSlot, Vec2 } from '../types'
import { EXHIBIT_WINGS } from '../types'
import { wingThemes } from '../styles/tokens'
import {
  BENCH_HEIGHT,
  CAMERA_CUT_HEIGHT,
  CIMAISE_HEIGHT,
  CIMAISE_THICKNESS,
  COLUMN_HEIGHT,
  COLUMN_RADIUS,
  COUNTER_HALF_DEPTH,
  COUNTER_HALF_WIDTH,
  CURATOR_COUNTER_OFFSET_Z,
  DOOR_WIDTH,
  dims,
  END_MARGIN,
  FRAME_WALL_OFFSET,
  FURNITURE_HEIGHT,
  HALL_HALF_DEPTH,
  HALL_HALF_WIDTH,
  JARDINIERE_HEIGHT,
  JARDINIERE_RADIUS,
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
  /** Hauteur explicite (sinon : `CAMERA_CUT_HEIGHT`/`dims.wallHeight` pour un mur, `FURNITURE_HEIGHT` pour un meuble, voir `archBoxHeight`). */
  height?: number
  /** Vrai : collider seulement, pas de rendu générique (une géométrie dédiée le dessine ailleurs — ex. colonnes, comptoir). */
  hidden?: boolean
}

/** Hauteur (depuis le sol) d'un `ArchBox`, pour le rendu (`roomGeometry.ts`) et les tests d'occultation. */
export function archBoxHeight(w: ArchBox): number {
  if (w.height !== undefined) return w.height
  if (w.kind === 'wall') return w.cut ? CAMERA_CUT_HEIGHT : dims.wallHeight
  return FURNITURE_HEIGHT
}

/**
 * Cimaise ou cloison intérieure susceptible de se placer entre la caméra (toujours au sud du joueur,
 * voir `occlusion.ts`) et le joueur : rendue en mesh séparé (pas fusionnée dans la salle) pour pouvoir
 * s'estomper indépendamment (voir `Museum.tsx`). `personIds` liste les cadres accrochés à CETTE
 * cimaise : leurs cadre/toile/cartel suivent le même fondu qu'elle (mission occultation, V2).
 */
export interface Occluder {
  id: string
  wing: ExhibitWingId
  box: AABB
  height: number
  personIds: string[]
}

interface OccluderBuild {
  box: AABB
  height: number
  slotIndices: number[]
}

interface WingBuild {
  room: RoomLayout
  walls: ArchBox[]
  occluders: OccluderBuild[]
  slots: FrameCandidate[]
  stampStation: Vec2
}

/** Comptoir de Minerve, toujours au sud d'elle (voir `CURATOR_COUNTER_OFFSET_Z`). */
const CURATOR_POSITION: Vec2 = { x: 0, z: -4.5 }

/** Décor fixe du hall (piliers, bancs, jardinières, comptoir, arbre) : partagé avec le rendu (`Museum.tsx`). */
export interface HallDecor {
  pillars: Vec2[]
  benches: Placement[]
  planters: Vec2[]
  /** Comptoir arrondi de Minerve (plateau + façade) : rendu dédié, pas la géométrie « meuble » générique. */
  counter: { center: Vec2; halfWidth: number; halfDepth: number }
  /** Sculpture originale « l'Arbre des 100 » entourée d'un banc circulaire (collider). */
  tree: { center: Vec2; benchRadius: number }
}

export function hallDecor(): HallDecor {
  const counterCenter: Vec2 = { x: CURATOR_POSITION.x, z: CURATOR_POSITION.z + CURATOR_COUNTER_OFFSET_Z }
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
    counter: { center: counterCenter, halfWidth: COUNTER_HALF_WIDTH, halfDepth: COUNTER_HALF_DEPTH },
    // Centré sur l'axe du comptoir mais bien au sud (z ≥ 0.5) : jamais atteint par le segment
    // caméra→joueur « pire cas » de l'aile industrialisation (voir occlusion.test.ts et le
    // commentaire de `MIN_TREE_Z` plus bas), quelle que soit la rangée regardée.
    tree: { center: { x: 0, z: 2.5 }, benchRadius: 2.0 },
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
  /** Cimaises/cloisons occultantes de toutes les ailes peuplées : voir `Occluder`. */
  occluders: Occluder[]
  /** Ailes sans aucune personne : porte fermée, panneau « Bientôt » (voir `worldStrings.wingComingSoon`). */
  comingSoonWings: ExhibitWingId[]
}

function sortPeople(people: Person[]): Person[] {
  return [...people].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

function wall(box: AABB, cut = false): ArchBox {
  return { box, kind: 'wall', cut }
}
function furniture(box: AABB, height?: number, hidden?: boolean): ArchBox {
  return { box, kind: 'furniture', cut: false, height, hidden }
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
 *
 * Seul le mur principal (lane 0) est un mur « dur » fusionné dans la salle : il est la limite nord de
 * l'aile, donc jamais entre la caméra (toujours au sud du joueur) et le joueur. Les cimaises
 * intérieures (lanes 1..N-1) sont en revanche systématiquement traversées par ce segment dès que le
 * joueur regarde une rangée plus au nord qu'elles (c'est le bug V1 corrigé ici) : elles sont donc
 * des `Occluder` séparés, jamais fusionnés dans la géométrie statique de la salle (voir `Museum.tsx`).
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

  // Face « avant » (côté joueur, +Z) de chaque cimaise : la face sud (épaisseur `dims.wallThickness`)
  // du mur principal lui-même pour la 1ère, puis la face sud de chaque cimaise intérieure suivante
  // (épaisseur `CIMAISE_THICKNESS`, déjà utilisée pour les lanes ≥ 1 ci-dessous). `wallZFar` est le
  // CENTRE du mur principal, pas sa face : un cadre positionné à `wallZFar + FRAME_WALL_OFFSET` (bug
  // V2 — écrans envahis d'un aplat, voir layout.test.ts) reste enfoui à l'intérieur du mur (son
  // demi-mur, `dims.wallThickness / 2`, dépasse largement le petit décalage `FRAME_WALL_OFFSET`),
  // jamais devant sa face, contrairement aux cimaises intérieures dont `laneCenterZ + CIMAISE_THICKNESS
  // / 2` désigne déjà la face. On ajoute donc ce même demi-mur ici pour que « lane 0 » suive la même
  // convention (`laneFrontZ` = la face, pas le centre) que toutes les autres lanes.
  const laneFrontZ: number[] = [wallZFar + dims.wallThickness / 2]
  const laneOccluderIndex: Array<number | null> = [null] // lane 0 = mur principal, jamais occultant
  const occluders: OccluderBuild[] = []
  for (let lane = 1; lane < XWING_LANE_COUNT; lane++) {
    const laneCenterZ = wallZFar + lane * XWING_LANE_STEP
    const box = xWall(laneCenterZ, laneStartX, farX, CIMAISE_THICKNESS)
    occluders.push({ box, height: CIMAISE_HEIGHT, slotIndices: [] })
    laneOccluderIndex.push(occluders.length - 1)
    laneFrontZ.push(laneCenterZ + CIMAISE_THICKNESS / 2)
  }

  for (let i = 0; i < rows; i++) {
    const u = NEAR_MARGIN + i * ROW_STEP + ROW_STEP * 0.5
    const x = hallWallX + dir * u
    for (let lane = 0; lane < XWING_LANE_COUNT; lane++) {
      if (i * XWING_LANE_COUNT + lane >= count) break
      const z = laneFrontZ[lane] + FRAME_WALL_OFFSET
      const slotIndex = slots.length
      slots.push({ position: [x, dims.frameCenterY, z], rotationY: 0, viewPoint: { x, z: z + VIEW_DISTANCE } })
      const oi = laneOccluderIndex[lane]
      if (oi !== null) occluders[oi].slotIndices.push(slotIndex)
    }
  }

  const bounds = aabb(hallWallX, farX, wallZFar, wallZNear)
  const stampStation: Vec2 = { x: hallWallX + dir * 1.2, z: wallZFar + 2 }
  const room: RoomLayout = { id: wing, bounds, label: roomLabels[wing], floorColor: wingThemes[wing].floor, wallColor: wingThemes[wing].wall, accentColor: wingThemes[wing].accent }
  return { room, walls, occluders, slots: slots.slice(0, count), stampStation }
}

/**
 * Aile nord (axe Z, on s'y enfonce en s'éloignant du hall) : murs ouest/est pleins, sans cadre (ils
 * feraient face à ±X : invisibles pour la caméra fixe, voir la note de `buildXWing`), et une rangée
 * de cadres face à +Z empilée en profondeur pour chaque tranche de `NORTH_ROW_X.length` personnes.
 * Chaque rangée est une cimaise transversale courte (`NORTH_ROW_HALF_SPAN`), pas un mur plein : elle
 * laisse un passage de chaque côté pour que le joueur atteigne les rangées suivantes, plus au nord.
 *
 * Contrairement à `buildXWing`, cette aile n'a pas de mur principal séparé porteur de cadres : CHAQUE
 * rangée est sa propre cimaise, et est donc occultante dès qu'une rangée plus au nord est regardée
 * (voir le commentaire de `buildXWing` et `Occluder`) — toutes deviennent des `Occluder`.
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
  const occluders: OccluderBuild[] = []

  for (let i = 0; i < rows; i++) {
    // Point de vue à NEAR_MARGIN + i*NORTH_ROW_DEPTH du mur du hall (même logique que les autres
    // ailes) ; le cadre et sa cimaise sont plus loin encore (vers le nord), pour que le joueur les
    // découvre en s'avançant depuis le point de vue.
    const viewZ = hallWallZ + dir * (NEAR_MARGIN + i * NORTH_ROW_DEPTH)
    const frameZ = viewZ + dir * VIEW_DISTANCE
    const rowWallZ = frameZ + dir * (FRAME_WALL_OFFSET + CIMAISE_THICKNESS / 2)
    const box = xWall(rowWallZ, -NORTH_ROW_HALF_SPAN, NORTH_ROW_HALF_SPAN, CIMAISE_THICKNESS)
    const occluderIndex = occluders.length
    occluders.push({ box, height: CIMAISE_HEIGHT, slotIndices: [] })
    for (let j = 0; j < NORTH_ROW_X.length; j++) {
      if (i * NORTH_ROW_X.length + j >= count) break
      const x = NORTH_ROW_X[j]
      const slotIndex = slots.length
      slots.push({ position: [x, dims.frameCenterY, frameZ], rotationY: 0, viewPoint: { x, z: viewZ } })
      occluders[occluderIndex].slotIndices.push(slotIndex)
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
  return { room, walls, occluders, slots: slots.slice(0, count), stampStation }
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

  const comingSoonWings: ExhibitWingId[] = EXHIBIT_WINGS.filter((w) => !wingBuilds[w])

  // Comptoir de Minerve, juste au sud d'elle. Collider seulement ici (boîte simple) : le rendu
  // (plateau + façade arrondis) est une géométrie dédiée dans `roomGeometry.ts`/`Museum.tsx`, pas la
  // géométrie « meuble » générique fusionnée avec les autres boîtes ci-dessous.
  const curator: Placement = { position: CURATOR_POSITION, rotationY: 0 }
  const decor = hallDecor()
  const counterBox = aabb(
    decor.counter.center.x - decor.counter.halfWidth,
    decor.counter.center.x + decor.counter.halfWidth,
    decor.counter.center.z - decor.counter.halfDepth,
    decor.counter.center.z + decor.counter.halfDepth,
  )

  // `hidden: true` : collider seulement — une géométrie dédiée les dessine (colonnes rondes, bancs en
  // bois, jardinières à motte + feuillage), pas le pavé « meuble » générique.
  for (const p of decor.pillars) hallWalls.push(furniture(aabb(p.x - COLUMN_RADIUS, p.x + COLUMN_RADIUS, p.z - COLUMN_RADIUS, p.z + COLUMN_RADIUS), COLUMN_HEIGHT, true))
  for (const b of decor.benches) hallWalls.push(furniture(aabb(b.position.x - 0.8, b.position.x + 0.8, b.position.z - 0.25, b.position.z + 0.25), BENCH_HEIGHT, true))
  for (const j of decor.planters) hallWalls.push(furniture(aabb(j.x - JARDINIERE_RADIUS, j.x + JARDINIERE_RADIUS, j.z - JARDINIERE_RADIUS, j.z + JARDINIERE_RADIUS), JARDINIERE_HEIGHT, true))

  const rooms: RoomLayout[] = [hallRoom]
  const archRooms: MuseumArchitecture['rooms'] = [{ room: hallRoom, walls: hallWalls }]
  const colliders: AABB[] = [...hallWalls.map((w) => w.box), counterBox]
  const frames: FrameSlot[] = []
  const stampStations: StampStationSlot[] = []
  const occluders: Occluder[] = []

  // Banc circulaire autour de l'Arbre des 100 : lui aussi un collider (le joueur en fait le tour).
  const treeRing = decor.tree
  colliders.push(aabb(treeRing.center.x - treeRing.benchRadius, treeRing.center.x + treeRing.benchRadius, treeRing.center.z - treeRing.benchRadius, treeRing.center.z + treeRing.benchRadius))

  for (const wingId of EXHIBIT_WINGS) {
    const wb = wingBuilds[wingId]
    if (!wb) continue
    rooms.push(wb.room)
    // Le socle à tampon a un collider ici, mais son rendu appartient au module tampons (StampStations).
    const half = STAMP_STATION_SIZE / 2
    const stationBox = aabb(wb.stampStation.x - half, wb.stampStation.x + half, wb.stampStation.z - half, wb.stampStation.z + half)
    archRooms.push({ room: wb.room, walls: wb.walls })
    colliders.push(...wb.walls.map((w) => w.box), ...wb.occluders.map((o) => o.box), stationBox)
    stampStations.push({ wing: wingId, position: wb.stampStation })
    const people = byWing[wingId]
    wb.slots.forEach((slot, i) => {
      frames.push({ personId: people[i].id, wing: wingId, position: slot.position, rotationY: slot.rotationY, viewPoint: slot.viewPoint })
    })
    wb.occluders.forEach((o, idx) => {
      occluders.push({ id: `${wingId}-cimaise-${idx}`, wing: wingId, box: o.box, height: o.height, personIds: o.slotIndices.map((si) => people[si].id) })
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
  return { layout, architecture: { rooms: archRooms, decor, doorArches, occluders, comingSoonWings } }
}

/** Calcule le plan du musée (salles, murs, cadres) pour la liste donnée. */
export function buildMuseumLayout(people: Person[]): MuseumLayout {
  return build(people).layout
}

/** Description enrichie du musée pour le rendu 3D (`Museum.tsx`) : mêmes salles, murs annotés. */
export function buildMuseumArchitecture(people: Person[]): MuseumArchitecture {
  return build(people).architecture
}
