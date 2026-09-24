import { describe, expect, it } from 'vitest'
import type { ExhibitWingId, FrameSlot, MuseumLayout, Person, Vec2 } from '../types'
import { EXHIBIT_WINGS } from '../types'
import { buildMuseumArchitecture, buildMuseumLayout } from './layout'
import { circleIntersectsAabb, pointInAabb } from './collision'
import { dims } from './constants'
import { generatePlaceholderPeople } from '../data/placeholder'

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
  '60/30/10': makePeople({ infrastructures: 60, industrialisation: 30, culture: 10 }),
  '1 personne': makePeople({ infrastructures: 0, industrialisation: 1, culture: 0 }),
  '120 personnes': generatePlaceholderPeople(120),
}

/** BFS sur une grille de 0,25 m : vrai s'il existe un chemin libre entre deux points. */
function isReachable(layout: MuseumLayout, from: Vec2, to: Vec2): boolean {
  const b = layout.bounds
  const margin = 1
  const minX = b.minX - margin
  const minZ = b.minZ - margin
  const cols = Math.ceil((b.maxX + margin - minX) / GRID_STEP) + 1
  const rows = Math.ceil((b.maxZ + margin - minZ) / GRID_STEP) + 1

  const toCell = (p: Vec2) => ({
    cx: Math.round((p.x - minX) / GRID_STEP),
    cz: Math.round((p.z - minZ) / GRID_STEP),
  })
  const walkable = (cx: number, cz: number): boolean => {
    if (cx < 0 || cz < 0 || cx >= cols || cz >= rows) return false
    const p = { x: minX + cx * GRID_STEP, z: minZ + cz * GRID_STEP }
    return !layout.colliders.some((c) => circleIntersectsAabb(p, dims.playerRadius, c))
  }

  const start = toCell(from)
  const goal = toCell(to)
  if (!walkable(start.cx, start.cz) || !walkable(goal.cx, goal.cz)) return false

  const visited = new Uint8Array(cols * rows)
  const idx = (cx: number, cz: number) => cz * cols + cx
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
      if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue
      if (visited[idx(nx, nz)]) continue
      if (!walkable(nx, nz)) continue
      visited[idx(nx, nz)] = 1
      queue.push(nx, nz)
    }
  }
  return false
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

  it('aucun cadre ne regarde vers -Z', () => {
    for (const f of layout.frames) {
      const allowed = [0, Math.PI / 2, -Math.PI / 2].some((r) => Math.abs(r - f.rotationY) < 1e-6)
      expect(allowed, `rotationY inattendu: ${f.rotationY}`).toBe(true)
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

  it('un chemin libre existe du spawn à chaque viewPoint', () => {
    for (const f of layout.frames) {
      expect(isReachable(layout, layout.spawn.position, f.viewPoint), `pas de chemin vers ${f.personId}`).toBe(true)
    }
  })

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

  it('comptoir de Minerve au centre-nord', () => {
    expect(layout.curator.position).toEqual({ x: 0, z: -4.5 })
  })
})
