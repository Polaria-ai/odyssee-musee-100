import { describe, expect, it } from 'vitest'
import { PENTATONIC_MAJOR_STEPS, PENTATONIC_MINOR_STEPS, pentatonicFrequency } from './scale'

describe('pentatonicFrequency', () => {
  it('degré 0 = la tonique', () => {
    expect(pentatonicFrequency(220, 0)).toBeCloseTo(220)
  })

  it('un octave plus haut (degré = taille de la gamme) double la fréquence', () => {
    expect(pentatonicFrequency(220, PENTATONIC_MAJOR_STEPS.length)).toBeCloseTo(440)
  })

  it('un octave plus bas (degré négatif symétrique) divise par deux', () => {
    expect(pentatonicFrequency(220, -PENTATONIC_MAJOR_STEPS.length)).toBeCloseTo(110)
  })

  it('la quinte (index 3 en pentatonique majeure) est à 7 demi-tons de la tonique', () => {
    const freq = pentatonicFrequency(220, 3, PENTATONIC_MAJOR_STEPS)
    expect(freq).toBeCloseTo(220 * Math.pow(2, 7 / 12))
  })

  it('gamme mineure : mêmes propriétés d’octave', () => {
    expect(pentatonicFrequency(200, 0, PENTATONIC_MINOR_STEPS)).toBeCloseTo(200)
    expect(pentatonicFrequency(200, PENTATONIC_MINOR_STEPS.length, PENTATONIC_MINOR_STEPS)).toBeCloseTo(400)
  })

  it('est strictement croissante avec le degré (aucun repli en enroulant les octaves)', () => {
    let prev = pentatonicFrequency(220, -3)
    for (let degree = -2; degree <= 8; degree++) {
      const freq = pentatonicFrequency(220, degree)
      expect(freq).toBeGreaterThan(prev)
      prev = freq
    }
  })

  it('rootHz nul ou négatif ne produit ni NaN ni Infinity', () => {
    expect(Number.isFinite(pentatonicFrequency(0, 4))).toBe(true)
  })
})
