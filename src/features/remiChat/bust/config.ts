/**
 * Réglages du buste partagés entre la scène (React) et les tests (cadrage, mains dans le cadre) :
 * aucun import three ni React.
 */
import type { RemiBustVariant } from '../contract'

/** Champ vertical de la caméra : un téléobjectif léger, flatteur pour un portrait (peu de perspective). */
export const BUST_FOV = 26

/** Graine par défaut des gestes (déterministe : deux ouvertures du chat jouent la même chorégraphie). */
export const DEFAULT_SEED = 0x7e31

/** Trois quarts léger vers le chat (radians) : Rémi reste de face à la caméra, à peine tourné. */
export const BODY_YAW: Readonly<Record<RemiBustVariant, number>> = { split: 0.2, fullscreen: 0.12 }

/** Côté du chat (+1 = droite de l'écran) et regard vers le bas (le chat est sous le buste sur téléphone). */
export const ATTENTION: Readonly<Record<RemiBustVariant, { side: number; down: number }>> = {
  split: { side: 1, down: 0 },
  fullscreen: { side: 0.35, down: 0.7 },
}
