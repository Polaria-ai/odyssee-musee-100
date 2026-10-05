import { describe, expect, it } from 'vitest'
import type { ExhibitWingId, FrameSlot, MuseumLayout, Person, Vec2 } from '../types'
import { EXHIBIT_WINGS } from '../types'
import { archBoxHeight, buildMuseumArchitecture, buildMuseumLayout } from './layout'
import { circleIntersectsAabb, pointInAabb } from './collision'
import { CIMAISE_THICKNESS, dims, DOOR_WIDTH, FRAME_WALL_OFFSET, HALL_HALF_WIDTH, MIN_WALKABLE_CORRIDOR, ROW_STEP, VIEW_DISTANCE, WING_WIDTH, XWING_CROSS_PASSAGE_WIDTH, XWING_LANE_COUNT, XWING_LANE_ENTRY, XWING_LANE_STEP, XWING_REAR_PASSAGE_WIDTH } from './constants'
import { archivesDoor } from '../styles/tokens'
import { occludesPlayer, worstCaseCameraFor } from './occlusion'
import { generatePlaceholderPeople } from '../data/placeholder'
import { resolveMovement } from '../player/physics'
import { playerColliders } from '../scene/playerColliders'
import { buildFrameGeometry } from './frameGeometry'

const GRID_STEP = 0.25

function makePeople(counts: Record<ExhibitWingId, number>): Person[] {
  const people: Person[] = []
  let order = 1
  for (const wing of EXHIBIT_WINGS) {
    for (let i = 0; i < counts[wing]; i++, order++) {
      people.push({
        id: `p-${wing}-${String(i).padStart(3, '0')}`,
        order,
        name: `Test ${order}`,
        role: { fr: 'Rôle', en: 'Role' },
        organization: 'Org',
        country: 'EU',
        wing,
        bio: { fr: 'Bio', en: 'Bio' },
        story: { fr: '', en: '' },
        photoUrl: null,
        placeholder: true,
      })
    }
  }
  return people
}

const distributions: Record<string, Person[]> = {
  '100 fiches par défaut': generatePlaceholderPeople(100),
  '100/0/0': makePeople({ infrastructures: 100, industrialisation: 0, culture: 0 }),
  '0/0/100': makePeople({ infrastructures: 0, industrialisation: 0, culture: 100 }),
  '30/40/30 (répartition des données locales)': makePeople({ infrastructures: 30, industrialisation: 40, culture: 30 }),
  '60/30/10': makePeople({ infrastructures: 60, industrialisation: 30, culture: 10 }),
  '1 personne': makePeople({ infrastructures: 0, industrialisation: 1, culture: 0 }),
  'petites salles latérales (2/0/3)': makePeople({ infrastructures: 2, industrialisation: 0, culture: 3 }),
  '120 personnes': generatePlaceholderPeople(120),
}

/**
 * Grille de marchabilité précalculée une seule fois par plan (0,25 m) : les ailes plus grandes
 * (mission occultation, V2 : couloirs ≥ 4,5 m) élargissent nettement les bounds, donc le nombre de
 * cellules — sans ce cache, refaire un test de colliders par cellule pour CHAQUE viewPoint (une
 * centaine) dépasse largement le budget d'un test unitaire.
 */
interface WalkGrid {
  cols: number
  rows: number
  minX: number
  minZ: number
  walkable: Uint8Array
  reachableFrom: Map<number, Uint8Array>
  toCell: (p: Vec2) => { cx: number; cz: number }
}

function buildWalkGrid(layout: MuseumLayout): WalkGrid {
  const b = layout.bounds
  const margin = 1
  const minX = b.minX - margin
  const minZ = b.minZ - margin
  const cols = Math.ceil((b.maxX + margin - minX) / GRID_STEP) + 1
  const rows = Math.ceil((b.maxZ + margin - minZ) / GRID_STEP) + 1

  const walkable = new Uint8Array(cols * rows)
  for (let cz = 0; cz < rows; cz++) {
    for (let cx = 0; cx < cols; cx++) {
      const p = { x: minX + cx * GRID_STEP, z: minZ + cz * GRID_STEP }
      if (!layout.colliders.some((c) => circleIntersectsAabb(p, dims.playerRadius, c))) walkable[cz * cols + cx] = 1
    }
  }

  return {
    cols,
    rows,
    minX,
    minZ,
    walkable,
    reachableFrom: new Map(),
    toCell: (p) => ({ cx: Math.round((p.x - minX) / GRID_STEP), cz: Math.round((p.z - minZ) / GRID_STEP) }),
  }
}

