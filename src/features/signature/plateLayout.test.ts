import { describe, expect, it } from 'vitest'
import { generatePlaceholderPeople } from '../../data/placeholder'
import { cameraPositionFor, cameraRig, dims } from '../../styles/tokens'
import { buildMuseumArchitecture, buildMuseumLayout } from '../../world/layout'
import { COLUMN_RADIUS, DOOR_WIDTH, HALL_HALF_DEPTH, HALL_HALF_WIDTH, JARDINIERE_HEIGHT, JARDINIERE_RADIUS } from '../../world/constants'
import { NORTH_WALL_INNER_Z, PLATE_HEIGHT, PLATE_WIDTH, PLATE_WALL_GAP, SIGNATURE_PLATE, plateCorners } from './plateLayout'

const [px, py, pz] = SIGNATURE_PLATE.position
const left = px - PLATE_WIDTH / 2
const right = px + PLATE_WIDTH / 2
const bottom = py - PLATE_HEIGHT / 2
const top = py + PLATE_HEIGHT / 2

describe('plaque Polaria : emplacement dans le hall', () => {
  const people = generatePlaceholderPeople(30)
  const layout = buildMuseumLayout(people)
  const architecture = buildMuseumArchitecture(people)
  const hall = layout.rooms.find((r) => r.id === 'hall')!.bounds

  it('est accrochée au mur nord du hall, face au sud (la caméra regarde vers -Z)', () => {
    expect(SIGNATURE_PLATE.rotationY).toBe(0)
    expect(NORTH_WALL_INNER_Z).toBeCloseTo(-HALL_HALF_DEPTH + dims.wallThickness / 2, 5)
    // 3 cm devant la face intérieure du mur, jamais dans le mur ni à son niveau (scintillement).
    expect(pz).toBeGreaterThan(NORTH_WALL_INNER_Z)
    expect(pz - NORTH_WALL_INNER_Z).toBeCloseTo(PLATE_WALL_GAP, 5)
  })

  it('reste dans l’emprise du hall', () => {
    expect(left).toBeGreaterThan(hall.minX)
    expect(right).toBeLessThan(hall.maxX)
    expect(pz).toBeGreaterThan(hall.minZ)
    expect(pz).toBeLessThan(hall.maxZ)
  })

  it('est à hauteur des yeux : bas entre 1,2 et 1,6 m, haut sous la corniche', () => {
    expect(bottom).toBeGreaterThanOrEqual(1.2)
    expect(bottom).toBeLessThanOrEqual(1.6)
    expect(top).toBeLessThan(dims.wallHeight - 1)
    // Au-dessus du lambris (0,95 m) : elle se lit sur le mur, pas sur le bas bleu foncé.
    expect(bottom).toBeGreaterThan(0.95)
  })

  it('n’est pas au centre : à plus de 6 m de l’axe du hall (comptoir, arbre, bannière)', () => {
    expect(Math.abs(px)).toBeGreaterThan(6)
  })

  it('ne chevauche ni la porte nord (Industrialisation) ni les appliques du mur nord (x = ±4,5)', () => {
    expect(left).toBeGreaterThan(DOOR_WIDTH / 2 + 1)
    const lamps = architecture.decorPlacements.filter((d) => d.type === 'wall-lamp' && Math.abs(d.position.z - NORTH_WALL_INNER_Z) < 0.5)
    expect(lamps.length).toBeGreaterThan(0)
    for (const lamp of lamps) expect(lamp.position.x < left || lamp.position.x > right, `applique en x = ${lamp.position.x}`).toBe(true)
  })

  it('aucun obstacle du hall ne se pose devant elle : colonnes et jardinières à distance, et plus bas que le bas de la plaque', () => {
    for (const pillar of architecture.decor.pillars) {
      // Les colonnes sont à plus de 3 m du mur : jamais contre la plaque.
      expect(Math.abs(pillar.z - NORTH_WALL_INNER_Z)).toBeGreaterThan(2)
      expect(pillar.x + COLUMN_RADIUS < left || pillar.x - COLUMN_RADIUS > right, `colonne en x = ${pillar.x}`).toBe(true)
    }
    for (const planter of architecture.decor.planters) {
      const overlapsX = planter.x + JARDINIERE_RADIUS > left && planter.x - JARDINIERE_RADIUS < right
      const nearNorth = planter.z < 0
      if (overlapsX && nearNorth) expect(JARDINIERE_HEIGHT).toBeLessThan(bottom)
    }
  })

  it('aucun collider du plan (murs, meubles) ne recoupe le volume de la plaque : le joueur ne peut pas la traverser ni s’y coincer', () => {
    const half = 0.02
    for (const c of layout.colliders) {
      const overlapsX = c.maxX > left && c.minX < right
      const overlapsZ = c.maxZ > pz - half && c.minZ < pz + half
      expect(overlapsX && overlapsZ, `collider ${JSON.stringify(c)}`).toBe(false)
    }
  })

  it('est derrière tout ce que le joueur peut atteindre : la caméra, toujours au sud, ne peut jamais avoir la plaque entre elle et lui', () => {
    // Le mur nord (collider) retient le joueur au sud de la plaque ; la caméra est encore plus au sud.
    const playerRadius = dims.playerRadius
    const northmostPlayerZ = NORTH_WALL_INNER_Z + playerRadius
    expect(northmostPlayerZ).toBeGreaterThan(pz - 0.5)
    const cam = cameraPositionFor(px, northmostPlayerZ, cameraRig.minDistance)
    expect(cam.z).toBeGreaterThan(northmostPlayerZ)
    expect(cam.z).toBeGreaterThan(pz)
  })

  it('le mur nord du hall est bien plein à cet endroit (plan avec ses trois ailes peuplées)', () => {
    const northWalls = architecture.rooms[0].walls.filter((w) => w.kind === 'wall' && Math.abs((w.box.minZ + w.box.maxZ) / 2 - -HALL_HALF_DEPTH) < 0.01)
    expect(northWalls.some((w) => w.box.minX <= left && w.box.maxX >= right)).toBe(true)
    expect(HALL_HALF_WIDTH).toBeGreaterThan(right)
  })

  it('plateCorners : quatre coins dans l’ordre haut-gauche, haut-droit, bas-droit, bas-gauche, dans le plan de la plaque', () => {
    const corners = plateCorners(SIGNATURE_PLATE)
    expect(corners).toHaveLength(4)
    expect(corners[0]).toEqual([left, top, pz])
    expect(corners[1]).toEqual([right, top, pz])
    expect(corners[2]).toEqual([right, bottom, pz])
    expect(corners[3]).toEqual([left, bottom, pz])
  })

  it('plateCorners suit la rotation autour de Y (quart de tour : la plaque s’étend le long de Z)', () => {
    const corners = plateCorners({ position: [0, 1, 0], rotationY: Math.PI / 2, width: 2, height: 1 })
    const xs = corners.map((c) => Math.round(c[0] * 1000) / 1000)
    const zs = corners.map((c) => Math.round(c[2] * 1000) / 1000)
    expect(new Set(xs)).toEqual(new Set([0]))
    expect(new Set(zs)).toEqual(new Set([-1, 1]))
  })
})
