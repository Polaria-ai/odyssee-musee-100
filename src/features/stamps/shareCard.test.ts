import { describe, expect, it } from 'vitest'
import { ALL_STAMPS } from './stamps'
import { computeShareLayout, countObtainedStamps, drawShareCard, generateShareBlob, SHARE_FILENAME, SHARE_HEIGHT, SHARE_WIDTH } from './shareCard'

describe('computeShareLayout', () => {
  it('utilise les dimensions par défaut 1080×1350', () => {
    const layout = computeShareLayout()
    expect(layout.width).toBe(SHARE_WIDTH)
    expect(layout.height).toBe(SHARE_HEIGHT)
  })

  it('place un badge par tampon (trois ailes + Archives), dans les limites de la carte', () => {
    const layout = computeShareLayout()
    expect(layout.stamps).toHaveLength(ALL_STAMPS.length)
    for (const badge of layout.stamps) {
      expect(badge.x - badge.radius).toBeGreaterThanOrEqual(0)
      expect(badge.x + badge.radius).toBeLessThanOrEqual(layout.width)
      expect(badge.radius).toBeGreaterThan(0)
    }
  })

  it('espace les badges de gauche à droite, Archives en dernier', () => {
    const layout = computeShareLayout()
    for (let i = 1; i < layout.stamps.length; i++) {
      expect(layout.stamps[i].x).toBeGreaterThan(layout.stamps[i - 1].x)
    }
    expect(layout.stamps.map((s) => s.wing)).toEqual([...ALL_STAMPS])
  })

  it('s’adapte à une largeur/hauteur personnalisée', () => {
    const layout = computeShareLayout(500, 700)
    expect(layout.width).toBe(500)
    expect(layout.height).toBe(700)
    expect(layout.stamps.every((s) => s.x <= 500)).toBe(true)
  })
})

describe('carte partageable sans pseudo', () => {
  it('compte les tampons obtenus, Archives comprises', () => {
    expect(countObtainedStamps({ stamps: {}, archivesObtained: false })).toBe(0)
    expect(countObtainedStamps({ stamps: { culture: 1, infrastructures: 2 }, archivesObtained: true })).toBe(3)
  })
  it('télécharge sous un nom de fichier fixe', () => {
    expect(SHARE_FILENAME).toBe('musee-des-100-carte.png')
  })
})

describe('drawShareCard', () => {
  it('ne lève pas si le contexte canvas est indisponible (jsdom)', () => {
    expect(() => drawShareCard(null, { stamps: {}, archivesObtained: false, lang: 'fr' })).not.toThrow()
  })
})

describe('generateShareBlob', () => {
  it('renvoie null sans lever quand le canvas 2D est indisponible (jsdom n’implémente pas getContext(2d))', async () => {
    const blob = await generateShareBlob({ stamps: {}, archivesObtained: false, lang: 'fr' })
    expect(blob).toBeNull()
  })
})
