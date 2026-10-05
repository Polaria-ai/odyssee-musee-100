/**
 * Détection du tap sur la plaque Polaria. En jeu, une surimpression DOM plein écran (`TouchJoystick`, z-index
 * 10) recouvre le canvas et capte tous les gestes : les événements `onClick` de react-three-fiber n'y
 * arrivent donc jamais. On écoute `window` et on projette la plaque à l'écran avec la caméra courante : un
 * tap court dont le point tombe dans le rectangle projeté (agrandi à une cible tactile confortable) ouvre la
 * carte. Fonctions pures ou presque (aucune allocation d'objet three.js par appel hors du scratch partagé).
 */
import { Vector3 } from 'three'
import type { Camera } from 'three'
import { plateCorners } from './plateLayout'
import type { PlateSlot } from './plateLayout'

export interface ScreenRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Cible tactile minimale (px) : un doigt n'a pas la précision d'un curseur, la plaque est petite à l'écran. */
export const MIN_TAP_TARGET_PX = 44

/** Un tap : appui court et quasi immobile (le joystick, lui, compte < 250 ms et < 10 px). */
export const TAP_LIMITS = { maxDurationMs: 320, maxDistancePx: 12 } as const

/** Agrandit `rect` (autour de son centre) pour que chaque dimension fasse au moins `minSize` px. */
export function expandRect(rect: ScreenRect, minSize: number): ScreenRect {
  const width = rect.right - rect.left
  const height = rect.bottom - rect.top
  const growX = Math.max(0, minSize - width) / 2
  const growY = Math.max(0, minSize - height) / 2
  return { left: rect.left - growX, top: rect.top - growY, right: rect.right + growX, bottom: rect.bottom + growY }
}

export function rectContains(rect: ScreenRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

export interface TapTracker {
  down: (pointerId: number, x: number, y: number, time: number) => void
  /** Vrai si l'appui relâché ici est un tap (court, peu déplacé, même pointeur que l'appui). */
  up: (pointerId: number, x: number, y: number, time: number) => boolean
  cancel: (pointerId: number) => void
}

export function createTapTracker(limits: { maxDurationMs: number; maxDistancePx: number } = TAP_LIMITS): TapTracker {
  const downs = new Map<number, { x: number; y: number; time: number }>()
  return {
    down(pointerId, x, y, time) {
      downs.set(pointerId, { x, y, time })
    },
    up(pointerId, x, y, time) {
      const start = downs.get(pointerId)
      downs.delete(pointerId)
      if (!start) return false
      return time - start.time <= limits.maxDurationMs && Math.hypot(x - start.x, y - start.y) <= limits.maxDistancePx
    },
    cancel(pointerId) {
      downs.delete(pointerId)
    },
  }
}

const scratch = new Vector3()

/**
 * Rectangle écran (clientX/Y) de la plaque vue par `camera`, dans le cadre `viewport` du canvas ; `null`
 * si un coin est derrière la caméra ou au-delà du plan lointain (plaque hors champ). Pas d'allocation
 * d'objet three.js : un seul `Vector3` partagé.
 */
export function projectPlateRect(
  camera: Camera,
  viewport: { left: number; top: number; width: number; height: number },
  slot: PlateSlot,
): ScreenRect | null {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const [x, y, z] of plateCorners(slot)) {
    scratch.set(x, y, z).project(camera)
    if (!(scratch.z > -1 && scratch.z < 1)) return null
    const sx = viewport.left + ((scratch.x + 1) / 2) * viewport.width
    const sy = viewport.top + ((1 - scratch.y) / 2) * viewport.height
    if (sx < left) left = sx
    if (sx > right) right = sx
    if (sy < top) top = sy
    if (sy > bottom) bottom = sy
  }
  return { left, top, right, bottom }
}
