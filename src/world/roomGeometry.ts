/**
 * Géométrie statique fusionnée par salle (sol, murs, décor) : un seul appel de dessin par salle,
 * couleurs par sommet, matériau `MeshLambertMaterial` partagé (pas de texture). Les cimaises (cloisons
 * occultantes) sont volontairement EXCLUES d'ici : `buildOccluderGeometry` les construit à part, en
 * mesh séparé, pour pouvoir les estomper indépendamment (voir `occlusion.ts`, `Museum.tsx`).
 *
 * WEL-874 (chantier assets 3D) : les objets remplacés par de vrais modèles CC0 (bancs, jardinières,
 * colonnes, racks, bustes, tapis roulant, bras robotisé, bibliothèque…) ont été retirés d'ici — leurs
 * positions vivent maintenant dans `layout.ts` (`MuseumArchitecture.decorPlacements`, contrat documenté
 * en tête de ce fichier), pour que `src/world/props/RoomProps.tsx` y pose ses modèles. Reste procédural
 * ici, faute de remplacement CC0 net (voir `docs/assets/catalogue.md`) : la roue dentée et les câbles
 * (Infrastructures), le chevalet (Culture), le cordon du comptoir, l'Arbre des 100 et son banc circulaire,
 * le comptoir de Minerve.
 */