/** BFS sur une grille précalculée (`buildWalkGrid`) : vrai s'il existe un chemin libre entre deux points. */
function isReachable(grid: WalkGrid, from: Vec2, to: Vec2): boolean {
  const { cols, rows, walkable } = grid
  const idx = (cx: number, cz: number) => cz * cols + cx
  const inBounds = (cx: number, cz: number) => cx >= 0 && cz >= 0 && cx < cols && cz < rows

  const start = grid.toCell(from)
  const goal = grid.toCell(to)
  if (!inBounds(start.cx, start.cz) || !walkable[idx(start.cx, start.cz)]) return false
  if (!inBounds(goal.cx, goal.cz) || !walkable[idx(goal.cx, goal.cz)]) return false
  const cached = grid.reachableFrom.get(idx(start.cx, start.cz))
  if (cached) return cached[idx(goal.cx, goal.cz)] === 1

  const visited = new Uint8Array(cols * rows)
  const queue: number[] = [start.cx, start.cz]
  visited[idx(start.cx, start.cz)] = 1
  let head = 0
  while (head < queue.length) {
    const cx = queue[head++]
    const cz = queue[head++]
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx
      const nz = cz + dz
      if (!inBounds(nx, nz)) continue
      if (visited[idx(nx, nz)]) continue
      if (!walkable[idx(nx, nz)]) continue
      visited[idx(nx, nz)] = 1
      queue.push(nx, nz)
    }
  }
  grid.reachableFrom.set(idx(start.cx, start.cz), visited)
  return visited[idx(goal.cx, goal.cz)] === 1
}

function roomFor(layout: MuseumLayout, wing: string) {
  const room = layout.rooms.find((r) => r.id === wing)
  if (!room) throw new Error(`salle introuvable: ${wing}`)
  return room
}

/** Regroupe les cadres qui partagent physiquement le même mur (aile, orientation, coordonnée fixe). */
function groupByWall(frames: FrameSlot[]): FrameSlot[][] {
  const groups = new Map<string, FrameSlot[]>()
  for (const f of frames) {
    const facingX = Math.abs(Math.cos(f.rotationY)) < 0.5 // rotationY = ±π/2 → mur vertical (le long de Z), coordonnée fixe = x
    const fixed = facingX ? f.position[0] : f.position[2]
    const key = `${f.wing}:${f.rotationY.toFixed(3)}:${fixed.toFixed(2)}`
    const group = groups.get(key) ?? []
    group.push(f)
    groups.set(key, group)
  }
  return [...groups.values()]
}

