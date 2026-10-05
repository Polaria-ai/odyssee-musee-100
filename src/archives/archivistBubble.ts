/**
 * Bulle « … » de l'Archiviste : règle pure (nombres uniquement, aucun three/React), testable seule.
 * Propriétaire : workflow « Archives de 2040 ».
 *
 * La caméra est AU SUD du joueur et plonge de 48° (`cameraRig.pitchDeg`). Un point à la hauteur `h` se
 * projette à l'écran comme le point du sol situé `h / tan(48°)` ≈ 0,9 × h plus au nord. La bulle (de 2,05 m
 * à 2,45 m) tombe donc 1,85 à 2,2 m au nord de l'Archiviste ; le corps du joueur (1,7 m) couvre, lui, les
 * 1,5 m au nord de ses pieds. Un joueur qui se tient juste derrière elle, dans l'axe de la caméra, a donc la
 * bulle posée sur le torse. On la cache alors : le bouton « Parler à l'Archiviste » reste affiché, et la bulle
 * revient dès qu'il s'écarte (constaté sur capture à 1,3 m, WEL-928).
 */

/** Du côté nord de l'Archiviste (`dz` négatif) : plus près que 0,3 m, la bulle est au-dessus de la tête du joueur. */
export const BUBBLE_BEHIND_NEAR = 0.3
/** … et plus loin que 2,4 m, le joueur est sorti de dessous la bulle. */
export const BUBBLE_BEHIND_FAR = 2.4
/** Demi-largeur de la zone (bulle 0,26 m + corps du joueur 0,35 m, arrondi). */
export const BUBBLE_BEHIND_HALF_WIDTH = 0.7

/**
 * Le joueur est-il derrière l'Archiviste, sous sa bulle à l'écran ?
 * `dx` / `dz` : vecteur de l'Archiviste vers le joueur, dans le repère du monde (le nord est −Z).
 */
export function playerCoversBubble(dx: number, dz: number): boolean {
  return dz <= -BUBBLE_BEHIND_NEAR && dz >= -BUBBLE_BEHIND_FAR && Math.abs(dx) <= BUBBLE_BEHIND_HALF_WIDTH
}
