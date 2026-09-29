/**
 * Géométries fusionnées de la salle des Archives de 2040 (charte 3D, `docs/CHARTE-3D.md` §7.3) : murs,
 * mobilier fixe, piliers, panneaux. Tout est en couleurs par sommet (`charter3d`), un seul matériau
 * `MeshLambertMaterial({ vertexColors })` partagé : aucune couleur en dur ici.
 *
 * Les murs se décomposent en trois couches (voir `wallRise.ts`) :
 *  - la BASE (statique) : corps jusqu'à `WALL_LOW`, plinthe, lambris, listel — identique que le mur soit
 *    coupé ou haut ; le mur sud y ajoute son liseré ;
 *  - le CORPS SUPÉRIEUR (boîtes de hauteur 1, origine en bas, mises à l'échelle en Y au rendu) ;
 *  - la COURONNE (boîtes de hauteur 1, idem) : liseré d'accent sur le mur coupé, corniche sur le mur haut.
 * Aucun `three` de rendu ici : ces fonctions ne touchent ni WebGL ni le DOM (testables en Node).
 */
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { AABB, ArchivesLayout } from '../../types'
import { charter3d } from '../../styles/tokens'
import { CAP_HEIGHT, LISTEL_HEIGHT, TRIM_PROTRUSION, WAINSCOT_HEIGHT } from '../../world/constants'
import { ENTRANCE_LECTERN } from '../layout'
import { DOOR_HEIGHT, WALL_HEIGHT, WALL_THICKNESS } from './constants'
import { WALL_LOW } from './wallRise'

const room = charter3d.rooms.archives
const { archives: archivesCharter, base } = charter3d

/** Plinthe : sombre, plus saillante que le lambris pour rester lisible au pied du mur. */
export const PLINTH_HEIGHT = 0.16
const PLINTH_PROTRUSION = 0.07
/** Variation de valeur par sommet des grands murs unis (même réglage que le hall). */
const WALL_NOISE = 0.03
/** Le corps supérieur est plus mince de 2 mm que la base : dans la zone de recouvrement, la base gagne. */
const BODY_INSET = 0.002

const _color = new Color()

/** Un mur : emprise au sol. `cut` = coupé en permanence (côté caméra), sinon il monte avec le joueur. */
export interface WallFootprint {
  box: AABB
  cut: boolean
}

export interface ArchivesWalls {
  /** Segments du mur nord (= mur sud du hall), de part et d'autre de la porte. */
  north: AABB[]
  south: AABB
  east: AABB
  west: AABB
  /** Emprise de l'embrasure de la porte (dans l'axe du mur nord), sur toute son épaisseur. */
  doorway: AABB
}

/**
 * Emprises des murs de la salle. Les colliders (`layout.ts`) sont centrés sur les bords de `bounds` ;
 * pour le rendu, les angles sont refermés (les murs est/ouest vont jusqu'à l'extérieur du mur sud, les
 * extrémités extérieures du mur nord jusqu'à l'extérieur des murs du hall).
 */
export function archivesWalls(archives: ArchivesLayout): ArchivesWalls {
  const b = archives.room.bounds
  const half = WALL_THICKNESS / 2
  const doorMin = archives.door.x - archives.door.width / 2
  const doorMax = archives.door.x + archives.door.width / 2
  const north = archives.northWall.map((w) => ({
    ...w,
    // Extrémités extérieures (celles qui ne bordent pas la porte) : jusqu'à l'extérieur du mur du hall.
    minX: Math.abs(w.maxX - doorMin) < 1e-6 ? w.minX - half : w.minX,
    maxX: Math.abs(w.minX - doorMax) < 1e-6 ? w.maxX + half : w.maxX,
  }))
  return {
    north,
    south: { minX: b.minX - half, maxX: b.maxX + half, minZ: b.maxZ - half, maxZ: b.maxZ + half },
    east: { minX: b.maxX - half, maxX: b.maxX + half, minZ: b.minZ, maxZ: b.maxZ + half },
    west: { minX: b.minX - half, maxX: b.minX + half, minZ: b.minZ, maxZ: b.maxZ + half },
    doorway: { minX: doorMin, maxX: doorMax, minZ: b.minZ - half, maxZ: b.minZ + half },
  }
}

