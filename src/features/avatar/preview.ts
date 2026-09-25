/**
 * Cadrage de l'aperçu 3D de l'écran « Qui es-tu ? ». Propriétaire : agent avatar+tampons.
 *
 * Logique pure (testable sans WebGL) : à partir de la vraie boîte englobante verticale du
 * personnage monté (mesurée avec `Box3`, jamais devinée), calcule où placer la caméra pour que
 * tout le sujet — pieds *et* tête, accessoires compris (béret, casquette…) — tienne dans le cadre.
 * On ne suppose aucune proportion fixe du mesh (`src/player/AvatarMesh.tsx`, hors contrat de ce
 * module) : une caméra visant un point fixe devinerait mal dès que ce mesh change.
 */

export interface PreviewBounds {
  /** Point le plus bas du sujet (typiquement les pieds, y ≈ 0). */
  minY: number
  /** Point le plus haut du sujet (sommet de la tête ou d'un accessoire). */
  maxY: number
}

export interface PreviewCameraFit {
  /** Distance caméra ↔ sujet le long de l'axe de vue. */
  distance: number
  /** Hauteur (Y) du point visé : le centre vertical du sujet, jamais le sol. */
  targetY: number
}

/** Évite une distance nulle/infinie si la boîte mesurée est dégénérée (mesh pas encore prêt). */
const MIN_HEIGHT = 0.01

/**
 * Distance et hauteur de visée pour que `bounds` tienne verticalement dans un champ de vision
 * `fovDeg` (vertical, en degrés), avec une marge `margin` autour du sujet (1 = calé pile sur les
 * bords du cadre, > 1 = marge). La caméra visée doit être positionnée à `(x, targetY, distance)`
 * (même x que le sujet, en face) et regarder `(x, targetY, z)` — jamais l'origine du monde, qui
 * correspond aux pieds et coupe la tête.
 */
export function fitVerticalBounds(bounds: PreviewBounds, fovDeg: number, margin = 1): PreviewCameraFit {
  const height = Math.max(bounds.maxY - bounds.minY, MIN_HEIGHT)
  const targetY = (bounds.minY + bounds.maxY) / 2
  const halfFovRad = (fovDeg * Math.PI) / 360
  const distance = (height * margin) / 2 / Math.tan(halfFovRad)
  return { distance, targetY }
}

// ---------------------------------------------------------------------------
// Orientation de l'aperçu : trois quarts face + balancement doux + glisser du doigt.
// Logique pure (angles, vitesses) ; le composant (`AvatarCustomizer.tsx`) ne fait que muter
// `group.rotation.y` dans `useFrame` à partir de ces fonctions — aucune allocation par image.
// ---------------------------------------------------------------------------

/**
 * Orientation de repos : trois quarts face (assez tournée pour lire le volume, visage bien
 * lisible). Volontairement modeste : combinée au balancement ± 30°, l'extrême le plus tourné
 * (base + amplitude) ne doit jamais approcher le profil pur (90°) sous peine de retomber dans le
 * bug d'origine (visage peu lisible pendant une partie du balancement).
 */
export const PREVIEW_BASE_YAW_DEG = 18
/** Amplitude du balancement doux autour de l'orientation de repos. */
export const PREVIEW_SWAY_DEG = 30
/** Vitesse du balancement (radians de phase par seconde) : lent, jamais brusque. */
export const PREVIEW_SWAY_SPEED = 0.6
/** Sensibilité du glisser : radians de rotation par pixel déplacé horizontalement. */
export const PREVIEW_DRAG_SENSITIVITY = 0.01
/**
 * Vitesse angulaire maximale retenue pour l'inertie (rad/s). Plafond bas et volontaire : des
 * évènements pointer consécutifs très rapprochés (un vrai doigt à 120 Hz, ou un test automatisé)
 * peuvent donner un `deltaTimeMs` minuscule et donc une vitesse instantanée démesurée pour un geste
 * pourtant modéré. Sans ce plafond bas, l'inertie intégrée sur `PREVIEW_INERTIA_HALF_LIFE` ferait
 * largement dépasser la vue de trois quarts (jusqu'au profil complet) — le contraire de « légère ».
 * À ce plafond, le supplément de rotation total dû à l'inertie seule reste sous ~36°.
 */
