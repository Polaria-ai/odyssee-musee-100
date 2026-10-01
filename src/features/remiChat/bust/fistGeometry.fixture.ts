/**
 * Géométrie du poing et du menton de Rémi pour les tests de cinématique (WEL-927) : de quoi dire, sur le
 * squelette de test (`remiSkeleton.fixture.ts`), où est le poing à l'écran par rapport au menton.
 *
 * Mesures prises sur le maillage de `public/models/characters/remi.glb` (sommets pondérés à plus de 50 % par
 * l'os de la main, ramenés dans le repère de l'os par la matrice de liaison inverse) :
 *  - le poing, manchette comprise, s'étend de 0 à 18 cm le long de l'axe Y de l'os `LeftHand` / `RightHand`
 *    (le poignet est l'origine de l'os) et de ±7,5 cm de part et d'autre ; hors manchette, le poing proprement
 *    dit va de 4 à 17 cm de l'origine, pour un rayon d'environ 5,5 cm (mesuré sur les captures de la page de
 *    démonstration : un poing de 8 à 9 cm de haut pour 14 cm de long) ;
 *  - le bout du menton est, dans le repère de l'os `Head`, à (0 ; 1,9 ; 10,5) cm : sommets de la tête les
 *    plus bas dans le plan médian (|x| < 2,5 cm) et à plus de 4 cm de la nuque en profondeur. L'os `Head`
 *    lui-même est ~5 cm plus haut que le menton : l'ancien test de la réflexion le prenait pour le menton,
 *    d'où un poing qui touchait le menton sans qu'aucun test ne bronche.
 *
 * Le squelette de test est en centimètres (le nœud `Armature` porte l'échelle 0,01) puis à l'échelle du jeu.
 */
import { Vector3, type Object3D, type PerspectiveCamera } from 'three'
import { REMI_GAME_SCALE } from './remiSkeleton.fixture'

/** Un centimètre du squelette de test, en mètres dans le monde. */
export const CM = 0.01 * REMI_GAME_SCALE

/** Échantillons le long de l'axe du poing (cm depuis l'origine de l'os de la main) : manchette, milieu, jointures. */
export const FIST_AXIS_CM: readonly number[] = [4, 8, 12, 17]
/** Rayon du poing (mètres du monde). */
export const FIST_RADIUS = 5.5 * CM
/** Bout du menton dans le repère de l'os `Head` (cm). */
export const CHIN_HEAD_LOCAL_CM: readonly [number, number, number] = [0, 1.9, 10.5]

const _p = new Vector3()
const _q = new Vector3()

/** Bout du menton dans le monde. */
export function chinWorld(head: Object3D, out = new Vector3()): Vector3 {
  return head.localToWorld(out.set(CHIN_HEAD_LOCAL_CM[0], CHIN_HEAD_LOCAL_CM[1], CHIN_HEAD_LOCAL_CM[2]))
}

/** Ordonnée écran (NDC) du bout du menton. */
export function chinNdcY(head: Object3D, camera: PerspectiveCamera): number {
  return chinWorld(head, _p).project(camera).y
}

/** Ordonnée écran (NDC) du HAUT de la silhouette du poing : chaque échantillon de l'axe, monté d'un rayon. */
export function fistTopNdcY(hand: Object3D, camera: PerspectiveCamera): number {
  let top = -Infinity
  for (const y of FIST_AXIS_CM) {
    hand.localToWorld(_q.set(0, y, 0))
    _q.y += FIST_RADIUS
    top = Math.max(top, _q.project(camera).y)
  }
  return top
}

/** Étendue écran (NDC) du poing en x, rayon compris : [min, max]. La perspective est dans `project`, le rayon est ajouté dans le monde. */
export function fistNdcX(hand: Object3D, camera: PerspectiveCamera): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const y of FIST_AXIS_CM) {
    hand.localToWorld(_q.set(0, y, 0))
    const centre = _p.copy(_q).project(camera).x
    _p.copy(_q)
    _p.x += FIST_RADIUS
    const radius = Math.abs(_p.project(camera).x - centre)
    min = Math.min(min, centre - radius)
    max = Math.max(max, centre + radius)
  }
  return { min, max }
}

/** Ordonnée écran (NDC) du centre du poing (milieu de l'axe) : sert à savoir si le poing est dans la partie visible du buste. */
export function fistCentreNdcY(hand: Object3D, camera: PerspectiveCamera): number {
  hand.localToWorld(_q.set(0, (FIST_AXIS_CM[0] + FIST_AXIS_CM[FIST_AXIS_CM.length - 1]) / 2, 0))
  return _q.project(camera).y
}
