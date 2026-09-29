// Propriétaire : agent joueur. Fonctions pures, testées (pas de dépendance three.js ici).
// Caméra 3e personne à orientation fixe (diorama, regarde toujours vers -Z) : voir le contrat
// partagé `cameraRig` / `cameraPositionFor` dans `src/styles/tokens.ts` (propriété intégration).
import type { AABB } from '../types'
import { cameraRig } from '../styles/tokens'
import { cameraPositionFor } from '../styles/tokens'

/** Rétrécissement de la distance en mode « regard » (cadrage rapproché sur un portrait proche). */
export const LOOK_DISTANCE_FACTOR = 0.7
/** Durée visée (s) de la transition douce vers/depuis le mode « regard ». */
export const LOOK_TRANSITION_SECONDS = 0.6
/**
 * Dialogue ouvert : la boîte de dialogue couvre le bas de l'écran, là où l'orientation fixe place le
 * joueur (≈ 73 % de la hauteur). On recule la caméra vers le sud d'une fraction de sa distance, à
 * hauteur constante : le regard vers le joueur s'aplatit et il remonte vers le milieu de l'écran
 * (≈ 55 %), au-dessus de la boîte (revue du 29/09 : le joueur disparaissait sous le dialogue).
 */
export const DIALOGUE_CAMERA_SHIFT_RATIO = 0.21
export const DIALOGUE_TRANSITION_SECONDS = 0.45

/** Recul de caméra (m, vers +Z) quand un dialogue est ouvert, pour une distance donnée. Fonction pure. */
export function dialogueShiftFor(distance: number, blend: number): number {
  return distance * DIALOGUE_CAMERA_SHIFT_RATIO * blend
}
/** Temps d'immobilité (s) avant que le mode « regard » ne s'engage. */
export const LOOK_STILLNESS_SECONDS = 0.4
/**
 * Fraction verticale du cadre (0 = haut, 1 = bas) visée pour le point regardé (hauteur
 * `cameraRig.lookHeight`) : le joueur doit rester au tiers inférieur (≥ 1/3, marge comprise), jamais
 * au centre. Voir `orientationPitchDeg`.
 */
export const PLAYER_SCREEN_FRACTION = 0.72

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Champ de vision horizontal (radians) pour un champ vertical `fovDeg` et un format `aspect` (largeur/hauteur). */
export function horizontalFovRad(fovDeg: number, aspect: number): number {
  const verticalFovRad = (fovDeg * Math.PI) / 180
  return 2 * Math.atan(Math.tan(verticalFovRad / 2) * aspect)
}

/**
 * Distance caméra→joueur pour voir `cameraRig.targetVisibleWidth` mètres de large à la profondeur
 * du joueur, selon le format d'écran (`aspect` = largeur/hauteur ; portrait < 1 < paysage). Un
 * format étroit (portrait) réduit le champ horizontal réel : il faut reculer la caméra pour garder
 * la même largeur visible, sinon le hall paraît vide (bug corrigé ici). Bornée entre
 * `cameraRig.minDistance` et `cameraRig.maxDistance`.
 */
export function distanceForAspect(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return cameraRig.maxDistance
  const hFov = horizontalFovRad(cameraRig.fovDeg, aspect)
  const raw = cameraRig.targetVisibleWidth / (2 * Math.tan(hFov / 2))
  if (!Number.isFinite(raw)) return cameraRig.maxDistance
  return clamp(raw, cameraRig.minDistance, cameraRig.maxDistance)
}

/**
 * Décalage (au-dessus de `cameraRig.lookHeight`) du point visé en mode « regard », pour recentrer
 * le cadrage sur un portrait accroché à `frameCenterY` plutôt que sur le sol devant le joueur.
 * Une translation verticale égale de la caméra et de sa cible ne change jamais l'orientation fixe :
 * dans `cameraPositionFor`, le vecteur caméra→cible ne dépend que de `pitchDeg` et de la distance,
 * jamais de la hauteur visée (voir `camera.test.ts`) — on peut donc lever le regard sans re-viser.
 *
 * Exprimé en proportion de `distance` (pas une hauteur fixe en mètres) : la même translation
 * verticale déplace le joueur à l'écran d'autant plus que la caméra est proche (voir
 * `fixedOrientationReference`, l'angle de visée est fixe, indépendant de la distance — un décalage
 * absolu se traduirait donc par un décalage ANGULAIRE, donc écran, plus grand à courte distance).
 * Sans cette mise à l'échelle, le mode « regard » (distance × `LOOK_DISTANCE_FACTOR`, donc plus
 * proche) pousserait le joueur bien plus bas dans le cadre en paysage (distance de base plus courte)
 * qu'en portrait, jusqu'à toucher le HUD bas — voir `camera.test.ts`. La proportion est calibrée pour
 * retrouver `frameCenterY - lookHeight` à `cameraRig.maxDistance` (le cas portrait, le plus fréquent).
 */
