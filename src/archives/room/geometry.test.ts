/**
 * Géométries de la salle des Archives (`geometry.ts`) : pures (BufferGeometry sans WebGL), testables en
 * Node. On vérifie les emprises, les hauteurs (mur coupé / mur haut), que toute couleur vient de la charte
 * 3D (aucun bois, or ou beige qui se glisse dans les sommets) et que le mobilier ne recoupe pas les murs.
 */
import { describe, expect, it } from 'vitest'
import { Color, type BufferGeometry } from 'three'
import type { EveningSession } from '../../types'
import { generatePlaceholderPeople } from '../../data/placeholder'
import { charter3d } from '../../styles/tokens'
import { CAP_HEIGHT, LISTEL_HEIGHT, TRIM_PROTRUSION, WAINSCOT_HEIGHT } from '../../world/constants'
import { buildMuseumLayout } from '../../world/layout'
import { buildArchivesLayout } from '../layout'
import { DOOR_HEIGHT, WALL_HEIGHT, WALL_THICKNESS } from './constants'
import {
  archivesWalls,
  buildCrownGeometry,
  buildFurnitureGeometry,
  buildPanelGeometry,
  buildPillarGeometry,
  buildShellGeometry,
  buildUpperBodyGeometry,
  buildWallBaseGeometry,
  panelZs,
} from './geometry'
import { LOW_TOP, WALL_LOW, riseFrame } from './wallRise'

const sessions: EveningSession[] = Array.from({ length: 12 }, (_, i) => ({
  id: `s${i}`,
  order: i + 1,
  startTime: '18:30',
  durationMin: 5,
  kind: 'film',
  title: { fr: `Séquence ${i}`, en: `Session ${i}` },
  speakers: [],
  provisional: true,
}))
const museum = buildMuseumLayout(generatePlaceholderPeople(100))
const hall = museum.rooms.find((r) => r.id === 'hall')!.bounds
const archives = buildArchivesLayout(sessions, hall)
const room = archives.room.bounds
const walls = archivesWalls(archives)
const { rooms } = charter3d

function bbox(geo: BufferGeometry) {
  geo.computeBoundingBox()
  return geo.boundingBox!
}

/** Couleurs par sommet d'une géométrie, en flottants [0, 1]. */
function vertexColors(geo: BufferGeometry): [number, number, number][] {
  const c = geo.attributes.color
  return Array.from({ length: c.count }, (_, i) => [c.getX(i), c.getY(i), c.getZ(i)] as [number, number, number])
}

/** Couleur linéaire (l'espace de travail de three) d'une couleur hexadécimale, comme dans les sommets peints. */
function linear(hex: string): [number, number, number] {
  const c = new Color().set(hex)
  return [c.r, c.g, c.b]
}

/** Toute couleur de sommet est l'une des couleurs de `palette` (au bruit multiplicatif près, `tolerance` en relatif). */
function expectColorsFrom(geo: BufferGeometry, palette: string[], tolerance = 0.035) {
  const allowed = palette.map(linear)
  for (const v of vertexColors(geo)) {
    const near = allowed.some((a) => a.every((channel, i) => Math.abs(channel - v[i]) <= tolerance * channel + 1e-6))
    expect(near, `couleur de sommet hors charte : ${v.map((c) => c.toFixed(3)).join(',')}`).toBe(true)
  }
}

