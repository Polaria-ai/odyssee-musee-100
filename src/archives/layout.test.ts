import { describe, expect, it } from 'vitest'
import type { EveningSession, Vec2 } from '../types'
import { archivesCapacity, buildArchivesLayout, ENTRANCE_LECTERN, mergeArchivesIntoLayout } from './layout'
import { circleIntersectsAabb, pointInAabb, xWall, zWall } from '../world/collision'
import { archivesDoor, dims } from '../styles/tokens'
import { buildMuseumLayout } from '../world/layout'
import { generatePlaceholderPeople } from '../data/placeholder'
import { ARCHIVIST_TALK_RADIUS, DOOR_CLEARANCE, ROW_DEPTH, ROW_X_OFFSETS, VITRINE_FOOTPRINT_RADIUS, WALL_THICKNESS } from './room/constants'

const GRID_STEP = 0.25
const KINDS: EveningSession['kind'][] = ['ouverture', 'film', 'presentation', 'keynote', 'les100', 'magneto', 'table-ronde', 'face-a-face', 'final', 'cloture']

function makeSessions(count: number): EveningSession[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${String(i).padStart(2, '0')}`,
    order: i + 1,
    startTime: `${String(18 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}`,
    durationMin: 5,
    kind: KINDS[i % KINDS.length],
    title: { fr: `Séquence ${i + 1}`, en: `Session ${i + 1}` },
    speakers: [],
    provisional: true,
  }))
}

/** Grille de marchabilité (0,25 m), comme `src/world/layout.test.ts`. */
interface WalkGrid {
  cols: number
  rows: number
  minX: number
  minZ: number
  walkable: Uint8Array
  toCell: (p: Vec2) => { cx: number; cz: number }
}

function buildWalkGrid(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, colliders: { minX: number; maxX: number; minZ: number; maxZ: number }[]): WalkGrid {
  const margin = 1
  const minX = bounds.minX - margin
  const minZ = bounds.minZ - margin
  const cols = Math.ceil((bounds.maxX + margin - minX) / GRID_STEP) + 1
  const rows = Math.ceil((bounds.maxZ + margin - minZ) / GRID_STEP) + 1
  const walkable = new Uint8Array(cols * rows)
  for (let cz = 0; cz < rows; cz++) {
    for (let cx = 0; cx < cols; cx++) {
      const p = { x: minX + cx * GRID_STEP, z: minZ + cz * GRID_STEP }
      if (!colliders.some((c) => circleIntersectsAabb(p, dims.playerRadius, c))) walkable[cz * cols + cx] = 1
    }
  }
  return { cols, rows, minX, minZ, walkable, toCell: (p) => ({ cx: Math.round((p.x - minX) / GRID_STEP), cz: Math.round((p.z - minZ) / GRID_STEP) }) }
}

function isReachable(grid: WalkGrid, from: Vec2, to: Vec2): boolean {
  const { cols, rows, walkable } = grid
  const idx = (cx: number, cz: number) => cz * cols + cx
  const inBounds = (cx: number, cz: number) => cx >= 0 && cz >= 0 && cx < cols && cz < rows
  const start = grid.toCell(from)
  const goal = grid.toCell(to)
  if (!inBounds(start.cx, start.cz) || !walkable[idx(start.cx, start.cz)]) return false
  if (!inBounds(goal.cx, goal.cz) || !walkable[idx(goal.cx, goal.cz)]) return false
  const visited = new Uint8Array(cols * rows)
  const queue: number[] = [start.cx, start.cz]
  visited[idx(start.cx, start.cz)] = 1
  let head = 0
  while (head < queue.length) {
    const cx = queue[head++]
    const cz = queue[head++]
    if (cx === goal.cx && cz === goal.cz) return true
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx
      const nz = cz + dz
      if (!inBounds(nx, nz) || visited[idx(nx, nz)] || !walkable[idx(nx, nz)]) continue
      visited[idx(nx, nz)] = 1
      queue.push(nx, nz)
    }
  }
  return false
}

describe('archivesCapacity', () => {
  it('accepte au moins 24 séquences', () => {
    expect(archivesCapacity()).toBeGreaterThanOrEqual(24)
  })
})

const counts = [0, 1, 5, 12, 18, 24]

/** Hall du musée réel (même emprise quel que soit le nombre de portraits). */
const museum = buildMuseumLayout(generatePlaceholderPeople(100))
const hall = museum.rooms.find((r) => r.id === 'hall')!.bounds

describe.each(counts)('buildArchivesLayout — %i séquence(s)', (count) => {
  const sessions = makeSessions(count)
  const layout = buildArchivesLayout(sessions, hall)

  it('déterminisme : deux appels identiques donnent le même JSON', () => {
    expect(JSON.stringify(buildArchivesLayout(sessions, hall))).toBe(JSON.stringify(layout))
  })

  it('garde les cinq segments de murs complets et réduit chaque objet de 75 % de surface, au même centre', () => {
    const b = layout.room.bounds
    expect(layout.colliders.slice(0, 5)).toEqual([
      xWall(b.maxZ, b.minX, b.maxX, WALL_THICKNESS),
      xWall(b.minZ, b.minX, archivesDoor.x - archivesDoor.width / 2, WALL_THICKNESS),
      xWall(b.minZ, archivesDoor.x + archivesDoor.width / 2, b.maxX, WALL_THICKNESS),
      zWall(b.minX, b.minZ, b.maxZ, WALL_THICKNESS),
      zWall(b.maxX, b.minZ, b.maxZ, WALL_THICKNESS),
    ])

    const objects = [
      ...layout.slots.map((s) => ({ x: s.position[0], z: s.position[2], width: 2 * VITRINE_FOOTPRINT_RADIUS, depth: 2 * VITRINE_FOOTPRINT_RADIUS })),
      { ...layout.archivist.position, width: 0.8, depth: 0.8 },
      { x: archivesDoor.x + ENTRANCE_LECTERN.dx, z: b.minZ + ENTRANCE_LECTERN.dz, width: 2 * ENTRANCE_LECTERN.halfWidth, depth: 2 * ENTRANCE_LECTERN.halfDepth },
    ]
    expect(layout.colliders).toHaveLength(5 + objects.length)
    for (const [i, original] of objects.entries()) {
      const c = layout.colliders[5 + i]
      const width = c.maxX - c.minX
      const depth = c.maxZ - c.minZ
      expect(width).toBeCloseTo(original.width / 2)
      expect(depth).toBeCloseTo(original.depth / 2)
      expect(width * depth).toBeCloseTo(original.width * original.depth / 4)
      expect((c.minX + c.maxX) / 2).toBeCloseTo(original.x)
      expect((c.minZ + c.maxZ) / 2).toBeCloseTo(original.z)
      expect(circleIntersectsAabb({ x: original.x, z: original.z }, dims.playerRadius, c)).toBe(true)
    }
  })

  it('permet de longer les vitrines de plus près sans traverser leur centre solide', () => {
    for (const [i, s] of layout.slots.entries()) {
      const c = layout.colliders[5 + i]
      const edge = { x: s.position[0] + 0.75, z: s.position[2] }
      expect(circleIntersectsAabb(edge, dims.playerRadius, c)).toBe(false)
      expect(circleIntersectsAabb({ x: s.position[0], z: s.position[2] }, dims.playerRadius, c)).toBe(true)
    }
  })

  it('une vitrine par séquence, dans le même ordre', () => {
    expect(layout.slots).toHaveLength(count)
    expect(layout.slots.map((s) => s.sessionId)).toEqual(sessions.map((s) => s.id))
  })

  it('chaque vitrine est dans les bounds de la salle', () => {
    for (const s of layout.slots) {
      expect(s.position[0]).toBeGreaterThanOrEqual(layout.room.bounds.minX)
      expect(s.position[0]).toBeLessThanOrEqual(layout.room.bounds.maxX)
      expect(s.position[2]).toBeGreaterThanOrEqual(layout.room.bounds.minZ)
      expect(s.position[2]).toBeLessThanOrEqual(layout.room.bounds.maxZ)
    }
  })

  it('aucune vitrine ne fait face à −Z (caméra fixe)', () => {
    for (const s of layout.slots) {
      const facingNegZ = Math.cos(s.rotationY) < -0.5
      expect(facingNegZ, `vitrine ${s.sessionId} face à -Z (rotationY=${s.rotationY})`).toBe(false)
    }
  })

  it('aucune paire de vitrines ne se chevauche (distance ≥ 1,8 m)', () => {
    for (let i = 0; i < layout.slots.length; i++) {
      for (let j = i + 1; j < layout.slots.length; j++) {
        const dx = layout.slots[i].position[0] - layout.slots[j].position[0]
        const dz = layout.slots[i].position[2] - layout.slots[j].position[2]
        expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(1.8)
      }
    }
  })

  it('chaque viewPoint est hors colliders et dans la salle', () => {
    for (const s of layout.slots) {
      for (const c of layout.colliders) {
        expect(circleIntersectsAabb(s.viewPoint, dims.playerRadius, c), `viewPoint de ${s.sessionId} dans un collider`).toBe(false)
      }
      expect(pointInAabb(s.viewPoint, layout.room.bounds), `viewPoint de ${s.sessionId} hors de la salle`).toBe(true)
    }
  })

  it('l’arrivée est hors colliders, dans la salle, juste après la porte et face au sud', () => {
    expect(pointInAabb(layout.arrival.position, layout.room.bounds)).toBe(true)
    for (const c of layout.colliders) {
      expect(circleIntersectsAabb(layout.arrival.position, dims.playerRadius, c)).toBe(false)
    }
    expect(layout.arrival.position.x).toBeCloseTo(archivesDoor.x)
    expect(layout.arrival.position.z - layout.room.bounds.minZ).toBeLessThan(DOOR_CLEARANCE)
    expect(layout.arrival.rotationY).toBeCloseTo(0)
  })

  // L'Archiviste est un obstacle (son podium a un collider, comme le comptoir d'accueil dans
  // src/world/layout.ts) : le joueur l'approche à portée d'interaction, il ne se tient jamais
  // exactement sur son point — seul `layout.archivist.position` doit rester dans la salle.
  it('l’Archiviste accueille près de la porte, avant la première rangée, hors du passage', () => {
    const p = layout.archivist.position
    expect(pointInAabb(p, layout.room.bounds)).toBe(true)
    expect(p.z - layout.room.bounds.minZ).toBeLessThan(DOOR_CLEARANCE)
    expect(Math.abs(p.x - archivesDoor.x)).toBeGreaterThan(archivesDoor.width / 2 + 1)
  })

  // Régression possible du plan en croix : un Archiviste trop près du mur répondrait « Parler à
  // l'Archiviste » à un joueur resté dans le hall, de l'autre côté du mur.
  it('l’Archiviste est hors de portée de tout joueur resté dans le hall', () => {
    const hallMaxPlayerZ = hall.maxZ - dims.wallThickness / 2 - dims.playerRadius
    const p = layout.archivist.position
    expect(p.z - hallMaxPlayerZ).toBeGreaterThan(ARCHIVIST_TALK_RADIUS)
  })

  it('la salle est accrochée au mur sud du hall, porte dans l’axe de tokens.archivesDoor', () => {
    expect(layout.room.bounds.minZ).toBe(hall.maxZ)
    expect(layout.door).toEqual({ x: archivesDoor.x, z: hall.maxZ, width: archivesDoor.width })
    expect(layout.room.bounds.minX).toBeGreaterThanOrEqual(hall.minX)
    expect(layout.room.bounds.maxX).toBeLessThanOrEqual(hall.maxX)
  })

  it('l’embrasure de la porte est libre (aucun collider de la salle dedans)', () => {
    const threshold = { x: archivesDoor.x, z: layout.door.z }
    for (const dx of [-0.6, 0, 0.6]) {
      const p = { x: threshold.x + dx, z: threshold.z }
      for (const c of layout.colliders) {
        expect(circleIntersectsAabb(p, dims.playerRadius, c), `seuil (${p.x}, ${p.z}) bloqué`).toBe(false)
      }
    }
  })

  it('à pied depuis le point d’apparition du hall : chaque vitrine et l’Archiviste sont atteignables', () => {
    const merged = mergeArchivesIntoLayout(museum, layout)
    const grid = buildWalkGrid(merged.bounds, merged.colliders)
    for (const s of layout.slots) {
      expect(isReachable(grid, museum.spawn.position, s.viewPoint), `pas de chemin vers ${s.sessionId}`).toBe(true)
    }
    const talkSpot = { x: layout.archivist.position.x, z: layout.archivist.position.z + 1.4 }
    expect(isReachable(grid, museum.spawn.position, talkSpot)).toBe(true)
    expect(isReachable(grid, museum.spawn.position, layout.arrival.position)).toBe(true)
  })

  // Régression : une première version enchaînait les rangées toujours dans le même sens, si bien que
  // le tracé au sol reliant les vitrines dans l'ordre du programme revenait d'un bord à l'autre de la
  // salle à chaque changement de rangée (ligne en diagonale qui barrait l'image, constat de la
  // vérification visuelle). Le serpentin (`layout.ts::buildCandidates`) garantit que deux séquences
  // consécutives restent toujours des vitrines voisines : jamais plus loin qu'un pas de colonne ou de
  // rangée l'une de l'autre.
  it('la frise ne fait jamais de grand saut entre deux vitrines consécutives (serpentin, pas de diagonale)', () => {
    const columnSteps = ROW_X_OFFSETS.slice(1).map((x, i) => Math.abs(x - ROW_X_OFFSETS[i]))
    const maxStep = Math.max(...columnSteps, ROW_DEPTH) + 0.01
    for (let i = 1; i < layout.slots.length; i++) {
      const a = layout.slots[i - 1].position
      const b = layout.slots[i].position
      const d = Math.hypot(a[0] - b[0], a[2] - b[2])
      expect(d, `saut de ${layout.slots[i - 1].sessionId} à ${layout.slots[i].sessionId} : ${d.toFixed(2)} m`).toBeLessThanOrEqual(maxStep)
    }
  })

  it('la frise part de la porte : la première séquence est la plus au nord', () => {
    if (layout.slots.length < 2) return
    const zs = layout.slots.map((s) => s.position[2])
    expect(zs[0]).toBe(Math.min(...zs))
  })
})

describe('mergeArchivesIntoLayout', () => {
  it('ajoute la salle, ses colliders et étend les bounds, sans muter le musée reçu', () => {
    const small = buildMuseumLayout(generatePlaceholderPeople(30))
    const before = JSON.stringify(small)
    const smallHall = small.rooms.find((r) => r.id === 'hall')!.bounds
    const archives = buildArchivesLayout(makeSessions(10), smallHall)
    const merged = mergeArchivesIntoLayout(small, archives)

    expect(JSON.stringify(small)).toBe(before) // pas de mutation
    expect(merged.rooms.some((r) => r.id === 'archives')).toBe(true)
    expect(merged.colliders.length).toBe(small.colliders.length + archives.colliders.length)
    expect(merged.bounds.maxZ).toBeGreaterThanOrEqual(archives.room.bounds.maxZ)
    expect(merged.bounds.minX).toBeLessThanOrEqual(Math.min(small.bounds.minX, archives.room.bounds.minX))
  })

  it('plan en croix : la salle touche le hall sans chevaucher aucune autre salle', () => {
    const archives = buildArchivesLayout(makeSessions(18), hall)
    const b = archives.room.bounds
    for (const room of museum.rooms) {
      const overlapsX = b.minX < room.bounds.maxX && b.maxX > room.bounds.minX
      const overlapsZ = b.minZ < room.bounds.maxZ && b.maxZ > room.bounds.minZ
      expect(overlapsX && overlapsZ, `chevauche ${room.id}`).toBe(false)
    }
  })
})
