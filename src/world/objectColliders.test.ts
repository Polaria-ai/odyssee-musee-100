import { describe, expect, it } from 'vitest'
import type { AABB } from '../types'
import { dims } from '../styles/tokens'
import { generatePlaceholderPeople } from '../data/placeholder'
import { aabb, circleIntersectsAabb } from './collision'
import { STAMP_STATION_SIZE } from './constants'
import { buildMuseumArchitecture, buildMuseumLayout } from './layout'
import { compactObjectCollider } from './objectColliders'

describe('compactObjectCollider', () => {
  it.each<AABB>([
    { minX: -1.5, maxX: 1.5, minZ: -3.7, maxZ: -2.7 }, // comptoir
    { minX: -2, maxX: 2, minZ: 0.5, maxZ: 4.5 }, // arbre et banc circulaire
    { minX: -9, maxX: -7.9, minZ: 14.5, maxZ: 15.6 }, // vitrine loin de l'origine
  ])('réduit les deux dimensions de moitié et la surface de 75 %, sans déplacer le centre : %j', (box) => {
    const original = { ...box }
    const compact = compactObjectCollider(Object.freeze(box))
    const width = box.maxX - box.minX
    const depth = box.maxZ - box.minZ
    expect(compact.maxX - compact.minX).toBeCloseTo(width / 2)
    expect(compact.maxZ - compact.minZ).toBeCloseTo(depth / 2)
    expect((compact.maxX - compact.minX) * (compact.maxZ - compact.minZ)).toBeCloseTo(width * depth / 4)
    expect(compact.minX + compact.maxX).toBeCloseTo(box.minX + box.maxX)
    expect(compact.minZ + compact.maxZ).toBeCloseTo(box.minZ + box.maxZ)
    expect(box).toEqual(original)
  })

  it('libère le bord du banc circulaire tout en gardant son centre solide pour le joueur', () => {
    const visualBox = { minX: -2, maxX: 2, minZ: 0.5, maxZ: 4.5 }
    const compact = compactObjectCollider(visualBox)
    const edge = { x: 1.5, z: 2.5 }
    expect(circleIntersectsAabb(edge, dims.playerRadius, visualBox)).toBe(true)
    expect(circleIntersectsAabb(edge, dims.playerRadius, compact)).toBe(false)
    expect(circleIntersectsAabb({ x: 0, z: 2.5 }, dims.playerRadius, compact)).toBe(true)
  })
})

describe('colliders des objets du musée', () => {
  const people = generatePlaceholderPeople(100)
  const architecture = buildMuseumArchitecture(people)
  const layout = buildMuseumLayout(people)

  function expectCompactCollider(original: AABB) {
    const centerX = (original.minX + original.maxX) / 2
    const centerZ = (original.minZ + original.maxZ) / 2
    const collider = layout.colliders.find((box) => (
      Math.abs((box.minX + box.maxX) / 2 - centerX) < 1e-9
      && Math.abs((box.minZ + box.maxZ) / 2 - centerZ) < 1e-9
    ))
    expect(collider, `collider absent au centre (${centerX}, ${centerZ})`).toBeDefined()
    if (!collider) return
    const width = original.maxX - original.minX
    const depth = original.maxZ - original.minZ
    expect(collider.maxX - collider.minX).toBeCloseTo(width / 2)
    expect(collider.maxZ - collider.minZ).toBeCloseTo(depth / 2)
    expect((collider.maxX - collider.minX) * (collider.maxZ - collider.minZ)).toBeCloseTo(width * depth / 4)
  }

  it('compacte les dix meubles du hall en gardant leur emprise visuelle dans l’architecture', () => {
    const furniture = architecture.rooms.flatMap((r) => r.walls.filter((w) => w.kind === 'furniture'))
    expect(furniture).toHaveLength(10) // quatre piliers, deux bancs et quatre jardinières
    for (const item of furniture) expectCompactCollider(item.box)
    const visualWidths = furniture.map((item) => item.box.maxX - item.box.minX)
    expect(visualWidths.filter((width) => Math.abs(width - 0.84) < 1e-9)).toHaveLength(8)
    expect(visualWidths.filter((width) => Math.abs(width - 1.6) < 1e-9)).toHaveLength(2)
  })

  it('compacte le comptoir, l’arbre et chacun des trois socles à tampon', () => {
    const { counter, tree } = architecture.decor
    expectCompactCollider(aabb(counter.center.x - counter.halfWidth, counter.center.x + counter.halfWidth, counter.center.z - counter.halfDepth, counter.center.z + counter.halfDepth))
    expectCompactCollider(aabb(tree.center.x - tree.benchRadius, tree.center.x + tree.benchRadius, tree.center.z - tree.benchRadius, tree.center.z + tree.benchRadius))
    expect(layout.stampStations).toHaveLength(3)
    const half = STAMP_STATION_SIZE / 2
    for (const station of layout.stampStations) {
      expectCompactCollider(aabb(station.position.x - half, station.position.x + half, station.position.z - half, station.position.z + half))
    }
    expect(counter.halfWidth).toBe(1.5)
    expect(counter.halfDepth).toBe(0.5)
    expect(tree.benchRadius).toBe(2)
  })

  it('conserve chaque mur et chaque cimaise comme obstacle complet', () => {
    for (const room of architecture.rooms) {
      for (const wall of room.walls.filter((w) => w.kind === 'wall')) {
        expect(layout.colliders).toContainEqual(wall.box)
      }
    }
    expect(architecture.occluders.length).toBeGreaterThan(0)
    for (const partition of architecture.occluders) expect(layout.colliders).toContainEqual(partition.box)
  })
})
