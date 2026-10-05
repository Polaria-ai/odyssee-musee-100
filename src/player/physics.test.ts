import { describe, expect, it } from 'vitest'
import type { AABB } from '../types'
import { escapeCollider, inputToWorldDirection, resolveMovement, shortestAngleDelta, smoothAngle } from './physics'

const RADIUS = 0.35

/** Mur épais orienté sur X, entre z = 2 et z = 2.4 (comme un mur de musée, dims.wallThickness = 0.4). */
const WALL_Z: AABB = { minX: -20, maxX: 20, minZ: 2, maxZ: 2.4 }
/** Mur épais orienté sur Z. */
const WALL_X: AABB = { minX: 5, maxX: 5.4, minZ: -20, maxZ: 20 }

/** Vrai si le cercle (pos, radius) pénètre réellement le rectangle `box`. */
function overlaps(pos: { x: number; z: number }, box: AABB, radius: number): boolean {
  const closestX = Math.max(box.minX, Math.min(pos.x, box.maxX))
  const closestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ))
  const dist = Math.hypot(pos.x - closestX, pos.z - closestZ)
  return dist < radius - 1e-6
}

describe('resolveMovement', () => {
  it('déplace librement en l’absence de collision', () => {
    const next = resolveMovement({ x: 0, z: 0 }, { x: 1, z: 0.5 }, RADIUS, [])
    expect(next.x).toBeCloseTo(1)
    expect(next.z).toBeCloseTo(0.5)
  })

  it('ne traverse jamais un mur, même à un pas énorme (60 m/s à 60 i/s)', () => {
    const start = { x: 0, z: 1 }
    const hugeStep = { x: 0, z: 60 / 60 } // 1 m en un seul appel, mur à 0.35 m
    const next = resolveMovement(start, hugeStep, RADIUS, [WALL_Z])
    // Le joueur ne doit jamais pénétrer le mur : il s'arrête à radius du bord le plus proche.
    expect(next.z).toBeLessThanOrEqual(WALL_Z.minZ - RADIUS + 1e-6)
  })

  it('même avec un pas monstrueux (10 m d’un coup), le mur bloque toujours', () => {
    const next = resolveMovement({ x: 0, z: 1 }, { x: 0, z: 10 }, RADIUS, [WALL_Z])
    expect(next.z).toBeLessThanOrEqual(WALL_Z.minZ - RADIUS + 1e-6)
  })

  it('s’arrête contre le mur en approchant droit dessus', () => {
    const next = resolveMovement({ x: 0, z: 1.5 }, { x: 0, z: 0.8 }, RADIUS, [WALL_Z])
    expect(next.z).toBeCloseTo(WALL_Z.minZ - RADIUS, 3)
    expect(next.x).toBeCloseTo(0, 5)
  })

  it('glisse le long du mur quand l’approche est en diagonale', () => {
    const next = resolveMovement({ x: 0, z: 1.5 }, { x: 1, z: 0.8 }, RADIUS, [WALL_Z])
    // Bloqué en z contre le mur, mais le mouvement latéral (x) continue : c'est un glissement, pas un arrêt net.
    expect(next.z).toBeCloseTo(WALL_Z.minZ - RADIUS, 2)
    expect(next.x).toBeGreaterThan(0.5)
  })

  it('gère un coin (deux murs perpendiculaires) sans se coincer ni traverser', () => {
    const next = resolveMovement({ x: 4, z: 1.5 }, { x: 5, z: 5 }, RADIUS, [WALL_Z, WALL_X])
    expect(overlaps(next, WALL_Z, RADIUS)).toBe(false)
    expect(overlaps(next, WALL_X, RADIUS)).toBe(false)
  })

  it('un pas minuscule ne fait pas de sous-pas inutiles (comportement continu)', () => {
    const next = resolveMovement({ x: 0, z: 0 }, { x: 0.01, z: 0 }, RADIUS, [WALL_Z])
    expect(next.x).toBeCloseTo(0.01)
    expect(next.z).toBeCloseTo(0)
  })

  it('respecte des rayons différents (petit rayon se faufile plus près du mur)', () => {
    const smallRadius = 0.05
    const next = resolveMovement({ x: 0, z: 1.9 }, { x: 0, z: 0.5 }, smallRadius, [WALL_Z])
    expect(next.z).toBeCloseTo(WALL_Z.minZ - smallRadius, 3)
  })

  it('un obstacle vide laisse le déplacement inchangé même à vitesse nulle', () => {
    const next = resolveMovement({ x: 3, z: 3 }, { x: 0, z: 0 }, RADIUS, [WALL_Z])
    expect(next).toEqual({ x: 3, z: 3 })
  })
})

