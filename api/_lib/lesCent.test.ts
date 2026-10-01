// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BIO_MAX_CHARS, condenseLesCent, truncateBio, WING_ORDER, type PersonSource } from './lesCent.js'
import { LES_CENT } from './lesCent.data.js'

function person(over: Partial<PersonSource> = {}): PersonSource {
  return {
    order: 1,
    name: 'Ada Exemple',
    role: { fr: 'Directrice' },
    organization: 'Exemple SA',
    country: 'FR',
    wing: 'culture',
    bio: { fr: 'Une accroche courte.' },
    placeholder: false,
    ...over,
  }
}

describe('truncateBio', () => {
  it('laisse intact un texte court et normalise les espaces', () => {
    expect(truncateBio('  Une   accroche\ncourte. ')).toBe('Une accroche courte.')
  })

  it('tronque à la limite de mot, avec une ellipse, sans dépasser la limite', () => {
    const long = 'mot '.repeat(100)
    const cut = truncateBio(long)
    expect(cut.length).toBeLessThanOrEqual(BIO_MAX_CHARS)
    expect(cut.endsWith('…')).toBe(true)
    expect(cut.endsWith(' …')).toBe(false)
    expect(cut.slice(0, -1).trim().split(' ').every((w) => w === 'mot')).toBe(true)
  })

  it('coupe net un texte sans espace', () => {
    expect(truncateBio('x'.repeat(500))).toHaveLength(BIO_MAX_CHARS)
  })
})

describe('condenseLesCent', () => {
  it('ignore les fiches d’attente (placeholder: true)', () => {
    const result = condenseLesCent([
      person({ name: 'Vraie Personne' }),
      person({ name: 'Nom Fictif', organization: '', placeholder: true }),
    ])
    expect(result.map((p) => p.name)).toEqual(['Vraie Personne'])
  })

  it('range par aile (ordre des tables rondes) puis par rang d’affichage', () => {
    const result = condenseLesCent([
      person({ name: 'C2', wing: 'culture', order: 2 }),
      person({ name: 'I2', wing: 'infrastructures', order: 2 }),
      person({ name: 'D1', wing: 'industrialisation', order: 1 }),
      person({ name: 'C1', wing: 'culture', order: 1 }),
      person({ name: 'I1', wing: 'infrastructures', order: 1 }),
    ])
    expect(result.map((p) => p.name)).toEqual(['I1', 'I2', 'D1', 'C1', 'C2'])
  })

  it('ne garde que le français, le rôle et l’accroche tronquée', () => {
    const [entry] = condenseLesCent([person({ bio: { fr: 'a '.repeat(300) } })])
    expect(Object.keys(entry).sort()).toEqual(['bio', 'country', 'name', 'organization', 'role', 'wing'])
    expect(entry.bio.length).toBeLessThanOrEqual(BIO_MAX_CHARS)
  })
})

describe('données embarquées (lesCent.data.ts)', () => {
  it('sont à jour par rapport à public/data/people.json — sinon : pnpm exec tsx scripts/generate-remi-data.ts', () => {
    const people = JSON.parse(readFileSync(new URL('../../public/data/people.json', import.meta.url), 'utf8')) as PersonSource[]
    expect(LES_CENT).toEqual(condenseLesCent(people))
  })

  it('comptent les 100, sans fiche d’attente, répartis sur les trois ailes', () => {
    expect(LES_CENT).toHaveLength(100)
    expect(new Set(LES_CENT.map((p) => p.wing))).toEqual(new Set(WING_ORDER))
    for (const p of LES_CENT) {
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.bio.length).toBeGreaterThan(0)
      expect(p.bio.length).toBeLessThanOrEqual(BIO_MAX_CHARS)
    }
    expect(new Set(LES_CENT.map((p) => p.name)).size).toBe(100)
  })
})
