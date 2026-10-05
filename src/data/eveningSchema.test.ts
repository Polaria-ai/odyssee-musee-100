import { describe, expect, it } from 'vitest'
import {
  ArchiveQuoteSchema,
  EveningAgentOutputSchema,
  EveningSessionSchema,
  SessionArchiveSchema,
  hasText,
  parseAgentOutput,
  toSessionArchives,
} from './eveningSchema'

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'table-ronde-1',
    order: 7,
    startTime: '19:01',
    durationMin: 14,
    kind: 'table-ronde',
    title: { fr: 'De la promesse aux infrastructures', en: 'From promise to infrastructure' },
    speakers: [{ name: 'Muriel Motte', organization: "L'Opinion", moderator: true }],
    provisional: true,
    ...overrides,
  }
}

describe('EveningSessionSchema', () => {
  it('accepte une séquence valide', () => {
    expect(EveningSessionSchema.safeParse(makeSession()).success).toBe(true)
  })
  it('accepte une séquence sans intervenant·e (ouverture, film, magnéto…)', () => {
    expect(EveningSessionSchema.safeParse(makeSession({ speakers: [] })).success).toBe(true)
  })
  it('rejette un id qui n’est pas en kebab-case', () => {
    expect(EveningSessionSchema.safeParse(makeSession({ id: 'Table Ronde 1' })).success).toBe(false)
  })
  it('rejette une heure mal formée', () => {
    expect(EveningSessionSchema.safeParse(makeSession({ startTime: '19h01' })).success).toBe(false)
    expect(EveningSessionSchema.safeParse(makeSession({ startTime: '25:00' })).success).toBe(false)
  })
  it('rejette un kind hors de la liste fermée', () => {
    expect(EveningSessionSchema.safeParse(makeSession({ kind: 'panel' })).success).toBe(false)
  })
  it('rejette un titre FR vide', () => {
    expect(EveningSessionSchema.safeParse(makeSession({ title: { fr: '', en: '' } })).success).toBe(false)
  })
})

describe('ArchiveQuoteSchema', () => {
  it('accepte une citation valide', () => {
    expect(
      ArchiveQuoteSchema.safeParse({ text: { fr: 'Une citation.', en: 'A quote.' }, author: 'Muriel Motte', verified: true })
        .success,
    ).toBe(true)
  })
  it('rejette un texte FR trop long (> 280) ou vide', () => {
    expect(
      ArchiveQuoteSchema.safeParse({ text: { fr: 'x'.repeat(281), en: '' }, author: 'Muriel Motte', verified: false }).success,
    ).toBe(false)
    expect(
      ArchiveQuoteSchema.safeParse({ text: { fr: '', en: '' }, author: 'Muriel Motte', verified: false }).success,
    ).toBe(false)
  })
  it('rejette un auteur vide', () => {
    expect(
      ArchiveQuoteSchema.safeParse({ text: { fr: 'Une citation.', en: '' }, author: '', verified: false }).success,
    ).toBe(false)
  })
})

describe('SessionArchiveSchema', () => {
  const base = {
    sessionId: 'table-ronde-1',
    summary: { fr: 'Une synthèse.', en: 'A summary.' },
    quotes: [],
    archivedAt: '2026-10-06T22:50:00.000Z',
    published: false,
  }
  it('accepte une archive valide', () => {
    expect(SessionArchiveSchema.safeParse(base).success).toBe(true)
  })
  it('rejette plus de 5 citations', () => {
    const quotes = Array.from({ length: 6 }, () => ({ text: { fr: 'x', en: '' }, author: 'Public', verified: false }))
    expect(SessionArchiveSchema.safeParse({ ...base, quotes }).success).toBe(false)
  })
  it('rejette un summary FR trop long (> 1200)', () => {
    expect(SessionArchiveSchema.safeParse({ ...base, summary: { fr: 'x'.repeat(1201), en: '' } }).success).toBe(false)
  })
  it('rejette un archivedAt qui n’est pas une date ISO', () => {
    expect(SessionArchiveSchema.safeParse({ ...base, archivedAt: '06/10/2026' }).success).toBe(false)
  })
})

describe('EveningAgentOutputSchema', () => {
  it('rejette une version ou un event différents', () => {
    expect(
      EveningAgentOutputSchema.safeParse({ version: 2, event: 'odyssee-ia-2026', generatedAt: '2026-10-06T22:50:00Z', archives: [] })
        .success,
    ).toBe(false)
    expect(
      EveningAgentOutputSchema.safeParse({ version: 1, event: 'autre-soiree', generatedAt: '2026-10-06T22:50:00Z', archives: [] })
        .success,
    ).toBe(false)
  })
})

