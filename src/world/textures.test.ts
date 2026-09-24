/**
 * `textures.ts` peint sur un canvas 2D (indisponible en jsdom, voir `context2d`) : on ne peut donc pas
 * monter `drawPlaceholderPortrait` en test. On vérifie à la place, numériquement, l'invariant de fond
 * de la régression « portrait d'attente illisible » (contraste fond/silhouette trop faible, voir
 * `docs`/rapport QA) : un grand écart de mélange blanc entre fond et silhouette, pour toutes les
 * couleurs d'aile réellement utilisées dans le musée.
 */
import { describe, expect, it } from 'vitest'
import { exhibitWingOrder, wingThemes } from '../styles/tokens'
import { mixWithWhite, PLACEHOLDER_BG_MIX, PLACEHOLDER_SILHOUETTE_MIX } from './textures'

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