import { BoxGeometry, BufferGeometry, CapsuleGeometry, Color, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, Matrix4, PlaneGeometry, TorusGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { palette, wingThemes } from '../styles/tokens'
import { archBoxHeight, farWallX, type ArchBox, type DoorArch, type HallDecor } from './layout'
// Ré-exportée pour compatibilité : `farWallX` vit maintenant dans `layout.ts` (source de vérité des
// positions de décor, WEL-874) mais restait importée d'ici par d'autres modules en cours d'écriture
// dans ce worktree (ex. `src/world/props/placements.ts`, agent concurrent — voir le rapport final).
export { farWallX } from './layout'
import {
  CORNICE_HEIGHT,
  CORNICE_TOP_GAP,
  DOOR_ARCH_RADIUS,
  DOOR_ARCH_TUBE,
  HERRINGBONE_LEN,
  SOFTEN_CHECKER,
  TRIM_PROTRUSION,
  TREE_TOTAL_HEIGHT,
  TREE_TRUNK_HEIGHT,
  WAINSCOT_HEIGHT,
} from './constants'
import type { RoomLayout, Vec2 } from '../types'

const PLINTH_HEIGHT = 0.16
// Bande du linteau, juste sous le sommet du mur (dims.wallHeight) et au-dessus des panneaux de porte
// (posés à y = 3.3, voir Museum.tsx `doorPanelPosition`) pour ne pas se chevaucher avec eux.
const ARCH_BOTTOM_Y = 3.7
const ARCH_HEIGHT = 0.4
const _m = new Matrix4()
const _color = new Color()

function paint(geo: BufferGeometry, hex: string): BufferGeometry {
  _color.set(hex)
  const count = geo.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = _color.r
    colors[i * 3 + 1] = _color.g
    colors[i * 3 + 2] = _color.b
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

/**
 * Comme `paint`, mais avec une légère variation déterministe par sommet (bruit pseudo-aléatoire, fonction
 * pure de la position LOCALE de chaque sommet — jamais `Math.random()` : la géométrie reste testable et
 * stable d'un appel à l'autre). Casse l'aplat des grands murs unis (item 4, embellissement architecture)
 * sans coût supplémentaire (mêmes sommets, même appel de dessin).
 */
function paintNoisy(geo: BufferGeometry, hex: string, amount = 0.045): BufferGeometry {
  _color.set(hex)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const raw = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
    const jitter = (raw - Math.floor(raw)) * 2 - 1 // pseudo-aléatoire déterministe, [-1, 1]
    const f = 1 + jitter * amount
    colors[i * 3] = Math.min(1, Math.max(0, _color.r * f))
    colors[i * 3 + 1] = Math.min(1, Math.max(0, _color.g * f))
    colors[i * 3 + 2] = Math.min(1, Math.max(0, _color.b * f))
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

function box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, hex: string): BufferGeometry {
  const geo = new BoxGeometry(sx, sy, sz)
  paint(geo, hex)
  geo.applyMatrix4(_m.makeTranslation(cx, cy, cz))
  return geo
}

/** Comme `box`, avec un léger bruit de couleur par sommet (voir `paintNoisy`) — grands murs/sols unis. */
function boxNoisy(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, hex: string, amount?: number): BufferGeometry {
  const geo = new BoxGeometry(sx, sy, sz)
  paintNoisy(geo, hex, amount)
  geo.applyMatrix4(_m.makeTranslation(cx, cy, cz))
  return geo
}

const _brickA = new Color()
const _brickB = new Color()
const BRICK_WIDTH = 0.6
const BRICK_ROW_HEIGHT = 0.28

/** Mur à motif de briques (couleurs par sommet, deux tons alternés) — aile Industrialisation. */
function brickBox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, hexA: string, hexB: string): BufferGeometry {
  const geo = new BoxGeometry(sx, sy, sz)
  _brickA.set(hexA)
  _brickB.set(hexB)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const worldX = pos.getX(i) + cx
    const worldY = pos.getY(i) + cy
    const worldZ = pos.getZ(i) + cz
    const row = Math.floor(worldY / BRICK_ROW_HEIGHT)
    const offset = row % 2 === 0 ? 0 : BRICK_WIDTH / 2
    const col = Math.floor((worldX + worldZ + offset) / BRICK_WIDTH)
    const parity = (((row + col) % 2) + 2) % 2
    const c = parity === 0 ? _brickA : _brickB
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.translate(cx, cy, cz)
  return geo
}

/** Cylindre plein peint d'une couleur, posé (base à `baseY`), low-poly (`radialSegments`). */
function cylinder(cx: number, baseY: number, cz: number, radiusTop: number, radiusBottom: number, height: number, hex: string, radialSegments = 8): BufferGeometry {
  const geo = new CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
  paint(geo, hex)
  geo.translate(cx, baseY + height / 2, cz)
  return geo
}

/** Icosaèdre facetté (sphère low-poly), pour le feuillage et les têtes de bustes. */
function facetedSphere(cx: number, cy: number, cz: number, radius: number, hex: string): BufferGeometry {
  const geo = new IcosahedronGeometry(radius, 0)
  paint(geo, hex)
  geo.translate(cx, cy, cz)
  return geo
}

/** Segment reliant deux points au sol (cordon, câble) : cylindre fin couché, orienté a→b. */
function strut(a: Vec2, b: Vec2, y: number, radius: number, hex: string): BufferGeometry {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const length = Math.max(0.01, Math.hypot(dx, dz))
  const angle = Math.atan2(dx, dz)
  const geo = new CylinderGeometry(radius, radius, length, 6)
  paint(geo, hex)
  geo.rotateX(Math.PI / 2)
  geo.rotateY(angle)
  geo.translate((a.x + b.x) / 2, y, (a.z + b.z) / 2)
  return geo
}

/**
 * `mergeGeometries` exige que TOUTES les géométries soient indexées, ou qu'AUCUNE ne le soit — jamais
 * un mélange. Les primitives three.js ne sont pas cohérentes entre elles à ce sujet (`IcosahedronGeometry`
 * ne l'est pas, contrairement à `BoxGeometry`/`CylinderGeometry`/`CapsuleGeometry`/`TorusGeometry`) :
 * on uniformise toujours vers « non indexé » ici, une seule fois, plutôt que dans chaque helper.
 */
function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  const uniform = parts.map((p) => (p.index ? p.toNonIndexed() : p))
  const merged = mergeGeometries(uniform, false)
  merged.computeBoundingSphere()
  return merged
}

// --- Sols par salle --------------------------------------------------------

