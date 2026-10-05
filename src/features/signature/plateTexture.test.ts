import { describe, expect, it } from 'vitest'
import { charter3d } from '../../styles/tokens'
import { POLARIA_LOGO } from './brand'
import { PLATE_HEIGHT, PLATE_WIDTH } from './plateLayout'
import { PLATE_CANVAS, plateTextureLayout } from './plateTexture'

describe('plateTextureLayout', () => {
  const L = plateTextureLayout()

  it('texture ≤ 512 px (règle mobile du dépôt) et au rapport de la plaque 3D : aucun étirement', () => {
    expect(L.width).toBeLessThanOrEqual(512)
    expect(L.height).toBeLessThanOrEqual(512)
    expect(L.width / L.height).toBeCloseTo(PLATE_WIDTH / PLATE_HEIGHT, 1)
    expect(PLATE_CANVAS.width).toBe(L.width)
  })

  it('le logo garde ses proportions officielles et tient à l’intérieur du liseré', () => {
    expect(L.logo.width / L.logo.height).toBeCloseTo(POLARIA_LOGO.width / POLARIA_LOGO.height, 1)
    expect(L.logo.x).toBeGreaterThan(L.rim)
    expect(L.logo.x + L.logo.width).toBeLessThan(L.width - L.rim)
    expect(L.logo.y).toBeGreaterThan(L.rim)
    expect(L.logo.y + L.logo.height).toBeLessThan(L.height - L.rim)
  })

  it('le logo est centré horizontalement', () => {
    expect(Math.abs(L.logo.x + L.logo.width / 2 - L.width / 2)).toBeLessThanOrEqual(0.5)
  })

  it('de haut en bas : kicker, logo, adresse, sans chevauchement', () => {
    const capHeight = (size: number) => size * 0.7
    const kickerBottom = L.kickerCenterY + capHeight(L.kickerSize) / 2
    const siteTop = L.siteCenterY - capHeight(L.siteSize) / 2
    expect(L.kickerCenterY - capHeight(L.kickerSize) / 2).toBeGreaterThan(L.rim)
    expect(kickerBottom).toBeLessThan(L.logo.y)
    expect(L.logo.y + L.logo.height).toBeLessThan(siteTop)
    expect(L.siteCenterY + capHeight(L.siteSize) / 2).toBeLessThan(L.height - L.rim)
  })

  it('les textes de la plaque sont assez grands pour se lire de près (≥ 18 px sur 512)', () => {
    expect(L.kickerSize).toBeGreaterThanOrEqual(18)
    expect(L.siteSize).toBeGreaterThanOrEqual(18)
  })

  it('couleurs : celles de la plaque du comptoir (charte), jamais d’or ni de bois', () => {
    const { plate } = charter3d.signage
    expect(plate.fill).toBe(charter3d.base.nuit)
    expect(plate.border).toBe(charter3d.base.corail)
  })
})
