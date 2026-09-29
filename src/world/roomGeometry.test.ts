/**
 * `roomGeometry.ts` dessine sur des `BufferGeometry` three.js pures (pas de canvas 2D, contrairement à
 * `textures.ts`) : testable sans DOM. On vérifie ici surtout `farWallX` (déplacée dans `layout.ts` depuis
 * WEL-874 — source de vérité des positions de décor — et ré-importée ici), dont dépend tout le décor
 * signature d'une aile est/ouest (`wingSignatureDecor`) — régression : le décor de l'aile
 * infrastructures se retrouvait plaqué contre la porte du hall plutôt que le mur du fond (voir
 * commentaire de `farWallX`).
 */
import { describe, expect, it } from 'vitest'
import { Color, type BufferGeometry } from 'three'
import type { RoomLayout } from '../types'
import { RUG_RADIUS, buildComingSoonBarrierGeometry, buildDoorArchesGeometry, buildLightRaysGeometry, buildOccluderGeometry, buildRoomGeometry } from './roomGeometry'
import { buildMuseumArchitecture, farWallX } from './layout'
import { generatePlaceholderPeople } from '../data/placeholder'
import { CAMERA_CUT_HEIGHT, CAP_HEIGHT, DOOR_WIDTH, HALL_HALF_DEPTH, HALL_HALF_WIDTH, LISTEL_HEIGHT, SOFTEN_CHECKER, WAINSCOT_HEIGHT, dims } from './constants'
import { charter3d } from '../styles/tokens'

function roomWithBounds(minX: number, maxX: number): RoomLayout {
  return {
    id: 'infrastructures',
    bounds: { minX, maxX, minZ: -7, maxZ: 7 },
    label: { fr: 'Test', en: 'Test' },
    floorColor: '#000000',
    wallColor: '#000000',
    accentColor: '#000000',
  }
}

describe('farWallX — mur du fond d’une aile est/ouest, quel que soit son sens', () => {
  it('aile qui s’éloigne du hall vers les X négatifs (infrastructures, dir = -1) : le mur du fond est en minX', () => {
    // Mêmes ordres de grandeur que le plan réel (hall en x = -11, aile qui s'étend jusqu'à x = -44.6).
    const room = roomWithBounds(-44.6, -11)
    expect(farWallX(room, 0.3)).toBeCloseTo(-44.3, 5)
  })

  it('aile qui s’éloigne du hall vers les X positifs (culture, dir = +1) : le mur du fond est en maxX', () => {
    const room = roomWithBounds(11, 44.6)
    expect(farWallX(room, 0.3)).toBeCloseTo(44.3, 5)
  })

  it('ne se trompe jamais de côté : reste toujours du côté le plus loin de x = 0 (le hall)', () => {
    const negative = roomWithBounds(-44.6, -11)
    const positive = roomWithBounds(11, 44.6)
    expect(Math.abs(farWallX(negative, 0.3))).toBeGreaterThan(Math.abs(negative.bounds.maxX))
    expect(Math.abs(farWallX(positive, 0.3))).toBeGreaterThan(Math.abs(positive.bounds.minX))
  })
})

