/**
 * Hauteur des murs de la salle des Archives selon la présence du joueur : logique PURE (aucune
 * dépendance three.js), testée dans `wallRise.test.ts`.
 *
 * Retour de Baptiste du 29/09 : « les murs de la partie Archives 2040 doivent être des murs complets,
 * des murs hauts, comme les autres murs — une pièce complète ». Contrainte de la caméra : elle est
 * TOUJOURS au sud du joueur (`cameraRig`, `src/styles/tokens.ts`) et regarde vers −Z. Un mur haut posé
 * entre elle et le joueur le masque. Trois murs sont concernés :
 *
 *  - le mur sud (côté caméra) reste coupé en permanence, comme tous les murs du musée du côté caméra ;
 *  - le mur nord est le mur SUD DU HALL (`ArchivesLayout.northWall`, toute la largeur du hall, porte
 *    exclue). Un joueur resté dans le hall a ce mur entre lui et la caméra : il reste coupé
 *    (`CAMERA_CUT_HEIGHT`) tant que le joueur n'est pas dans la salle, et monte à `dims.wallHeight`
 *    quand `currentRoom === 'archives'` (le joueur est alors au sud du mur : il est derrière lui, pas
 *    devant) ;
 *  - les murs est et ouest sont hauts en permanence (`dims.wallHeight`), SAUF dans un cas rare : un
 *    joueur du hall qui longe l'angle sud-est ou sud-ouest du hall (le hall est 1 m plus large que la
 *    salle de chaque côté) se retrouve en plein dans l'ombre portée d'un de ces murs vu de la caméra.
 *    Tant que c'est le cas, ils redescendent (même principe que la rétraction des vitrines).
 *
 * Le mouvement est une « progression » `p` ∈ [0, 1] (0 = mur coupé, 1 = mur haut), amortie
 * exponentiellement (`stepRise`). Tout ce qui monte avec le mur se déduit de `p` par `riseFrame` :
 * corps supérieur, couronne (bande d'accent qui fait office de liseré sur le mur coupé et de corniche
 * sur le mur haut), linteau au-dessus de la porte, bandeau « Les Archives de 2040 ».
 */
import type { AABB, ArchivesLayout, WingId } from '../../types'
import { CAP_HEIGHT, CORNICE_HEIGHT, CORNICE_TOP_GAP } from '../../world/constants'
import { occludesPlayer, type OcclusionObstacle, type Vec3 } from '../../world/occlusion'
import { DOOR_HEIGHT, SOUTH_WALL_CUT_HEIGHT, WALL_HEIGHT, WALL_THICKNESS } from './constants'

/** Hauteur d'un mur coupé (le liseré d'accent est posé dessus, voir `LOW_TOP`). */
export const WALL_LOW = SOUTH_WALL_CUT_HEIGHT
/** Hauteur d'un mur haut : celle des autres salles (`dims.wallHeight`). */
export const WALL_FULL = WALL_HEIGHT
/** Sommet réel d'un mur coupé, liseré compris. */
export const LOW_TOP = WALL_LOW + CAP_HEIGHT

/** Vitesse d'amortissement (1/s) : ~95 % du chemin en 0,5 s. */
export const RISE_RATE = 6
/** Recouvrement du corps supérieur dans la base, pour qu'aucune fissure ne se voie entre les deux. */
export const BODY_OVERLAP = 0.02
/** Bord de la couronne, depuis le haut du mur, quand le mur est haut (corniche sous le plafond). */
export const CROWN_TOP_FULL = WALL_FULL - CORNICE_TOP_GAP
/** Le bandeau du linteau n'apparaît que sur les derniers 10 % de la montée. */
const BANNER_FADE_START = 0.9
/** Marge (m) dont on élargit un mur latéral, de chaque côté, pour anticiper sa rétraction. */
export const SIDE_WALL_LEAD = 1.2

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Le joueur est-il dans la salle des Archives ? (`useGame.currentRoom`) */
export function isInArchives(currentRoom: WingId | null): boolean {
  return currentRoom === 'archives'
}

/** Hauteur visée du mur nord : haut dans la salle, coupé partout ailleurs (jamais de mur haut devant le hall). */
export function northWallTargetHeight(inArchives: boolean): number {
  return inArchives ? WALL_FULL : WALL_LOW
}

/** Progression visée du mur nord (1 = haut, 0 = coupé). */
export function northWallTarget(inArchives: boolean): 0 | 1 {
  return inArchives ? 1 : 0
}

