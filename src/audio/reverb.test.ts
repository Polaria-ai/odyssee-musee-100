import { describe, expect, it } from 'vitest'
import { impulseResponseSamples } from './reverb'

describe('impulseResponseSamples', () => {
  it('reste dans -1..1 pour une décroissance normale', () => {
    const data = impulseResponseSamples(200, 2.6)
    expect(data.length).toBe(200)
    for (const v of data) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('ne produit ni NaN ni Infinity, même avec une décroissance négative ou NaN (mésusage)', () => {
    for (const decay of [-1, -0.001, NaN, 0]) {
      const data = impulseResponseSamples(64, decay)
      for (const v of data) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(-1)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('longueur nulle ou négative retombe sur au moins 1 échantillon', () => {
    expect(impulseResponseSamples(0, 2).length).toBe(1)
    expect(impulseResponseSamples(-5, 2).length).toBe(1)
  })
})