describe('escapeCollider', () => {
  it('ne fait rien si le joueur n’est dans aucun collider', () => {
    const next = escapeCollider({ x: 0, z: 0 }, RADIUS, [WALL_Z])
    expect(next).toEqual({ x: 0, z: 0 })
  })

  it('repousse un joueur téléporté au centre d’un mur vers le bord le plus proche', () => {
    const next = escapeCollider({ x: 0, z: 2.2 }, RADIUS, [WALL_Z])
    // Le bord le plus proche du centre (z=2.2) dans [2, 2.4] est équidistant ; l'important est de sortir.
    const outsideBelow = next.z <= WALL_Z.minZ - RADIUS + 1e-6
    const outsideAbove = next.z >= WALL_Z.maxZ + RADIUS - 1e-6
    expect(outsideBelow || outsideAbove).toBe(true)
    expect(next.x).toBeCloseTo(0)
  })

  it('repousse depuis un bord précis vers le côté le plus proche', () => {
    const next = escapeCollider({ x: 0, z: 2.05 }, RADIUS, [WALL_Z])
    expect(next.z).toBeCloseTo(WALL_Z.minZ - RADIUS, 3)
  })
})

describe('inputToWorldDirection', () => {
  it('mappe moveX → +x, moveY → +z (caméra fixe vers -Z)', () => {
    const dir = inputToWorldDirection(1, 0)
    expect(dir.x).toBeCloseTo(1)
    expect(dir.z).toBeCloseTo(0)
    const dir2 = inputToWorldDirection(0, 1)
    expect(dir2.x).toBeCloseTo(0)
    expect(dir2.z).toBeCloseTo(1)
  })

  it('normalise une entrée diagonale', () => {
    const dir = inputToWorldDirection(1, 1)
    expect(Math.hypot(dir.x, dir.z)).toBeCloseTo(1)
    expect(dir.x).toBeCloseTo(dir.z)
  })

  it('retourne le vecteur nul pour une entrée nulle (pas de NaN)', () => {
    const dir = inputToWorldDirection(0, 0)
    expect(dir).toEqual({ x: 0, z: 0 })
  })
})

describe('shortestAngleDelta / smoothAngle', () => {
  it('prend le plus court chemin même en traversant ±π', () => {
    const delta = shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1)
    expect(delta).toBeCloseTo(0.2)
  })

  it('smoothAngle avec t=1 saute directement à la cible', () => {
    expect(smoothAngle(0, Math.PI / 2, 1)).toBeCloseTo(Math.PI / 2)
  })

  it('smoothAngle avec t=0 ne bouge pas', () => {
    expect(smoothAngle(1, 2, 0)).toBeCloseTo(1)
  })

  it('smoothAngle interpole par le chemin le plus court près de ±π', () => {
    const result = smoothAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5)
    // Le résultat doit être proche de π (ou -π), pas de 0 (ce qui indiquerait le long chemin).
    const distToPi = Math.abs(shortestAngleDelta(result, Math.PI))
    expect(distToPi).toBeLessThan(0.2)
  })

  it('reste borné dans [-π, π]', () => {
    const result = smoothAngle(3, -3, 1)
    expect(result).toBeGreaterThanOrEqual(-Math.PI - 1e-9)
    expect(result).toBeLessThanOrEqual(Math.PI + 1e-9)
  })
})