function floorBase(room: RoomLayout, segments: number): { geo: PlaneGeometry; cx: number; cz: number; w: number; d: number } {
  const w = room.bounds.maxX - room.bounds.minX
  const d = room.bounds.maxZ - room.bounds.minZ
  const cx = (room.bounds.minX + room.bounds.maxX) / 2
  const cz = (room.bounds.minZ + room.bounds.maxZ) / 2
  const geo = new PlaneGeometry(w, d, segments, segments)
  geo.rotateX(-Math.PI / 2)
  geo.translate(cx, 0, cz)
  return { geo, cx, cz, w, d }
}

/** Peint chaque sommet d'une géométrie de sol via `colorAt(xLocal, zLocal)` (coordonnées relatives au centre de la salle). */
function paintFloor(geo: PlaneGeometry, cx: number, cz: number, colorAt: (lx: number, lz: number) => Color): BufferGeometry {
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const c = colorAt(pos.getX(i) - cx, pos.getZ(i) - cz)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

const RUG_RADIUS = 3.2
const PATH_HALF_WIDTH = 1.15

/**
 * Sol du hall : parquet à chevrons fins (bandes de deux tons, alternées en diagonale pour l'effet
 * « point de Hongrie », voir `chevronBand`), grand tapis rond au centre, chemins de tapis à la couleur de
 * chaque aile menant à chaque porte (ouverte ou non — un chemin vers une aile « Bientôt » reste visible,
 * comme une promesse). Les trois portes sont toujours cardinales (voir `layout.ts`) : un simple test par
 * axe suffit, pas de projection générale.
 */
function hallFloor(room: RoomLayout): BufferGeometry {
  const { geo, cx, cz } = floorBase(room, 64)
  const plankA = new Color(room.floorColor)
  // Deuxième ton proche du premier : des lames lisibles sans effet de rayures « zèbre ».
  const plankB = new Color(room.floorColor).lerp(new Color(palette.woodDark), 0.3)
  const rug = new Color(palette.gold)
  const doors: Array<{ axis: 'x' | 'z'; sign: 1 | -1; color: string }> = [
    { axis: 'z', sign: -1, color: wingThemes.industrialisation.accent }, // porte nord
    { axis: 'x', sign: -1, color: wingThemes.infrastructures.accent }, // porte ouest
    { axis: 'x', sign: 1, color: wingThemes.culture.accent }, // porte est
  ]
  const doorColors = doors.map((d) => ({ ...d, c: new Color(d.color) }))

  return paintFloor(geo, cx, cz, (lx, lz) => {
    const r = Math.hypot(lx, lz)
    if (r < RUG_RADIUS) return rug
    for (const d of doorColors) {
      const along = (d.axis === 'x' ? lx : lz) * d.sign
      const across = d.axis === 'x' ? lz : lx
      if (along > RUG_RADIUS * 0.85 && Math.abs(across) < PATH_HALF_WIDTH) return d.c
    }
    return chevronBand(lx, lz) % 2 === 0 ? plankA : plankB
  })
}

/**
 * « Point de Hongrie » (chevrons) low-cost : la salle est découpée en cellules carrées de
 * `HERRINGBONE_LEN`, chaque cellule alternant l'orientation de ses lames (parité de `cellU + cellV`, en
 * coordonnées tournées à 45°) — deux lames voisines ne sont donc jamais parallèles, contrairement aux
 * lames droites de `PLANK_WIDTH` (aile) : c'est ce changement d'orientation, pas une vraie géométrie de
 * planches, qui lit comme des chevrons à la distance de jeu (caméra plongeante, voir DESIGN.md).
 */
function chevronBand(lx: number, lz: number): number {
  const diag = Math.SQRT1_2
  const u = (lx + lz) * diag
  const v = (lx - lz) * diag
  const cellU = Math.floor(u / HERRINGBONE_LEN)
  const cellV = Math.floor(v / HERRINGBONE_LEN)
  const cellParity = (((cellU + cellV) % 2) + 2) % 2
  const along = cellParity === 0 ? u : v
  return Math.floor(along / (HERRINGBONE_LEN / 2))
}

/** Damier de pierre adouci (aile Infrastructures : salle des machines) : tons rapprochés, jamais d'« effet zèbre ». */
function checkerFloor(room: RoomLayout, colorA: string, colorB: string, cell: number): BufferGeometry {
  const { geo, cx, cz } = floorBase(room, 24)
  const mid = new Color(colorA).lerp(new Color(colorB), 0.5)
  const a = new Color(colorA).lerp(mid, SOFTEN_CHECKER)
  const b = new Color(colorB).lerp(mid, SOFTEN_CHECKER)
  return paintFloor(geo, cx, cz, (lx, lz) => {
    const ix = Math.floor(lx / cell)
    const iz = Math.floor(lz / cell)
    const parity = (((ix + iz) % 2) + 2) % 2
    return parity === 0 ? a : b
  })
}

/** Carrelage terre cuite (aile Industrialisation : atelier sous verrière) — même principe, tons chauds. */
function terracottaFloor(room: RoomLayout, colorA: string, colorB: string, cell: number): BufferGeometry {
  return checkerFloor(room, colorA, colorB, cell)
}

/** Moquette unie avec bordure (aile Culture : galerie d'art). */
function moquetteFloor(room: RoomLayout, base: string, border: string, borderWidth: number): BufferGeometry {
  const { geo, cx, cz } = floorBase(room, 24)
  const b = new Color(base)
  const bd = new Color(border)
  const halfW = (room.bounds.maxX - room.bounds.minX) / 2
  const halfD = (room.bounds.maxZ - room.bounds.minZ) / 2
  return paintFloor(geo, cx, cz, (lx, lz) => {
    const nearEdge = halfW - Math.abs(lx) < borderWidth || halfD - Math.abs(lz) < borderWidth
    return nearEdge ? bd : b
  })
}

function wingFloor(room: RoomLayout): BufferGeometry {
  switch (room.id) {
    case 'infrastructures':
      return checkerFloor(room, room.floorColor, palette.inkSoft, 1.4)
    case 'industrialisation':
      return terracottaFloor(room, room.floorColor, palette.woodDark, 1.6)
    case 'culture':
      return moquetteFloor(room, room.floorColor, room.accentColor, 1.0)
    default: {
      // N'arrive jamais en pratique (le hall a son propre `hallFloor`, appelé avant celui-ci) : sol
      // uni de secours, pour rester exhaustif sur `WingId` sans dupliquer `floorBase`.
      const { geo, cx, cz } = floorBase(room, 8)
      return paintFloor(geo, cx, cz, () => new Color(room.floorColor))
    }
  }
}

// --- Décor propre à chaque aile (reliefs muraux, jamais dans le couloir de vue) ----------------
//
// WEL-874 : les racks, la roue dentée ~~non~~ (gardée, voir ci-dessous), le tapis roulant, le bras
// robotisé, les bustes et la bibliothèque ont été remplacés par des `decorPlacements` (`layout.ts`,
// module props). Reste ici, faute de modèle CC0 net (voir `docs/assets/catalogue.md`) : la roue dentée
// et les câbles (Infrastructures — le modèle du catalogue ne fait que les compléter, pas les remplacer)
// et le chevalet (Culture — « aucun remplacement CC0 identifié »).

/**
 * Reliefs décoratifs d'une aile, fusionnés dans SA géométrie de salle (même matériau, aucun appel de
 * dessin supplémentaire). Toujours plaqués contre le mur du fond (jamais dans le couloir de vue ni
 * sur un viewPoint) : ce ne sont pas des obstacles de gameplay (pas de collider), juste du décor.
 */
function wingSignatureDecor(room: RoomLayout): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const halfW = (room.bounds.maxX - room.bounds.minX) / 2
  const halfD = (room.bounds.maxZ - room.bounds.minZ) / 2
  const cx = (room.bounds.minX + room.bounds.maxX) / 2
  const cz = (room.bounds.minZ + room.bounds.maxZ) / 2

  if (room.id === 'infrastructures') {
    const wallX = farWallX(room, 0.32)
    // Grande roue dentée : disque plaqué au mur du fond (face dans le plan Y/Z) + dents radiales.
    const gearZ = cz - halfD + 1.2
    const gearY = 2.3
    const gearR = 0.75
    const gearX = wallX - 0.1
    const gearDisc = new CylinderGeometry(gearR, gearR, 0.12, 10)
    paint(gearDisc, room.wallColor)
    gearDisc.rotateZ(Math.PI / 2) // axe du cylindre : Y → X, la face circulaire regarde vers +X/-X
    gearDisc.translate(gearX, gearY, gearZ)
    parts.push(gearDisc)
    const toothCount = 8
    for (let t = 0; t < toothCount; t++) {
      const a = (t / toothCount) * Math.PI * 2
      const tooth = box(0, 0, gearR + 0.09, 0.1, 0.18, 0.18, room.accentColor)
      tooth.rotateX(a) // la roue est plaquée au mur, dans le plan (Y, Z) : on tourne autour de X
      tooth.translate(gearX, gearY, gearZ)
      parts.push(tooth)
    }
    // Chemins de câbles au sol, le long du couloir principal (purement décoratif, pas de collider).
    const cableY = 0.012
    parts.push(strut({ x: cx - halfW + 0.6, z: cz }, { x: cx + halfW - 0.6, z: cz }, cableY, 0.05, palette.inkSoft))
    parts.push(strut({ x: cx - halfW + 0.6, z: cz - 0.3 }, { x: cx + halfW - 0.6, z: cz - 0.3 }, cableY, 0.04, room.accentColor))
  } else if (room.id === 'culture') {
    // Chevalet, plaqué contre le mur du fond (aucun modèle CC0 trouvé pour ce rôle, voir catalogue).
    const wallX = farWallX(room, 0.4)
    const easelX = wallX - 1.1
    parts.push(box(easelX - 0.2, 0.55, 1.0, 0.06, 1.1, 0.06, palette.woodDark))
    parts.push(box(easelX + 0.2, 0.55, 1.0, 0.06, 1.1, 0.06, palette.woodDark))
    parts.push(box(easelX, 0.9, 1.0, 0.7, 0.5, 0.04, palette.cream))
  }
  return parts
}