describe('parseAgentOutput', () => {
  const validOutput = {
    version: 1,
    event: 'odyssee-ia-2026',
    generatedAt: '2026-10-06T22:50:00+02:00',
    archives: [
      {
        sessionId: 'table-ronde-1',
        summary: { fr: 'Synthèse.', en: 'Summary.' },
        quotes: [
          { text: { fr: 'Citation de la modératrice.', en: '' }, author: 'Muriel Motte', verified: true },
          { text: { fr: 'Question du public.', en: '' }, author: 'Public', verified: false },
          { text: { fr: 'Commentaire de l’hologramme.', en: '' }, author: "L'Archiviste", verified: false },
        ],
      },
    ],
  }

  it('accepte une sortie valide, avec auteur de séquence, "Public" et "L\'Archiviste"', () => {
    const { accepted, errors, generatedAt } = parseAgentOutput(validOutput)
    expect(errors).toEqual([])
    expect(accepted).toHaveLength(1)
    expect(accepted[0].quotes).toHaveLength(3)
    expect(generatedAt).toBe('2026-10-06T22:50:00+02:00')
  })

  it('accepte un auteur de la liste générale, même hors de cette séquence', () => {
    const output = {
      ...validOutput,
      archives: [
        {
          sessionId: 'table-ronde-1',
          summary: { fr: 'Synthèse.', en: '' },
          quotes: [{ text: { fr: 'Citation.', en: '' }, author: 'Charles Gorintin', verified: false }],
        },
      ],
    }
    const { accepted, errors } = parseAgentOutput(output)
    expect(errors).toEqual([])
    expect(accepted[0].quotes).toHaveLength(1)
  })

  it('rejette (et retire) une citation dont l’auteur est inconnu, sans perdre le reste de l’archive', () => {
    const output = {
      ...validOutput,
      archives: [
        {
          sessionId: 'table-ronde-1',
          summary: { fr: 'Synthèse.', en: '' },
          quotes: [
            { text: { fr: 'Citation valide.', en: '' }, author: 'Muriel Motte', verified: true },
            { text: { fr: 'Citation invalide.', en: '' }, author: 'Quelqu’un d’inventé', verified: false },
          ],
        },
      ],
    }
    const { accepted, errors } = parseAgentOutput(output)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Quelqu’un d’inventé/)
    expect(accepted[0].quotes).toHaveLength(1)
    expect(accepted[0].quotes[0].author).toBe('Muriel Motte')
  })

  it('rejette une archive entière dont la séquence est inconnue', () => {
    const output = { ...validOutput, archives: [{ ...validOutput.archives[0], sessionId: 'table-ronde-99' }] }
    const { accepted, errors } = parseAgentOutput(output)
    expect(accepted).toEqual([])
    expect(errors[0]).toMatch(/table-ronde-99/)
  })

  it('rejette une séquence en double, garde la première', () => {
    const output = { ...validOutput, archives: [validOutput.archives[0], { ...validOutput.archives[0], summary: { fr: 'Autre.', en: '' } }] }
    const { accepted, errors } = parseAgentOutput(output)
    expect(accepted).toHaveLength(1)
    expect(accepted[0].summary.fr).toBe('Synthèse.')
    expect(errors.some((e) => e.includes('double'))).toBe(true)
  })

  it('ne rejette jamais (renvoie un rapport) même sur une entrée totalement invalide', () => {
    expect(() => parseAgentOutput({ nawak: true })).not.toThrow()
    const { accepted, errors, generatedAt } = parseAgentOutput({ nawak: true })
    expect(accepted).toEqual([])
    expect(errors.length).toBeGreaterThan(0)
    expect(generatedAt).toBeNull()
  })

  it('ne rejette jamais sur une entrée qui n’est pas un objet', () => {
    expect(() => parseAgentOutput(null)).not.toThrow()
    expect(() => parseAgentOutput('pas un objet')).not.toThrow()
  })
})

describe('toSessionArchives', () => {
  it('ajoute archivedAt et published à chaque entrée', () => {
    const archives = toSessionArchives(
      [{ sessionId: 'table-ronde-1', summary: { fr: 'x', en: '' }, quotes: [] }],
      '2026-10-06T22:50:00Z',
      true,
    )
    expect(archives).toEqual([
      { sessionId: 'table-ronde-1', summary: { fr: 'x', en: '' }, quotes: [], archivedAt: '2026-10-06T22:50:00Z', published: true },
    ])
  })
})

describe('hasText', () => {
  it('vrai si fr non vide, faux si absent ou vide', () => {
    expect(hasText({ fr: 'x', en: '' })).toBe(true)
    expect(hasText({ fr: '  ', en: '' })).toBe(false)
    expect(hasText(undefined)).toBe(false)
  })
})