export const PREVIEW_MAX_DRAG_VELOCITY = 2.4
/** Demi-vie de l'inertie après un lâcher (s) : « légère », s'arrête vite. */
export const PREVIEW_INERTIA_HALF_LIFE = 0.18
/**
 * Amplitude maximale (dans un sens comme dans l'autre) de la rotation ajoutée par le glisser du
 * doigt, en plus de la pose de repos et du balancement. Sans cette borne, un glisser tout à fait
 * ordinaire (la largeur de l'aperçu, ≈ 220–300 px, à `PREVIEW_DRAG_SENSITIVITY`) fait largement
 * dépasser 90° et retombe exactement dans le bug d'origine : le personnage tourne le dos à la
 * caméra, cette fois à cause du doigt plutôt que de l'ancienne rotation automatique. La borne
 * laisse largement de quoi regarder le personnage de profil (utile pour juger une tenue, un
 * accessoire) sans jamais atteindre le dos.
 */
export const PREVIEW_MAX_DRAG_OFFSET_DEG = 60

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Ramène un angle dans [-π, π] : évite une dérive numérique après un usage prolongé. */
export function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2
  let a = angle % twoPi
  if (a > Math.PI) a -= twoPi
  else if (a < -Math.PI) a += twoPi
  return a
}

/** Décalage du balancement doux à l'instant `t` (secondes écoulées), en radians. */
export function previewSwayAngle(t: number, amplitudeDeg = PREVIEW_SWAY_DEG, speed = PREVIEW_SWAY_SPEED): number {
  return Math.sin(t * speed) * degToRad(amplitudeDeg)
}

export interface DragStep {
  /** Rotation à ajouter à l'offset accumulé (radians). */
  offsetDelta: number
  /** Vitesse angulaire instantanée (rad/s), retenue pour l'inertie après un lâcher. */
  velocity: number
}

/**
 * Traduit un déplacement de glisser (pixels horizontaux, durée en ms) en rotation et vitesse
 * angulaire. `deltaTimeMs` est plancher à ~4 ms (240 Hz) pour éviter une vitesse démesurée quand
 * deux évènements pointer arrivent quasi simultanément.
 */
export function dragToAngularStep(
  deltaX: number,
  deltaTimeMs: number,
  radiansPerPixel = PREVIEW_DRAG_SENSITIVITY,
): DragStep {
  const offsetDelta = deltaX * radiansPerPixel
  const dtSeconds = Math.max(deltaTimeMs, 1000 / 240) / 1000
  const rawVelocity = offsetDelta / dtSeconds
  const velocity = Math.max(-PREVIEW_MAX_DRAG_VELOCITY, Math.min(PREVIEW_MAX_DRAG_VELOCITY, rawVelocity))
  return { offsetDelta, velocity }
}

/**
 * Amortissement exponentiel d'une vitesse angulaire (inertie après un lâcher de glisser).
 * Retombe exactement à 0 sous un seuil imperceptible, pour ne pas faire tourner le personnage
 * indéfiniment à une vitesse infinitésimale.
 */
export function decayVelocity(velocity: number, deltaSeconds: number, halfLife = PREVIEW_INERTIA_HALF_LIFE): number {
  if (velocity === 0) return 0
  const next = velocity * Math.pow(0.5, deltaSeconds / halfLife)
  return Math.abs(next) < 0.001 ? 0 : next
}

/**
 * Borne la rotation accumulée par le glisser à `±maxDeg` : au-delà, le personnage reste de profil
 * au pire, jamais de dos (voir `PREVIEW_MAX_DRAG_OFFSET_DEG`). Appelée à la fois pendant le glisser
 * (`dragToAngularStep`) et pendant l'inertie qui suit un lâcher, pour qu'aucun des deux chemins ne
 * puisse dépasser la borne.
 */
export function clampDragOffset(offset: number, maxDeg = PREVIEW_MAX_DRAG_OFFSET_DEG): number {
  const max = degToRad(maxDeg)
  return Math.max(-max, Math.min(max, offset))
}
