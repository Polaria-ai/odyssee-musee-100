/** Types du script `atlas-padding.mjs` (importé par ses tests et par `clean-texture-stains.mjs`). */
export function padIslands(
  pixels: Uint8Array,
  channels: number,
  width: number,
  height: number,
  island: Int32Array,
  radius?: number,
): {
  /** COPIE de l'image dilatée (l'originale n'est pas modifiée). */
  pixels: Uint8Array
  /** 1 = texel de vide rempli. */
  padded: Uint8Array
  /** Îlot auquel appartient chaque texel après la dilatation (0 = vide resté vide). */
  territory: Int32Array
}
