import type { AABB } from '../types'

/** Mobilier : moitié de la largeur et de la profondeur, soit 75 % de surface bloquée en moins. */
export const OBJECT_COLLIDER_SCALE = 0.5

/**
 * Garde un noyau solide centré dans un objet pour faciliter son contournement.
 * Appliqué uniquement aux colliders du mobilier : l'emprise visuelle, les murs,
 * les cimaises et les zones d'interaction gardent leurs dimensions propres.
 * Ne modifie jamais la boîte reçue (elle peut aussi servir au rendu).
 */
export function compactObjectCollider(box: AABB): AABB {
  const centerX = (box.minX + box.maxX) / 2
  const centerZ = (box.minZ + box.maxZ) / 2
  const halfWidth = (box.maxX - box.minX) * OBJECT_COLLIDER_SCALE / 2
  const halfDepth = (box.maxZ - box.minZ) * OBJECT_COLLIDER_SCALE / 2
  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minZ: centerZ - halfDepth,
    maxZ: centerZ + halfDepth,
  }
}