describe('buildRoomGeometry / buildComingSoonBarrierGeometry — fusion sans exception', () => {
  it('fusionne sol + murs + décor de chaque salle sans lever d’exception, pour une répartition qui peuple les trois ailes', () => {
    const people = generatePlaceholderPeople(100)
    const architecture = buildMuseumArchitecture(people)
    for (const { room, walls } of architecture.rooms) {
      const geo = buildRoomGeometry(room, walls, room.id === 'hall' ? architecture.decor : undefined)
      geo.computeBoundingBox()
      expect(geo.boundingBox, `géométrie vide pour la salle ${room.id}`).toBeTruthy()
      expect(geo.boundingBox!.max.x).toBeGreaterThan(geo.boundingBox!.min.x)
    }
  })

  it('la barrière décorative d’une aile « Bientôt » est une géométrie non dégénérée', () => {
    const geo = buildComingSoonBarrierGeometry({ x: 0, z: 0 }, 0)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.max.x).toBeGreaterThan(geo.boundingBox!.min.x)
    expect(geo.boundingBox!.max.y).toBeGreaterThan(geo.boundingBox!.min.y)
  })

  // Item 4 (embellissement architecture) : l'arche arrondie ajoute un demi-cercle au-dessus du linteau
  // plat — la géométrie doit donc culminer nettement plus haut que le simple linteau (ARCH_HEIGHT = 0,4 m).
  it('les trois ailes peuplées : l’arche de porte dépasse le linteau plat (demi-cercle ajouté)', () => {
    const people = generatePlaceholderPeople(100)
    const architecture = buildMuseumArchitecture(people)
    const geo = buildDoorArchesGeometry(architecture.doorArches)
    expect(geo, 'les trois ailes sont peuplées : au moins une arche attendue').toBeTruthy()
    geo!.computeBoundingBox()
    const archTop = geo!.boundingBox!.max.y
    const archBottom = geo!.boundingBox!.min.y
    expect(archTop - archBottom).toBeGreaterThan(0.4) // > ARCH_HEIGHT (0,4, linteau plat seul) : le demi-cercle dépasse
    expect(archTop).toBeLessThan(dims.wallHeight) // ne perce jamais le plafond
  })

  it('aucune arche (toutes les ailes vides) : géométrie nulle', () => {
    expect(buildDoorArchesGeometry([])).toBeNull()
  })
})

// --- Charte 3D (docs/CHARTE-3D.md) : l'architecture n'emploie que les couleurs de `charter3d` -----------------

/** Toutes les couleurs `#rrggbb` de la charte (les `rgba()` sont des couleurs de canvas, pas de matière). */
function charterHexes(node: unknown = charter3d, out = new Set<string>()): Set<string> {
  if (typeof node === 'string') {
    if (/^#[0-9a-f]{6}$/i.test(node)) out.add(node.toLowerCase())
  } else if (node && typeof node === 'object') {
    for (const v of Object.values(node)) charterHexes(v, out)
  }
  return out
}

interface Vertex {
  x: number
  y: number
  z: number
  r: number
  g: number
  b: number
}

function vertices(geo: BufferGeometry): Vertex[] {
  const pos = geo.attributes.position
  const col = geo.attributes.color
  const out: Vertex[] = []
  for (let i = 0; i < pos.count; i++) out.push({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i), r: col.getX(i), g: col.getY(i), b: col.getZ(i) })
  return out
}

/** Vrai si le sommet a la couleur `hex` (espace de travail linéaire de three), à `tol` près en valeur relative. */
function isColor(v: Vertex, hex: string, tol = 0.002): boolean {
  const c = new Color(hex)
  return Math.abs(v.r - c.r) <= tol * Math.max(c.r, 0.01) + 1e-4 && Math.abs(v.g - c.g) <= tol * Math.max(c.g, 0.01) + 1e-4 && Math.abs(v.b - c.b) <= tol * Math.max(c.b, 0.01) + 1e-4
}

const NOISE_TOLERANCE = 0.035 // ≥ la variation par sommet des grands murs (WALL_NOISE = 3 %)

function isCharterColor(v: Vertex, palette: string[]): boolean {
  return palette.some((hex) => isColor(v, hex, NOISE_TOLERANCE))
}