/** Fusionne le sol, les murs (coupés côté caméra) et le décor d'une salle en une seule géométrie. */
export function buildRoomGeometry(room: RoomLayout, walls: ArchBox[], decor?: HallDecor): BufferGeometry {
  const parts: BufferGeometry[] = [decor ? hallFloor(room) : wingFloor(room)]
  const trimColor = wingThemes[room.id].trim

  for (const w of walls) {
    if (w.hidden) continue // collider seulement : une géométrie dédiée le dessine (voir buildHallDecorGeometry)
    const cx = (w.box.minX + w.box.maxX) / 2
    const cz = (w.box.minZ + w.box.maxZ) / 2
    const sx = w.box.maxX - w.box.minX
    const sz = w.box.maxZ - w.box.minZ
    const height = archBoxHeight(w)
    if (w.kind === 'wall') {
      // Aile Industrialisation (atelier sous verrière) : murs à motif de briques, jamais côté caméra
      // (le mur coupé à 1 m resterait illisible à cette hauteur, autant garder l'aplat).
      const brick = room.id === 'industrialisation' && !w.cut
      parts.push(brick ? brickBox(cx, height / 2, cz, sx, height, sz, room.wallColor, palette.woodDark) : boxNoisy(cx, height / 2, cz, sx, height, sz, room.wallColor))
      // Plinthe : léger surplomb sombre en pied de mur, même coupé.
      parts.push(box(cx, PLINTH_HEIGHT / 2, cz, sx + 0.05, PLINTH_HEIGHT, sz + 0.05, palette.woodDark))
      // Lambris bas + corniche en haut : seulement sur les murs pleins (un mur « coupé », côté caméra,
      // n'a que ~1 m de haut — pas la place pour les deux bandes sans se chevaucher, voir CAMERA_CUT_HEIGHT).
      if (!w.cut) parts.push(...wainscotAndCornice(cx, cz, sx, sz, height, trimColor))
    } else {
      // Pavé générique de secours : un meuble sans géométrie dédiée reste visible et à la bonne
      // hauteur (`archBoxHeight`), plutôt que silencieusement invisible.
      parts.push(box(cx, height / 2, cz, sx, height, sz, room.accentColor))
    }
  }

  if (decor) parts.push(...buildHallDecorGeometry(decor))
  else parts.push(...wingSignatureDecor(room))

  return mergeAll(parts)
}

