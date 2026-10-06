import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getSupabaseMock } = vi.hoisted(() => ({ getSupabaseMock: vi.fn() }))
vi.mock('./supabaseClient', () => ({ getSupabase: () => getSupabaseMock() }))

// Import après le mock : `evening.ts` doit recevoir la version mockée de `getSupabase`.
const { loadEvening } = await import('./evening')
const { ARCHIVE_SESSIONS } = await import('./eveningProgram')

/** Un même client sait répondre aux deux tables interrogées en parallèle par `loadEvening`. */
function combinedClient(
  sessions: PromiseLike<{ data: unknown; error: unknown }>,
  archives: PromiseLike<{ data: unknown; error: unknown }>,
) {
  return {
    from: (table: string) => {
      if (table === 'evening_sessions') return { select: () => ({ order: () => ({ abortSignal: () => sessions }) }) }
      if (table === 'session_archives') return { select: () => ({ eq: () => ({ abortSignal: () => archives }) }) }
      throw new Error(`table inattendue : ${table}`)
    },
  }
}

const supabaseSessionRow = {
  id: 'table-ronde-1',
  ord: 8,
  start_time: '19:01',
  duration_min: 14,
  kind: 'table-ronde',
  title_fr: 'De la promesse aux infrastructures',
  title_en: 'From promise to infrastructure',
  theme_fr: 'Un thème.',
  theme_en: 'A theme.',
  speakers: [{ name: 'Muriel Motte', organization: "L'Opinion", moderator: true }],
  provisional: true,
}

const completeSupabaseSessionRows = ARCHIVE_SESSIONS.map((session) =>
  session.id === supabaseSessionRow.id
    ? supabaseSessionRow
    : {
        id: session.id,
        ord: session.order,
        start_time: session.startTime,
        duration_min: session.durationMin,
        kind: session.kind,
        title_fr: session.title.fr,
        title_en: session.title.en,
        theme_fr: session.theme?.fr,
        theme_en: session.theme?.en,
        speakers: session.speakers,
        provisional: session.provisional,
      },
)

const supabaseArchiveRow = {
  session_id: 'table-ronde-1',
  transcript_fr: 'Modération — Une transcription de test.',
  transcript_en: 'Moderator — A test transcript.',
  archived_at: '2026-10-06T22:50:00.000Z',
  published: true,
}

const archiveHighlight = {
  id: 'transcription-de-test',
  title: { fr: 'Une transcription', en: '' },
  body: { fr: 'Cette bulle montre un passage de test.', en: '' },
  source: { excerpt: 'Une transcription de test.', startSec: 12.5, endSec: 20 },
}

