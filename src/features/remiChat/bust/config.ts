/**
 * Réglages du buste partagés entre la scène (React) et les tests (cadrage, mains dans le cadre) :
 * aucun import three ni React.
 */
import type { ChatPersona, RemiBustVariant } from '../contract'

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

/**
 * Le cadrage mesure-t-il le sommet RÉEL du maillage (cheveux compris) plutôt que l'os `head_end` ?
 * - Rémi : non. Il est chauve : son os `head_end` est à 1,4 cm du sommet du crâne, et son cadrage, validé, ne bouge pas.
 * - L'Archiviste : oui. Son chignon dépasse l'os de 3,4 cm (mesuré dans le navigateur, 03/10/2026) : sans cela, le haut
 *   de sa tête, cheveux compris, frôlerait le bord du cadre (marge de 7 %) au lieu de tenir « tête entière ».
 * Le sommet est lu sur le maillage lui-même (`measureBust`), donc aucune valeur à tenir à jour si le modèle change.
 */
export const FIT_MESH_TOP: Readonly<Record<ChatPersona, boolean>> = { remi: false, archiviste: true }
