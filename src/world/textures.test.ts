/**
 * `textures.ts` peint sur un canvas 2D (indisponible en jsdom, voir `context2d`) : on ne peut donc pas
 * monter `drawPlaceholderPortrait` en test. On vérifie à la place, numériquement, ce qui fait la lisibilité
 * des textures peintes de la charte 3D (`docs/CHARTE-3D.md` §4.5-4.6, §5) : contrastes AA de chaque texte
 * sur son fond réel, éléments graphiques ≥ 3:1, géométrie du portrait d'attente (rien ne se chevauche),
 * police plafonnée à la charte, kicker en capitales espacées. `charter3d.test.ts` couvre les jetons ;
 * ici, ce qu'en fait `textures.ts`.
 */
import { describe, expect, it } from 'vitest'
import { charter3d, exhibitWingOrder, wingThemes } from '../styles/tokens'
import { canvasFont, canvasFontsReady, cartelOrganizationText, fitFontSize, placeholderLayout, placeholderSilhouetteColor, spacedGlyphOffsets } from './textures'

// --- Contraste WCAG (hex ou rgba, composé sur un fond opaque) ---

function parse(css: string): { rgb: [number, number, number]; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(css)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 }
  }
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(css)
  if (!rgba) throw new Error(`couleur inattendue: ${css}`)
  return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], alpha: Number(rgba[4]) }
}

const linear = (v: number): number => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminanceOf(rgb: [number, number, number]): number {
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2])
}