/**
 * Lambris bas (bande sombre, hauteur `WAINSCOT_HEIGHT`) et corniche (bande claire, juste sous le
 * plafond) : léger surplomb (`TRIM_PROTRUSION`) sur la face intérieure du mur pour rester visibles
 * malgré `flatShading` (item 4, embellissement architecture — voir docs/DESIGN.md). Le surplomb ne
 * s'ajoute qu'à l'axe « épaisseur » du mur (le plus petit de `sx`/`sz`), jamais à sa longueur.
 */
function wainscotAndCornice(cx: number, cz: number, sx: number, sz: number, wallHeight: number, trimColor: string): BufferGeometry[] {
  const growX = sx <= sz ? TRIM_PROTRUSION * 2 : 0
  const growZ = sz < sx ? TRIM_PROTRUSION * 2 : 0
  const wSx = sx + growX
  const wSz = sz + growZ
  const wainscot = box(cx, WAINSCOT_HEIGHT / 2, cz, wSx, WAINSCOT_HEIGHT, wSz, palette.woodDark)
  const corniceY = wallHeight - CORNICE_TOP_GAP - CORNICE_HEIGHT / 2
  const cornice = box(cx, corniceY, cz, wSx, CORNICE_HEIGHT, wSz, trimColor)
  return [wainscot, cornice]
}