export function lookRaiseFor(frameCenterY: number, distance: number): number {
  const raiseAtMaxDistance = clamp(frameCenterY - cameraRig.lookHeight, 0, frameCenterY)
  return (raiseAtMaxDistance / cameraRig.maxDistance) * distance
}

/**
 * Position de caméra bornée à `bounds` (emprise du musée) sans jamais rogner le décalage normal
 * joueur→caméra près des bords (bug V1 : le plan tronquait l'offset sans toucher l'orientation
 * fixe, ce qui vidait la scène). Les bornes sont décalées du décalage (x, z) réellement appliqué
 * pour la `distance` courante — qui varie maintenant avec le format d'écran et le mode « regard »,
 * contrairement au décalage constant de la V1 — avant d'y appliquer le clamp. `extraY` est le
 * décalage vertical du mode « regard » (voir `lookRaiseFor`), appliqué tel quel : il ne fait que
 * translater caméra et cible ensemble, sans affecter le clamp horizontal.
 */
export function boundedCameraPosition(
  x: number,
  z: number,
  distance: number,
  bounds: AABB,
  extraY = 0,
): { x: number; y: number; z: number } {
  const raw = cameraPositionFor(x, z, distance)
  const offsetX = raw.x - x
  const offsetZ = raw.z - z
  return {
    x: clamp(raw.x, bounds.minX + offsetX, bounds.maxX + offsetX),
    y: raw.y + extraY,
    z: clamp(raw.z, bounds.minZ + offsetZ, bounds.maxZ + offsetZ),
  }
}

/**
 * Angle de visée fixe (deg, depuis l'horizontale) pour que le point à hauteur `cameraRig.lookHeight`
 * apparaisse à `screenFraction` du cadre plutôt qu'au centre. Une caméra dont l'orientation regarde
 * EXACTEMENT dans la direction `positionPitchDeg` (celle de `cameraPositionFor`) place ce point pile
 * au centre, quelle que soit la distance (`cameraPositionFor` vise le joueur par construction) : le
 * joueur resterait au milieu du cadre, jamais au tiers inférieur. Reculer l'angle de visée (toujours
 * plus « à plat », donc < `positionPitchDeg`, comme la V1 — voir `Player.tsx`, ancien
 * `CAMERA_LOOK_OFFSET` vs `CAMERA_OFFSET`, angles différents) fait apparaître le joueur plus bas dans
 * le cadre, l'angle entre les deux directions étant indépendant de la distance (voir `camera.test.ts`).
 * Bonus : un angle de visée plus à plat étend aussi la portée vers l'avant (on voit plus loin dans le
 * hall — Rémi Godeau, les portes), l'un ne va pas sans l'autre.
 */
export function orientationPitchDeg(positionPitchDeg: number, fovDeg: number, screenFraction: number): number {
  const halfVFovRad = (fovDeg * Math.PI) / 180 / 2
  const ndcY = 1 - 2 * screenFraction // +1 en haut, -1 en bas
  const deltaRad = Math.atan(-ndcY * Math.tan(halfVFovRad))
  return positionPitchDeg - (deltaRad * 180) / Math.PI
}

/**
 * Référence (position, cible) à distance unité pour calculer une fois pour toutes le quaternion fixe
 * de la caméra (voir `Player.tsx` : `PerspectiveCamera.lookAt()`, jamais un `Object3D` nu — sa
 * convention de `lookAt` inversée retournerait une caméra plein ciel). La direction obtenue ne dépend
 * pas de la distance choisie ici (voir `camera.test.ts`), donc valable pour n'importe quelle distance
 * ou hauteur visée réelles. Position calculée via le contrat partagé (`cameraPositionFor`) ; visée
 * volontairement plus à plat que cette position (voir `orientationPitchDeg`) pour garder le joueur au
 * tiers inférieur du cadre.
 */
export function fixedOrientationReference(): {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
} {
  const position = cameraPositionFor(0, 0, 1)
  const pitchRad = (orientationPitchDeg(cameraRig.pitchDeg, cameraRig.fovDeg, PLAYER_SCREEN_FRACTION) * Math.PI) / 180
  return {
    position,
    target: { x: 0, y: position.y - Math.sin(pitchRad), z: position.z - Math.cos(pitchRad) },
  }
}

/**
 * Avance `current` (0..1) vers `target` à vitesse constante, pour boucler la transition en
 * `duration` secondes (indépendant du framerate : pas exponentiel, la durée est garantie). Avec
 * `reducedMotion`, saute directement à la cible (accessibilité, `prefers-reduced-motion`).
 */
export function stepBlend(current: number, target: number, dt: number, duration: number, reducedMotion: boolean): number {
  if (reducedMotion || duration <= 0) return target
  const maxDelta = dt / duration
  if (current < target) return Math.min(target, current + maxDelta)
  if (current > target) return Math.max(target, current - maxDelta)
  return current
}

/** Vrai si le visiteur a demandé de réduire les animations (respecté par le mode « regard »). */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  } catch {
    return false
  }
}