/**
 * Progression visée des murs est/ouest : hauts, sauf s'ils cachent un joueur resté dans le hall.
 * Dans la salle, ils ne peuvent jamais cacher le joueur (il est à l'intérieur, à ≥ 0,35 m du mur) :
 * toujours hauts.
 */
export function sideWallTarget(inArchives: boolean, hidesHallPlayer: boolean): 0 | 1 {
  return !inArchives && hidesHallPlayer ? 0 : 1
}

/**
 * Approche amortie de `target` (exponentielle, indépendante du framerate), sans dépassement ; se cale
 * exactement sur la cible quand l'écart devient négligeable. `rate` infini = saut immédiat (mouvement
 * réduit).
 */
export function stepRise(current: number, target: number, dt: number, rate: number = RISE_RATE): number {
  if (current === target) return current
  if (!Number.isFinite(rate)) return target
  if (!(dt > 0)) return current
  const next = current + (target - current) * (1 - Math.exp(-rate * dt))
  return Math.abs(target - next) < 0.002 ? target : next
}

/** Hauteur du sommet du corps du mur pour une progression `p`. */
export function wallTopAt(p: number): number {
  return lerp(WALL_LOW, WALL_FULL, clamp01(p))
}

/** Tout ce qui se déplace avec le mur, pour une progression `p`. Les hauteurs sont en mètres. */
export interface RiseFrame {
  /** Base et hauteur du corps supérieur (posé sur la base du mur). Hauteur 0 = rien à dessiner. */
  bodyBottom: number
  bodyHeight: number
  /** Base et hauteur de la couronne : liseré de 6 cm sur le mur coupé, corniche de 16 cm sur le mur haut. */
  crownBottom: number
  crownHeight: number
  /** Hauteur du linteau au-dessus de la porte (0 = mur trop bas pour en avoir un). */
  lintelHeight: number
  /** La couronne passe-t-elle au-dessus de la porte (donc peut-elle traverser l'embrasure) ? */
  lintelCrownVisible: boolean
  /** Opacité du bandeau « Les Archives de 2040 » : 0 tant que le mur n'est pas presque haut. */
  bannerOpacity: number
}

export function riseFrame(progress: number): RiseFrame {
  const p = clamp01(progress)
  const top = wallTopAt(p)
  const bodyHeight = p > 1e-3 ? top - WALL_LOW + BODY_OVERLAP : 0
  const crownBottom = lerp(WALL_LOW, CROWN_TOP_FULL - CORNICE_HEIGHT, p)
  const crownHeight = lerp(CAP_HEIGHT, CORNICE_HEIGHT, p)
  return {
    bodyBottom: WALL_LOW - BODY_OVERLAP,
    bodyHeight,
    crownBottom,
    crownHeight,
    lintelHeight: Math.max(0, top - DOOR_HEIGHT),
    lintelCrownVisible: crownBottom >= DOOR_HEIGHT - 1e-6,
    bannerOpacity: clamp01((p - BANNER_FADE_START) / (1 - BANNER_FADE_START)),
  }
}

/** Murs est et ouest à pleine hauteur, élargis de `SIDE_WALL_LEAD` : pour anticiper leur rétraction. */
export function sideWallObstacles(archives: ArchivesLayout): OcclusionObstacle[] {
  const b: AABB = archives.room.bounds
  const half = WALL_THICKNESS / 2
  const lead = SIDE_WALL_LEAD
  return [
    { box: { minX: b.minX - half - lead, maxX: b.minX + half + lead, minZ: b.minZ, maxZ: b.maxZ }, height: WALL_FULL },
    { box: { minX: b.maxX - half - lead, maxX: b.maxX + half + lead, minZ: b.minZ, maxZ: b.maxZ }, height: WALL_FULL },
  ]
}

/** Un mur latéral haut cacherait-il un joueur du hall, vu de la caméra ? (test de segment, sans allocation) */
export function sideWallsHidePlayer(obstacles: OcclusionObstacle[], playerX: number, playerZ: number, camera: Vec3): boolean {
  for (const o of obstacles) if (occludesPlayer(o, playerX, playerZ, camera)) return true
  return false
}

/**
 * Mur nord tel que la caméra le voit pour une progression `p` : emprise des segments de `northWall` et
 * sommet réel (liseré ou corniche compris). Sert aux tests d'occultation, jamais au rendu.
 */
export function northWallObstacles(archives: ArchivesLayout, progress: number): OcclusionObstacle[] {
  const p = clamp01(progress)
  const riseTop = wallTopAt(p)
  const crownTop = lerp(LOW_TOP, CROWN_TOP_FULL, p)
  const height = Math.max(riseTop, crownTop)
  return archives.northWall.map((box) => ({ box, height }))
}
