/**
 * Signature Polaria : constantes de marque partagées par l'écran titre, le badge du jeu, la carte de
 * crédits et la plaque 3D du hall (décision de Baptiste, WEL-922 : « poser le droit » sobrement, plus un
 * easter egg).
 *
 * Logo officiel : `public/brand/polaria-logo.webp`, tiré de `polaria-logo-official.png` (3738 × 819, « p✳lar »
 * en blanc et « ia » en jaune, fond transparent) par un simple redimensionnement à 480 px de large (sharp,
 * lanczos3, WebP qualité 92) : aucune couleur modifiée, 8 Ko. 480 px couvrent le badge (73 px de large),
 * le titre (≈ 110 px) et la plaque (texture ≤ 512 px) jusqu'à un écran 3×.
 */

/** Site de Polaria : seule destination externe de la signature (nouvel onglet, `rel="noopener"`). */
export const POLARIA_URL = 'https://www.polaria.ai'

/** Fichier et proportions du logo (le rapport sert à calculer la largeur d'une hauteur voulue). */
export const POLARIA_LOGO = { url: '/brand/polaria-logo.webp', width: 480, height: 105 } as const

/** Largeur d'affichage (px) du logo pour une hauteur donnée, arrondie. */
export function logoWidthFor(height: number): number {
  return Math.round((height * POLARIA_LOGO.width) / POLARIA_LOGO.height)
}
