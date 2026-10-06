import { describe, expect, it } from 'vitest'
import {
  ArchiveHighlightSchema,
  ArchiveTranscriptSchema,
  EveningAgentOutputSchema,
  EveningSessionSchema,
  SessionArchiveSchema,
  hasText,
  parseAgentOutput,
  toSessionArchives,
} from './eveningSchema'

const highlight = {
  id: 'idee-de-test',
  title: { fr: 'Une idée de test', en: '' },
  body: { fr: 'Cette synthèse de test renvoie au passage source.', en: '' },
  source: { excerpt: 'Une idée de test à garder.' },
}

describe('ArchiveHighlightSchema', () => {
  it('accepte une bulle FR avec repli anglais et sans horodatage inventé', () => {
    expect(ArchiveHighlightSchema.parse(highlight)).toEqual(highlight)
  })

  it('préserve mot pour mot les espaces et sauts de ligne de l’extrait', () => {
    const exact = { ...highlight, source: { excerpt: ' Une idée de test.\n' } }
    expect(ArchiveHighlightSchema.parse(exact).source.excerpt).toBe(' Une idée de test.\n')
  })

  it.each([
    ['id non kebab', { ...highlight, id: 'Id De Test' }],
    ['titre FR vide', { ...highlight, title: { fr: '  ', en: '' } }],
    ['titre FR trop long', { ...highlight, title: { fr: 'x'.repeat(101), en: '' } }],
    ['titre EN trop long', { ...highlight, title: { fr: 'Titre', en: 'x'.repeat(101) } }],
    ['corps FR vide', { ...highlight, body: { fr: '  ', en: '' } }],
    ['corps FR trop long', { ...highlight, body: { fr: 'x'.repeat(801), en: '' } }],
    ['corps EN trop long', { ...highlight, body: { fr: 'Corps', en: 'x'.repeat(801) } }],
    ['extrait vide', { ...highlight, source: { excerpt: '  \n' } }],
    ['extrait trop long', { ...highlight, source: { excerpt: 'x'.repeat(2001) } }],
    ['début négatif', { ...highlight, source: { ...highlight.source, startSec: -1 } }],
    ['fin négative', { ...highlight, source: { ...highlight.source, endSec: -1 } }],
    ['début infini', { ...highlight, source: { ...highlight.source, startSec: Infinity } }],
    ['fin antérieure', { ...highlight, source: { ...highlight.source, startSec: 30, endSec: 29 } }],
    ['horodatage texte', { ...highlight, source: { ...highlight.source, startSec: '30' } }],
  ])('rejette %s', (_label, value) => {
    expect(ArchiveHighlightSchema.safeParse(value).success).toBe(false)
  })

  it('accepte des secondes exactes non négatives, dont zéro et une fraction', () => {
    expect(ArchiveHighlightSchema.safeParse({ ...highlight, source: { ...highlight.source, startSec: 0, endSec: 12.5 } }).success).toBe(true)
  })
})

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

describe('ArchiveTranscriptSchema', () => {
  it('accepte une transcription source et une traduction facultative', () => {
    expect(ArchiveTranscriptSchema.safeParse({ fr: 'Modération — Bonjour.', en: '' }).success).toBe(true)
  })
  it('rejette une transcription française vide ou une version trop longue', () => {
    expect(ArchiveTranscriptSchema.safeParse({ fr: '  ', en: '' }).success).toBe(false)
    expect(ArchiveTranscriptSchema.safeParse({ fr: 'x'.repeat(40_001), en: '' }).success).toBe(false)
  })
})

