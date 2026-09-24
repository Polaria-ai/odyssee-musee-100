/**
 * Régression : les yeux de Minerve doivent se lire comme de grands yeux ronds et
 * ouverts (docs/DESIGN.md), jamais comme des fentes englouties dans la tête.
 * Bug corrigé : la sphère du blanc de l'œil (r=0.115) était centrée à seulement
 * 0.264 du centre de la tête (r=0.3), donc majoritairement enfouie — et l'anneau
 * des lunettes, plus avancé, mangeait le peu qui dépassait.
 * Vérifie la géométrie réellement utilisée par `Minerve.tsx` (mêmes constantes,
 * pas de valeurs recopiées) pour qu'un futur changement de position ne puisse pas
 * réintroduire des yeux engloutis sans faire échouer ce test.
 */
import { describe, expect, it } from 'vitest'
import { EYE_GROUP_Y, EYE_POKE_RATIO, EYE_RADIUS, EYE_X, EYE_Z, HEAD_RADIUS, eyePokeRatio } from './Minerve'

describe('eyePokeRatio', () => {
  it('la moitié exactement dehors quand le centre de l\'œil est sur la surface de la tête', () => {
    // Centre à distance R du centre de la tête, aligné sur un seul axe (cas simple).
    expect(eyePokeRatio(1, 0.2, 1, 0, 0)).toBeCloseTo(0.5, 5)
  })

  it('rien ne dépasse quand l\'œil est entièrement sous la surface', () => {
    expect(eyePokeRatio(1, 0.2, 0.5, 0, 0)).toBeLessThanOrEqual(0)
  })

  it('tout dépasse (tangence interne) quand le centre est à R + rayon de la tête', () => {
    expect(eyePokeRatio(1, 0.2, 1.2, 0, 0)).toBeCloseTo(1, 5)
  })
})

describe('placement des yeux de Minerve (régression yeux engloutis)', () => {
  const ratio = eyePokeRatio(HEAD_RADIUS, EYE_RADIUS, EYE_X, EYE_GROUP_Y, EYE_Z)

  it('reproduit la constante de conception `EYE_POKE_RATIO`', () => {
    expect(ratio).toBeCloseTo(EYE_POKE_RATIO, 5)
  })

  it('la majorité du blanc de l\'œil dépasse de la tête (grands yeux ouverts, pas des fentes)', () => {
    // L'ancien réglage donnait ~0.34 (bug rapporté par la QA) ; on exige une nette majorité visible.
    expect(ratio).toBeGreaterThanOrEqual(0.6)
  })

  it('l\'œil reste ancré : pas de vide entre la tête et l\'œil (pas totalement dehors)', () => {
    expect(ratio).toBeLessThan(1)
  })

  it('les deux yeux ne se chevauchent pas (silhouette de deux yeux distincts)', () => {
    // Écart entre les bords intérieurs des deux sphères de blanc d'œil (symétriques en x).
    const gapBetweenEyes = 2 * EYE_X - 2 * EYE_RADIUS
    expect(gapBetweenEyes).toBeGreaterThan(0)
  })
})
