/**
 * Test pur d'occultation « caméra → joueur ». La caméra 3e personne est toujours au sud du joueur
 * (voir `cameraPositionFor`, `src/styles/tokens.ts`) : une cimaise ou une cloison qui se place entre
 * les deux masquerait le joueur (et le cadre qu'il regarde) si elle restait pleinement opaque.
 *
 * Aucune dépendance three.js ici : fonctions pures, testables sans WebGL (`occlusion.test.ts`).
 * Consommateurs : `Museum.tsx` (fondu en direct, caméra réelle lue dans `useFrame`) et
 * `layout.test.ts` (caméra « pire cas », voir `worstCaseCameraFor`).
 * Propriétaire : agent monde.
 */
import type { AABB } from '../types'
import { cameraPositionFor, cameraRig, dims } from '../styles/tokens'

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Un obstacle susceptible d'occulter : emprise au sol (plan XZ) + hauteur depuis le sol (y = 0). */
export interface OcclusionObstacle {
  box: AABB
  height: number
}

const EPS = 1e-9

/**
 * Intersection segment 3D / boîte alignée sur les axes (« slab test », Kay–Kajiya), bornes incluses.
 * Écrit avec des nombres uniquement (aucune allocation) : appelé plusieurs fois par image dans
 * `Museum.tsx` (une fois par cimaise visible), jamais avec des objets three.js.
 */
function segmentHitsBox(
  p0x: number,
  p0y: number,
  p0z: number,
  p1x: number,
  p1y: number,
  p1z: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): boolean {
  let tMin = 0
  let tMax = 1

  let d = p1x - p0x
  if (Math.abs(d) < EPS) {
    if (p0x < minX || p0x > maxX) return false
  } else {
    let t1 = (minX - p0x) / d
    let t2 = (maxX - p0x) / d
    if (t1 > t2) {
      const tmp = t1
      t1 = t2
      t2 = tmp
    }
    if (t1 > tMin) tMin = t1
    if (t2 < tMax) tMax = t2
    if (tMin > tMax) return false
  }

  d = p1y - p0y
  if (Math.abs(d) < EPS) {
    if (p0y < minY || p0y > maxY) return false
  } else {
    let t1 = (minY - p0y) / d
    let t2 = (maxY - p0y) / d
    if (t1 > t2) {
      const tmp = t1
      t1 = t2
      t2 = tmp
    }
    if (t1 > tMin) tMin = t1
    if (t2 < tMax) tMax = t2
    if (tMin > tMax) return false
  }

  d = p1z - p0z
  if (Math.abs(d) < EPS) {
    if (p0z < minZ || p0z > maxZ) return false
  } else {
    let t1 = (minZ - p0z) / d
    let t2 = (maxZ - p0z) / d
    if (t1 > t2) {
      const tmp = t1
      t1 = t2
      t2 = tmp
    }
    if (t1 > tMin) tMin = t1
    if (t2 < tMax) tMax = t2
    if (tMin > tMax) return false
  }

  return true
}

/** Fractions de `playerHeight` échantillonnées le long du joueur : pieds, torse, tête. */
const SAMPLE_HEIGHT_FRACTIONS = [0, 0.5, 1] as const

/**
 * Vrai si le segment caméra→joueur — échantillonné aux pieds (y = 0), au torse (mi-hauteur) et à la
 * tête (y = `playerHeight`, voir `dims.playerHeight`) — traverse `obstacle`. Un seul point occulté
 * suffit : c'est ce point (donc potentiellement le joueur ou le cadre qu'il regarde) qui disparaîtrait
 * derrière l'obstacle s'il restait opaque.
 */
export function occludesPlayer(obstacle: OcclusionObstacle, playerX: number, playerZ: number, camera: Vec3, playerHeight: number = dims.playerHeight): boolean {
  const { minX, maxX, minZ, maxZ } = obstacle.box
  const maxY = obstacle.height
  for (const f of SAMPLE_HEIGHT_FRACTIONS) {
    if (segmentHitsBox(camera.x, camera.y, camera.z, playerX, f * playerHeight, playerZ, minX, 0, minZ, maxX, maxY, maxZ)) return true
  }
  return false
}

/**
 * Position de caméra « pire cas » pour un joueur en `(x, z)` : distance maximale du rig partagé
 * (`cameraRig.maxDistance`). Sert aux tests de plan (`layout.test.ts`), où la vraie distance — qui
 * dépend du format d'écran de l'appareil — n'est pas connue à l'avance ; en pratique une caméra plus
 * loin voit une plus grande part du couloir, donc plus susceptible de traverser un obstacle lointain.
 */
export function worstCaseCameraFor(x: number, z: number): Vec3 {
  return cameraPositionFor(x, z, cameraRig.maxDistance)
}

/** Rapproche `current` de `target` d'au plus `maxStep` (jamais de dépassement). Utilisé pour le fondu. */
export function approach(current: number, target: number, maxStep: number): number {
  if (current < target) return Math.min(target, current + maxStep)
  if (current > target) return Math.max(target, current - maxStep)
  return current
}