describe.each(Object.entries(distributions))('buildMuseumLayout — %s', (_label, people) => {
  const layout = buildMuseumLayout(people)

  it('déterminisme : deux appels identiques donnent le même JSON', () => {
    const again = buildMuseumLayout(people)
    expect(JSON.stringify(again)).toBe(JSON.stringify(layout))
  })

  it('chaque personne a exactement un cadre', () => {
    expect(layout.frames).toHaveLength(people.length)
    const counts = new Map<string, number>()
    for (const f of layout.frames) counts.set(f.personId, (counts.get(f.personId) ?? 0) + 1)
    for (const p of people) expect(counts.get(p.id), `${p.id} doit avoir exactement un cadre`).toBe(1)
  })

  it('les cadres sont dans les bounds de leur salle', () => {
    for (const f of layout.frames) {
      const room = roomFor(layout, f.wing)
      expect(f.position[0]).toBeGreaterThanOrEqual(room.bounds.minX)
      expect(f.position[0]).toBeLessThanOrEqual(room.bounds.maxX)
      expect(f.position[2]).toBeGreaterThanOrEqual(room.bounds.minZ)
      expect(f.position[2]).toBeLessThanOrEqual(room.bounds.maxZ)
    }
  })

  it('aucune paire de cadres à moins de 1,9 m sur un même mur', () => {
    for (const group of groupByWall(layout.frames)) {
      const facingX = Math.abs(Math.cos(group[0].rotationY)) < 0.5
      const coords = group.map((f) => (facingX ? f.position[2] : f.position[0])).sort((a, b) => a - b)
      for (let i = 1; i < coords.length; i++) {
        expect(coords[i] - coords[i - 1]).toBeGreaterThanOrEqual(1.9)
      }
    }
  })

  // La caméra du jeu est fixe et ne regarde jamais que vers -Z (voir `src/player/Player.tsx`,
  // `FIXED_CAMERA_QUATERNION`, jamais recalculée à partir de la rotation du joueur) : un cadre n'est
  // jamais visible de face sauf s'il fait face à +Z (rotationY = 0). Un cadre en épi (±π/2, face à
  // l'axe X) ou au mur du fond (π, face à -Z) reste vu par la tranche depuis n'importe quel point de
  // vue, quelle que soit la position du joueur (régression : voir docs de `buildXWing`).
  it('tout cadre fait face à +Z (rotationY = 0) : seule orientation visible par la caméra fixe', () => {
    for (const f of layout.frames) {
      expect(f.rotationY, `rotationY inattendu pour ${f.personId}: ${f.rotationY}`).toBeCloseTo(0)
    }
  })

  it('chaque viewPoint est hors colliders et dans une salle', () => {
    for (const f of layout.frames) {
      for (const c of layout.colliders) {
        expect(circleIntersectsAabb(f.viewPoint, dims.playerRadius, c), `viewPoint de ${f.personId} dans un collider`).toBe(false)
      }
      const inSomeRoom = layout.rooms.some((r) => pointInAabb(f.viewPoint, r.bounds))
      expect(inSomeRoom, `viewPoint de ${f.personId} hors de toute salle`).toBe(true)
    }
  })

  it('spawn et curator sont valides', () => {
    expect(pointInAabb(layout.spawn.position, roomFor(layout, 'hall').bounds)).toBe(true)
    expect(pointInAabb(layout.curator.position, roomFor(layout, 'hall').bounds)).toBe(true)
    for (const c of layout.colliders) {
      expect(circleIntersectsAabb(layout.spawn.position, dims.playerRadius, c)).toBe(false)
    }
  })

  // Le flood fill est mémorisé pour ce spawn : une seule exploration vérifie tous les portraits.
  it(
    'un chemin libre existe du spawn à chaque viewPoint',
    () => {
      const grid = buildWalkGrid({ ...layout, colliders: playerColliders(layout, buildMuseumArchitecture(people)) })
      for (const f of layout.frames) {
        expect(isReachable(grid, layout.spawn.position, f.viewPoint), `pas de chemin vers ${f.personId}`).toBe(true)
      }
    },
    15000,
  )

  it('un socle à tampon existe pour chaque aile non vide, à l’intérieur de son aile', () => {
    const wingsWithPeople = new Set(people.map((p) => p.wing))
    expect(new Set(layout.stampStations.map((s) => s.wing))).toEqual(wingsWithPeople)
    for (const s of layout.stampStations) {
      expect(pointInAabb(s.position, roomFor(layout, s.wing).bounds)).toBe(true)
    }
  })

  it('une arche de porte existe pour chaque aile non vide, aucune pour une aile vide', () => {
    const wingsWithPeople = new Set(people.map((p) => p.wing))
    const architecture = buildMuseumArchitecture(people)
    expect(architecture.doorArches).toHaveLength(wingsWithPeople.size)
    for (const arch of architecture.doorArches) {
      expect(arch.box.maxX).toBeGreaterThan(arch.box.minX)
      expect(arch.box.maxZ).toBeGreaterThan(arch.box.minZ)
    }
  })

  // Mission occultation (V2) : les cimaises se placent nécessairement entre la caméra (toujours au
  // sud du joueur, voir `occlusion.ts`) et le joueur dès qu'il regarde une rangée plus au nord
  // qu'elles (bug V1). Elles sont donc des `Occluder` séparés (fondu, voir `Museum.tsx`), jamais
  // fusionnés dans les murs/meubles « durs » de la salle. Ce test vérifie l'inverse : aucun mur ou
  // meuble NON estompable ne coupe jamais le segment caméra→joueur, quel que soit le viewPoint, y
  // compris au pire cas (caméra à `cameraRig.maxDistance`, écran le plus étroit possible).
  it('chaque viewPoint laisse voir le joueur ET son cadre : aucun obstacle non estompable ne coupe le segment caméra→joueur (pire cas)', () => {
    const architecture = buildMuseumArchitecture(people)
    for (const f of layout.frames) {
      const wingWalls = architecture.rooms.find((r) => r.room.id === f.wing)?.walls ?? []
      const camera = worstCaseCameraFor(f.viewPoint.x, f.viewPoint.z)
      for (const w of wingWalls) {
        const occluded = occludesPlayer({ box: w.box, height: archBoxHeight(w) }, f.viewPoint.x, f.viewPoint.z, camera)
        expect(occluded, `${f.personId} (${f.wing}) occulté par un obstacle non estompable (${w.kind}, cut=${w.cut})`).toBe(false)
      }
    }
  })

  // WEL-874 (chantier assets 3D) : `decorPlacements` est le contrat entre ce module (positions) et le
  // module props (modèles CC0). Voir le commentaire en tête de layout.ts.
  it('chaque decorPlacement est dans les bounds de sa salle', () => {
    const architecture = buildMuseumArchitecture(people)
    for (const d of architecture.decorPlacements) {
      const room = roomFor(layout, d.room)
      expect(pointInAabb(d.position, room.bounds), `${d.type} (${d.room}) hors des bounds de sa salle`).toBe(true)
    }
  })

  it('porte sud du hall (Archives de 2040) : mur sud percé en face de tokens.archivesDoor, embrasure libre', () => {
    const hall = roomFor(layout, 'hall')
    const doorZ = hall.bounds.maxZ
    // Le seuil de la porte n'est dans aucun obstacle…
    for (let x = archivesDoor.x - archivesDoor.width / 2 + dims.playerRadius + 0.05; x <= archivesDoor.x + archivesDoor.width / 2 - dims.playerRadius - 0.05; x += 0.25) {
      for (const box of layout.colliders) {
        expect(circleIntersectsAabb({ x, z: doorZ + 0.2 }, dims.playerRadius, box), `seuil bloqué en x=${x.toFixed(2)}`).toBe(false)
      }
    }
    // … et aucun décor n'est posé devant l'embrasure, côté hall.
    const architecture = buildMuseumArchitecture(people)
    for (const d of architecture.decorPlacements) {
      if (d.room !== 'hall') continue
      const inFront = Math.abs(d.position.x - archivesDoor.x) < archivesDoor.width / 2 + 0.3 && d.position.z > doorZ - 1.5
      expect(inFront, `${d.type} devant la porte des Archives`).toBe(false)
    }
  })

  it('aucun decorPlacement dans l’ouverture d’une porte du hall (largeur DOOR_WIDTH)', () => {
    const architecture = buildMuseumArchitecture(people)
    const hall = roomFor(layout, 'hall')
    const doorHalf = DOOR_WIDTH / 2
    for (const d of architecture.decorPlacements) {
      if (d.room !== 'hall') continue
      const nearNorthWall = Math.abs(d.position.z - hall.bounds.minZ) < 1
      const nearSideWall = Math.abs(Math.abs(d.position.x) - hall.bounds.maxX) < 1
      if (nearNorthWall) expect(Math.abs(d.position.x), `${d.type} dans la porte nord`).toBeGreaterThanOrEqual(doorHalf)
      if (nearSideWall) expect(Math.abs(d.position.z), `${d.type} dans une porte est/ouest`).toBeGreaterThanOrEqual(doorHalf)
    }
  })

  it('aucun decorPlacement ne coïncide avec le viewPoint d’un cadre (le joueur doit pouvoir s’y tenir)', () => {
    const architecture = buildMuseumArchitecture(people)
    for (const d of architecture.decorPlacements) {
      for (const f of layout.frames) {
        const dist = Math.hypot(d.position.x - f.viewPoint.x, d.position.z - f.viewPoint.z)
        expect(dist, `${d.type} (${d.room}) recouvre le viewPoint de ${f.personId}`).toBeGreaterThanOrEqual(dims.playerRadius)
      }
    }
  })

  it('pas de chevauchement entre deux decorPlacements (distance minimale raisonnable)', () => {
    const architecture = buildMuseumArchitecture(people)
    const MIN_SPACING = 0.4
    const list = architecture.decorPlacements
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        const dist = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)
        expect(dist, `${a.type} et ${b.type} trop proches (${dist.toFixed(2)} m)`).toBeGreaterThanOrEqual(MIN_SPACING)
      }
    }
  })

  // Régression (bug V2 — écran envahi d'un aplat) : `laneFrontZ[0]`, dans `buildXWing`, désignait le
  // CENTRE du mur principal (`wallZFar`) plutôt que sa face côté joueur, contrairement aux cimaises
  // intérieures (`laneCenterZ + CIMAISE_THICKNESS / 2`, déjà une face). `FRAME_WALL_OFFSET` (0,06 m)
  // ajouté à un centre au lieu d'une face laissait le cadre — cadre, toile ET cartel — enfoui à
  // l'intérieur du mur (demi-épaisseur `dims.wallThickness / 2` = 0,2 m, largement > 0,06 m) : invisible
  // depuis n'importe quel angle, quelle que soit la caméra (occultation par le mur lui-même, opaque et
  // jamais estompé). Ce test vérifie qu'aucun cadre, dans aucune aile, ne se trouve à l'intérieur de
  // l'empoint d'un mur « dur » (non estompable) de sa propre aile.
  it('aucun cadre n’est enfoui dans un mur dur de son aile (régression : cadre invisible, mur non estompé)', () => {
    const architecture = buildMuseumArchitecture(people)
    for (const { room, walls } of architecture.rooms) {
      if (room.id === 'hall') continue
      const framesInRoom = layout.frames.filter((f) => f.wing === room.id)
      for (const f of framesInRoom) {
        const point: Vec2 = { x: f.position[0], z: f.position[2] }
        for (const w of walls) {
          if (w.kind !== 'wall') continue
          expect(pointInAabb(point, w.box), `${f.personId} (${f.wing}) enfoui dans un mur (${JSON.stringify(w.box)})`).toBe(false)
        }
      }
    }
  })
})