// --- Décor du hall (comptoir, arbre) --------------------------------------------------------

function counterGeometry(center: Vec2, halfWidth: number, halfDepth: number): BufferGeometry[] {
  const height = 0.95
  const bodyLength = Math.max(0.2, 2 * halfWidth - 2 * halfDepth)
  const body = new CapsuleGeometry(halfDepth, bodyLength, 4, 10)
  paint(body, palette.wood)
  body.rotateZ(Math.PI / 2)
  body.translate(center.x, height / 2, center.z)

  const top = new CapsuleGeometry(halfDepth * 1.18, bodyLength, 4, 10)
  paint(top, palette.woodDark)
  top.rotateZ(Math.PI / 2)
  top.scale(1, 0.1, 1)
  top.translate(center.x, height + 0.04, center.z)

  // Petite sonnette dorée, posée sur le plateau côté joueur (sud).
  const bell = cylinder(center.x + halfWidth * 0.55, height + 0.08, center.z + halfDepth * 0.5, 0.05, 0.07, 0.07, palette.gold, 8)

  return [body, top, bell]
}

function treeGeometry(center: Vec2): BufferGeometry[] {
  const trunk = new CylinderGeometry(0.16, 0.26, TREE_TRUNK_HEIGHT, 7)
  paint(trunk, palette.woodDark)
  // Léger tortillement : cisaille progressivement le tronc selon la hauteur (facettes, pas lisse).
  const pos = trunk.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + TREE_TRUNK_HEIGHT / 2
    const twist = (y / TREE_TRUNK_HEIGHT) * 0.35
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setX(i, x * Math.cos(twist) - z * Math.sin(twist))
    pos.setZ(i, x * Math.sin(twist) + z * Math.cos(twist))
  }
  pos.needsUpdate = true
  trunk.computeVertexNormals()
  trunk.translate(center.x, TREE_TRUNK_HEIGHT / 2, center.z)

  const canopyY = TREE_TRUNK_HEIGHT
  const foliage = [
    facetedSphere(center.x, canopyY + 0.5, center.z, 1.1, palette.leaf),
    facetedSphere(center.x + 0.7, canopyY + 0.15, center.z + 0.3, 0.75, palette.leafDark),
    facetedSphere(center.x - 0.75, canopyY + 0.25, center.z - 0.2, 0.7, palette.leafDark),
    facetedSphere(center.x + 0.1, canopyY + (TREE_TOTAL_HEIGHT - TREE_TRUNK_HEIGHT), center.z - 0.1, 0.6, palette.gold),
  ]
  return [trunk, ...foliage]
}