describe('SessionArchiveSchema', () => {
  const base = {
    sessionId: 'table-ronde-1',
    transcript: { fr: 'Modération — Transcription de test.', en: '' },
    archivedAt: '2026-10-06T22:50:00.000Z',
    published: false,
  }
  it('accepte une archive valide', () => {
    expect(SessionArchiveSchema.safeParse(base).success).toBe(true)
  })
  it('rejette une transcription FR trop longue (> 40 000)', () => {
    expect(SessionArchiveSchema.safeParse({ ...base, transcript: { fr: 'x'.repeat(40_001), en: '' } }).success).toBe(false)
  })
  it('rejette un archivedAt qui n’est pas une date ISO', () => {
    expect(SessionArchiveSchema.safeParse({ ...base, archivedAt: '06/10/2026' }).success).toBe(false)
  })

  const withHighlight = {
    ...base,
    transcript: { fr: 'Préface.\nUne idée de test à garder.\nFin.', en: '' },
    highlights: [highlight],
  }

  it('accepte une bulle dont l’extrait est exactement présent dans le transcript FR', () => {
    expect(SessionArchiveSchema.parse(withHighlight).highlights).toEqual([highlight])
  })

  it('ne crée pas de bulles dans une ancienne archive qui n’en possède pas', () => {
    expect(SessionArchiveSchema.parse(base)).toEqual(base)
  })

  it('rejette un extrait absent ou réécrit, même si le titre est valide', () => {
    const result = SessionArchiveSchema.safeParse({ ...withHighlight, highlights: [{ ...highlight, source: { excerpt: 'Une idée de test inventée.' } }] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['highlights', 0, 'source', 'excerpt'])
  })

  it('rejette les ids de bulles en double dans une table ronde', () => {
    const result = SessionArchiveSchema.safeParse({ ...withHighlight, highlights: [highlight, highlight] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((issue) => issue.message.includes('double'))).toBe(true)
  })

  it('accepte douze bulles et rejette la treizième', () => {
    const highlights = Array.from({ length: 13 }, (_, i) => ({ ...highlight, id: `idee-${i}` }))
    expect(SessionArchiveSchema.safeParse({ ...withHighlight, highlights: highlights.slice(0, 12) }).success).toBe(true)
    expect(SessionArchiveSchema.safeParse({ ...withHighlight, highlights }).success).toBe(false)
  })
})

describe('EveningAgentOutputSchema', () => {
  it('rejette une version ou un event différents', () => {
    expect(
      EveningAgentOutputSchema.safeParse({ version: 1, event: 'odyssee-ia-2026', generatedAt: '2026-10-06T22:50:00Z', archives: [] })
        .success,
    ).toBe(false)
    expect(
      EveningAgentOutputSchema.safeParse({ version: 2, event: 'autre-soiree', generatedAt: '2026-10-06T22:50:00Z', archives: [] })
        .success,
    ).toBe(false)
  })
})

describe('parseAgentOutput', () => {
  const validOutput = {
    version: 2,
    event: 'odyssee-ia-2026',
    generatedAt: '2026-10-06T22:50:00+02:00',
    archives: [
      {
        sessionId: 'table-ronde-1',
        transcript: { fr: 'Muriel Motte — Modération.\nPublic — Question.', en: '' },
      },
    ],
  }

  it('accepte une transcription de table ronde', () => {
    const { accepted, errors, generatedAt } = parseAgentOutput(validOutput)
    expect(errors).toEqual([])
    expect(accepted).toHaveLength(1)
    expect(accepted[0].transcript.fr).toContain('Muriel Motte')
    expect(generatedAt).toBe('2026-10-06T22:50:00+02:00')
  })

  it('conserve les bulles facultatives dans le format v2 et vérifie leur extrait avant import', () => {
    const output = {
      ...validOutput,
      archives: [{ sessionId: 'table-ronde-1', transcript: { fr: highlight.source.excerpt, en: '' }, highlights: [highlight] }],
    }
    expect(parseAgentOutput(output).accepted[0].highlights).toEqual([highlight])
    const invalid = { ...output, archives: [{ ...output.archives[0], transcript: { fr: 'Texte différent.', en: '' } }] }
    expect(parseAgentOutput(invalid).accepted).toEqual([])
    expect(parseAgentOutput(invalid).errors.join(' ')).toContain('passage exact')
  })

  it('rejette une archive entière dont la séquence ne fait pas partie des tables rondes', () => {
    const output = { ...validOutput, archives: [{ ...validOutput.archives[0], sessionId: 'introduction' }] }
    const { accepted, errors } = parseAgentOutput(output)
    expect(accepted).toEqual([])
    expect(errors[0]).toMatch(/introduction/)
  })

  it('rejette une séquence en double, garde la première', () => {
    const output = { ...validOutput, archives: [validOutput.archives[0], { ...validOutput.archives[0], transcript: { fr: 'Autre.', en: '' } }] }
    const { accepted, errors } = parseAgentOutput(output)
    expect(accepted).toHaveLength(1)
    expect(accepted[0].transcript.fr).toContain('Modération')
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
      [{ sessionId: 'table-ronde-1', transcript: { fr: 'x', en: '' } }],
      '2026-10-06T22:50:00Z',
      true,
    )
    expect(archives).toEqual([
      { sessionId: 'table-ronde-1', transcript: { fr: 'x', en: '' }, archivedAt: '2026-10-06T22:50:00Z', published: true },
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