describe('mission occultation (V2) — cimaises estompables', () => {
  it('régression : la cause du bug V1 est réelle (une cimaise se place bien entre la caméra et un point de vue du mur principal), et corrigée seulement parce qu’elle est estompable', () => {
    const people = makePeople({ infrastructures: 100, industrialisation: 0, culture: 0 })
    const layout = buildMuseumLayout(people)
    const architecture = buildMuseumArchitecture(people)
    const occludedIds = new Set(architecture.occluders.flatMap((o) => o.personIds))
    // Un cadre du mur principal (lane 0, jamais accroché à une cimaise) mais assez loin dans l'aile
    // pour que d'autres cimaises se trouvent entre son point de vue et la caméra.
    const mainWallFrame = layout.frames.find((f) => f.wing === 'infrastructures' && !occludedIds.has(f.personId))
    expect(mainWallFrame, 'aucun cadre de mur principal trouvé pour ce scénario (100 personnes, 1 seule aile)').toBeTruthy()

    const camera = worstCaseCameraFor(mainWallFrame!.viewPoint.x, mainWallFrame!.viewPoint.z)
    const blockingOccluder = architecture.occluders.find(
      (o) => o.wing === 'infrastructures' && occludesPlayer({ box: o.box, height: o.height }, mainWallFrame!.viewPoint.x, mainWallFrame!.viewPoint.z, camera),
    )
    expect(blockingOccluder, 'aucune cimaise ne se place entre la caméra et ce point de vue : le scénario de régression ne teste plus rien').toBeTruthy()
  })

  const multiLaneDistributions: Record<string, Person[]> = {
    '100 fiches par défaut': generatePlaceholderPeople(100),
    '100/0/0 (infrastructures)': makePeople({ infrastructures: 100, industrialisation: 0, culture: 0 }),
    '0/100/0 (industrialisation)': makePeople({ infrastructures: 0, industrialisation: 100, culture: 0 }),
    '60/30/10': makePeople({ infrastructures: 60, industrialisation: 30, culture: 10 }),
  }
  for (const [label, people] of Object.entries(multiLaneDistributions)) {
    it(`${label} : couloir ≥ ${MIN_WALKABLE_CORRIDOR} m entre deux cimaises consécutives d’une même aile`, () => {
      const architecture = buildMuseumArchitecture(people)
      const byWing = new Map<ExhibitWingId, typeof architecture.occluders>()
      for (const o of architecture.occluders) byWing.set(o.wing, [...(byWing.get(o.wing) ?? []), o])
      for (const [wing, list] of byWing) {
        // Plusieurs segments longitudinaux appartiennent à la même lane : comparer les lanes,
        // jamais deux morceaux séparés par la traversée (ils partagent exactement le même Z).
        const lanes = new Map(list.map((o) => [o.box.minZ, o]))
        const sorted = [...lanes.values()].sort((a, b) => a.box.minZ - b.box.minZ)
        for (let i = 1; i < sorted.length; i++) {
          const gap = sorted[i].box.minZ - sorted[i - 1].box.maxZ
          expect(gap, `${wing} : écart insuffisant entre les cimaises ${i - 1} et ${i}`).toBeGreaterThanOrEqual(MIN_WALKABLE_CORRIDOR)
        }
      }
    })
  }
})

