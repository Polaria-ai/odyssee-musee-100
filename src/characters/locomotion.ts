/**
 * Choix du clip de déplacement et cadence de la marche à partir de la vitesse (m/s) d'un personnage.
 * Propriétaire : agent personnages. Fonctions pures, sans three ni React.
 */

/** Vitesse de marche du joueur (`WALK_SPEED` de `src/player/Player.tsx`, sa course est à 5,6 m/s). */
export const WALK_REFERENCE_SPEED = 3.2

/**
 * Vitesse au-dessus de laquelle on passe de « idle » à « walk » (m/s). Le joueur accélère à
 * 14 m/s² : ce seuil est franchi en ~15 ms, sans latence visible, mais il filtre le bruit d'une
 * vitesse quasi nulle (interpolation réseau d'un visiteur distant, `MOVE_EPSILON` = 0,01 du joueur).
 */
export const WALK_ENTER_SPEED = 0.2

/**
 * Seuil de retour à « idle » quand le personnage marche déjà (hystérésis) : sans lui, une vitesse
 * qui oscille autour de `WALK_ENTER_SPEED` ferait clignoter idle ↔ walk (et un fondu à chaque fois).
 */
export const WALK_EXIT_SPEED = 0.08

export type LocomotionClip = 'idle' | 'walk'

/**
 * Clip à jouer pour une vitesse donnée : « walk » au-delà de `WALK_ENTER_SPEED`, « idle » sinon.
 * `current` (facultatif) active l'hystérésis : un personnage qui marche déjà ne s'arrête qu'en
 * dessous de `WALK_EXIT_SPEED`. Vitesse non finie ou négative → traitée comme 0 / sa valeur absolue.
 */
export function pickLocomotionClip(speed: number, current?: LocomotionClip): LocomotionClip {
  const s = Number.isFinite(speed) ? Math.abs(speed) : 0
  return s > (current === 'walk' ? WALK_EXIT_SPEED : WALK_ENTER_SPEED) ? 'walk' : 'idle'
}

/**
 * Cadence de lecture du clip « walk » à `WALK_REFERENCE_SPEED` (marche normale du joueur).
 * Le clip Meshy est une marche lente (~0,5 m/s à l'échelle native, 3 pas de chaque pied en 4,2 s) :
 * le caler sur les 3,2 m/s du joueur demanderait ×7 (des jambes qui vibrent). ×2 (≈ 2,8 pas/s)
 * reste une marche vive et lisible ; les pieds glissent un peu, c'est un rendu cartoon.
 */
export const WALK_TIMESCALE_AT_REFERENCE = 2
export const WALK_TIMESCALE_MIN = 0.6
export const WALK_TIMESCALE_MAX = 3

/**
 * Vitesse de lecture de la marche, proportionnelle à la vitesse (m/s) et bornée à
 * [`WALK_TIMESCALE_MIN`, `WALK_TIMESCALE_MAX`] : la course du joueur (5,6 m/s) donne ×3,5 non bornée,
 * donc plafonnée à ×3 ; un pas très lent ne descend pas sous ×0,6.
 */
export function walkTimeScale(speed: number): number {
  const s = Number.isFinite(speed) ? Math.abs(speed) : 0
  const scale = (s / WALK_REFERENCE_SPEED) * WALK_TIMESCALE_AT_REFERENCE
  return Math.min(WALK_TIMESCALE_MAX, Math.max(WALK_TIMESCALE_MIN, scale))
}
