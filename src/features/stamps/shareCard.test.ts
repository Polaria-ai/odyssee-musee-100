import { describe, expect, it } from 'vitest'
import { EXHIBIT_WINGS } from '../../types'
import { buildShareFilename, computeShareLayout, drawShareCard, generateShareBlob, SHARE_HEIGHT, SHARE_WIDTH } from './shareCard'

describe('computeShareLayout', () => {
  it('utilise les dimensions par défaut 1080×1350', () => {
    const layout = computeShareLayout()
    expect(layout.width).toBe(SHARE_WIDTH)
    expect(layout.height).toBe(SHARE_HEIGHT)
  })

  it('place un badge par aile, dans les limites de la carte', () => {
    const layout = computeShareLayout()
    expect(layout.stamps).toHaveLength(EXHIBIT_WINGS.length)
    for (const badge of layout.stamps) {
      expect(badge.x - badge.radius).toBeGreaterThanOrEqual(0)
      expect(badge.x + badge.radius).toBeLessThanOrEqual(layout.width)
      expect(badge.radius).toBeGreaterThan(0)
    }
  })

  it('espace les badges de gauche à droite dans l’ordre des ailes', () => {
    const layout = computeShareLayout()
    for (let i = 1; i < layout.stamps.length; i++) {
      expect(layout.stamps[i].x).toBeGreaterThan(layout.stamps[i - 1].x)
    }
    expect(layout.stamps.map((s) => s.wing)).toEqual([...EXHIBIT_WINGS])
  })

  it('s’adapte à une largeur/hauteur personnalisée', () => {
    const layout = computeShareLayout(500, 700)
    expect(layout.width).toBe(500)
    expect(layout.height).toBe(700)
    expect(layout.stamps.every((s) => s.x <= 500)).toBe(true)
  })
})

describe('buildShareFilename', () => {
  it('produit un slug ASCII sûr', () => {
    expect(buildShareFilename('Ada Lovelace')).toBe('musee-des-100-ada-lovelace.png')
    expect(buildShareFilename('Éléa Ünïcode !!')).toBe('musee-des-100-elea-unicode.png')
  })
  it('retombe sur "carte" si le pseudo est vide', () => {
    expect(buildShareFilename('')).toBe('musee-des-100-carte.png')
  })
})

describe('drawShareCard', () => {
  it('ne lève pas si le contexte canvas est indisponible (jsdom)', () => {
    expect(() => drawShareCard(null, { avatarName: 'Ada', stamps: {}, lang: 'fr' })).not.toThrow()
  })
})

describe('generateShareBlob', () => {
  it('renvoie null sans lever quand le canvas 2D est indisponible (jsdom n’implémente pas getContext(2d))', async () => {
    const blob = await generateShareBlob({ avatarName: 'Ada', stamps: {}, lang: 'fr' })
    expect(blob).toBeNull()
  })
})