describe('salles latérales — traversées au milieu et boucle au fond', () => {
  const frameGeometry = buildFrameGeometry()
  frameGeometry.computeBoundingBox()
  const frameHalfWidth = (frameGeometry.boundingBox!.max.x - frameGeometry.boundingBox!.min.x) / 2
  frameGeometry.dispose()

  for (const wing of ['infrastructures', 'culture'] as const) {
    for (const count of [1, 2, 3, 4, 5, 10, 33, 34, 60, 100]) {
      describe(`${wing}, ${count} portraits`, () => {
        const people = makePeople({ infrastructures: 0, industrialisation: 0, culture: 0, [wing]: count })
        const layout = buildMuseumLayout(people)
        const architecture = buildMuseumArchitecture(people)
        const colliders = playerColliders(layout, architecture)
        const room = roomFor(layout, wing)
        const dir = wing === 'infrastructures' ? -1 : 1
        const hallX = dir * HALL_HALF_WIDTH
        const xAt = (distance: number) => hallX + dir * distance
        const rows = Math.ceil(count / XWING_LANE_COUNT)
        const passageStart = XWING_LANE_ENTRY + Math.ceil(rows / 2) * ROW_STEP
        const passageEnd = passageStart + XWING_CROSS_PASSAGE_WIDTH
        const laneEnd = XWING_LANE_ENTRY + rows * ROW_STEP + XWING_CROSS_PASSAGE_WIDTH
        const farX = dir === -1 ? room.bounds.minX : room.bounds.maxX
        const middleX = xAt((passageStart + passageEnd) / 2)
        const rearX = farX - dir * 3.0
        const northZ = -WING_WIDTH / 2 + dims.wallThickness / 2 + FRAME_WALL_OFFSET + VIEW_DISTANCE
        const southZ = -WING_WIDTH / 2 + (XWING_LANE_COUNT - 1) * XWING_LANE_STEP + CIMAISE_THICKNESS / 2 + FRAME_WALL_OFFSET + VIEW_DISTANCE
        const occluders = architecture.occluders.filter((o) => o.wing === wing)

        const walkTo = (from: Vec2, to: Vec2): Vec2 => {
          const arrived = resolveMovement(from, { x: to.x - from.x, z: to.z - from.z }, dims.playerRadius, colliders)
          expect(arrived.x, `trajet X ${JSON.stringify(from)} → ${JSON.stringify(to)}`).toBeCloseTo(to.x, 6)
          expect(arrived.z, `trajet Z ${JSON.stringify(from)} → ${JSON.stringify(to)}`).toBeCloseTo(to.z, 6)
          return arrived
        }

        it('conserve tous les portraits et leur moulure entièrement sur le bon support', () => {
          expect(layout.frames).toHaveLength(count)
          expect(occluders).toHaveLength(rows === 1 ? 2 : 4)
          for (const frame of layout.frames) {
            const owners = occluders.filter((o) => o.personIds.includes(frame.personId))
            const isMainWall = Math.abs(frame.position[2] - (-WING_WIDTH / 2 + dims.wallThickness / 2 + FRAME_WALL_OFFSET)) < 1e-6
            expect(owners).toHaveLength(isMainWall ? 0 : 1)
            const support = owners[0]?.box ?? architecture.rooms.find((r) => r.room.id === wing)!.walls[0].box
            expect(frame.position[0] - frameHalfWidth).toBeGreaterThanOrEqual(support.minX - 1e-6)
            expect(frame.position[0] + frameHalfWidth).toBeLessThanOrEqual(support.maxX + 1e-6)
            expect(frame.position[2]).toBeCloseTo(support.maxZ + FRAME_WALL_OFFSET, 6)
          }
          const attached = occluders.flatMap((o) => o.personIds)
          expect(new Set(attached).size).toBe(attached.length)
          expect(attached.every((id) => people.some((p) => p.id === id))).toBe(true)
        })

        it('ouvre 2,4 m entre les groupes, et 3,6 m jusqu’à la face intérieure du fond', () => {
          const laneGroups = new Map<number, typeof occluders>()
          for (const o of occluders) laneGroups.set(o.box.minZ, [...(laneGroups.get(o.box.minZ) ?? []), o])
          for (const lane of laneGroups.values()) {
            const segments = lane.map((o) => [dir * (o.box.minX - hallX), dir * (o.box.maxX - hallX)].sort((a, b) => a - b)).sort((a, b) => a[0] - b[0])
            expect(segments[0]).toEqual(expect.arrayContaining([XWING_LANE_ENTRY]))
            expect(segments[0][1]).toBeCloseTo(passageStart, 6)
            if (rows > 1) {
              expect(segments[1][0]).toBeCloseTo(passageEnd, 6)
              expect(segments[1][1]).toBeCloseTo(laneEnd, 6)
            }
          }
          expect(Math.abs(farX - xAt(laneEnd)) - dims.wallThickness / 2).toBeCloseTo(XWING_REAR_PASSAGE_WIDTH, 6)
          expect(occluders.every((o) => layout.colliders.some((c) => JSON.stringify(c) === JSON.stringify(o.box)))).toBe(true)
        })

        it('traverse les trois couloirs au milieu avec la physique réelle, mobilier inclus', () => {
          // Tester aussi les bords du passage : aucun meuble automatique n'en condamne l'entrée.
          for (const u of [passageStart + dims.playerRadius + 0.05, (passageStart + passageEnd) / 2, passageEnd - dims.playerRadius - 0.05]) {
            const x = xAt(u)
            walkTo({ x, z: southZ }, { x, z: northZ })
            walkTo({ x, z: northZ }, { x, z: southZ })
          }
        })

        it('boucle continûment au fond puis revient par la traversée centrale, sans retourner à la porte', () => {
          const lastFrameX = xAt(laneEnd - ROW_STEP / 2 - (rows === 1 ? XWING_CROSS_PASSAGE_WIDTH : 0))
          let position = { x: lastFrameX, z: southZ }
          for (const point of [
            { x: rearX, z: southZ },
            { x: rearX, z: northZ },
            { x: middleX, z: northZ },
            { x: middleX, z: southZ },
            { x: lastFrameX, z: southZ },
          ]) position = walkTo(position, point)
        })

        it('le mur du fond et les deux murs extérieurs empêchent toujours toute sortie', () => {
          const towardFar = resolveMovement({ x: rearX, z: northZ }, { x: dir * 20, z: 0 }, dims.playerRadius, colliders)
          expect(dir * (farX - towardFar.x)).toBeCloseTo(dims.wallThickness / 2 + dims.playerRadius, 6)
          for (const side of [-1, 1]) {
            const start = { x: middleX, z: side * 5 }
            const towardSide = resolveMovement(start, { x: 0, z: side * 20 }, dims.playerRadius, colliders)
            expect(side * towardSide.z).toBeCloseTo(WING_WIDTH / 2 - dims.wallThickness / 2 - dims.playerRadius, 6)
          }
        })
      })
    }
  }
})

