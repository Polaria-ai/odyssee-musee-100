import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getSupabaseMock } = vi.hoisted(() => ({ getSupabaseMock: vi.fn() }))
vi.mock('./supabaseClient', () => ({ getSupabase: () => getSupabaseMock() }))

// Import après le mock : `evening.ts` doit recevoir la version mockée de `getSupabase`.
const { loadEvening } = await import('./evening')
const { EVENING_PROGRAM } = await import('./eveningProgram')

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
  ord: 7,
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

const supabaseArchiveRow = {
  session_id: 'table-ronde-1',
  summary_fr: 'Une synthèse.',
  summary_en: 'A summary.',
  quotes: [{ text: { fr: 'Une citation.', en: '' }, author: 'Muriel Motte', verified: true }],
  archived_at: '2026-10-06T22:50:00.000Z',
  published: true,
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
      combinedClient(Promise.resolve({ data: [supabaseSessionRow], error: null }), Promise.resolve({ data: [supabaseArchiveRow], error: null })),
    )
    const { sessions, archives, source } = await loadEvening()
    expect(source).toBe('supabase')
    expect(sessions.map((s) => s.id)).toEqual(['table-ronde-1'])
    expect(archives['table-ronde-1'].summary.fr).toBe('Une synthèse.')
  })

  it('retombe sur le programme embarqué si la table evening_sessions est vide (programme, contrairement aux archives, exige une réponse non vide)', async () => {
    getSupabaseMock.mockReturnValue(
      combinedClient(Promise.resolve({ data: [], error: null }), Promise.resolve({ data: [], error: null })),
    )
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ archives: [] }) }) as unknown as typeof fetch
    const warnSpy = vi.spyOn(console, 'warn')
    const { sessions, archives, source } = await loadEvening()
    expect(source).toBe('program')
    expect(sessions).toEqual(EVENING_PROGRAM)
    // Une réponse Supabase vide (aucune archive déposée) est normale : {} directement, pas d'avertissement.
    expect(archives).toEqual({})
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('accepte {} comme réponse Supabase valide pour les archives, sans repli sur le JSON statique', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    getSupabaseMock.mockReturnValue(
      combinedClient(Promise.resolve({ data: [supabaseSessionRow], error: null }), Promise.resolve({ data: [], error: null })),
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
          { sessionId: 'table-ronde-1', summary: { fr: 'Publiée.', en: '' }, quotes: [], archivedAt: '2026-10-06T22:50:00.000Z', published: true },
          { sessionId: 'table-ronde-2', summary: { fr: 'Brouillon.', en: '' }, quotes: [], archivedAt: '2026-10-06T22:50:00.000Z', published: false },
        ],
      }),
    }) as unknown as typeof fetch
    const { sessions, archives, source } = await loadEvening()
    expect(source).toBe('program')
    expect(sessions).toEqual(EVENING_PROGRAM)
    expect(Object.keys(archives)).toEqual(['table-ronde-1'])
  })

  it('ne renvoie aucune archive si Supabase et le JSON statique échouent tous les deux', async () => {
    getSupabaseMock.mockReturnValue(null)
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('hors ligne')) as unknown as typeof fetch
    const { sessions, archives, source } = await loadEvening()
    expect(source).toBe('program')
    expect(sessions).toEqual(EVENING_PROGRAM)
    expect(archives).toEqual({})
  })

  it('ne rejette jamais si getSupabase() lève', async () => {
    getSupabaseMock.mockImplementation(() => {
      throw new Error('Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.')
    })
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ archives: [] }) }) as unknown as typeof fetch
    await expect(loadEvening()).resolves.toEqual({ sessions: EVENING_PROGRAM, archives: {}, source: 'program' })
  })

  it('ne rejette jamais si le JSON statique est invalide (mauvaise forme)', async () => {
    getSupabaseMock.mockReturnValue(null)
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: 'the right shape' }) }) as unknown as typeof fetch
    await expect(loadEvening()).resolves.toEqual({ sessions: EVENING_PROGRAM, archives: {}, source: 'program' })
  })

  it('ignore les lignes Supabase invalides sans faire échouer tout le chargement', async () => {
    getSupabaseMock.mockReturnValue(
      combinedClient(Promise.resolve({ data: [supabaseSessionRow, { nawak: true }], error: null }), Promise.resolve({ data: [], error: null })),
    )
    const { sessions, source } = await loadEvening()
    expect(source).toBe('supabase')
    expect(sessions).toHaveLength(1)
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