function treeBenchGeometry(center: Vec2, radius: number, height: number): BufferGeometry {
  const ring = new TorusGeometry(radius, 0.14, 6, 20)
  paint(ring, palette.wood)
  ring.rotateX(Math.PI / 2)
  ring.translate(center.x, height, center.z)
  return ring
}

/** Cordons à potelets dorés devant le comptoir de Minerve — purement décoratif, aucun collider. */
const ROPE_COLOR = '#7a2f3f'
function velvetRopeGeometry(postPositions: Vec2[], y = 0.55): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  for (const p of postPositions) {
    parts.push(cylinder(p.x, 0, p.z, 0.045, 0.05, y, palette.gold, 8))
    parts.push(facetedSphere(p.x, y + 0.04, p.z, 0.06, palette.gold))
  }
  for (let i = 1; i < postPositions.length; i++) parts.push(strut(postPositions[i - 1], postPositions[i], y - 0.05, 0.03, ROPE_COLOR))
  return parts
}

function buildHallDecorGeometry(decor: HallDecor): BufferGeometry[] {
  // Colonnes, bancs et jardinières : voir `docs/assets/catalogue.md` et `layout.ts` (`decorPlacements`,
  // module props) — remplacés par de vrais modèles CC0, retirés d'ici (WEL-874).
  const parts: BufferGeometry[] = []
  parts.push(...counterGeometry(decor.counter.center, decor.counter.halfWidth, decor.counter.halfDepth))
  parts.push(...treeGeometry(decor.tree.center))
  parts.push(treeBenchGeometry(decor.tree.center, decor.tree.benchRadius, 0.46))
  // Cordons devant le comptoir : un potelet de chaque côté de la façade, côté joueur (sud).
  const ropeZ = decor.counter.center.z + decor.counter.halfDepth + 0.5
  parts.push(...velvetRopeGeometry([{ x: decor.counter.center.x - decor.counter.halfWidth - 0.2, z: ropeZ }, { x: decor.counter.center.x + decor.counter.halfWidth + 0.2, z: ropeZ }]))
  return parts
}

/** Barrière décorative (cordon) devant une aile « Bientôt » — même famille visuelle, aucun collider (le mur reste plein). */
export function buildComingSoonBarrierGeometry(center: Vec2, rotationY: number, span = 1.6): BufferGeometry {
  const facing = { x: Math.sin(rotationY), z: Math.cos(rotationY) }
  const side = { x: Math.cos(rotationY), z: -Math.sin(rotationY) }
  const a: Vec2 = { x: center.x + side.x * span * 0.5 + facing.x * 0.4, z: center.z + side.z * span * 0.5 + facing.z * 0.4 }
  const b: Vec2 = { x: center.x - side.x * span * 0.5 + facing.x * 0.4, z: center.z - side.z * span * 0.5 + facing.z * 0.4 }
  return mergeAll(velvetRopeGeometry([a, b], 0.5))
}

/** Cimaise / cloison occultante : mesh séparé (voir `Occluder`, `occlusion.ts`), fondu en `useFrame`. */
export function buildOccluderGeometry(footprint: { minX: number; maxX: number; minZ: number; maxZ: number }, height: number, wallColor: string): BufferGeometry {
  const cx = (footprint.minX + footprint.maxX) / 2
  const cz = (footprint.minZ + footprint.maxZ) / 2
  const sx = footprint.maxX - footprint.minX
  const sz = footprint.maxZ - footprint.minZ
  const parts = [box(cx, height / 2, cz, sx, height, sz, wallColor), box(cx, PLINTH_HEIGHT / 2, cz, sx + 0.05, PLINTH_HEIGHT, sz + 0.05, palette.woodDark)]
  return mergeAll(parts)
}

