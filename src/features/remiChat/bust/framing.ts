/**
 * Cadrage « affiche » du buste de Rémi · IA : de la tête au milieu du torse. Calcul PUR (aucun import
 * three ni React) à partir de mesures prises sur les os du squelette, refait à chaque changement de
 * ratio du conteneur. Aucune constante de position : tout dérive de la taille mesurée du personnage.
 *
 * Deux dispositions (`RemiBustVariant`) :
 *  - `split` (PC, moitié gauche de l'écran) : le bloc tête → milieu du torse est centré dans toute la
 *    hauteur du conteneur ; le corps se dissout sous la coupe jusqu'au bord bas ;
 *  - `fullscreen` (téléphone portrait) : tête et buste tiennent dans les `FULLSCREEN_BOTTOM_LIMIT`
 *    (60 %) supérieurs, le bas étant couvert par les bulles et la saisie ; le corps est dissous à 60 %.
 *
 * Les mains sont gardées dans le cadre de deux façons : la largeur de cadre vise l'envergure des
 * gestes (`HAND_REACH_FACTOR` × la demi-largeur d'épaules) et, si le conteneur est trop étroit pour
 * ça sans rapetisser le sujet de plus de `MAX_SHRINK`, `reach` (0 à 1) réduit l'amplitude des gestes.
 */
import type { RemiBustVariant } from '../contract'

/** Mesures du personnage (mètres, repère du monde, personnage de face à la caméra). */
export interface BustMetrics {
  /** Sommet du crâne. */
  headTopY: number
  /** Centre de la tête (centre du halo). */
  headCenterY: number
  /** Ligne de coupe : milieu du torse. */
  cutY: number
  /** Demi-largeur des épaules (os des bras, de part et d'autre de l'axe). */
  shoulderHalfWidth: number
}

export interface FramingInput {
  metrics: BustMetrics
  variant: RemiBustVariant
  /** Largeur / hauteur du conteneur. */
  aspect: number
  /** Champ vertical de la caméra, en degrés. */
  fovDeg: number
}

export interface Framing {
  /** Distance caméra → plan du personnage. */
  distance: number
  /** Hauteur de la caméra et de sa visée (la caméra ne bascule pas : pas de déformation de portrait). */
  cameraY: number
  /** Hauteur de monde visible dans le conteneur, au plan du personnage. */
  frameHeight: number
  /** Positions verticales, 0 = haut du conteneur, 1 = bas. */
  headTopFraction: number
  headCenterFraction: number
  /** Le corps est plein jusqu'ici… */
  cutFraction: number
  /** … et entièrement fondu ici. */
  fadeEndFraction: number
  /** 0,4 à 1 : part de l'amplitude nominale des gestes de bras que le cadre permet. */
  reach: number
}

/** Envergure nominale des mains par rapport à l'axe, en multiples de la demi-largeur d'épaules. */
export const HAND_REACH_FACTOR = 1.75
/** Les mains en geste avancent d'au plus ce multiple de la demi-largeur d'épaules devant le torse (~0,5 m) : elles paraissent plus larges. */
export const HAND_FORWARD_FACTOR = 2.4
/** Les mains ne passent jamais au-delà de cette part de la demi-largeur du cadre. */
export const FRAME_SAFE_FRACTION = 0.92
/** Le sujet ne rapetisse pas de plus de cette part pour laisser de la place aux mains. */
export const MAX_SHRINK = 1.45
export const MIN_REACH = 0.4
/** Plafond de la zone utile en plein écran : « tête et buste dans les 60 % supérieurs ». */
export const FULLSCREEN_BOTTOM_LIMIT = 0.6

interface Layout {
  topMargin: number
  /** Limite basse de la zone visible (le corps est entièrement fondu à cette hauteur). */
  bottomLimit: number
  /** Hauteur minimale du fondu sous la coupe, en fraction du conteneur (il peut être plus long). */
  fade: number
}

const LAYOUTS: Record<RemiBustVariant, Layout> = {
  split: { topMargin: 0.07, bottomLimit: 1, fade: 0.14 },
  fullscreen: { topMargin: 0.06, bottomLimit: FULLSCREEN_BOTTOM_LIMIT, fade: 0.1 },
}

export function layoutOf(variant: RemiBustVariant): Readonly<Layout> {
  return LAYOUTS[variant]
}

export function computeFraming({ metrics, variant, aspect, fovDeg }: FramingInput): Framing {
  const { topMargin, bottomLimit, fade } = LAYOUTS[variant]
  const safeAspect = Number.isFinite(aspect) && aspect > 0.05 ? aspect : 1
  const tanHalf = Math.tan((Math.min(Math.max(fovDeg, 5), 120) * Math.PI) / 360)
  const block = Math.max(metrics.headTopY - metrics.cutY, 1e-3)
  const halfWidth = Math.max(metrics.shoulderHalfWidth, 1e-3)

  // Le bloc tête → coupe tient entre la marge haute et la coupe la plus basse permise.
  const cutLimit = bottomLimit - fade
  const heightForBlock = block / (cutLimit - topMargin)
  // Largeur : les mains en gestes doivent tenir (à `FRAME_SAFE_FRACTION` du demi-cadre). Une main avancée de
  // `handForward` paraît agrandie de d / (d − handForward) avec d = H / (2 tanHalf) la distance de la caméra :
  // E · H / (H − c) ≤ s · H · a / 2, avec c = handForward · 2 tanHalf, donne H ≥ c + 2E / (s · a).
  const handForward = halfWidth * HAND_FORWARD_FACTOR
  const forwardTerm = handForward * 2 * tanHalf
  const heightForHands = forwardTerm + (2 * halfWidth * HAND_REACH_FACTOR) / (FRAME_SAFE_FRACTION * safeAspect)
  // On ne rapetisse pas le sujet au-delà de `MAX_SHRINK` : au-delà, c'est l'amplitude des gestes qui cède.
  const frameHeight = Math.min(Math.max(heightForBlock, heightForHands), heightForBlock * MAX_SHRINK)

  const blockFraction = block / frameHeight
  const headTopFraction = topMargin + (cutLimit - topMargin - blockFraction) / 2
  const cutFraction = headTopFraction + blockFraction
  // Excursion permise des mains (monde, perspective déduite), en multiples de la demi-largeur d'épaules.
  const allowed = (FRAME_SAFE_FRACTION * safeAspect * Math.max(frameHeight - forwardTerm, 0)) / 2 / halfWidth
  const reach = Math.min(1, Math.max(MIN_REACH, (allowed - 1) / (HAND_REACH_FACTOR - 1)))

  return {
    distance: frameHeight / (2 * tanHalf),
    cameraY: metrics.headTopY - (0.5 - headTopFraction) * frameHeight,
    frameHeight,
    headTopFraction,
    headCenterFraction: headTopFraction + (metrics.headTopY - metrics.headCenterY) / frameHeight,
    cutFraction,
    // Le corps est plein jusqu'à la coupe puis se dissout jusqu'à la limite de la zone utile (jamais de bord net).
    fadeEndFraction: bottomLimit,
    reach,
  }
}

/** Dégradé de masque CSS (corps plein jusqu'à la coupe, fondu ensuite) à poser sur le conteneur. */
export function fadeMask(framing: Pick<Framing, 'cutFraction' | 'fadeEndFraction'>): string {
  const from = (framing.cutFraction * 100).toFixed(2)
  const to = (framing.fadeEndFraction * 100).toFixed(2)
  return `linear-gradient(to bottom, #000 0%, #000 ${from}%, transparent ${to}%)`
}
