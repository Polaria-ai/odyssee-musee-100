/**
 * Hauteur des murs de la salle des Archives (`wallRise.ts`) : fonctions pures, testées sans WebGL.
 * Retour de Baptiste du 29/09 : « des murs complets, des murs hauts, comme les autres murs ». Garde-fou :
 * la caméra est toujours au sud du joueur ; rien de haut ne doit rester entre elle et un joueur resté
 * dans le hall, alors que dans la salle les murs sont hauts.
 */
import { describe, expect, it } from 'vitest'
import type { AABB, EveningSession } from '../../types'
import { generatePlaceholderPeople } from '../../data/placeholder'
import { cameraPositionFor, cameraRig, dims } from '../../styles/tokens'
import { CAMERA_CUT_HEIGHT, CAP_HEIGHT, CORNICE_HEIGHT, CORNICE_TOP_GAP } from '../../world/constants'
import { buildMuseumLayout } from '../../world/layout'
import { occludesPlayer } from '../../world/occlusion'
import { buildArchivesLayout } from '../layout'
import { DOOR_HEIGHT, SOUTH_WALL_CUT_HEIGHT, WALL_HEIGHT, WALL_THICKNESS } from './constants'
import { BANNER_CENTER_Y, BANNER_HEIGHT, BANNER_WIDTH } from './geometry'
import {
  LOW_TOP,
  RISE_RATE,
  WALL_FULL,
  WALL_LOW,
  isInArchives,
  northWallObstacles,
  northWallTarget,
  northWallTargetHeight,
  riseFrame,
  sideWallObstacles,
  sideWallTarget,
  sideWallsHidePlayer,
  stepRise,
  wallTopAt,
} from './wallRise'

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

const museum = buildMuseumLayout(generatePlaceholderPeople(100))
const hall = museum.rooms.find((r) => r.id === 'hall')!.bounds
const archives = buildArchivesLayout(makeSessions(24), hall)
const room = archives.room.bounds

/** Distances de caméra échantillonnées entre les deux extrêmes du rig (le format d'écran choisit). */
const CAMERA_DISTANCES = [cameraRig.minDistance, 11, 13, 15, cameraRig.maxDistance]

// --- Test de segment pour le torse et la tête seulement (le pied caché par un mur de 1 m est voulu) -----

