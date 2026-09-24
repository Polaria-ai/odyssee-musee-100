import { describe, expect, it } from 'vitest'
import { fitVerticalBounds } from './preview'

describe('fitVerticalBounds', () => {
  it('vise le centre vertical du sujet, pas le sol (bug : tête coupée)', () => {
    // Pieds à 0, sommet de la tête à 1.16 (proportions du chibi, voir src/player/AvatarMesh.tsx).
    const { targetY } = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 32)
    expect(targetY).toBeCloseTo(0.58)
    expect(targetY).not.toBe(0) // l'ancien bug visait (0,0,0), c'est-à-dire les pieds
  })

  it('recule la caméra quand le sujet est plus grand (accessoire haut, ex. casquette)', () => {
    const short = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 32)
    const tall = fitVerticalBounds({ minY: 0, maxY: 1.4 }, 32)
    expect(tall.distance).toBeGreaterThan(short.distance)
    expect(tall.targetY).toBeGreaterThan(short.targetY)
  })

  it('un FOV plus étroit demande une distance plus grande pour le même sujet', () => {
    const wide = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 60)
    const narrow = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 20)
    expect(narrow.distance).toBeGreaterThan(wide.distance)
  })

  it('une marge plus grande éloigne la caméra (plus d’air autour du sujet)', () => {
    const tight = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 32, 1)
    const loose = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 32, 1.35)
    expect(loose.distance).toBeGreaterThan(tight.distance)
    expect(loose.distance).toBeCloseTo(tight.distance * 1.35)
  })

  it('ne renvoie jamais une distance nulle ou infinie pour une boîte dégénérée', () => {
    const { distance } = fitVerticalBounds({ minY: 0.4, maxY: 0.4 }, 32)
    expect(distance).toBeGreaterThan(0)
    expect(Number.isFinite(distance)).toBe(true)
  })

  it('reste cohérent quand la boîte ne commence pas à 0 (ex. sujet décalé)', () => {
    const { targetY, distance } = fitVerticalBounds({ minY: 2, maxY: 3.16 }, 32)
    expect(targetY).toBeCloseTo(2.58)
    expect(distance).toBeCloseTo(fitVerticalBounds({ minY: 0, maxY: 1.16 }, 32).distance)
  })
})
