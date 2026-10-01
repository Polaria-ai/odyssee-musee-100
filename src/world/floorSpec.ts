/**
 * Matières des sols (WEL-923) : données pures, sans three.js ni DOM, partagées par la géométrie
 * (`roomGeometry.ts` : UV en coordonnées monde), le chargement (`floorTextures.ts`) et les tests.
 *
 * Règle (docs/CHARTE-3D.md §4.1) : la texture MULTIPLIE les couleurs de sommet de la charte, elle ne porte
 * jamais la couleur. Chaque matière a une carte de détail (niveaux de gris linéaires, moyenne `detailMean`)
 * et une carte de normales, fabriquées par `scripts/build-floor-textures.mjs` dans `public/textures/floors/`.
 */
import type { WingId } from '../types'

export type FloorKind = 'marble' | 'terrazzo' | 'microcement' | 'carpet'

export interface FloorSpec {
  /** Côté du motif répété, en mètres : les UV valent `x / tileMeters`, `z / tileMeters` (coordonnées monde). */
  tileMeters: number
  /** Gain de relief de la carte de normales (modéré : la caméra plonge à 48°, un relief fort tremble). */
  normalScale: number
  /**
   * Moyenne (en lumière linéaire) de la carte de détail, mesurée sur le fichier par le script de fabrication
   * et vérifiée par `floorTextures.test.ts`. Le matériau est éclairci de `1 / detailMean` : la couleur
   * MOYENNE du sol reste exactement celle de la charte, seul le motif s'en écarte (par-dessus et par-dessous).
   */
  detailMean: number
  detailUrl: string
  normalUrl: string
}

/** Dossier public des textures de sol (servi par Vite et par Vercel tel quel). */
export const FLOOR_TEXTURE_DIR = '/textures/floors'

const spec = (kind: FloorKind, tileMeters: number, normalScale: number, detailMean: number): FloorSpec => ({
  tileMeters,
  normalScale,
  detailMean,
  detailUrl: `${FLOOR_TEXTURE_DIR}/${kind}-detail.webp`,
  normalUrl: `${FLOOR_TEXTURE_DIR}/${kind}-normal.webp`,
})

export const FLOOR_SPECS: Record<FloorKind, FloorSpec> = {
  marble: spec('marble', 2.5, 0.35, 0.906),
  terrazzo: spec('terrazzo', 6, 0.8, 0.817),
  microcement: spec('microcement', 5, 0.6, 0.740),
  carpet: spec('carpet', 7, 0.8, 0.741),
}

export const FLOOR_KINDS = Object.keys(FLOOR_SPECS) as FloorKind[]

/** Matière du sol de chaque salle : marbre au hall et aux Archives, terrazzo / microciment / moquette dans les ailes. */
export const ROOM_FLOOR_KIND: Record<WingId, FloorKind> = {
  hall: 'marble',
  archives: 'marble',
  infrastructures: 'terrazzo',
  industrialisation: 'microcement',
  culture: 'carpet',
}

/** UV en coordonnées monde : deux quads voisins (ou deux salles) lisent la matière au même endroit, sans raccord. */
export function worldUv(x: number, z: number, tileMeters: number): [number, number] {
  return [x / tileMeters, z / tileMeters]
}