interface Box3 {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

function segmentHitsBox(p0: [number, number, number], p1: [number, number, number], box: Box3): boolean {
  let tMin = 0
  let tMax = 1
  const lo = [box.minX, box.minY, box.minZ]
  const hi = [box.maxX, box.maxY, box.maxZ]
  for (let axis = 0; axis < 3; axis++) {
    const d = p1[axis] - p0[axis]
    if (Math.abs(d) < 1e-9) {
      if (p0[axis] < lo[axis] || p0[axis] > hi[axis]) return false
      continue
    }
    let t1 = (lo[axis] - p0[axis]) / d
    let t2 = (hi[axis] - p0[axis]) / d
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
    if (tMin > tMax) return false
  }
  return true
}

/** Le torse ou la tête d'un joueur en (x, z) est-il caché par `obstacles` depuis la caméra à la distance donnée ? */
function bodyHidden(obstacles: { box: AABB; height: number }[], x: number, z: number, distance: number): boolean {
  const cam = cameraPositionFor(x, z, distance)
  return obstacles.some((o) =>
    [0.5, 1].some((f) => segmentHitsBox([cam.x, cam.y, cam.z], [x, f * dims.playerHeight, z], { ...o.box, minY: 0, maxY: o.height })),
  )
}

function grid(x0: number, x1: number, z0: number, z1: number, step: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = []
  for (let x = x0; x <= x1 + 1e-9; x += step) for (let z = z0; z <= z1 + 1e-9; z += step) out.push({ x, z })
  return out
}

/** Positions atteignables dans le hall : partout sauf dans les murs, plus le passage de la porte jusqu'à z = maxZ. */
const r = dims.playerRadius
const half = dims.wallThickness / 2
const hallPositions = [
  ...grid(hall.minX + half + r, hall.maxX - half - r, hall.minZ + half + r, hall.maxZ - half - r, 0.35),
  ...grid(archives.door.x - archives.door.width / 2 + r, archives.door.x + archives.door.width / 2 - r, hall.maxZ - half - r, hall.maxZ, 0.25),
]
/** Positions atteignables dans la salle des Archives (currentRoom === 'archives' : z > hall.maxZ). */
const roomPositions = [
  ...grid(room.minX + half + r, room.maxX - half - r, room.minZ + half + r, room.maxZ - half - r, 0.5),
  ...grid(archives.door.x - archives.door.width / 2 + r, archives.door.x + archives.door.width / 2 - r, room.minZ + 1e-3, room.minZ + half + r, 0.25),
]

describe('hauteurs des murs', () => {
  it('les murs hauts ont la hauteur des autres salles, le mur coupé celle de tous les murs coupés du musée', () => {
    expect(WALL_HEIGHT).toBe(dims.wallHeight)
    expect(WALL_FULL).toBe(dims.wallHeight)
    expect(SOUTH_WALL_CUT_HEIGHT).toBe(CAMERA_CUT_HEIGHT)
    expect(WALL_LOW).toBe(CAMERA_CUT_HEIGHT)
    expect(LOW_TOP).toBeCloseTo(CAMERA_CUT_HEIGHT + CAP_HEIGHT)
  })

  it('le mur nord est haut dans les Archives et coupé partout ailleurs', () => {
    expect(isInArchives('archives')).toBe(true)
    for (const other of ['hall', 'infrastructures', 'industrialisation', 'culture', null] as const) expect(isInArchives(other)).toBe(false)
    expect(northWallTargetHeight(true)).toBe(dims.wallHeight)
    expect(northWallTargetHeight(false)).toBe(CAMERA_CUT_HEIGHT)
    expect(northWallTarget(true)).toBe(1)
    expect(northWallTarget(false)).toBe(0)
  })

  it('les murs latéraux sont hauts, sauf s’ils cachent un joueur resté hors de la salle', () => {
    expect(sideWallTarget(true, false)).toBe(1)
    expect(sideWallTarget(true, true)).toBe(1) // dans la salle, jamais de rétraction
    expect(sideWallTarget(false, false)).toBe(1)
    expect(sideWallTarget(false, true)).toBe(0)
  })
})

describe('riseFrame — ce qui monte avec le mur', () => {
  it('p = 0 : mur coupé, liseré de 6 cm posé dessus, ni linteau ni bandeau', () => {
    const f = riseFrame(0)
    expect(f.bodyHeight).toBe(0)
    expect(f.crownBottom).toBeCloseTo(CAMERA_CUT_HEIGHT)
    expect(f.crownHeight).toBeCloseTo(CAP_HEIGHT)
    expect(f.lintelHeight).toBe(0)
    expect(f.lintelCrownVisible).toBe(false)
    expect(f.bannerOpacity).toBe(0)
  })

  it('p = 1 : mur haut, corniche sous le plafond, linteau jusqu’au sommet, bandeau opaque', () => {
    const f = riseFrame(1)
    expect(wallTopAt(1)).toBe(dims.wallHeight)
    expect(f.bodyBottom + f.bodyHeight).toBeCloseTo(dims.wallHeight)
    expect(f.crownHeight).toBeCloseTo(CORNICE_HEIGHT)
    expect(f.crownBottom + f.crownHeight).toBeCloseTo(dims.wallHeight - CORNICE_TOP_GAP)
    expect(f.lintelHeight).toBeCloseTo(dims.wallHeight - DOOR_HEIGHT)
    expect(f.lintelCrownVisible).toBe(true)
    expect(f.bannerOpacity).toBe(1)
  })

  it('monte de façon monotone, et la couronne ne flotte jamais loin au-dessus du corps', () => {
    let previous = riseFrame(0)
    for (let i = 1; i <= 100; i++) {
      const p = i / 100
      const f = riseFrame(p)
      expect(f.bodyBottom + f.bodyHeight).toBeGreaterThanOrEqual(previous.bodyBottom + previous.bodyHeight - 1e-9)
      expect(f.crownBottom).toBeGreaterThanOrEqual(previous.crownBottom - 1e-9)
      expect(f.lintelHeight).toBeGreaterThanOrEqual(previous.lintelHeight - 1e-9)
      expect(f.bannerOpacity).toBeGreaterThanOrEqual(previous.bannerOpacity - 1e-9)
      // La couronne ne dépasse jamais le sommet du corps de plus que son propre liseré.
      expect(f.crownBottom + f.crownHeight).toBeLessThanOrEqual(wallTopAt(p) + CAP_HEIGHT + 1e-9)
      // Et elle ne quitte jamais le corps par le bas : pas de trou entre les deux.
      expect(f.crownBottom).toBeLessThanOrEqual(wallTopAt(p) + 1e-9)
      previous = f
    }
  })

  it('borne p à [0, 1]', () => {
    expect(riseFrame(-3)).toEqual(riseFrame(0))
    expect(riseFrame(7)).toEqual(riseFrame(1))
  })

  it('la couronne ne traverse l’embrasure de la porte qu’une fois au-dessus de son linteau', () => {
    for (let i = 0; i <= 100; i++) {
      const f = riseFrame(i / 100)
      if (f.lintelCrownVisible) expect(f.crownBottom).toBeGreaterThanOrEqual(DOOR_HEIGHT - 1e-6)
      // Le linteau existe avant la couronne : elle vient toujours se poser sur du mur plein.
      if (f.lintelCrownVisible) expect(f.lintelHeight).toBeGreaterThan(0)
    }
  })

  it('le bandeau tient sur le linteau : entre le haut de la porte et la corniche, et pas plus large que la porte', () => {
    const f = riseFrame(1)
    expect(BANNER_CENTER_Y - BANNER_HEIGHT / 2).toBeGreaterThanOrEqual(DOOR_HEIGHT)
    expect(BANNER_CENTER_Y + BANNER_HEIGHT / 2).toBeLessThanOrEqual(f.crownBottom)
    expect(BANNER_WIDTH).toBeLessThanOrEqual(archives.door.width)
  })
})

describe('stepRise — approche amortie', () => {
  it('converge vers la cible sans jamais la dépasser, et s’y cale exactement', () => {
    for (const [from, to] of [
      [0, 1],
      [1, 0],
      [0.3, 0.9],
    ] as const) {
      let p: number = from
      let steps = 0
      while (p !== to && steps < 600) {
        const next = stepRise(p, to, 1 / 60)
        expect(next).toBeGreaterThanOrEqual(Math.min(p, to) - 1e-12)
        expect(next).toBeLessThanOrEqual(Math.max(p, to) + 1e-12)
        expect(Math.abs(next - to)).toBeLessThanOrEqual(Math.abs(p - to))
        p = next
        steps++
      }
      expect(p).toBe(to)
      expect(steps).toBeLessThan(120) // moins de 2 s à 60 i/s : la transition est brève
    }
  })

  it('est ~indépendante du framerate', () => {
    const oneStep = stepRise(0, 1, 1 / 30)
    const twoSteps = stepRise(stepRise(0, 1, 1 / 60), 1, 1 / 60)
    expect(oneStep).toBeCloseTo(twoSteps, 6)
  })

  it('ne bouge pas sans temps écoulé, saute à la cible en mouvement réduit', () => {
    expect(stepRise(0.4, 1, 0)).toBe(0.4)
    expect(stepRise(0.4, 1, -1)).toBe(0.4)
    expect(stepRise(0.4, 1, 1 / 60, Infinity)).toBe(1)
    expect(stepRise(1, 1, 1 / 60)).toBe(1)
  })

  it('le premier pas est sensible (le mur démarre tout de suite) et la moitié du chemin est faite en ~0,12 s', () => {
    expect(stepRise(0, 1, 1 / 60)).toBeGreaterThan(0.05)
    expect(stepRise(0, 1, Math.LN2 / RISE_RATE)).toBeCloseTo(0.5, 2)
  })
})

describe('la caméra, toujours au sud du joueur, ne trouve rien de haut devant un joueur du hall', () => {
  it('mur nord coupé : ni le torse ni la tête d’un joueur du hall (porte comprise) ne sont jamais cachés', () => {
    const obstacles = northWallObstacles(archives, 0)
    expect(hallPositions.length).toBeGreaterThan(500)
    for (const { x, z } of hallPositions) {
      for (const d of CAMERA_DISTANCES) expect(bodyHidden(obstacles, x, z, d), `joueur du hall en (${x.toFixed(2)}, ${z.toFixed(2)}), caméra à ${d} m`).toBe(false)
    }
  })

  it('… alors que le même mur à pleine hauteur cacherait un joueur du hall (c’est pourquoi il reste coupé)', () => {
    const obstacles = northWallObstacles(archives, 1)
    expect(bodyHidden(obstacles, 5, hall.maxZ - half - r, cameraRig.minDistance)).toBe(true)
    expect(bodyHidden(obstacles, -6, hall.maxZ - half - r, cameraRig.maxDistance)).toBe(true)
    expect(obstacles.every((o) => o.height >= dims.wallHeight - CORNICE_TOP_GAP)).toBe(true)
  })

  it('mur nord haut : un joueur dans la salle (au sud du mur) n’est jamais caché par lui', () => {
    const obstacles = northWallObstacles(archives, 1)
    expect(roomPositions.length).toBeGreaterThan(300)
    for (const { x, z } of roomPositions) {
      for (const d of CAMERA_DISTANCES) {
        expect(bodyHidden(obstacles, x, z, d), `joueur des Archives en (${x.toFixed(2)}, ${z.toFixed(2)}), caméra à ${d} m`).toBe(false)
        expect(occludesPlayer(obstacles[0], x, z, cameraPositionFor(x, z, d)), 'pieds compris').toBe(false)
        expect(occludesPlayer(obstacles[1], x, z, cameraPositionFor(x, z, d)), 'pieds compris').toBe(false)
      }
    }
  })

  it('murs latéraux hauts : jamais devant un joueur dans la salle', () => {
    const b = room
    const sides: { box: AABB; height: number }[] = [
      { box: { minX: b.minX - half, maxX: b.minX + half, minZ: b.minZ, maxZ: b.maxZ }, height: dims.wallHeight },
      { box: { minX: b.maxX - half, maxX: b.maxX + half, minZ: b.minZ, maxZ: b.maxZ }, height: dims.wallHeight },
    ]
    for (const { x, z } of roomPositions) {
      for (const d of CAMERA_DISTANCES) expect(bodyHidden(sides, x, z, d)).toBe(false)
    }
  })

  it('murs latéraux hauts : ils cachent un joueur qui longe l’angle du hall (d’où la rétraction) — jamais au centre du hall', () => {
    const obstacles = sideWallObstacles(archives)
    expect(obstacles).toHaveLength(2)
    const cam = (x: number, z: number, d: number = cameraRig.minDistance) => cameraPositionFor(x, z, d)
    // Angle sud-est et sud-ouest du hall, à l'aplomb des murs latéraux de la salle.
    expect(sideWallsHidePlayer(obstacles, room.maxX, 8, cam(room.maxX, 8))).toBe(true)
    expect(sideWallsHidePlayer(obstacles, room.minX, 8.3, cam(room.minX, 8.3, 17))).toBe(true)
    // Approche : la marge de `sideWallObstacles` déclenche la rétraction un peu avant.
    expect(sideWallsHidePlayer(obstacles, room.maxX - 1, 8, cam(room.maxX - 1, 8))).toBe(true)
    // Centre du hall, devant la porte, fond du hall : jamais.
    for (const [x, z] of [
      [0, 0],
      [0, 8],
      [-4, 6],
      [4, -8],
      [room.maxX - 3, 8],
    ]) {
      expect(sideWallsHidePlayer(obstacles, x, z, cam(x, z)), `(${x}, ${z})`).toBe(false)
    }
  })

  it('murs latéraux rétractés (coupés) : ils ne cachent plus le torse ni la tête d’aucun joueur du hall', () => {
    const b = room
    const lowSides: { box: AABB; height: number }[] = [
      { box: { minX: b.minX - half, maxX: b.minX + half, minZ: b.minZ, maxZ: b.maxZ }, height: LOW_TOP },
      { box: { minX: b.maxX - half, maxX: b.maxX + half, minZ: b.minZ, maxZ: b.maxZ }, height: LOW_TOP },
    ]
    for (const { x, z } of hallPositions) {
      for (const d of CAMERA_DISTANCES) expect(bodyHidden(lowSides, x, z, d), `(${x.toFixed(2)}, ${z.toFixed(2)}) à ${d} m`).toBe(false)
    }
  })
})

describe('emprise du mur nord', () => {
  it('couvre toute la largeur du hall, porte exclue, à l’épaisseur des murs du musée', () => {
    const doorMin = archives.door.x - archives.door.width / 2
    const doorMax = archives.door.x + archives.door.width / 2
    expect(archives.northWall).toHaveLength(2)
    const [left, right] = [...archives.northWall].sort((a, b) => a.minX - b.minX)
    expect(left.minX).toBe(hall.minX)
    expect(left.maxX).toBeCloseTo(doorMin)
    expect(right.minX).toBeCloseTo(doorMax)
    expect(right.maxX).toBe(hall.maxX)
    for (const w of archives.northWall) {
      expect((w.minZ + w.maxZ) / 2).toBeCloseTo(hall.maxZ)
      expect(w.maxZ - w.minZ).toBeCloseTo(WALL_THICKNESS)
    }
  })
})