// --- Boîtes peintes ------------------------------------------------------------------------------

function paint(geo: BufferGeometry, hex: string, noise = 0): BufferGeometry {
  _color.set(hex)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    let f = 1
    if (noise > 0) {
      // Pseudo-aléatoire déterministe de la position du sommet (jamais `Math.random`) : géométrie stable.
      const raw = Math.sin(pos.getX(i) * 12.9898 + pos.getY(i) * 78.233 + pos.getZ(i) * 37.719) * 43758.5453
      f = 1 + ((raw - Math.floor(raw)) * 2 - 1) * noise
    }
    colors[i * 3] = Math.min(1, _color.r * f)
    colors[i * 3 + 1] = Math.min(1, _color.g * f)
    colors[i * 3 + 2] = Math.min(1, _color.b * f)
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

/** Boîte définie par ses bornes, peinte d'une couleur (avec, au besoin, un léger bruit par sommet). */
export function paintedBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, hex: string, noise = 0): BufferGeometry {
  const geo = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return paint(geo, hex, noise)
}

/** Un mur est « épais en X » (nord-sud) ou « épais en Z » (est-ouest) : l'axe mince reçoit les surplombs. */
function thinAxis(box: AABB): 'x' | 'z' {
  return box.maxX - box.minX <= box.maxZ - box.minZ ? 'x' : 'z'
}

/** `box` élargie de `grow` de chaque côté sur son axe mince (lambris, listel, plinthe, corniche). */
function grown(box: AABB, grow: number): AABB {
  return thinAxis(box) === 'x'
    ? { ...box, minX: box.minX - grow, maxX: box.maxX + grow }
    : { ...box, minZ: box.minZ - grow, maxZ: box.maxZ + grow }
}

/** `box` réduite de `shrink` de chaque côté sur son axe mince. */
function inset(box: AABB, shrink: number): AABB {
  return grown(box, -shrink)
}

function boxOf(b: AABB, y0: number, y1: number, hex: string, noise = 0): BufferGeometry {
  return paintedBox(b.minX, b.maxX, y0, y1, b.minZ, b.maxZ, hex, noise)
}

function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  if (!merged) throw new Error('Fusion de géométries impossible (attributs incompatibles)')
  return merged
}

// --- Murs ----------------------------------------------------------------------------------------

/** Base d'un mur : corps, plinthe, lambris, listel (et liseré d'accent si le mur est coupé en permanence). */
function wallBaseParts(box: AABB, cut: boolean): BufferGeometry[] {
  const parts = [
    boxOf(box, 0, WALL_LOW, room.wall, WALL_NOISE),
    boxOf(grown(box, PLINTH_PROTRUSION), 0, PLINTH_HEIGHT, room.plinth),
    boxOf(grown(box, TRIM_PROTRUSION), PLINTH_HEIGHT, WAINSCOT_HEIGHT, room.wainscot),
    boxOf(grown(box, TRIM_PROTRUSION), WAINSCOT_HEIGHT, WAINSCOT_HEIGHT + LISTEL_HEIGHT, room.listel),
  ]
  // Liseré posé sur le dessus, un peu plus large que le mur (même réglage que les murs coupés du musée).
  if (cut) parts.push(boxOf(grown(box, 0.025), WALL_LOW, WALL_LOW + CAP_HEIGHT, room.cap))
  return parts
}

/**
 * Sol de base de tous les murs (statique, un appel de dessin) : les quatre murs à la hauteur d'un mur
 * coupé. Le mur sud y a son liseré définitif ; celui des autres est la couronne (`buildCrownGeometry`).
 */
export function buildWallBaseGeometry(walls: ArchivesWalls): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (const box of walls.north) parts.push(...wallBaseParts(box, false))
  parts.push(...wallBaseParts(walls.south, true))
  parts.push(...wallBaseParts(walls.east, false))
  parts.push(...wallBaseParts(walls.west, false))
  return mergeAll(parts)
}