/**
 * Demi-cercle décoratif au-dessus d'un linteau de porte (« arche arrondie », item 4). `TorusGeometry`
 * sans rotation trace son anneau dans le plan XY local (confirmé par `treeBenchGeometry` : un
 * `rotateX(π/2)` le couche à plat au sol — donc, SANS rotation, il est déjà vertical) ; avec
 * `arc = π`, il balaie de +X (θ = 0) à +Y (θ = π/2, le sommet) puis −X (θ = π) : exactement le demi-
 * cercle du haut, centré sur `(cx, y, cz)`. `axis = 'z'` (portes ouest/est, largeur le long de Z) tourne
 * cet anneau de 90° autour de Y pour aligner son axe « largeur » (local X) sur Z — la hauteur (Y) n'est
 * pas affectée par une rotation autour de Y.
 */
function doorArchCurve(cx: number, cz: number, axis: 'x' | 'z', y: number, hex: string): BufferGeometry {
  const geo = new TorusGeometry(DOOR_ARCH_RADIUS, DOOR_ARCH_TUBE, 6, 16, Math.PI)
  if (axis === 'z') geo.rotateY(Math.PI / 2)
  paint(geo, hex)
  geo.translate(cx, y, cz)
  return geo
}

/** Linteaux des portes ouvertes, à la couleur de chaque aile (« arches des portes ») — une seule géométrie fusionnée, `null` si aucune porte n'est ouverte. */
export function buildDoorArchesGeometry(arches: DoorArch[]): BufferGeometry | null {
  if (arches.length === 0) return null
  const parts = arches.flatMap(({ box: b, color }) => {
    const cx = (b.minX + b.maxX) / 2
    const cz = (b.minZ + b.maxZ) / 2
    const sx = b.maxX - b.minX
    const sz = b.maxZ - b.minZ
    const axis: 'x' | 'z' = sx >= sz ? 'x' : 'z' // porte nord (large en X) vs ouest/est (large en Z)
    return [box(cx, ARCH_BOTTOM_Y + ARCH_HEIGHT / 2, cz, sx, ARCH_HEIGHT, sz, color), doorArchCurve(cx, cz, axis, ARCH_BOTTOM_Y, color)]
  })
  return mergeAll(parts)
}

/**
 * Rayons de lumière suggérant une verrière : quelques fins plans additifs, près du plafond, fusionnés
 * en un seul appel. Fins (`RAY_WIDTH`) et espacés (`radius`) pour ne jamais se chevaucher entre eux
 * (l'« additive blending » accumule sinon leur opacité) ni recouvrir la bannière du hall : hauts
 * (`RAY_Y`, proches du plafond à `dims.wallHeight`) et peu opaques (mission : lumière chaleureuse
 * suggérée, jamais un aplat qui masque le décor — voir docs/DESIGN.md, « musée cosy »).
 */
const RAY_WIDTH = 0.5
const RAY_LENGTH = 4.5
const RAY_Y = 4.8
const RAY_OPACITY_HINT = '#fff6d8' // couleur peinte ici ; l'opacité elle-même est réglée côté matériau (Museum.tsx)
export function buildLightRaysGeometry(center: Vec2, count = 4, radius = 6): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / count // décalé : jamais aligné sur les portes/la bannière
    const x = center.x + Math.cos(angle) * radius
    const z = center.z + Math.sin(angle) * radius
    const geo = new PlaneGeometry(RAY_WIDTH, RAY_LENGTH)
    geo.rotateX(-Math.PI / 2.6)
    geo.rotateY(angle)
    geo.translate(x, RAY_Y, z)
    paint(geo, RAY_OPACITY_HINT)
    parts.push(geo)
  }
  return mergeAll(parts)
}