describe('charte 3D — l’architecture ne peint qu’avec charter3d', () => {
  const architecture = buildMuseumArchitecture(generatePlaceholderPeople(100))
  const palette = [...charterHexes()]
  const geometryOf = (id: string): BufferGeometry => {
    const entry = architecture.rooms.find((r) => r.room.id === id)!
    return buildRoomGeometry(entry.room, entry.walls, entry.room.id === 'hall' ? architecture.decor : undefined)
  }

  it('la charte contient bien des couleurs (sanity du contrôle)', () => {
    expect(palette.length).toBeGreaterThan(15)
    expect(palette).toEqual(expect.arrayContaining([charter3d.base.mur, charter3d.base.corail, charter3d.base.cyanVif, charter3d.base.bleuNeon]))
  })

  it('chaque sommet de chaque salle (sol, murs, tapis, mobilier) est une couleur de la charte : ni bois, ni beige, ni or', () => {
    for (const { room } of architecture.rooms) {
      const off = vertices(geometryOf(room.id)).filter((v) => !isCharterColor(v, palette))
      expect(off.length, `salle ${room.id} : ${off.length} sommets hors charte, p. ex. ${JSON.stringify(off[0])}`).toBe(0)
    }
  })

  it('cimaises, linteaux, barrière et rayons : mêmes couleurs de charte', () => {
    const occluder = buildOccluderGeometry({ minX: 0, maxX: 5, minZ: 0, maxZ: 0.3 }, 4.2, charter3d.rooms.hall.wall)
    const others = [occluder, buildDoorArchesGeometry(architecture.doorArches)!, buildComingSoonBarrierGeometry({ x: 0, z: 0 }, 0), buildLightRaysGeometry({ x: 0, z: 0 })]
    for (const geo of others) expect(vertices(geo).filter((v) => !isCharterColor(v, palette))).toEqual([])
  })

  it('une cimaise a un pied de plinthe nuit profond et un mur bleu de charte', () => {
    const vs = vertices(buildOccluderGeometry({ minX: 0, maxX: 5, minZ: 0, maxZ: 0.3 }, 4.2, charter3d.rooms.hall.wall))
    expect(vs.some((v) => isColor(v, charter3d.rooms.hall.plinth))).toBe(true)
    expect(vs.some((v) => isColor(v, charter3d.rooms.hall.wall))).toBe(true)
  })

  it('les rayons de la verrière sont blanc froid (plus de jaune)', () => {
    const vs = vertices(buildLightRaysGeometry({ x: 0, z: 0 }))
    expect(vs.every((v) => isColor(v, charter3d.scene.rays))).toBe(true)
  })

  it('le magenta n’a qu’un usage : le cordon de l’aile fermée (jamais dans le hall ni les ailes)', () => {
    const magenta = charter3d.base.magenta
    for (const { room } of architecture.rooms) expect(vertices(geometryOf(room.id)).some((v) => isColor(v, magenta)), `magenta dans ${room.id}`).toBe(false)
    expect(vertices(buildComingSoonBarrierGeometry({ x: 0, z: 0 }, 0)).some((v) => isColor(v, charter3d.furniture.rope.cordClosed))).toBe(true)
    // Le cordon du comptoir, lui, est corail.
    expect(vertices(geometryOf('hall')).some((v) => isColor(v, charter3d.furniture.rope.cord))).toBe(true)
  })

  it('murs pleins : lambris, listel blanc posé dessus et corniche d’accent, dans chaque salle', () => {
    for (const { room } of architecture.rooms) {
      const c = charter3d.rooms[room.id]
      const vs = vertices(geometryOf(room.id))
      expect(vs.some((v) => isColor(v, c.wainscot) && Math.abs(v.y - WAINSCOT_HEIGHT) < 1e-6), `lambris ${room.id}`).toBe(true)
      expect(vs.some((v) => isColor(v, c.listel) && Math.abs(v.y - (WAINSCOT_HEIGHT + LISTEL_HEIGHT)) < 1e-6), `listel ${room.id}`).toBe(true)
      expect(vs.some((v) => isColor(v, c.cornice) && v.y > dims.wallHeight - 0.4), `corniche ${room.id}`).toBe(true)
    }
  })

  it('murs coupés côté caméra : une bande d’accent (CAP_HEIGHT) sur le dessus', () => {
    const top = CAMERA_CUT_HEIGHT + CAP_HEIGHT
    for (const { room } of architecture.rooms) {
      const vs = vertices(geometryOf(room.id))
      const hasCutWall = architecture.rooms.find((r) => r.room.id === room.id)!.walls.some((w) => w.kind === 'wall' && w.cut && !w.hidden)
      if (!hasCutWall) continue
      expect(vs.some((v) => isColor(v, charter3d.rooms[room.id].cap) && Math.abs(v.y - top) < 1e-6), `bande sur le mur coupé de ${room.id}`).toBe(true)
    }
  })

  it('le mur sud du hall (« collider seulement », dessiné par les Archives) ne produit aucun mur ici', () => {
    // Hors des extrémités des murs est/ouest (|x| ≈ 11) : plus rien de haut le long du mur sud.
    const south = vertices(geometryOf('hall')).filter((v) => Math.abs(v.x) < HALL_HALF_WIDTH - 0.5 && v.z > HALL_HALF_DEPTH - 0.19 && v.y > 0.3)
    expect(south).toEqual([])
  })

  it('les ailes ont un sol à deux tons francs (damier) ou moquette + bordure, aux couleurs de charte', () => {
    for (const id of ['infrastructures', 'industrialisation', 'culture'] as const) {
      const c = charter3d.rooms[id]
      const ground = vertices(geometryOf(id)).filter((v) => v.y === 0)
      expect(ground.some((v) => isColor(v, c.floor)), `${id} : sol`).toBe(true)
      expect(ground.some((v) => isColor(v, c.floorAlt)), `${id} : second ton`).toBe(true)
    }
  })

  it('SOFTEN_CHECKER est à 0 : le damier garde ses deux tons exacts', () => {
    expect(SOFTEN_CHECKER).toBe(0)
  })

  it('les câbles des Infrastructures sont cyan vif et blancs (plus de brun)', () => {
    const vs = vertices(geometryOf('infrastructures'))
    expect(vs.some((v) => isColor(v, charter3d.cables.main) && v.y < 0.1)).toBe(true)
    expect(vs.some((v) => isColor(v, charter3d.cables.thin) && v.y < 0.1)).toBe(true)
  })

  it('sol du hall : chevrons bleus, disque en scanlines, un chemin par porte (sud compris)', () => {
    const vs = vertices(geometryOf('hall'))
    const { hallFloor } = charter3d
    // Barres du logo : blanches et corail, toutes dans le disque.
    const bars = vs.filter((v) => Math.abs(v.y - 0.013) < 1e-6)
    expect(bars.length).toBeGreaterThan(0)
    expect(bars.some((v) => isColor(v, hallFloor.rugBar))).toBe(true)
    expect(bars.some((v) => isColor(v, hallFloor.rugBarAccent))).toBe(true)
    for (const v of bars) expect(Math.hypot(v.x, v.z), 'barre hors du disque').toBeLessThanOrEqual(RUG_RADIUS + 0.08)
    // Fond du disque.
    expect(vs.some((v) => Math.abs(v.y - 0.01) < 1e-6 && isColor(v, hallFloor.rugBacking))).toBe(true)
    // Chemins : un par porte, jusqu’au mur.
    const paths = vs.filter((v) => Math.abs(v.y - 0.004) < 1e-6)
    const reach = (hex: string, pick: (v: Vertex) => number): number => Math.max(...paths.filter((v) => isColor(v, hex)).map(pick))
    expect(reach(hallFloor.path.industrialisation, (v) => -v.z)).toBeCloseTo(HALL_HALF_DEPTH, 5)
    expect(reach(hallFloor.path.archives, (v) => v.z)).toBeCloseTo(HALL_HALF_DEPTH, 5)
    expect(reach(hallFloor.path.infrastructures, (v) => -v.x)).toBeCloseTo(HALL_HALF_WIDTH, 5)
    expect(reach(hallFloor.path.culture, (v) => v.x)).toBeCloseTo(HALL_HALF_WIDTH, 5)
    // Liseré blanc de bord.
    expect(vs.some((v) => Math.abs(v.y - 0.007) < 1e-6 && isColor(v, hallFloor.pathEdge))).toBe(true)
  })

  it('les chemins du hall passent dans les portes (2,3 m < DOOR_WIDTH) sans déborder du hall', () => {
    const vs = vertices(geometryOf('hall')).filter((v) => Math.abs(v.y - 0.004) < 1e-6)
    for (const v of vs) {
      expect(Math.abs(v.x)).toBeLessThanOrEqual(HALL_HALF_WIDTH + 1e-6)
      expect(Math.abs(v.z)).toBeLessThanOrEqual(HALL_HALF_DEPTH + 1e-6)
    }
    const northPath = vs.filter((v) => isColor(v, charter3d.hallFloor.path.industrialisation))
    expect(Math.max(...northPath.map((v) => Math.abs(v.x)))).toBeLessThan(DOOR_WIDTH / 2)
  })
})
