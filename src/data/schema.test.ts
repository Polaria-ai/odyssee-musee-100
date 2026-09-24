import { describe, expect, it } from 'vitest'
import { PersonSchema, mapSupabaseRow, parsePeople } from './schema'
import type { Person } from '../types'

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'ada-lovelace',
    order: 1,
    name: 'Ada Lovelace',
    role: { fr: 'Pionnière', en: 'Pioneer' },
    organization: 'Analytical Engine',
    country: 'GB',
    wing: 'infrastructures',
    bio: { fr: 'Une accroche courte.', en: 'A short hook.' },
    story: { fr: 'Une histoire plus longue.', en: 'A longer story.' },
    photoUrl: null,
    placeholder: false,
    ...overrides,
  }
}

describe('PersonSchema : fiche valide', () => {
  it('accepte une fiche complète', () => {
    const result = PersonSchema.safeParse(makePerson())
    expect(result.success).toBe(true)
  })
  it('accepte le pays EU (fiches d’attente)', () => {
    expect(PersonSchema.safeParse(makePerson({ country: 'EU', placeholder: true })).success).toBe(true)
  })
  it('accepte une photo en URL https ou en chemin /portraits/…', () => {
    expect(PersonSchema.safeParse(makePerson({ photoUrl: 'https://exemple.org/photo.jpg' })).success).toBe(true)
    expect(PersonSchema.safeParse(makePerson({ photoUrl: '/portraits/ada-lovelace.webp' })).success).toBe(true)
    expect(PersonSchema.safeParse(makePerson({ photoUrl: null })).success).toBe(true)
  })
  it('accepte des liens http(s) et un devis (quote) optionnel', () => {
    expect(
      PersonSchema.safeParse(
        makePerson({ links: [{ label: 'Site', url: 'https://exemple.org' }], quote: { fr: 'Une phrase.', en: 'A line.' } }),
      ).success,
    ).toBe(true)
  })
})

describe('PersonSchema : fiche invalide', () => {
  it('rejette un id qui n’est pas en kebab-case', () => {
    expect(PersonSchema.safeParse(makePerson({ id: 'Ada Lovelace' })).success).toBe(false)
    expect(PersonSchema.safeParse(makePerson({ id: 'ada_lovelace' })).success).toBe(false)
  })
  it('rejette un order non entier ou < 1', () => {
    expect(PersonSchema.safeParse(makePerson({ order: 0 })).success).toBe(false)
    expect(PersonSchema.safeParse(makePerson({ order: 1.5 })).success).toBe(false)
  })
  it('rejette un nom vide ou trop long', () => {
    expect(PersonSchema.safeParse(makePerson({ name: '' })).success).toBe(false)
    expect(PersonSchema.safeParse(makePerson({ name: 'x'.repeat(81) })).success).toBe(false)
  })
  it('rejette une bio FR trop longue', () => {
    expect(PersonSchema.safeParse(makePerson({ bio: { fr: 'x'.repeat(221), en: '' } })).success).toBe(false)
  })
  it('rejette un pays qui n’est pas 2 lettres majuscules', () => {
    expect(PersonSchema.safeParse(makePerson({ country: 'France' })).success).toBe(false)
    expect(PersonSchema.safeParse(makePerson({ country: 'fr' })).success).toBe(false)
  })
  it('rejette une aile hors énumération', () => {
    // @ts-expect-error valeur volontairement invalide
    expect(PersonSchema.safeParse(makePerson({ wing: 'hall' })).success).toBe(false)
  })
  it('rejette les URLs dangereuses ou non https pour la photo', () => {
    expect(PersonSchema.safeParse(makePerson({ photoUrl: 'javascript:alert(1)' })).success).toBe(false)
    expect(PersonSchema.safeParse(makePerson({ photoUrl: 'http://exemple.org/photo.jpg' })).success).toBe(false)
    expect(PersonSchema.safeParse(makePerson({ photoUrl: 'data:image/png;base64,AAAA' })).success).toBe(false)
    expect(PersonSchema.safeParse(makePerson({ photoUrl: '/etc/passwd' })).success).toBe(false)
  })
  it('rejette un lien non http(s)', () => {
    expect(
      PersonSchema.safeParse(makePerson({ links: [{ label: 'x', url: 'javascript:alert(1)' }] })).success,
    ).toBe(false)
  })
})

describe('parsePeople', () => {
  it('garde les fiches valides et signale les invalides', () => {
    const { people, errors } = parsePeople([makePerson(), { id: 'x' }])
    expect(people).toHaveLength(1)
    expect(errors).toHaveLength(1)
  })
  it('renvoie une liste vide et une erreur si l’entrée n’est pas un tableau', () => {
    const { people, errors } = parsePeople({ not: 'an array' })
    expect(people).toEqual([])
    expect(errors).toHaveLength(1)
  })
  it('dédoublonne les id (garde la première occurrence)', () => {
    const first = makePerson({ organization: 'Première' })
    const dup = makePerson({ organization: 'Doublon' })
    const { people, errors } = parsePeople([first, dup])
    expect(people).toHaveLength(1)
    expect(people[0].organization).toBe('Première')
    expect(errors.some((e) => e.includes('double'))).toBe(true)
  })
  it('trie par aile (ordre de EXHIBIT_WINGS) puis par order', () => {
    const { people } = parsePeople([
      makePerson({ id: 'c-2', wing: 'culture', order: 2 }),
      makePerson({ id: 'i-1', wing: 'infrastructures', order: 1 }),
      makePerson({ id: 'c-1', wing: 'culture', order: 1 }),
      makePerson({ id: 'd-1', wing: 'industrialisation', order: 1 }),
    ])
    expect(people.map((p) => p.id)).toEqual(['i-1', 'd-1', 'c-1', 'c-2'])
  })
})

describe('mapSupabaseRow', () => {
  it('convertit une ligne snake_case en objet Person brut', () => {
    const row = {
      id: 'ada-lovelace',
      ord: 1,
      name: 'Ada Lovelace',
      role_fr: 'Pionnière',
      role_en: 'Pioneer',
      organization: 'Analytical Engine',
      country: 'GB',
      wing: 'infrastructures',
      bio_fr: 'Une accroche.',
      bio_en: 'A hook.',
      story_fr: 'Une histoire.',
      story_en: 'A story.',
      quote_fr: null,
      quote_en: null,
      photo_url: null,
      photo_credit: null,
      links: [],
      placeholder: false,
    }
    const mapped = mapSupabaseRow(row)
    expect(PersonSchema.safeParse(mapped).success).toBe(true)
    const result = PersonSchema.parse(mapped)
    expect(result.order).toBe(1)
    expect(result.role).toEqual({ fr: 'Pionnière', en: 'Pioneer' })
    expect(result.quote).toBeUndefined()
  })
  it('reconstruit quote uniquement si fr ou en est renseigné', () => {
    const base = {
      id: 'x',
      ord: 1,
      name: 'X',
      role_fr: 'R',
      role_en: 'R',
      organization: '',
      country: 'FR',
      wing: 'culture',
      bio_fr: 'Bio.',
      bio_en: 'Bio.',
      story_fr: '',
      story_en: '',
      photo_url: null,
      links: [],
      placeholder: false,
    }
    expect((mapSupabaseRow({ ...base, quote_fr: 'Une phrase.', quote_en: '' }) as { quote?: unknown }).quote).toEqual({
      fr: 'Une phrase.',
      en: '',
    })
    expect((mapSupabaseRow({ ...base, quote_fr: '', quote_en: '' }) as { quote?: unknown }).quote).toBeUndefined()
  })
})
