/**
 * Géométrie statique fusionnée par salle (sol, murs, socle des meubles) : un seul appel de dessin
 * par salle, couleurs par sommet, matériau `MeshLambertMaterial` partagé (pas de texture).
 */
import { BoxGeometry, BufferGeometry, Color, ConeGeometry, Float32BufferAttribute, Matrix4, PlaneGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { palette } from '../styles/tokens'
import { dims, CAMERA_CUT_HEIGHT } from './constants'
import type { ArchBox, DoorArch } from './layout'
import type { RoomLayout, Vec2 } from '../types'

const FURNITURE_HEIGHT = 0.85
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

function box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, hex: string): BufferGeometry {
  const geo = new BoxGeometry(sx, sy, sz)
  paint(geo, hex)
  geo.applyMatrix4(_m.makeTranslation(cx, cy, cz))
  return geo
}

/** Sol de la salle, avec une mosaïque concentrique discrète pour le hall. */
function floor(room: RoomLayout, mosaic: boolean): BufferGeometry {
  const w = room.bounds.maxX - room.bounds.minX
  const d = room.bounds.maxZ - room.bounds.minZ
  const cx = (room.bounds.minX + room.bounds.maxX) / 2
  const cz = (room.bounds.minZ + room.bounds.maxZ) / 2
  const segments = mosaic ? 40 : 2
  const geo = new PlaneGeometry(w, d, segments, segments)
  geo.rotateX(-Math.PI / 2)
  geo.applyMatrix4(_m.makeTranslation(cx, 0, cz))

  const base = new Color(room.floorColor)
  const ring = new Color(room.accentColor)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const maxR = Math.min(w, d) / 2
  for (let i = 0; i < pos.count; i++) {
    let t = 0
    if (mosaic) {
      const x = pos.getX(i) - cx
      const z = pos.getZ(i) - cz
      const r = Math.sqrt(x * x + z * z) / maxR
      t = (Math.sin(r * Math.PI * 5) + 1) / 2
      t *= Math.max(0, 1 - r) * 0.35
    }
    const c = base.clone().lerp(ring, t)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

/** Fusionne le sol, les murs (coupés côté caméra) et le socle des meubles d'une salle en une seule géométrie. */
export function buildRoomGeometry(room: RoomLayout, walls: ArchBox[], mosaic = false): BufferGeometry {
  const parts: BufferGeometry[] = [floor(room, mosaic)]

  for (const w of walls) {
    const cx = (w.box.minX + w.box.maxX) / 2
    const cz = (w.box.minZ + w.box.maxZ) / 2
    const sx = w.box.maxX - w.box.minX
    const sz = w.box.maxZ - w.box.minZ
    if (w.kind === 'wall') {
      const height = w.cut ? CAMERA_CUT_HEIGHT : dims.wallHeight
      parts.push(box(cx, height / 2, cz, sx, height, sz, room.wallColor))
      // Plinthe : léger surplomb sombre en pied de mur, même coupé.
      parts.push(box(cx, PLINTH_HEIGHT / 2, cz, sx + 0.05, PLINTH_HEIGHT, sz + 0.05, palette.woodDark))
    } else {
      parts.push(box(cx, FURNITURE_HEIGHT / 2, cz, sx, FURNITURE_HEIGHT, sz, room.accentColor))
    }
  }

  const merged = mergeGeometries(parts, false)
  merged.computeBoundingSphere()
  return merged
}

/** Petites plantes low-poly (un cône + une motte), une par jardinière — une seule géométrie fusionnée. */
export function buildFoliageGeometry(positions: Vec2[]): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (const p of positions) {
    parts.push(box(p.x, 0.42, p.z, 0.5, 0.14, 0.5, palette.woodDark))
    const cone = new ConeGeometry(0.32, 0.6, 7)
    paint(cone, palette.leafDark)
    cone.applyMatrix4(_m.makeTranslation(p.x, 0.8, p.z))
    parts.push(cone)
  }
  const merged = mergeGeometries(parts, false)
  merged.computeBoundingSphere()
  return merged
}

/** Linteaux des portes ouvertes, à la couleur de chaque aile (« arches des portes ») — une seule géométrie fusionnée, `null` si aucune porte n'est ouverte. */
export function buildDoorArchesGeometry(arches: DoorArch[]): BufferGeometry | null {
  if (arches.length === 0) return null
  const parts = arches.map(({ box: b, color }) => {
    const cx = (b.minX + b.maxX) / 2
    const cz = (b.minZ + b.maxZ) / 2
    const sx = b.maxX - b.minX
    const sz = b.maxZ - b.minZ
    return box(cx, ARCH_BOTTOM_Y + ARCH_HEIGHT / 2, cz, sx, ARCH_HEIGHT, sz, color)
  })
  const merged = mergeGeometries(parts, false)
  merged.computeBoundingSphere()
  return merged
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
    geo.applyMatrix4(_m.makeTranslation(x, RAY_Y, z))
    paint(geo, RAY_OPACITY_HINT)
    parts.push(geo)
  }
  const merged = mergeGeometries(parts, false)
  merged.computeBoundingSphere()
  return merged
}
