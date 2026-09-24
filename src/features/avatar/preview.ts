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