describe('buildMuseumLayout — hall', () => {
  const layout = buildMuseumLayout(generatePlaceholderPeople(100))

  it('grand hall ≈ 22 × 18 m centré sur l’origine', () => {
    const hall = roomFor(layout, 'hall')
    expect(hall.bounds).toEqual({ minX: -11, maxX: 11, minZ: -9, maxZ: 9 })
  })

  it('spawn au sud, face au nord (-Z)', () => {
    expect(layout.spawn.position.z).toBeGreaterThan(0)
    expect(layout.spawn.rotationY).toBeCloseTo(Math.PI)
  })

  it('comptoir d’accueil au centre-nord', () => {
    expect(layout.curator.position).toEqual({ x: 0, z: -4.5 })
  })
})

// Code mort V1 réutilisé (mission occultation, point 5) : une aile sans aucune personne garde sa porte
// fermée (pas d'arche, voir le test « une arche de porte existe... » plus haut) et affiche un panneau
// « Bientôt » + un cordon décoratif devant. Sans ceci, `comingSoonWings` n'était vérifié par aucun test
// (seul son typage l'était) : la fonction pouvait très bien renvoyer n'importe quoi sans faire échouer
// la suite.
describe('comingSoonWings — ailes sans aucune personne', () => {
  it('correspond exactement aux ailes sans personne, pour plusieurs répartitions (y compris deux ailes vides à la fois)', () => {
    const cases: Array<{ label: string; people: Person[]; expected: ExhibitWingId[] }> = [
      { label: 'toutes peuplées', people: makePeople({ infrastructures: 60, industrialisation: 30, culture: 10 }), expected: [] },
      { label: 'deux ailes vides (100/0/0)', people: makePeople({ infrastructures: 100, industrialisation: 0, culture: 0 }), expected: ['industrialisation', 'culture'] },
      { label: 'deux ailes vides (0/1/0)', people: makePeople({ infrastructures: 0, industrialisation: 1, culture: 0 }), expected: ['infrastructures', 'culture'] },
      { label: 'une seule aile vide (0/40/40, culture seule vide est impossible ici : infra vide)', people: makePeople({ infrastructures: 0, industrialisation: 40, culture: 40 }), expected: ['infrastructures'] },
    ]
    for (const { label, people, expected } of cases) {
      const architecture = buildMuseumArchitecture(people)
      expect(architecture.comingSoonWings.slice().sort(), label).toEqual([...expected].sort())
    }
  })

  it('une aile « Bientôt » n’a ni cadre, ni socle à tampon, ni cimaise occultante, mais son mur reste un collider plein', () => {
    const people = makePeople({ infrastructures: 100, industrialisation: 0, culture: 0 })
    const layout = buildMuseumLayout(people)
    const architecture = buildMuseumArchitecture(people)
    expect(architecture.comingSoonWings.sort()).toEqual(['culture', 'industrialisation'])
    for (const wing of architecture.comingSoonWings) {
      expect(layout.frames.some((f) => f.wing === wing)).toBe(false)
      expect(layout.stampStations.some((s) => s.wing === wing)).toBe(false)
      expect(architecture.occluders.some((o) => o.wing === wing)).toBe(false)
      // Aucune salle construite pour une aile vide : juste le mur plein (avec sa porte fermée) côté hall.
      expect(layout.rooms.some((r) => r.id === wing)).toBe(false)
    }
  })
})
