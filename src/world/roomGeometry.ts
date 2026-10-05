/**
 * Géométrie statique fusionnée par salle (murs, décor, tapis et chemins du hall) : un seul appel de dessin
 * par salle, couleurs par sommet, matériau `MeshLambertMaterial` partagé (pas de texture). Le sol de fond
 * (parquet du hall, damiers, moquette) est une géométrie à part (`buildFloorGeometry`, WEL-923) : il porte une
 * matière (marbre, terrazzo, microciment, moquette) par UV en coordonnées monde, donc son propre matériau —
 * un appel de dessin de plus par salle, en échange de sols texturés. Toutes les couleurs
 * viennent de `charter3d` (`src/styles/tokens.ts`, table dans `docs/CHARTE-3D.md`) : aucune couleur en
 * dur ici, aucune matière chaude. Les cimaises (cloisons
 * occultantes) sont volontairement EXCLUES d'ici : `buildOccluderGeometry` les construit à part, en
 * mesh séparé, pour pouvoir les estomper indépendamment (voir `occlusion.ts`, `Museum.tsx`).
 *
 * WEL-874 (chantier assets 3D) : les objets remplacés par de vrais modèles CC0 (bancs, jardinières,
 * colonnes, racks, bustes, tapis roulant, bras robotisé, bibliothèque…) ont été retirés d'ici — leurs
 * positions vivent maintenant dans `layout.ts` (`MuseumArchitecture.decorPlacements`, contrat documenté
 * en tête de ce fichier), pour que `src/world/props/RoomProps.tsx` y pose ses modèles. Reste procédural
 * ici, faute de remplacement CC0 net (voir `docs/assets/catalogue.md`) : la roue dentée et les câbles
 * (Infrastructures), le chevalet (Culture), le cordon du comptoir, l'Arbre des 100 et son banc circulaire,
 * le comptoir d'accueil.
 */