describe('archivesWalls — emprises', () => {
  it('le mur nord couvre toute la largeur du hall, porte exclue, et déborde des angles extérieurs', () => {
    const doorMin = archives.door.x - archives.door.width / 2
    const doorMax = archives.door.x + archives.door.width / 2
    const [left, right] = [...walls.north].sort((a, b) => a.minX - b.minX)
    expect(left.minX).toBeCloseTo(hall.minX - WALL_THICKNESS / 2)
    expect(left.maxX).toBeCloseTo(doorMin)
    expect(right.minX).toBeCloseTo(doorMax)
    expect(right.maxX).toBeCloseTo(hall.maxX + WALL_THICKNESS / 2)
  })

  it('l’embrasure est exactement la porte, sur l’épaisseur du mur nord', () => {
    expect(walls.doorway.minX).toBeCloseTo(archives.door.x - archives.door.width / 2)
    expect(walls.doorway.maxX).toBeCloseTo(archives.door.x + archives.door.width / 2)
    expect(walls.doorway.maxZ - walls.doorway.minZ).toBeCloseTo(WALL_THICKNESS)
    for (const w of walls.north) {
      expect(w.minZ).toBeCloseTo(walls.doorway.minZ)
      expect(w.maxZ).toBeCloseTo(walls.doorway.maxZ)
    }
  })

  it('les quatre murs ferment la salle : angles refermés, colliders inclus dans les murs dessinés', () => {
    // Le joueur ne voit jamais un trou : chaque collider de la salle est couvert par un mur dessiné.
    const drawn = [...walls.north, walls.south, walls.east, walls.west]
    for (const c of archives.colliders.slice(0, 5)) {
      const covered = drawn.some((w) => w.minX <= c.minX + 1e-6 && w.maxX >= c.maxX - 1e-6 && w.minZ <= c.minZ + 1e-6 && w.maxZ >= c.maxZ - 1e-6) ||
        // Le collider du mur nord est en deux segments autour de la porte : couverts par `north`.
        walls.north.some((w) => w.minX <= c.minX + 1e-6 && w.maxX >= c.maxX - 1e-6 && w.minZ <= c.minZ + 1e-6 && w.maxZ >= c.maxZ - 1e-6)
      expect(covered, `collider ${JSON.stringify(c)}`).toBe(true)
    }
    expect(walls.east.maxZ).toBeGreaterThanOrEqual(walls.south.maxZ - 1e-6)
    expect(walls.west.maxZ).toBeGreaterThanOrEqual(walls.south.maxZ - 1e-6)
  })
})

describe('buildWallBaseGeometry — la base est celle d’un mur coupé', () => {
  const geo = buildWallBaseGeometry(walls)
  const box = bbox(geo)

  it('monte jusqu’au liseré du mur sud, pas plus (les autres murs sont complétés par le corps supérieur)', () => {
    expect(box.min.y).toBeCloseTo(0)
    expect(box.max.y).toBeCloseTo(WALL_LOW + CAP_HEIGHT)
    expect(LOW_TOP).toBeCloseTo(WALL_LOW + CAP_HEIGHT)
  })

  it('les surplombs (lambris, listel, plinthe) restent sous la hauteur d’un mur coupé et la porte reste libre', () => {
    expect(WAINSCOT_HEIGHT + LISTEL_HEIGHT).toBeLessThan(WALL_LOW)
    const doorMin = archives.door.x - archives.door.width / 2
    const doorMax = archives.door.x + archives.door.width / 2
    const position = geo.attributes.position
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const z = position.getZ(i)
      const inDoorway = x > doorMin + 1e-6 && x < doorMax - 1e-6 && z > walls.doorway.minZ - 0.3 && z < walls.doorway.maxZ + 0.3
      expect(inDoorway, `sommet dans l’embrasure : (${x}, ${z})`).toBe(false)
    }
  })

  it('n’utilise que les couleurs de la charte : mur, plinthe, lambris, listel, liseré', () => {
    const c = rooms.archives
    expectColorsFrom(geo, [c.wall, c.plinth, c.wainscot, c.listel, c.cap])
  })
})

