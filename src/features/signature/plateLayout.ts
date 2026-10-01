/**
 * Emplacement de la plaque Polaria (easter egg) dans le hall. Fonction pure : aucune dépendance à three.js
 * ni au DOM, donc importable aussi par les tests E2E pour viser la plaque à l'écran.
 *
 * Choix : mur NORD du hall, côté est (à droite de la porte de l'Industrialisation), face au sud.
 * - La caméra du jeu regarde toujours vers -Z (`src/player/Player.tsx`, orientation fixe) : seule une
 *   surface qui fait face à +Z (`rotationY = 0`) se lit de face, et le mur nord est la seule paroi du hall
 *   qui le fait. Les murs est et ouest, vus de biais, la rendraient illisible.
 * - Rien de haut au sud du joueur : la plaque est une feuille de 3 cm devant un mur, elle ne cache jamais
 *   le joueur (`occlusion.ts` ne s'en occupe pas, elle n'est pas un obstacle).
 * - À x = 8,6 : loin du centre du hall (comptoir, arbre, bannière), dans le tronçon de mur libre entre la
 *   colonne (x = 6,5, à 3,3 m devant le mur) et le coin, au-dessus du lambris (0,95 m), de la jardinière
 *   d'angle (x = 9,8, 1,3 m de haut) et sous la corniche ; les appliques du mur nord sont en x = ±4,5. Un peu
 *   plus à l'est que le milieu du tronçon : vue d'un joueur qui longe le mur, la colonne ne la masque pas.
 * - Hauteur des yeux : centre à 1,75 m (bas 1,39 m, haut 2,11 m).
 */
import { HALL_HALF_DEPTH } from '../../world/constants'
import { dims } from '../../styles/tokens'

/** Dimensions de la plaque (m), rapport 2,5:1 comme la texture (512 × 205). */
export const PLATE_WIDTH = 1.8
export const PLATE_HEIGHT = 0.72

/** Centre de la plaque : abscisse, hauteur (yeux). */
export const PLATE_CENTER_X = 8.6
export const PLATE_CENTER_Y = 1.75

/** Écart entre la plaque et la face intérieure du mur (m) : évite le scintillement de profondeur. */
export const PLATE_WALL_GAP = 0.03

/** Face intérieure du mur nord du hall (m) : le mur est centré sur `-HALL_HALF_DEPTH`. */
export const NORTH_WALL_INNER_Z = -HALL_HALF_DEPTH + dims.wallThickness / 2

export interface PlateSlot {
  /** Centre de la plaque (x, y, z), en mètres. */
  position: [number, number, number]
  /** Même convention que `FrameSlot` : 0 = face à +Z. */
  rotationY: number
  width: number
  height: number
}

export const SIGNATURE_PLATE: PlateSlot = {
  position: [PLATE_CENTER_X, PLATE_CENTER_Y, NORTH_WALL_INNER_Z + PLATE_WALL_GAP],
  rotationY: 0,
  width: PLATE_WIDTH,
  height: PLATE_HEIGHT,
}

/** Les quatre coins de la plaque dans le monde (haut-gauche, haut-droit, bas-droit, bas-gauche vus de face). */
export function plateCorners(slot: PlateSlot): Array<[number, number, number]> {
  const [cx, cy, cz] = slot.position
  const hw = slot.width / 2
  const hh = slot.height / 2
  const cos = Math.cos(slot.rotationY)
  const sin = Math.sin(slot.rotationY)
  // Un décalage local (dx, dy) tourne autour de Y : x' = cx + dx·cos, z' = cz − dx·sin (convention three.js).
  const at = (dx: number, dy: number): [number, number, number] => [cx + dx * cos, cy + dy, cz - dx * sin]
  return [at(-hw, hh), at(hw, hh), at(hw, -hh), at(-hw, -hh)]
}