import { BoxGeometry, BufferGeometry, CapsuleGeometry, CircleGeometry, Color, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, Matrix4, PlaneGeometry, TorusGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { charter3d, type RoomCharter } from '../styles/tokens'
import { discBars } from '../ui/OdysseeLogo'
import { archBoxHeight, farWallX, type ArchBox, type DoorArch, type HallDecor } from './layout'
import { FLOOR_SPECS, ROOM_FLOOR_KIND, worldUv } from './floorSpec'
// Ré-exportée pour compatibilité : `farWallX` vit maintenant dans `layout.ts` (source de vérité des
// positions de décor, WEL-874) mais restait importée d'ici par d'autres modules en cours d'écriture
// dans ce worktree (ex. `src/world/props/placements.ts`, agent concurrent — voir le rapport final).
export { farWallX } from './layout'
import {
  CAP_HEIGHT,
  CORNICE_HEIGHT,
  CORNICE_TOP_GAP,
  DOOR_ARCH_RADIUS,
  DOOR_ARCH_TUBE,
  HERRINGBONE_LEN,
  LISTEL_HEIGHT,
  SOFTEN_CHECKER,
  TRIM_PROTRUSION,
  TREE_TOTAL_HEIGHT,
  TREE_TRUNK_HEIGHT,
  WAINSCOT_HEIGHT,
} from './constants'
import type { RoomLayout, Vec2 } from '../types'

const PLINTH_HEIGHT = 0.16
/** Variation de valeur par sommet des grands murs unis (voir `paintNoisy`) : discrète, la teinte reste celle de la charte. */
const WALL_NOISE = 0.03
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

/** Remplace les UV d'une géométrie de sol par des UV en coordonnées monde (`x / tile`, `z / tile`). */
function setWorldUv(geo: BufferGeometry, tileMeters: number): BufferGeometry {
  const pos = geo.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const [u, v] = worldUv(pos.getX(i), pos.getZ(i), tileMeters)
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return geo
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

/** Rayon du tapis rond du hall : le disque en scanlines du logo (`discBars()`), mis à l'échelle. */
export const RUG_RADIUS = 3.2
const PATH_HALF_WIDTH = 1.15
/** Largeur du liseré blanc qui borde chaque chemin de tapis (`charter3d.hallFloor.pathEdge`). */
const PATH_EDGE_WIDTH = 0.06
/**
 * Étagement des motifs posés sur le sol du hall (mètres) : chemins < liserés < fond du tapis < barres.
 * Quelques millimètres suffisent (le zbuffer à 24 bits résout ≈ 0,3 mm à 20 m) ; le tapis passe AU-DESSUS
 * des chemins, qui semblent donc partir de dessous lui.
 */
const PATH_Y = 0.004
const PATH_EDGE_Y = 0.007
const RUG_Y = 0.01
const RUG_BAR_Y = 0.013
/** Rayon du disque dans le viewBox du logo (`discBars()` : R = 44, centre (62, 50)). */
const LOGO_R = 44
const LOGO_CX = 62
const LOGO_CY = 50

/** Rectangle horizontal à couleur unie, posé à la hauteur `y` (sol, tapis, chemin, liseré). */
interface FloorQuad {
  x0: number
  x1: number
  z0: number
  z1: number
  y: number
  color: Color
}

/**
 * Rectangles horizontaux à couleur unie, en géométrie non indexée (normale +Y). Les motifs de sol de la
 * charte (damier, moquette et bordure, chemins, barres du logo) ont des arêtes franches : la coloration par
 * sommet d'un plan subdivisé les faisait baver d'une cellule sur l'autre (lu sur les captures). Avec
 * `tileMeters`, les UV sont les coordonnées monde divisées par la taille du motif de la matière (sols texturés).
 */
function flatQuads(quads: FloorQuad[], tileMeters?: number): BufferGeometry {
  const position = new Float32Array(quads.length * 18)
  const normal = new Float32Array(quads.length * 18)
  const uv = new Float32Array(quads.length * 12)
  const color = new Float32Array(quads.length * 18)
  quads.forEach((q, i) => {
    // Deux triangles, sens trigonométrique vu de dessus (face avant = +Y).
    const corners = [q.x0, q.z0, q.x0, q.z1, q.x1, q.z1, q.x0, q.z0, q.x1, q.z1, q.x1, q.z0]
    for (let v = 0; v < 6; v++) {
      const o = i * 18 + v * 3
      position[o] = corners[v * 2]
      position[o + 1] = q.y
      position[o + 2] = corners[v * 2 + 1]
      normal[o + 1] = 1
      color[o] = q.color.r
      color[o + 1] = q.color.g
      color[o + 2] = q.color.b
      if (tileMeters === undefined) {
        uv[i * 12 + v * 2] = corners[v * 2] === q.x0 ? 0 : 1
        uv[i * 12 + v * 2 + 1] = corners[v * 2 + 1] === q.z0 ? 0 : 1
      } else {
        // Sol texturé : UV en coordonnées monde, la matière continue d'un quad au suivant.
        const [u, w] = worldUv(corners[v * 2], corners[v * 2 + 1], tileMeters)
        uv[i * 12 + v * 2] = u
        uv[i * 12 + v * 2 + 1] = w
      }
    }
  })
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(position, 3))
  geo.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geo.setAttribute('color', new Float32BufferAttribute(color, 3))
  return geo
}

/**
 * Sol du hall : parquet à chevrons fins (deux bleus proches, alternés en diagonale pour l'effet « point de
 * Hongrie », voir `chevronBand`), disque central en scanlines (le logo de l'Odyssée, voir `hallRug`) et
 * chemins de tapis à la couleur de chaque aile menant à chaque porte (ouverte ou non — un chemin vers une
 * aile « Bientôt » reste visible, comme une promesse), y compris la porte sud des Archives (voir `hallPaths`).
 * Le parquet (`hallParquet`, marbre, UV monde) est une géométrie à part ; disque et chemins sont des quads
 * francs, sans matière (nets et lisibles), qui restent dans la géométrie de la salle et se posent dessus.
 */
function hallFloor(room: RoomLayout): BufferGeometry[] {
  const cx = (room.bounds.minX + room.bounds.maxX) / 2
  const cz = (room.bounds.minZ + room.bounds.maxZ) / 2
  return [...hallPaths(room), ...hallRug(cx, cz)]
}

/** Parquet à chevrons du hall, peint par sommet (deux tons voisins : le flou n'y nuit pas), UV monde. */
function hallParquet(room: RoomLayout): BufferGeometry {
  const { geo, cx, cz } = floorBase(room, 64)
  const { floor, floorAlt } = charter3d.rooms.hall
  const plankA = new Color(floor)
  const plankB = new Color(floorAlt)
  paintFloor(geo, cx, cz, (lx, lz) => (chevronBand(lx, lz) % 2 === 0 ? plankA : plankB))
  return setWorldUv(geo, FLOOR_SPECS[ROOM_FLOOR_KIND.hall].tileMeters)
}

/** Les quatre chemins du hall : un par porte, couleur de l'aile (`hallFloor.path`), liseré blanc de chaque côté. */
function hallPaths(room: RoomLayout): BufferGeometry[] {
  const { path, pathEdge } = charter3d.hallFloor
  const cx = (room.bounds.minX + room.bounds.maxX) / 2
  const cz = (room.bounds.minZ + room.bounds.maxZ) / 2
  const halfW = (room.bounds.maxX - room.bounds.minX) / 2
  const halfD = (room.bounds.maxZ - room.bounds.minZ) / 2
  // Trois portes cardinales d'ailes + la porte sud des Archives (`archivesDoor`, sur l'axe x = 0).
  const doors: Array<{ axis: 'x' | 'z'; sign: 1 | -1; color: string }> = [
    { axis: 'z', sign: -1, color: path.industrialisation }, // porte nord
    { axis: 'x', sign: -1, color: path.infrastructures }, // porte ouest
    { axis: 'x', sign: 1, color: path.culture }, // porte est
    { axis: 'z', sign: 1, color: path.archives }, // porte sud
  ]
  const edge = new Color(pathEdge)
  const quads: FloorQuad[] = []
  for (const d of doors) {
    const from = RUG_RADIUS * 0.8 // recouvert par le tapis rond : le chemin en sort sans jonction visible
    const to = d.axis === 'x' ? halfW : halfD // jusqu'à l'axe du mur : le seuil de la porte est couvert
    const a = Math.min(from * d.sign, to * d.sign)
    const b = Math.max(from * d.sign, to * d.sign)
    const along = (lo: number, hi: number, across0: number, across1: number, y: number, color: Color): FloorQuad =>
      d.axis === 'x' ? { x0: cx + lo, x1: cx + hi, z0: cz + across0, z1: cz + across1, y, color } : { x0: cx + across0, x1: cx + across1, z0: cz + lo, z1: cz + hi, y, color }
    quads.push(along(a, b, -PATH_HALF_WIDTH, PATH_HALF_WIDTH, PATH_Y, new Color(d.color)))
    quads.push(along(a, b, -PATH_HALF_WIDTH, -PATH_HALF_WIDTH + PATH_EDGE_WIDTH, PATH_EDGE_Y, edge))
    quads.push(along(a, b, PATH_HALF_WIDTH - PATH_EDGE_WIDTH, PATH_HALF_WIDTH, PATH_EDGE_Y, edge))
  }
  return [flatQuads(quads)]
}

/**
 * Tapis rond du hall = le disque du logo : fond nuit, puis les barres de `discBars()` (blanches, les trois
 * barres corail en `rugBarAccent`), mises à l'échelle de `RUG_RADIUS`. Chaque barre est rognée au disque
 * (le logo en laisse déborder à gauche) ; les tirets qui fuient à gauche tombent alors hors du disque et
 * disparaissent (ils recouvriraient le chemin ouest). Sens du logo conservé : vu de la caméra, le haut du
 * disque est au nord.
 */
function hallRug(cx: number, cz: number): BufferGeometry[] {
  const { rugBacking, rugBar, rugBarAccent } = charter3d.hallFloor
  const backing = new CircleGeometry(RUG_RADIUS, 48)
  backing.rotateX(-Math.PI / 2)
  paint(backing, rugBacking)
  backing.translate(cx, RUG_Y, cz)

  const s = RUG_RADIUS / LOGO_R
  const white = new Color(rugBar)
  const accent = new Color(rugBarAccent)
  const bars: FloorQuad[] = []
  for (const b of discBars()) {
    // Corde du disque au bord le plus éloigné de la barre : ses quatre coins restent dans le disque (au
    // milieu du logo l'écart est nul ; aux rangées extrêmes le bout rentre de ≤ 1 unité de logo).
    const dyFar = Math.abs(b.y + b.height / 2 - LOGO_CY) + b.height / 2
    const half = Math.sqrt(Math.max(0, LOGO_R * LOGO_R - dyFar * dyFar))
    const x0 = Math.max(b.x, LOGO_CX - half)
    const x1 = Math.min(b.x + b.width, LOGO_CX + half)
    if (x1 - x0 < 0.5) continue // tiret hors du disque : ignoré
    bars.push({
      x0: cx + (x0 - LOGO_CX) * s,
      x1: cx + (x1 - LOGO_CX) * s,
      z0: cz + (b.y - LOGO_CY) * s,
      z1: cz + (b.y + b.height - LOGO_CY) * s,
      y: RUG_BAR_Y,
      color: b.coral ? accent : white,
    })
  }
  return [backing, flatQuads(bars)]
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

/**
 * Damier (aile Infrastructures : salle des machines ; aile Industrialisation : atelier) : cellules franches de
 * `cell` mètres, centrées sur la salle, deux tons voisins de la charte (`floor` / `floorAlt`). Les cellules du
 * bord sont rognées à l'emprise de la salle. Jamais d'« effet zèbre » : les tons sont rapprochés.
 */
function checkerFloor(room: RoomLayout, colorA: string, colorB: string, cell: number, tileMeters: number): BufferGeometry {
  const { minX, maxX, minZ, maxZ } = room.bounds
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const mid = new Color(colorA).lerp(new Color(colorB), 0.5)
  const a = new Color(colorA).lerp(mid, SOFTEN_CHECKER)
  const b = new Color(colorB).lerp(mid, SOFTEN_CHECKER)
  const quads: FloorQuad[] = []
  for (let ix = Math.floor((minX - cx) / cell); ix < Math.ceil((maxX - cx) / cell); ix++) {
    for (let iz = Math.floor((minZ - cz) / cell); iz < Math.ceil((maxZ - cz) / cell); iz++) {
      const x0 = Math.max(minX, cx + ix * cell)
      const x1 = Math.min(maxX, cx + (ix + 1) * cell)
      const z0 = Math.max(minZ, cz + iz * cell)
      const z1 = Math.min(maxZ, cz + (iz + 1) * cell)
      if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6) continue
      quads.push({ x0, x1, z0, z1, y: 0, color: (((ix + iz) % 2) + 2) % 2 === 0 ? a : b })
    }
  }
  return flatQuads(quads, tileMeters)
}

/** Moquette unie avec bordure (aile Culture : galerie d'art) : un rectangle central et quatre bandes de bordure, sans recouvrement. */
function moquetteFloor(room: RoomLayout, base: string, border: string, borderWidth: number, tileMeters: number): BufferGeometry {
  const { minX, maxX, minZ, maxZ } = room.bounds
  const b = new Color(base)
  const bd = new Color(border)
  const ix0 = minX + borderWidth
  const ix1 = maxX - borderWidth
  const iz0 = minZ + borderWidth
  const iz1 = maxZ - borderWidth
  return flatQuads([
    { x0: ix0, x1: ix1, z0: iz0, z1: iz1, y: 0, color: b },
    { x0: minX, x1: maxX, z0: minZ, z1: iz0, y: 0, color: bd }, // nord
    { x0: minX, x1: maxX, z0: iz1, z1: maxZ, y: 0, color: bd }, // sud
    { x0: minX, x1: ix0, z0: iz0, z1: iz1, y: 0, color: bd }, // ouest
    { x0: ix1, x1: maxX, z0: iz0, z1: iz1, y: 0, color: bd }, // est
  ], tileMeters)
}

/**
 * Sol de fond d'une salle texturée (WEL-923), en géométrie à part : parquet du hall (marbre), damier des
 * Infrastructures (terrazzo), damier de l'Industrialisation (microciment), moquette et bordure de la Culture.
 * Les couleurs de sommet sont celles de la charte (inchangées) ; les UV sont en coordonnées monde, à l'échelle
 * de la matière (`FLOOR_SPECS`). `null` pour une salle qui peint son sol elle-même (les Archives).
 */
export function buildFloorGeometry(room: RoomLayout): BufferGeometry | null {
  if (room.id === 'hall') return hallParquet(room)
  if (room.id === 'archives') return null
  const { floor, floorAlt } = charter3d.rooms[room.id]
  const tile = FLOOR_SPECS[ROOM_FLOOR_KIND[room.id]].tileMeters
  switch (room.id) {
    case 'infrastructures':
      return checkerFloor(room, floor, floorAlt, 1.4, tile)
    case 'industrialisation':
      return checkerFloor(room, floor, floorAlt, 1.6, tile)
    case 'culture':
      return moquetteFloor(room, floor, floorAlt, 1.0, tile)
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
    paint(gearDisc, charter3d.furniture.gearDisc)
    gearDisc.rotateZ(Math.PI / 2) // axe du cylindre : Y → X, la face circulaire regarde vers +X/-X
    gearDisc.translate(gearX, gearY, gearZ)
    parts.push(gearDisc)
    const toothCount = 8
    for (let t = 0; t < toothCount; t++) {
      const a = (t / toothCount) * Math.PI * 2
      const tooth = box(0, 0, gearR + 0.09, 0.1, 0.18, 0.18, charter3d.rooms.infrastructures.accent)
      tooth.rotateX(a) // la roue est plaquée au mur, dans le plan (Y, Z) : on tourne autour de X
      tooth.translate(gearX, gearY, gearZ)
      parts.push(tooth)
    }
    // Chemins de câbles au sol, le long du couloir principal (purement décoratif, pas de collider).
    const cableY = 0.012
    parts.push(strut({ x: cx - halfW + 0.6, z: cz }, { x: cx + halfW - 0.6, z: cz }, cableY, 0.05, charter3d.cables.main))
    parts.push(strut({ x: cx - halfW + 0.6, z: cz - 0.3 }, { x: cx + halfW - 0.6, z: cz - 0.3 }, cableY, 0.04, charter3d.cables.thin))
  } else if (room.id === 'culture') {
    // Chevalet, plaqué contre le mur du fond (aucun modèle CC0 trouvé pour ce rôle, voir catalogue).
    const wallX = farWallX(room, 0.4)
    const easelX = wallX - 1.1
    const { legs, board } = charter3d.furniture.easel
    parts.push(box(easelX - 0.2, 0.55, 1.0, 0.06, 1.1, 0.06, legs))
    parts.push(box(easelX + 0.2, 0.55, 1.0, 0.06, 1.1, 0.06, legs))
    parts.push(box(easelX, 0.9, 1.0, 0.7, 0.5, 0.04, board))
  }
  return parts
}

/**
 * Fusionne les murs (coupés côté caméra), le décor, et pour le hall les tapis et chemins posés sur le sol,
 * en une seule géométrie. Le sol de fond est à part (`buildFloorGeometry`).
 */
export function buildRoomGeometry(room: RoomLayout, walls: ArchBox[], decor?: HallDecor): BufferGeometry {
  const parts: BufferGeometry[] = decor ? hallFloor(room) : []
  const c = charter3d.rooms[room.id]

  for (const w of walls) {
    if (w.hidden) continue // collider seulement : une géométrie dédiée le dessine (voir buildHallDecorGeometry)
    const cx = (w.box.minX + w.box.maxX) / 2
    const cz = (w.box.minZ + w.box.maxZ) / 2
    const sx = w.box.maxX - w.box.minX
    const sz = w.box.maxZ - w.box.minZ
    const height = archBoxHeight(w)
    if (w.kind === 'wall') {
      // Aile Industrialisation (atelier sous verrière) : murs à motif de briques (deux bleus rapprochés),
      // jamais côté caméra (le mur coupé à 1 m resterait illisible à cette hauteur, autant garder l'aplat).
      const brick = room.id === 'industrialisation' && !w.cut
      parts.push(brick ? brickBox(cx, height / 2, cz, sx, height, sz, c.wall, c.wallAlt) : boxNoisy(cx, height / 2, cz, sx, height, sz, c.wall, WALL_NOISE))
      // Plinthe : léger surplomb sombre en pied de mur, même coupé.
      parts.push(box(cx, PLINTH_HEIGHT / 2, cz, sx + 0.05, PLINTH_HEIGHT, sz + 0.05, c.plinth))
      if (w.cut) {
        // Mur « coupé » côté caméra : ~1 m de haut, pas la place pour lambris ni corniche (voir
        // CAMERA_CUT_HEIGHT). Une bande d'accent sur son dessus en fait un liseré lumineux, lisible depuis
        // la caméra plongeante, qui découpe la salle sur le ciel.
        parts.push(box(cx, height + CAP_HEIGHT / 2, cz, sx + 0.05, CAP_HEIGHT, sz + 0.05, c.cap))
      } else {
        // Lambris + listel blanc + corniche d'accent : seulement sur les murs pleins.
        parts.push(...wainscotAndCornice(cx, cz, sx, sz, height, c))
      }
    } else {
      // Pavé générique de secours : un meuble sans géométrie dédiée reste visible et à la bonne
      // hauteur (`archBoxHeight`), plutôt que silencieusement invisible.
      parts.push(box(cx, height / 2, cz, sx, height, sz, c.accent))
    }
  }

  if (decor) parts.push(...buildHallDecorGeometry(decor))
  else parts.push(...wingSignatureDecor(room))

  return mergeAll(parts)
}

/**
 * Lambris bas (bleu de la charte, plus sombre que le mur, hauteur `WAINSCOT_HEIGHT`), listel blanc posé sur
 * son haut (`LISTEL_HEIGHT`) et corniche d'accent (juste sous le plafond) : léger surplomb
 * (`TRIM_PROTRUSION`) sur la face intérieure du mur pour rester visibles malgré `flatShading`. Le surplomb
 * ne s'ajoute qu'à l'axe « épaisseur » du mur (le plus petit de `sx`/`sz`), jamais à sa longueur.
 */
function wainscotAndCornice(cx: number, cz: number, sx: number, sz: number, wallHeight: number, c: RoomCharter): BufferGeometry[] {
  const growX = sx <= sz ? TRIM_PROTRUSION * 2 : 0
  const growZ = sz < sx ? TRIM_PROTRUSION * 2 : 0
  const wSx = sx + growX
  const wSz = sz + growZ
  const wainscot = box(cx, WAINSCOT_HEIGHT / 2, cz, wSx, WAINSCOT_HEIGHT, wSz, c.wainscot)
  const listel = box(cx, WAINSCOT_HEIGHT + LISTEL_HEIGHT / 2, cz, wSx, LISTEL_HEIGHT, wSz, c.listel)
  const corniceY = wallHeight - CORNICE_TOP_GAP - CORNICE_HEIGHT / 2
  const cornice = box(cx, corniceY, cz, wSx, CORNICE_HEIGHT, wSz, c.cornice)
  return [wainscot, listel, cornice]
}

// --- Décor du hall (comptoir, arbre) --------------------------------------------------------

function counterGeometry(center: Vec2, halfWidth: number, halfDepth: number): BufferGeometry[] {
  const counter = charter3d.furniture.counter
  const height = 0.95
  const bodyLength = Math.max(0.2, 2 * halfWidth - 2 * halfDepth)
  const body = new CapsuleGeometry(halfDepth, bodyLength, 4, 10)
  paint(body, counter.body)
  body.rotateZ(Math.PI / 2)
  body.translate(center.x, height / 2, center.z)

  const top = new CapsuleGeometry(halfDepth * 1.18, bodyLength, 4, 10)
  paint(top, counter.top)
  top.rotateZ(Math.PI / 2)
  top.scale(1, 0.1, 1)
  top.translate(center.x, height + 0.04, center.z)

  // Petite sonnette bleu nuit sur le plateau blanc, côté joueur (sud).
  const bell = cylinder(center.x + halfWidth * 0.55, height + 0.08, center.z + halfDepth * 0.5, 0.05, 0.07, 0.07, counter.bell, 8)

  return [body, top, bell]
}

function treeGeometry(center: Vec2): BufferGeometry[] {
  const tree = charter3d.furniture.tree
  const trunk = new CylinderGeometry(0.16, 0.26, TREE_TRUNK_HEIGHT, 7)
  paint(trunk, tree.trunk)
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
  // Une couleur de zone par feuillage : cyan vif (Infrastructures) au centre, bleu néon (Culture) à
  // gauche, corail (Industrialisation) à droite, cime blanche. L'arbre des 100 porte les trois ailes.
  const foliage = [
    facetedSphere(center.x, canopyY + 0.5, center.z, 1.1, tree.leafMain),
    facetedSphere(center.x + 0.7, canopyY + 0.15, center.z + 0.3, 0.75, tree.leafRight),
    facetedSphere(center.x - 0.75, canopyY + 0.25, center.z - 0.2, 0.7, tree.leafLeft),
    facetedSphere(center.x + 0.1, canopyY + (TREE_TOTAL_HEIGHT - TREE_TRUNK_HEIGHT), center.z - 0.1, 0.6, tree.crown),
  ]
  return [trunk, ...foliage]
}

function treeBenchGeometry(center: Vec2, radius: number, height: number): BufferGeometry {
  const ring = new TorusGeometry(radius, 0.14, 6, 20)
  paint(ring, charter3d.furniture.tree.bench)
  ring.rotateX(Math.PI / 2)
  ring.translate(center.x, height, center.z)
  return ring
}

/**
 * Cordon à potelets blancs — purement décoratif, aucun collider. Corail devant le comptoir d'accueil
 * (`rope.cord`), magenta devant une aile fermée (`rope.cordClosed`) : le seul usage du magenta en 3D.
 */
function velvetRopeGeometry(postPositions: Vec2[], y = 0.55, cordColor: string = charter3d.furniture.rope.cord): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  for (const p of postPositions) {
    parts.push(cylinder(p.x, 0, p.z, 0.045, 0.05, y, charter3d.furniture.rope.post, 8))
    parts.push(facetedSphere(p.x, y + 0.04, p.z, 0.06, charter3d.furniture.rope.post))
  }
  for (let i = 1; i < postPositions.length; i++) parts.push(strut(postPositions[i - 1], postPositions[i], y - 0.05, 0.03, cordColor))
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
  return mergeAll(velvetRopeGeometry([a, b], 0.5, charter3d.furniture.rope.cordClosed))
}

/** Cimaise / cloison occultante : mesh séparé (voir `Occluder`, `occlusion.ts`), fondu en `useFrame`. */
export function buildOccluderGeometry(footprint: { minX: number; maxX: number; minZ: number; maxZ: number }, height: number, wallColor: string): BufferGeometry {
  const cx = (footprint.minX + footprint.maxX) / 2
  const cz = (footprint.minZ + footprint.maxZ) / 2
  const sx = footprint.maxX - footprint.minX
  const sz = footprint.maxZ - footprint.minZ
  const parts = [box(cx, height / 2, cz, sx, height, sz, wallColor), box(cx, PLINTH_HEIGHT / 2, cz, sx + 0.05, PLINTH_HEIGHT, sz + 0.05, charter3d.rooms.hall.plinth)]
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
const RAY_OPACITY_HINT = charter3d.scene.rays // blanc froid ; l'opacité elle-même est réglée côté matériau (Museum.tsx)
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