describe('corps supérieur et couronne', () => {
  it('le corps supérieur est une boîte de hauteur 1 par mur, un peu plus mince que la base', () => {
    const body = buildUpperBodyGeometry(walls.north)
    const box = bbox(body)
    expect(box.min.y).toBeCloseTo(0)
    expect(box.max.y).toBeCloseTo(1)
    expect(box.min.x).toBeCloseTo(walls.north.map((w) => w.minX).sort((a, b) => a - b)[0])
    expect(box.max.z).toBeLessThan(walls.north[0].maxZ)
    expect(box.min.z).toBeGreaterThan(walls.north[0].minZ)
    const c = rooms.archives
    expectColorsFrom(body, [c.wall])
  })

  it('la couronne est une boîte de hauteur 1 qui déborde du mur comme la corniche, à l’accent de la salle', () => {
    const crown = buildCrownGeometry([walls.east, walls.west])
    const box = bbox(crown)
    expect(box.min.y).toBeCloseTo(0)
    expect(box.max.y).toBeCloseTo(1)
    expect(box.max.x).toBeCloseTo(walls.east.maxX + TRIM_PROTRUSION)
    expect(box.min.x).toBeCloseTo(walls.west.minX - TRIM_PROTRUSION)
    expectColorsFrom(crown, [rooms.archives.cornice], 1e-6)
    expect(rooms.archives.cornice).toBe(rooms.archives.accent)
  })

  it('à p = 1 le corps + la couronne font un mur de la hauteur des autres salles, avec corniche et sans trou', () => {
    const f = riseFrame(1)
    expect(f.bodyBottom).toBeLessThan(WALL_LOW) // recouvrement dans la base : pas de fissure
    expect(f.bodyBottom + f.bodyHeight).toBeCloseTo(WALL_HEIGHT)
    expect(f.crownBottom + f.crownHeight).toBeLessThan(WALL_HEIGHT)
    expect(f.lintelHeight).toBeGreaterThan(0)
    expect(DOOR_HEIGHT).toBeLessThan(WALL_HEIGHT)
  })
})

describe('mobilier fixe, panneaux, piliers', () => {
  it('bancs et pupitre restent dans la salle et hors des murs', () => {
    const furniture = buildFurnitureGeometry(archives)
    const box = bbox(furniture)
    expect(box.min.x).toBeGreaterThan(room.minX + WALL_THICKNESS / 2 + TRIM_PROTRUSION)
    expect(box.max.x).toBeLessThan(room.maxX - WALL_THICKNESS / 2 - TRIM_PROTRUSION)
    expect(box.min.z).toBeGreaterThan(room.minZ + WALL_THICKNESS / 2)
    expect(box.max.y).toBeLessThan(1)
    const c = charter3d.archives
    expectColorsFrom(furniture, [c.bench, charter3d.props.wood.trim, c.lectern, rooms.archives.accent], 1e-6)
  })

  it('les panneaux posent au-dessus du listel, sous la corniche, et ne recoupent ni le lambris ni le mur', () => {
    const panels = buildPanelGeometry(archives)
    const box = bbox(panels)
    const cornice = riseFrame(1).crownBottom
    expect(box.min.y).toBeGreaterThan(WAINSCOT_HEIGHT + LISTEL_HEIGHT)
    expect(box.max.y).toBeLessThan(cornice)
    // Posés sur la face intérieure des murs, pas dedans.
    expect(box.min.x).toBeGreaterThanOrEqual(room.minX + WALL_THICKNESS / 2 - 1e-6)
    expect(box.max.x).toBeLessThanOrEqual(room.maxX - WALL_THICKNESS / 2 + 1e-6)
    const zs = panelZs(archives)
    expect(zs).toHaveLength(2)
    for (const z of zs) {
      expect(z).toBeGreaterThan(room.minZ)
      expect(z).toBeLessThan(room.maxZ)
    }
    const c = charter3d.archives
    expectColorsFrom(panels, [c.panel.color, charter3d.base.cyan], 1e-6)
  })

  it('le pilier d’angle monte à la hauteur des murs, pied au sol', () => {
    const pillar = buildPillarGeometry()
    const box = bbox(pillar)
    expect(box.min.y).toBeCloseTo(0)
    expect(box.max.y).toBeCloseTo(WALL_HEIGHT)
    expectColorsFrom(pillar, [charter3d.archives.pillar, rooms.archives.plinth, rooms.archives.accent], 1e-6)
  })

  it('la charpente entière se fusionne en une seule géométrie non vide', () => {
    const shell = buildShellGeometry(archives)
    expect(shell.attributes.position.count).toBeGreaterThan(200)
    expect(shell.attributes.color.count).toBe(shell.attributes.position.count)
  })
})
