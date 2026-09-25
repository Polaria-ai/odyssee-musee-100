import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getSupabaseMock } = vi.hoisted(() => ({ getSupabaseMock: vi.fn() }))
vi.mock('./supabaseClient', () => ({ getSupabase: () => getSupabaseMock() }))

// Import après le mock : `repository.ts` doit recevoir la version mockée de `getSupabase`.
const { loadPeople } = await import('./repository')

/** Reconstruit la forme chaînée `from().select().eq().abortSignal()` renvoyée par supabase-js. */
function supabaseClientReturning(query: PromiseLike<{ data: unknown; error: unknown }>) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          abortSignal: () => query,
        }),
      }),
    }),
  }
}

const validStaticPerson = {
  id: 'grace-hopper',
  order: 1,
  name: 'Grace Hopper',
  role: { fr: 'Informaticienne', en: 'Computer scientist' },
  organization: 'US Navy',
  country: 'US', // hors UE, mais toléré : le schéma valide un code ISO générique à 2 lettres
  wing: 'infrastructures',
  bio: { fr: 'Une accroche courte.', en: 'A short hook.' },
  story: { fr: 'Une histoire.', en: 'A story.' },
  photoUrl: null,
  placeholder: false,
}

const supabaseRow = {
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

describe('loadPeople', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    getSupabaseMock.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('utilise Supabase quand il répond avec des fiches valides', async () => {
    getSupabaseMock.mockReturnValue(supabaseClientReturning(Promise.resolve({ data: [supabaseRow], error: null })))
    const { people, source } = await loadPeople()
    expect(source).toBe('supabase')
    expect(people.map((p) => p.id)).toEqual(['ada-lovelace'])
  })

  it('ne laisse aucun minuteur actif quand Supabase répond avant le délai (withTimeout annule son setTimeout)', async () => {
    vi.useFakeTimers()
    try {
      getSupabaseMock.mockReturnValue(supabaseClientReturning(Promise.resolve({ data: [supabaseRow], error: null })))
      const { source } = await loadPeople()
      expect(source).toBe('supabase')
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('retombe silencieusement sur /data/people.json puis les fiches d’attente si la table Supabase est vide (200 + [])', async () => {
    const warnSpy = vi.spyOn(console, 'warn')
    getSupabaseMock.mockReturnValue(supabaseClientReturning(Promise.resolve({ data: [], error: null })))
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] }) as unknown as typeof fetch
    const { people, source } = await loadPeople()
    expect(source).toBe('placeholder')
    expect(people).toHaveLength(100)
    // Une table vide n'est pas une erreur : aucun avertissement bruyant, pas plus au premier
    // repli (Supabase → JSON) qu'au second (JSON → fiches d'attente).
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('retombe sur /data/people.json si Supabase n’est pas configuré', async () => {
    getSupabaseMock.mockReturnValue(null)
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [validStaticPerson] }) as unknown as typeof fetch
    const { people, source } = await loadPeople()
    expect(source).toBe('static')
    expect(people).toHaveLength(1)
  })

  it('retombe sur les fiches d’attente si Supabase et le JSON statique échouent tous les deux', async () => {
    getSupabaseMock.mockReturnValue(null)
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('hors ligne')) as unknown as typeof fetch
    const { people, source } = await loadPeople()
    expect(source).toBe('placeholder')
    expect(people).toHaveLength(100)
  })

  it('passe à la source suivante si Supabase renvoie une erreur', async () => {
    getSupabaseMock.mockReturnValue(
      supabaseClientReturning(Promise.resolve({ data: null, error: { message: 'boom' } })),
    )
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [validStaticPerson] }) as unknown as typeof fetch
    const { people, source } = await loadPeople()
    expect(source).toBe('static')
    expect(people).toHaveLength(1)
  })

  it('passe à la source suivante si Supabase ne renvoie aucune fiche valide', async () => {
    getSupabaseMock.mockReturnValue(supabaseClientReturning(Promise.resolve({ data: [{ nawak: true }], error: null })))
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [validStaticPerson] }) as unknown as typeof fetch
    const { people, source } = await loadPeople()
    expect(source).toBe('static')
    expect(people).toHaveLength(1)
  })

  it('ne rejette jamais même si fetch renvoie un JSON invalide', async () => {
    getSupabaseMock.mockReturnValue(null)
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: 'an array' }) }) as unknown as typeof fetch
    const { people, source } = await loadPeople()
    expect(source).toBe('placeholder')
    expect(people).toHaveLength(100)
  })

  it('ne rejette jamais si getSupabase() lève (ex. VITE_SUPABASE_URL mal renseignée)', async () => {
    getSupabaseMock.mockImplementation(() => {
      throw new Error('Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.')
    })
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [validStaticPerson] }) as unknown as typeof fetch
    await expect(loadPeople()).resolves.toEqual({ people: [validStaticPerson], source: 'static' })
  })
})