describe('loadEvening', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    getSupabaseMock.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('utilise le programme et les archives Supabase quand les deux répondent avec des données valides', async () => {
    getSupabaseMock.mockReturnValue(
      combinedClient(Promise.resolve({ data: completeSupabaseSessionRows, error: null }), Promise.resolve({ data: [supabaseArchiveRow], error: null })),
    )
    const { sessions, archives, source } = await loadEvening()
    expect(source).toBe('supabase')
    expect(sessions.map((s) => s.id)).toEqual(ARCHIVE_SESSIONS.map((session) => session.id))
    expect(archives['table-ronde-1'].transcript.fr).toBe('Modération — Une transcription de test.')
  })

  it('lit les bulles de la ligne Supabase avec leurs extraits et horodatages', async () => {
    getSupabaseMock.mockReturnValue(
      combinedClient(Promise.resolve({ data: [], error: null }), Promise.resolve({ data: [{ ...supabaseArchiveRow, highlights: [archiveHighlight] }], error: null })),
    )
    const { archives } = await loadEvening()
    expect(archives['table-ronde-1'].highlights).toEqual([archiveHighlight])
    expect(archives['table-ronde-1'].transcript.fr).toBe(supabaseArchiveRow.transcript_fr)
  })

  it('garde lisibles les anciennes lignes Supabase sans colonne highlights', async () => {
    getSupabaseMock.mockReturnValue(
      combinedClient(Promise.resolve({ data: [], error: null }), Promise.resolve({ data: [supabaseArchiveRow], error: null })),
    )
    const { archives } = await loadEvening()
    expect(archives['table-ronde-1'].highlights).toBeUndefined()
    expect(archives['table-ronde-1'].transcript.fr).toBe(supabaseArchiveRow.transcript_fr)
  })

  it('ignore une archive dont une bulle cite un texte absent de sa transcription', async () => {
    getSupabaseMock.mockReturnValue(
      combinedClient(Promise.resolve({ data: [], error: null }), Promise.resolve({
        data: [{ ...supabaseArchiveRow, highlights: [{ ...archiveHighlight, source: { excerpt: 'Un autre texte non publié.' } }] }],
        error: null,
      })),
    )
    expect((await loadEvening()).archives).toEqual({})
  })

  it('conserve les bulles publiées dans le repli statique et exclut toujours les brouillons', async () => {
    getSupabaseMock.mockReturnValue(null)
    const archive = {
      sessionId: 'table-ronde-1',
      transcript: { fr: supabaseArchiveRow.transcript_fr, en: '' },
      highlights: [archiveHighlight],
      archivedAt: supabaseArchiveRow.archived_at,
      published: true,
    }
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ archives: [archive, { ...archive, sessionId: 'table-ronde-2', published: false }] }) }) as unknown as typeof fetch
    const { archives } = await loadEvening()
    expect(Object.keys(archives)).toEqual(['table-ronde-1'])
    expect(archives['table-ronde-1'].highlights).toEqual([archiveHighlight])
  })

  it('retombe sur le programme embarqué si la table evening_sessions est vide (programme, contrairement aux archives, exige une réponse non vide)', async () => {
    getSupabaseMock.mockReturnValue(
      combinedClient(Promise.resolve({ data: [], error: null }), Promise.resolve({ data: [], error: null })),
    )
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ archives: [] }) }) as unknown as typeof fetch
    const warnSpy = vi.spyOn(console, 'warn')
    const { sessions, archives, source } = await loadEvening()
    expect(source).toBe('program')
    expect(sessions).toEqual(ARCHIVE_SESSIONS)
    // Une réponse Supabase vide (aucune archive déposée) est normale : {} directement, pas d'avertissement.
    expect(archives).toEqual({})
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('accepte {} comme réponse Supabase valide pour les archives, sans repli sur le JSON statique', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    getSupabaseMock.mockReturnValue(
      combinedClient(Promise.resolve({ data: completeSupabaseSessionRows, error: null }), Promise.resolve({ data: [], error: null })),
    )
    const { archives } = await loadEvening()
    expect(archives).toEqual({})
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('retombe sur /data/evening.json (filtré aux archives publiées) si Supabase n’est pas configuré', async () => {
    getSupabaseMock.mockReturnValue(null)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        archives: [
          { sessionId: 'table-ronde-1', transcript: { fr: 'Publiée.', en: '' }, archivedAt: '2026-10-06T22:50:00.000Z', published: true },
          { sessionId: 'table-ronde-2', transcript: { fr: 'Brouillon.', en: '' }, archivedAt: '2026-10-06T22:50:00.000Z', published: false },
        ],
      }),
    }) as unknown as typeof fetch
    const { sessions, archives, source } = await loadEvening()
    expect(source).toBe('program')
    expect(sessions).toEqual(ARCHIVE_SESSIONS)
    expect(Object.keys(archives)).toEqual(['table-ronde-1'])
  })

  it('ne renvoie aucune archive si Supabase et le JSON statique échouent tous les deux', async () => {
    getSupabaseMock.mockReturnValue(null)
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('hors ligne')) as unknown as typeof fetch
    const { sessions, archives, source } = await loadEvening()
    expect(source).toBe('program')
    expect(sessions).toEqual(ARCHIVE_SESSIONS)
    expect(archives).toEqual({})
  })

  it('ne rejette jamais si getSupabase() lève', async () => {
    getSupabaseMock.mockImplementation(() => {
      throw new Error('Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.')
    })
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ archives: [] }) }) as unknown as typeof fetch
    await expect(loadEvening()).resolves.toEqual({ sessions: ARCHIVE_SESSIONS, archives: {}, source: 'program' })
  })

  it('ne rejette jamais si le JSON statique est invalide (mauvaise forme)', async () => {
    getSupabaseMock.mockReturnValue(null)
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: 'the right shape' }) }) as unknown as typeof fetch
    await expect(loadEvening()).resolves.toEqual({ sessions: ARCHIVE_SESSIONS, archives: {}, source: 'program' })
  })

  it('ignore les lignes Supabase invalides sans faire échouer tout le chargement', async () => {
    getSupabaseMock.mockReturnValue(
      combinedClient(Promise.resolve({ data: [...completeSupabaseSessionRows, { nawak: true }], error: null }), Promise.resolve({ data: [], error: null })),
    )
    const { sessions, source } = await loadEvening()
    expect(source).toBe('supabase')
    expect(sessions).toHaveLength(ARCHIVE_SESSIONS.length)
    // `warned` est un singleton dédié une-fois-par-session (voir le test « n'écrit jamais dans la
    // console... ») : un autre test de ce fichier a déjà pu déclencher l'avertissement avant
    // celui-ci, ce qui rendrait une assertion `warnSpy` ici dépendante de l'ordre d'exécution.
  })

  it('n’écrit jamais dans la console dans le cas normal (Supabase non configuré, JSON par défaut { archives: [] })', async () => {
    getSupabaseMock.mockReturnValue(null)
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ archives: [] }) }) as unknown as typeof fetch
    const warnSpy = vi.spyOn(console, 'warn')
    const errorSpy = vi.spyOn(console, 'error')
    await loadEvening()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
