import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadPersisted, savePersisted } from './persist'

const KEY = 'odyssee-musee-100:v1'

describe('persist — avatar enregistré par une version précédente', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('est ignoré à la lecture et effacé du stockage, le reste est conservé', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        lang: 'en',
        visitorId: 'v-123',
        stamps: { culture: 1 },
        avatar: { name: 'Ada', skinTone: '#f5c9a3', hairColor: '#3b2a1e', outfit: 'suit', outfitColor: '#7bc47f', accessory: 'cap' },
      }),
    )

    const loaded = loadPersisted()
    expect(loaded).toEqual({ lang: 'en', visitorId: 'v-123', stamps: { culture: 1 } })
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).not.toHaveProperty('avatar')
  })

  it('n’écrit jamais d’avatar, même si le stockage en contenait un avant une sauvegarde', () => {
    localStorage.setItem(KEY, JSON.stringify({ avatar: { name: 'Ada' }, lang: 'fr' }))
    savePersisted({ visited: { p1: 1 } })
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({ lang: 'fr', visited: { p1: 1 } })
  })

  it('un stockage sans avatar est lu tel quel, sans réécriture', () => {
    const raw = JSON.stringify({ lang: 'fr' })
    localStorage.setItem(KEY, raw)
    expect(loadPersisted()).toEqual({ lang: 'fr' })
    expect(localStorage.getItem(KEY)).toBe(raw)
  })
})
