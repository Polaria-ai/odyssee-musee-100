import { describe, expect, it } from 'vitest'
import type { EveningSession, Vec2 } from '../types'
import { ARCHIVES_ORIGIN, archivesCapacity, buildArchivesLayout, mergeArchivesIntoLayout } from './layout'
import { circleIntersectsAabb, pointInAabb } from '../world/collision'
import { dims, hallReservedSpots } from '../styles/tokens'
import { buildMuseumLayout } from '../world/layout'
import { generatePlaceholderPeople } from '../data/placeholder'

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

describe.each(counts)('buildArchivesLayout — %i séquence(s)', (count) => {
  const sessions = makeSessions(count)
  const layout = buildArchivesLayout(sessions)

  it('déterminisme : deux appels identiques donnent le même JSON', () => {
    expect(JSON.stringify(buildArchivesLayout(sessions))).toBe(JSON.stringify(layout))
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

  it('arrivée et porte de retour sont hors colliders et dans la salle', () => {
    for (const placement of [layout.arrival, layout.returnPortal]) {
      expect(pointInAabb(placement.position, layout.room.bounds)).toBe(true)
      for (const c of layout.colliders) {
        expect(circleIntersectsAabb(placement.position, dims.playerRadius, c)).toBe(false)
      }
    }
  })

  // L'Archiviste est un obstacle (son podium a un collider, comme le comptoir de Minerve dans
  // src/world/layout.ts) : le joueur l'approche à portée d'interaction, il ne se tient jamais
  // exactement sur son point — seul `layout.archivist.position` doit rester dans la salle.
  it('l’Archiviste est dans la salle, dans l’alcôve nord (loin des murs est/ouest)', () => {
    expect(pointInAabb(layout.archivist.position, layout.room.bounds)).toBe(true)
    expect(layout.archivist.position.z).toBeLessThan(ARCHIVES_ORIGIN.z)
  })

  it('arrivée face au nord (−Z), près de l’entrée', () => {
    expect(layout.arrival.rotationY).toBeCloseTo(Math.PI)
    expect(layout.arrival.position.z).toBeGreaterThan(ARCHIVES_ORIGIN.z)
  })

  it('un chemin libre existe de l’arrivée à chaque viewPoint et à la porte de retour', () => {
    const grid = buildWalkGrid(layout.room.bounds, layout.colliders)
    for (const s of layout.slots) {
      expect(isReachable(grid, layout.arrival.position, s.viewPoint), `pas de chemin vers ${s.sessionId}`).toBe(true)
    }
    expect(isReachable(grid, layout.arrival.position, layout.returnPortal.position)).toBe(true)
  })

  it('la Porte de 2040 (hall) est dans la zone réservée du hall', () => {
    const z = hallReservedSpots.timePortal
    const dx = layout.hallPortal.position.x - z.x
    const dz = layout.hallPortal.position.z - z.z
    expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(z.radius)
  })
})

describe('mergeArchivesIntoLayout', () => {
  it('ajoute la salle, ses colliders et étend les bounds, sans muter le musée reçu', () => {
    const museum = buildMuseumLayout(generatePlaceholderPeople(30))
    const before = JSON.stringify(museum)
    const archives = buildArchivesLayout(makeSessions(10))
    const merged = mergeArchivesIntoLayout(museum, archives)

    expect(JSON.stringify(museum)).toBe(before) // pas de mutation
    expect(merged.rooms.some((r) => r.id === 'archives')).toBe(true)
    expect(merged.colliders.length).toBe(museum.colliders.length + archives.colliders.length)
    expect(merged.bounds.maxZ).toBeGreaterThanOrEqual(archives.room.bounds.maxZ)
    expect(merged.bounds.minX).toBeLessThanOrEqual(Math.min(museum.bounds.minX, archives.room.bounds.minX))
  })

  it('la salle des Archives est loin du musée (aucun chevauchement de bounds)', () => {
    const museum = buildMuseumLayout(generatePlaceholderPeople(100))
    const archives = buildArchivesLayout(makeSessions(18))
    const overlapsX = archives.room.bounds.minX < museum.bounds.maxX && archives.room.bounds.maxX > museum.bounds.minX
    const overlapsZ = archives.room.bounds.minZ < museum.bounds.maxZ && archives.room.bounds.maxZ > museum.bounds.minZ
    expect(overlapsX && overlapsZ).toBe(false)
  })
})
