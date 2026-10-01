import { describe, expect, it } from 'vitest'
import { POLARIA_LOGO, POLARIA_URL, logoWidthFor } from './brand'
import { strings } from './strings'

describe('textes de la signature Polaria', () => {
  it('la carte de crédits dit ce que Baptiste a demandé, en français', () => {
    expect(strings.cardTitle.fr).toBe('Le Musée des 100 — une création Polaria')
    expect(strings.cardCredit.fr).toBe("Conçu et développé par Polaria pour L'Odyssée de l'IA (L'Opinion\u00A0×\u00A0Polaria), 6\u00A0octobre\u00A02026")
    expect(strings.cardRights.fr).toBe('© 2026 Polaria. Tous droits réservés.')
    expect(strings.cardLink.fr).toBe('polaria.ai')
  })

  it('la carte de crédits est traduite en anglais (pas un doublon du français)', () => {
    expect(strings.cardTitle.en).toBe('The Museum of the 100 — a Polaria creation')
    expect(strings.cardCredit.en).toContain('Designed and developed by Polaria')
    expect(strings.cardCredit.en).toContain("L'Opinion\u00A0×\u00A0Polaria")
    expect(strings.cardCredit.en).toContain('October\u00A06,\u00A02026')
    expect(strings.cardRights.en).toBe('© 2026 Polaria. All rights reserved.')
    expect(strings.creation.en).not.toBe(strings.creation.fr)
  })

  it('« © 2026 Polaria » et « Une création » : les mentions de l’écran titre', () => {
    expect(strings.copyright.fr).toBe('© 2026 Polaria')
    expect(strings.creation.fr).toBe('Une création')
  })

  it('le lien pointe vers le site de Polaria, en https', () => {
    expect(POLARIA_URL).toBe('https://www.polaria.ai')
  })

  it('le logo garde les proportions du fichier officiel (3738 × 819) et sa largeur suit la hauteur voulue', () => {
    expect(POLARIA_LOGO.width / POLARIA_LOGO.height).toBeCloseTo(3738 / 819, 1)
    expect(POLARIA_LOGO.url).toBe('/brand/polaria-logo.webp')
    expect(logoWidthFor(16)).toBe(73)
    expect(logoWidthFor(22)).toBe(101)
  })
})
