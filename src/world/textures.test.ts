/**
 * `textures.ts` peint sur un canvas 2D (indisponible en jsdom, voir `context2d`) : on ne peut donc pas
 * monter `drawPlaceholderPortrait` en test. On vérifie à la place, numériquement, l'invariant de fond
 * de la régression « portrait d'attente illisible » (contraste fond/silhouette trop faible, voir
 * `docs`/rapport QA) : un grand écart de mélange blanc entre fond et silhouette, pour toutes les
 * couleurs d'aile réellement utilisées dans le musée.
 */
import { describe, expect, it } from 'vitest'
import { exhibitWingOrder, wingThemes } from '../styles/tokens'
import { cartelOrganizationText, fitFontSize, mixWithWhite, PLACEHOLDER_BG_MIX, PLACEHOLDER_SILHOUETTE_MIX } from './textures'

function luminance(rgb: string): number {
  const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(rgb)
  if (!m) throw new Error(`couleur inattendue: ${rgb}`)
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Seules les ailes d'exposition ont des portraits d'attente (jamais le hall) : ce sont les seules
// couleurs réellement passées à `drawPlaceholderPortrait` en jeu.
const accentColors = exhibitWingOrder.map((w) => wingThemes[w].accent)

describe('portrait d’attente — contraste fond/silhouette', () => {
  it('le fond et la silhouette utilisent des mélanges de blanc nettement différents', () => {
    // Régression : 0.78 vs 0.55 (23 points d'écart) se lisait comme un rectangle presque blanc et vide.
    expect(PLACEHOLDER_BG_MIX - PLACEHOLDER_SILHOUETTE_MIX).toBeGreaterThanOrEqual(0.6)
  })

  it.each(accentColors)('silhouette nettement plus sombre que le fond pour %s', (accent) => {
    const bg = luminance(mixWithWhite(accent, PLACEHOLDER_BG_MIX))
    const silhouette = luminance(mixWithWhite(accent, PLACEHOLDER_SILHOUETTE_MIX))
    expect(bg - silhouette).toBeGreaterThan(55) // luminance perçue sur 255 (régression : ~18 à 24 points)
  })

  it('le fond reste un pastel clair (jamais la couleur d’aile brute)', () => {
    for (const accent of accentColors) {
      expect(luminance(mixWithWhite(accent, PLACEHOLDER_BG_MIX))).toBeGreaterThan(180)
    }
  })
})

describe('cartelOrganizationText — texte de la ligne « organisation » d’un cartel', () => {
  it('affiche l’organisation quand elle est renseignée', () => {
    expect(cartelOrganizationText({ organization: 'Acme Corp', placeholder: false }, 'fr')).toBe('Acme Corp')
    expect(cartelOrganizationText({ organization: 'Acme Corp', placeholder: true }, 'fr')).toBe('Acme Corp')
  })

  it('fiche d’attente (placeholder) sans organisation : date de révélation, localisée', () => {
    expect(cartelOrganizationText({ organization: '', placeholder: true }, 'fr')).toBe('À dévoiler le 6 octobre')
    expect(cartelOrganizationText({ organization: '', placeholder: true }, 'en')).toBe('Revealed on October 6')
  })

  it('fiche réelle (non placeholder) sans organisation : texte générique « à confirmer »', () => {
    expect(cartelOrganizationText({ organization: '', placeholder: false }, 'fr')).toBe('Organisation à confirmer')
    expect(cartelOrganizationText({ organization: '', placeholder: false }, 'en')).toBe('Organization to be confirmed')
  })

  it('un tiret cadratin seul compte comme vide (compat V1)', () => {
    expect(cartelOrganizationText({ organization: '—', placeholder: true }, 'fr')).toBe('À dévoiler le 6 octobre')
  })
})

describe('fitFontSize — police qui tient dans une largeur donnée (régression : titre EN débordant du bandeau)', () => {
  // `measureWidth` synthétique : largeur proportionnelle à la taille (comme un texte réel, à police
  // fixée), pour ne pas dépendre d'un vrai canvas 2D (indisponible en jsdom, voir l'en-tête du fichier).
  const widthAt46 = (baseWidthAt46: number) => (size: number) => (baseWidthAt46 * size) / 46

  it('garde `maxSize` quand le texte tient déjà (régression : ne pas rétrécir le FR sans raison)', () => {
    // FR mesuré ≈383 px à 46 px pour une largeur dispo de 512 - 120 = 392 px (voir `paintBanner`).
    expect(fitFontSize(widthAt46(383), 392, 46, 26)).toBe(46)
  })

  it('rétrécit un texte trop large (régression : titre EN ≈500 px débordant du cadre à 512 - 120 = 392 px)', () => {
    const size = fitFontSize(widthAt46(500), 392, 46, 26)
    expect(size).toBeLessThan(46)
    expect(widthAt46(500)(size)).toBeLessThanOrEqual(392)
  })

  it('ne descend jamais sous `minSize`, même pour un texte extrêmement long', () => {
    expect(fitFontSize(widthAt46(2000), 392, 46, 26)).toBe(26)
  })

  it('valeur exacte à la limite (392 px pile à 46 px) : reste à `maxSize`, pas de rétrécissement superflu', () => {
    expect(fitFontSize(widthAt46(392), 392, 46, 26)).toBe(46)
  })
})
