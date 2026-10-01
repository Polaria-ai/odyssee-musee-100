import { describe, expect, it } from 'vitest'
import {
  FRAME_SAFE_FRACTION,
  FULLSCREEN_BOTTOM_LIMIT,
  HAND_FORWARD_FACTOR,
  HAND_REACH_FACTOR,
  MIN_REACH,
  computeFraming,
  fadeMask,
  layoutOf,
  type BustMetrics,
  type FramingInput,
} from './framing'
import type { RemiBustVariant } from '../contract'

/** Mesures prises sur le vrai squelette de Rémi dans le jeu (bout de tête, milieu du torse, épaules). */
const METRICS: BustMetrics = { headTopY: 1.776, headCenterY: 1.63, cutY: 1.12, shoulderHalfWidth: 0.2 }
const FOV = 26
const VARIANTS: RemiBustVariant[] = ['split', 'fullscreen']
const ASPECTS = [0.3, 0.46, 0.6, 0.8, 1, 1.5, 2.2]

const input = (variant: RemiBustVariant, aspect: number, metrics = METRICS): FramingInput => ({ metrics, variant, aspect, fovDeg: FOV })

describe('computeFraming', () => {
  for (const variant of VARIANTS) {
    for (const aspect of ASPECTS) {
      it(`${variant}, ratio ${aspect} : tête entière, coupe à mi-torse, fondu dans la zone utile`, () => {
        const f = computeFraming(input(variant, aspect))
        const { topMargin, bottomLimit } = layoutOf(variant)
        // Tête entière : le sommet du crâne est dans le cadre, avec sa marge (jamais coupé au front).
        expect(f.headTopFraction).toBeGreaterThanOrEqual(topMargin - 1e-9)
        expect(f.headCenterFraction).toBeGreaterThan(f.headTopFraction)
        // Ordre vertical : tête, centre de tête, coupe, fin du fondu, limite de la zone.
        expect(f.cutFraction).toBeGreaterThan(f.headCenterFraction)
        expect(f.fadeEndFraction).toBeGreaterThan(f.cutFraction)
        expect(f.fadeEndFraction).toBeLessThanOrEqual(bottomLimit + 1e-9)
        // Les positions du cadre retombent sur les mesures du personnage.
        expect(f.cameraY + (0.5 - f.headTopFraction) * f.frameHeight).toBeCloseTo(METRICS.headTopY, 9)
        expect(f.cameraY + (0.5 - f.cutFraction) * f.frameHeight).toBeCloseTo(METRICS.cutY, 9)
        expect(f.cameraY + (0.5 - f.headCenterFraction) * f.frameHeight).toBeCloseTo(METRICS.headCenterY, 9)
        // La caméra voit bien `frameHeight` à `distance` avec le champ demandé.
        expect(2 * f.distance * Math.tan((FOV * Math.PI) / 360)).toBeCloseTo(f.frameHeight, 9)
      })

      it(`${variant}, ratio ${aspect} : les mains des gestes tiennent dans la largeur du cadre`, () => {
        const f = computeFraming(input(variant, aspect))
        expect(f.reach).toBeGreaterThanOrEqual(MIN_REACH)
        expect(f.reach).toBeLessThanOrEqual(1)
        const halfFrameWidth = (f.frameHeight * aspect) / 2
        const handExcursion = METRICS.shoulderHalfWidth * (1 + (HAND_REACH_FACTOR - 1) * f.reach)
        // Une main avancée de `handForward` paraît agrandie de d / (d − handForward).
        const handForward = METRICS.shoulderHalfWidth * HAND_FORWARD_FACTOR
        const apparent = (handExcursion * f.distance) / (f.distance - handForward)
        // Tant que reach > MIN_REACH la marge est exacte ; au plancher, le cadre est trop étroit pour mieux.
        if (f.reach > MIN_REACH + 1e-9) expect(apparent).toBeLessThanOrEqual(FRAME_SAFE_FRACTION * halfFrameWidth + 1e-9)
      })
    }
  }

  it('plein écran : tête et buste dans les 60 % supérieurs (téléphone portrait 390 × 844 compris)', () => {
    for (const aspect of [390 / 844, 360 / 780, 430 / 932, 0.4]) {
      const f = computeFraming(input('fullscreen', aspect))
      expect(f.fadeEndFraction).toBeLessThanOrEqual(FULLSCREEN_BOTTOM_LIMIT + 1e-9)
      expect(f.cutFraction).toBeLessThan(FULLSCREEN_BOTTOM_LIMIT)
    }
  })

  it('split : le bloc tête → torse est centré dans la zone utile', () => {
    const f = computeFraming(input('split', 0.8))
    const { topMargin, bottomLimit, fade } = layoutOf('split')
    const above = f.headTopFraction - topMargin
    const below = bottomLimit - fade - f.cutFraction
    expect(above).toBeCloseTo(below, 9)
  })

  it('ratio large (cadre plus large que haut) : le sujet se cale sur la hauteur, les gestes gardent leur amplitude', () => {
    const f = computeFraming(input('split', 2.2))
    expect(f.reach).toBe(1)
    const { topMargin, bottomLimit, fade } = layoutOf('split')
    expect(f.headTopFraction).toBeCloseTo(topMargin, 9)
    expect(f.cutFraction).toBeCloseTo(bottomLimit - fade, 9)
    expect(f.fadeEndFraction - f.cutFraction).toBeCloseTo(fade, 9) // cadre calé sur la hauteur : fondu minimal
  })

  it('le fondu va toujours jusqu\'à la limite de la zone utile (pas de bord net, pas de bande vide)', () => {
    for (const variant of VARIANTS) {
      for (const aspect of ASPECTS) {
        const f = computeFraming(input(variant, aspect))
        expect(f.fadeEndFraction).toBe(layoutOf(variant).bottomLimit)
        expect(f.fadeEndFraction - f.cutFraction).toBeGreaterThanOrEqual(layoutOf(variant).fade - 1e-9)
      }
    }
  })

  it('ratio très étroit : le sujet rapetisse au plus de 1,45 ×, puis les gestes se resserrent', () => {
    const narrow = computeFraming(input('fullscreen', 0.3))
    const wide = computeFraming(input('fullscreen', 0.8))
    expect(narrow.reach).toBeLessThan(wide.reach)
    expect(narrow.frameHeight / computeFraming(input('fullscreen', 2)).frameHeight).toBeLessThanOrEqual(1.45 + 1e-9)
  })

  it('continu au redimensionnement : un pas de ratio ne fait pas sauter le cadre', () => {
    for (const variant of VARIANTS) {
      let prev = computeFraming(input(variant, 0.3))
      for (let aspect = 0.31; aspect <= 2.5; aspect += 0.01) {
        const f = computeFraming(input(variant, aspect))
        expect(Math.abs(f.frameHeight - prev.frameHeight) / prev.frameHeight).toBeLessThan(0.04)
        expect(Math.abs(f.cameraY - prev.cameraY)).toBeLessThan(0.05)
        expect(Math.abs(f.reach - prev.reach)).toBeLessThan(0.1)
        prev = f
      }
    }
  })

  it('aucune constante de position : un personnage k fois plus grand donne un cadre k fois plus grand, mêmes fractions', () => {
    const k = 1.7
    const scaled: BustMetrics = {
      headTopY: METRICS.headTopY * k,
      headCenterY: METRICS.headCenterY * k,
      cutY: METRICS.cutY * k,
      shoulderHalfWidth: METRICS.shoulderHalfWidth * k,
    }
    for (const variant of VARIANTS) {
      const a = computeFraming(input(variant, 0.62))
      const b = computeFraming(input(variant, 0.62, scaled))
      expect(b.distance).toBeCloseTo(a.distance * k, 9)
      expect(b.frameHeight).toBeCloseTo(a.frameHeight * k, 9)
      expect(b.cameraY).toBeCloseTo(a.cameraY * k, 9)
      expect(b.headTopFraction).toBeCloseTo(a.headTopFraction, 9)
      expect(b.cutFraction).toBeCloseTo(a.cutFraction, 9)
      expect(b.reach).toBeCloseTo(a.reach, 9)
    }
  })

  it('entrées dégénérées : jamais de NaN ni d\'infini', () => {
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1e-9]) {
      for (const variant of VARIANTS) {
        const f = computeFraming({ metrics: METRICS, variant, aspect, fovDeg: FOV })
        for (const value of Object.values(f)) expect(Number.isFinite(value)).toBe(true)
      }
    }
    for (const fovDeg of [0, 1, 200, Number.NaN]) {
      const f = computeFraming({ metrics: METRICS, variant: 'split', aspect: 0.8, fovDeg })
      if (Number.isFinite(fovDeg)) expect(Number.isFinite(f.distance)).toBe(true)
    }
    const flat = computeFraming({ metrics: { headTopY: 1, headCenterY: 1, cutY: 1, shoulderHalfWidth: 0 }, variant: 'split', aspect: 1, fovDeg: FOV })
    for (const value of Object.values(flat)) expect(Number.isFinite(value)).toBe(true)
  })
})

describe('fadeMask', () => {
  it('dégradé plein jusqu\'à la coupe puis transparent', () => {
    const f = computeFraming(input('split', 0.8))
    const mask = fadeMask(f)
    expect(mask).toMatch(/^linear-gradient\(to bottom, #000 0%, #000 [\d.]+%, transparent [\d.]+%\)$/)
    const [, from, to] = /#000 ([\d.]+)%, transparent ([\d.]+)%/.exec(mask)!
    expect(Number(from)).toBeCloseTo(f.cutFraction * 100, 1)
    expect(Number(to)).toBeCloseTo(f.fadeEndFraction * 100, 1)
    expect(Number(to)).toBeGreaterThan(Number(from))
  })
})