/**
 * Corps supérieur des murs donnés : boîtes de hauteur 1 (y de 0 à 1), à poser à `bodyBottom` et mettre
 * à l'échelle en Y de `bodyHeight` (voir `riseFrame`).
 */
export function buildUpperBodyGeometry(boxes: AABB[]): BufferGeometry {
  return mergeAll(boxes.map((b) => boxOf(inset(b, BODY_INSET), 0, 1, room.wall, WALL_NOISE)))
}

/**
 * Couronne des murs donnés : boîtes de hauteur 1 (y de 0 à 1), avec le surplomb de la corniche.
 * Liseré d'accent sur le mur coupé, corniche sur le mur haut (voir `riseFrame`).
 */
export function buildCrownGeometry(boxes: AABB[]): BufferGeometry {
  return mergeAll(boxes.map((b) => boxOf(grown(b, TRIM_PROTRUSION), 0, 1, room.cornice)))
}

// --- Mobilier fixe (bancs, pupitre) --------------------------------------------------------------

const BENCH_LENGTH = 1.3
const BENCH_DEPTH = 0.44
const BENCH_SEAT_TOP = 0.42
const BENCH_SEAT_THICKNESS = 0.08

/** Banc bas : assise claire sur deux pieds au bleu trait. Long axe le long de Z (contre un mur latéral). */
function benchParts(cx: number, cz: number): BufferGeometry[] {
  const halfL = BENCH_LENGTH / 2
  const halfD = BENCH_DEPTH / 2
  const legZ = 0.1
  return [
    paintedBox(cx - halfD, cx + halfD, BENCH_SEAT_TOP - BENCH_SEAT_THICKNESS, BENCH_SEAT_TOP, cz - halfL, cz + halfL, archivesCharter.bench),
    paintedBox(cx - halfD + 0.04, cx + halfD - 0.04, 0, BENCH_SEAT_TOP - BENCH_SEAT_THICKNESS, cz - halfL + 0.08, cz - halfL + 0.08 + legZ, charter3d.props.wood.trim),
    paintedBox(cx - halfD + 0.04, cx + halfD - 0.04, 0, BENCH_SEAT_TOP - BENCH_SEAT_THICKNESS, cz + halfL - 0.08 - legZ, cz + halfL - 0.08, charter3d.props.wood.trim),
  ]
}

/** Hauteur du pupitre (le bas du panneau incliné y est posé). */
export const LECTERN_HEIGHT = 0.72

/** Pupitre du panneau d'entrée : socle nuit, liseré cyan sur son bord haut. */
function lecternParts(archives: ArchivesLayout): BufferGeometry[] {
  const cx = archives.door.x + ENTRANCE_LECTERN.dx
  const cz = archives.room.bounds.minZ + ENTRANCE_LECTERN.dz
  const halfW = ENTRANCE_LECTERN.halfWidth - 0.05
  const halfD = ENTRANCE_LECTERN.halfDepth - 0.05
  return [
    paintedBox(cx - halfW, cx + halfW, 0, LECTERN_HEIGHT, cz - halfD, cz + halfD, archivesCharter.lectern),
    paintedBox(cx - halfW - 0.015, cx + halfW + 0.015, LECTERN_HEIGHT - 0.03, LECTERN_HEIGHT + 0.012, cz - halfD - 0.015, cz + halfD + 0.015, room.accent),
  ]
}

/** Mobilier statique de la salle (deux bancs contre les murs latéraux, près de la porte, et le pupitre). */
export function buildFurnitureGeometry(archives: ArchivesLayout): BufferGeometry {
  const b = archives.room.bounds
  const z = b.minZ + 3.2
  return mergeAll([...benchParts(b.minX + 1.0, z), ...benchParts(b.maxX - 1.0, z), ...lecternParts(archives)])
}

/** Base statique de la salle en un seul maillage : les quatre murs (à hauteur de mur coupé) et le mobilier fixe. */
export function buildShellGeometry(archives: ArchivesLayout): BufferGeometry {
  return mergeAll([buildWallBaseGeometry(archivesWalls(archives)), buildFurnitureGeometry(archives)])
}