/** Contraste de `fg` (éventuellement translucide) posé sur `bg` (opaque). */
function contrast(fg: string, bg: string): number {
  const f = parse(fg)
  const b = parse(bg)
  const composed = f.rgb.map((v, i) => v * f.alpha + b.rgb[i] * (1 - f.alpha)) as [number, number, number]
  const la = luminanceOf(composed)
  const lb = luminanceOf(b.rgb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Seules les ailes d'exposition ont des portraits d'attente (jamais le hall) : ce sont les seules
// couleurs réellement passées à `drawPlaceholderPortrait` en jeu.
const accentColors = exhibitWingOrder.map((w) => wingThemes[w].accent)

describe('portrait d’attente — couleurs (fond sombre, silhouette et bandeau à l’accent de l’aile)', () => {
  it('la silhouette est l’accent de l’aile, tel quel (plus de pastel ni de mélange)', () => {
    for (const accent of accentColors) expect(placeholderSilhouetteColor(accent)).toBe(accent)
  })

  it.each(accentColors)('silhouette / fond ≥ 3:1 (élément graphique) pour %s', (accent) => {
    expect(contrast(placeholderSilhouetteColor(accent), charter3d.portrait.fill)).toBeGreaterThanOrEqual(3)
  })

  it.each(accentColors)('numéro sur bandeau ≥ 4,5:1 (AA) pour %s', (accent) => {
    expect(contrast(charter3d.portrait.bandText, accent)).toBeGreaterThanOrEqual(4.5)
  })

  it('la légende « portrait à venir » (blanc à 72 %) ≥ 4,5:1 sur le fond nuit', () => {
    expect(contrast(charter3d.portrait.kicker, charter3d.portrait.fill)).toBeGreaterThanOrEqual(4.5)
  })

  it('le filet accent sous la silhouette reste un élément graphique lisible sur le fond (≥ 3:1)', () => {
    for (const accent of accentColors) expect(contrast(accent, charter3d.portrait.fill)).toBeGreaterThanOrEqual(3)
  })

  it('le fond est sombre : nettement plus foncé que la silhouette (le pastel rose de l’ancienne charte a disparu)', () => {
    for (const accent of accentColors) {
      expect(luminanceOf(parse(accent).rgb)).toBeGreaterThan(luminanceOf(parse(charter3d.portrait.fill).rgb) * 5)
    }
  })
})

describe('portrait d’attente — géométrie (placeholderLayout)', () => {
  const L = placeholderLayout()

  it('le canvas a le rapport du cadre (1,3 × 1,6) : le texte n’est pas étiré', () => {
    expect(L.width / L.height).toBeCloseTo(1.3 / 1.6, 1)
    expect(L.width).toBeLessThanOrEqual(512)
    expect(L.height).toBeLessThanOrEqual(512)
  })

  it('de haut en bas : silhouette, filet, légende, bandeau — rien ne se chevauche', () => {
    expect(L.head.cy - L.head.r).toBeGreaterThan(0)
    expect(L.bust.base).toBeLessThan(L.rule.top)
    expect(L.rule.top + L.rule.height).toBeLessThan(L.kickerCenterY - 6) // le filet reste au-dessus de la légende
    expect(L.kickerCenterY + 8).toBeLessThan(L.bandTop) // la légende reste au-dessus du bandeau
  })

  it('la tête et le buste forment une seule silhouette (les épaules touchent le bas de la tête)', () => {
    expect(L.bust.apexY).toBeLessThanOrEqual(L.head.cy + L.head.r)
    expect(L.bust.apexY).toBeGreaterThan(L.head.cy)
    expect(L.bust.left).toBeGreaterThan(0)
    expect(L.bust.right).toBeLessThan(L.width)
    expect(L.bust.left + L.bust.right).toBe(L.width) // symétrique
  })

  it('le bandeau occupe la part de hauteur de la charte et le numéro est centré dans sa partie visible', () => {
    expect(L.bandHeight / L.height).toBeCloseTo(charter3d.portrait.bandShare, 1)
    expect(L.bandTop + L.bandHeight).toBe(L.height)
    expect(L.numberCenterY).toBeGreaterThan(L.bandTop)
    expect(L.numberCenterY).toBeLessThan(L.height - 6)
  })

  it('les scanlines rappellent le disque du logo : barre ≈ 55 % du pas, au moins six barres sur la tête', () => {
    const { pitch, bar } = charter3d.portrait.scanline
    expect(bar / pitch).toBeGreaterThan(0.45)
    expect(bar / pitch).toBeLessThan(0.65)
    expect((L.head.r * 2) / pitch).toBeGreaterThanOrEqual(6)
  })
})

describe('cartel — contrastes sur le fond nuit', () => {
  it('nom ≥ 4,5:1 et organisation ≥ 4,5:1', () => {
    expect(contrast(charter3d.cartel.name, charter3d.cartel.fill)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(charter3d.cartel.org, charter3d.cartel.fill)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(accentColors)('contour et filet %s ≥ 3:1 sur le fond du cartel', (accent) => {
    expect(contrast(accent, charter3d.cartel.fill)).toBeGreaterThanOrEqual(3)
  })
})

describe('signalétique et bulle — contrastes', () => {
  it('bannière : titre et sous-titre ≥ 4,5:1 sur le fond nuit, filet corail ≥ 3:1', () => {
    const b = charter3d.signage.banner
    expect(contrast(b.title, b.fill)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(b.subtitle, b.fill)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(b.border, b.fill)).toBeGreaterThanOrEqual(3)
  })

  it.each(accentColors)('panneau de porte : libellé ≥ 4,5:1, contour / pictogramme / flèche %s ≥ 3:1', (accent) => {
    const p = charter3d.signage.wingPanel
    expect(contrast(p.text, p.fill)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(accent, p.fill)).toBeGreaterThanOrEqual(3)
  })

  it('plaque « Bientôt » : texte ≥ 4,5:1, contour magenta ≥ 3:1', () => {
    const p = charter3d.signage.comingSoon
    expect(contrast(p.text, p.fill)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.border, p.fill)).toBeGreaterThanOrEqual(3)
  })

  it('plaque du comptoir d’accueil : nom et fonction ≥ 4,5:1, contour ≥ 3:1', () => {
    const p = charter3d.signage.plate
    expect(contrast(p.name, p.fill)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.title, p.fill)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.border, p.fill)).toBeGreaterThanOrEqual(3)
  })

  it('bulle « ! » du monde : glyphe nuit très sombre ≥ 4,5:1 sur le corail', () => {
    const b = charter3d.frame.bubble
    expect(contrast(b.glyph, b.fill)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('canvasFont — police de la charte, graisse plafonnée', () => {
  it('Poppins pour les mots, plafonnée à 600 (un 700 demandé par erreur retombe à 600)', () => {
    expect(canvasFont(700, 26)).toMatch(/^600 26px Poppins/)
    expect(canvasFont(500, 14)).toMatch(/^500 14px Poppins/)
    expect(canvasFont(400, 14)).toMatch(/^400 14px Poppins/)
  })

  it('JetBrains Mono pour les chiffres, plafonnée à 500 (seules les graisses 400 et 500 sont chargées)', () => {
    expect(canvasFont(700, 34, 'mono')).toMatch(/^500 34px 'JetBrains Mono'/)
    expect(canvasFont(600, 34, 'mono')).toMatch(/^500 34px/)
  })

  it('aucune graisse au-dessus de la charte, quelle que soit la demande', () => {
    for (const w of [300, 400, 500, 600, 700, 800, 900]) {
      expect(Number.parseInt(canvasFont(w, 20), 10)).toBeLessThanOrEqual(charter3d.text.maxWeight)
      expect(Number.parseInt(canvasFont(w, 20, 'mono'), 10)).toBeLessThanOrEqual(500)
    }
  })

  it('canvasFontsReady se résout sans attendre là où document.fonts n’existe pas (jsdom)', async () => {
    await expect(canvasFontsReady(50)).resolves.toBeUndefined()
  })
})

describe('spacedGlyphOffsets — capitales espacées dessinées caractère par caractère', () => {
  it('chaque caractère est décalé de la largeur du précédent + l’espacement, sans espacement final', () => {
    const { offsets, total } = spacedGlyphOffsets([10, 20, 5], 3)
    expect(offsets).toEqual([0, 13, 36])
    expect(total).toBe(41)
  })

  it('sans caractère : rien à dessiner', () => {
    expect(spacedGlyphOffsets([], 4)).toEqual({ offsets: [], total: 0 })
  })

  it('un seul caractère : pas d’espacement', () => {
    expect(spacedGlyphOffsets([12], 5)).toEqual({ offsets: [0], total: 12 })
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