// --- Panneaux muraux -----------------------------------------------------------------------------

const PANEL_WIDTH = 1.5
const PANEL_HEIGHT = 2.1
const PANEL_BOTTOM = 1.15
const FRAME_BORDER = 0.06
const FRAME_DEPTH = 0.045
const PANEL_DEPTH = 0.03

/** Positions (Z) des panneaux le long de chaque mur latéral. */
export function panelZs(archives: ArchivesLayout): number[] {
  const b = archives.room.bounds
  return [b.minZ + (b.maxZ - b.minZ) * 0.28, b.minZ + (b.maxZ - b.minZ) * 0.62]
}

/**
 * Écrans muraux : dalle nuit dans un liseré cyan, posés sur la face intérieure des murs est et ouest, au
 * -dessus du lambris. Le matériau (`archives.panel`) leur ajoute une faible émission cyan.
 */
export function buildPanelGeometry(archives: ArchivesLayout): BufferGeometry {
  const b = archives.room.bounds
  const face = WALL_THICKNESS / 2
  const parts: BufferGeometry[] = []
  for (const z of panelZs(archives)) {
    for (const side of [-1, 1] as const) {
      // side = -1 : mur ouest (face tournée vers +X) ; side = +1 : mur est (face tournée vers −X).
      const wallFace = side < 0 ? b.minX + face : b.maxX - face
      const inward = -side
      const span = (from: number, to: number): [number, number] => {
        const a = wallFace + inward * from
        const c = wallFace + inward * to
        return a < c ? [a, c] : [c, a]
      }
      const [fx0, fx1] = span(0, FRAME_DEPTH)
      const [px0, px1] = span(FRAME_DEPTH, FRAME_DEPTH + PANEL_DEPTH)
      parts.push(
        paintedBox(fx0, fx1, PANEL_BOTTOM - FRAME_BORDER, PANEL_BOTTOM + PANEL_HEIGHT + FRAME_BORDER, z - PANEL_WIDTH / 2 - FRAME_BORDER, z + PANEL_WIDTH / 2 + FRAME_BORDER, base.cyan),
        paintedBox(px0, px1, PANEL_BOTTOM, PANEL_BOTTOM + PANEL_HEIGHT, z - PANEL_WIDTH / 2, z + PANEL_WIDTH / 2, archivesCharter.panel.color),
      )
    }
  }
  return mergeAll(parts)
}

// --- Pilier d'angle ------------------------------------------------------------------------------

/** Pilier d'angle : fût blanc bleuté, pied sombre et bague cyan près du sommet. Origine au pied. */
export function buildPillarGeometry(): BufferGeometry {
  const shaft = new CylinderGeometry(0.24, 0.28, WALL_HEIGHT, 10)
  shaft.translate(0, WALL_HEIGHT / 2, 0)
  const foot = new CylinderGeometry(0.34, 0.36, PLINTH_HEIGHT, 10)
  foot.translate(0, PLINTH_HEIGHT / 2, 0)
  const ring = new CylinderGeometry(0.29, 0.29, 0.1, 10)
  ring.translate(0, WALL_HEIGHT - 0.7, 0)
  const capital = new CylinderGeometry(0.33, 0.25, 0.12, 10)
  capital.translate(0, WALL_HEIGHT - 0.06, 0)
  return mergeAll([paint(shaft, archivesCharter.pillar), paint(foot, room.plinth), paint(ring, room.accent), paint(capital, archivesCharter.pillar)])
}

// --- Linteau et bandeau de la porte --------------------------------------------------------------

/** Dimensions du bandeau « Les Archives de 2040 » (face +Z du linteau). */
export const BANNER_WIDTH = 3.1
export const BANNER_HEIGHT = 0.6
/** Bas du bandeau : juste au-dessus de la porte (le haut reste sous la corniche, qui commence à 3,94 m). */
const BANNER_BOTTOM = DOOR_HEIGHT + 0.08
export const BANNER_CENTER_Y = BANNER_BOTTOM + BANNER_HEIGHT / 2
