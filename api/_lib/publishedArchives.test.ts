// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { EVENING_PROGRAM } from '../../src/data/eveningProgram.js'
import { ARCHIVES_CACHE_MS, ARCHIVES_FAILURE_CACHE_MS, ARCHIVES_TIMEOUT_MS } from './config.js'
import { createArchivesSource, orderByProgram, parseArchiveRows, type ArchivesEnv } from './publishedArchives.js'

const ENV: ArchivesEnv = { VITE_SUPABASE_URL: 'https://projet-de-test.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-de-test-sans-valeur' }

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session_id: 'keynote-ouverture',
    summary_fr: 'Une synthèse de test.',
    summary_en: 'A test summary.',
    quotes: [{ text: { fr: 'Une citation de test.', en: 'A test quote.' }, author: 'Public', verified: true }],
    published: true,
    ...over,
  }
}

function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms: number) => void (t += ms) }
}

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })

describe('parseArchiveRows', () => {
  it('lit une ligne valide : synthèse bilingue et citations', () => {
    expect(parseArchiveRows([row()])).toEqual([
      {
        sessionId: 'keynote-ouverture',
        summary: { fr: 'Une synthèse de test.', en: 'A test summary.' },
        quotes: [{ text: { fr: 'Une citation de test.', en: 'A test quote.' }, author: 'Public', verified: true }],
      },
    ])
  })

  it('n’accepte que les archives publiées, même si la base en renvoyait d’autres', () => {
    expect(parseArchiveRows([row({ published: false }), row({ session_id: 'film-1', published: undefined })])).toEqual([])
  })

  it('écarte une ligne mal formée sans faire échouer les autres', () => {
    const rows = [
      row({ session_id: 'Pas Valide' }),
      row({ session_id: 'a', summary_fr: '' }),
      row({ session_id: 'b', summary_fr: 'x'.repeat(1201) }),
      row({ session_id: 'c', summary_fr: 42 }),
      'pas un objet',
      null,
      row({ session_id: 'bonne-ligne' }),
    ]
    expect(parseArchiveRows(rows).map((a) => a.sessionId)).toEqual(['bonne-ligne'])
  })

  it('écarte une citation sans auteur, sans texte français ou trop longue, garde les autres', () => {
    const [archive] = parseArchiveRows([
      row({
        quotes: [
          { text: { fr: 'Sans auteur', en: '' }, author: '', verified: true },
          { text: { fr: '', en: 'Only english' }, author: 'Public', verified: true },
          { text: { fr: 'x'.repeat(281), en: '' }, author: 'Public', verified: true },
          { text: { fr: 'Citation sans version anglaise', en: '' }, author: 'Public' },
          'pas une citation',
        ],
      }),
    ])
    expect(archive.quotes).toEqual([{ text: { fr: 'Citation sans version anglaise', en: '' }, author: 'Public', verified: false }])
  })

  it('« verified » n’est vrai que s’il vaut exactement true', () => {
    const [archive] = parseArchiveRows([
      row({ quotes: [{ text: { fr: 'A', en: '' }, author: 'X', verified: 'true' }, { text: { fr: 'B', en: '' }, author: 'X', verified: true }] }),
    ])
    expect(archive.quotes.map((q) => q.verified)).toEqual([false, true])
  })

  it('garde 5 citations au plus, retire les caractères de contrôle, ignore un doublon de séquence', () => {
    const quotes = Array.from({ length: 8 }, (_, i) => ({ text: { fr: `Citation ${i}`, en: '' }, author: 'Public', verified: false }))
    const archives = parseArchiveRows([row({ quotes, summary_fr: 'Synthèse\u0000 propre\u0007.' }), row({ summary_fr: 'Doublon' })])
    expect(archives).toHaveLength(1)
    expect(archives[0].quotes).toHaveLength(5)
    expect(archives[0].summary.fr).toBe('Synthèse propre.')
  })

  it('une réponse qui n’est pas un tableau donne une liste vide', () => {
    for (const raw of [null, undefined, {}, 'oups', 42]) expect(parseArchiveRows(raw)).toEqual([])
  })
})

describe('orderByProgram', () => {
  it('suit l’ordre du programme, les séquences inconnues à la fin', () => {
    const [first, second] = EVENING_PROGRAM
    const archives = [
      { sessionId: 'inconnue', summary: { fr: 'x', en: '' }, quotes: [] },
      { sessionId: second.id, summary: { fr: 'x', en: '' }, quotes: [] },
      { sessionId: first.id, summary: { fr: 'x', en: '' }, quotes: [] },
    ]
    expect(orderByProgram(archives, EVENING_PROGRAM).map((a) => a.sessionId)).toEqual([first.id, second.id, 'inconnue'])
  })
})

describe('createArchivesSource', () => {
  it('lit les archives publiées avec la clé anon et rien d’autre', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([row()]))
    const source = createArchivesSource({ getEnv: () => ENV, fetchImpl, now: clock().now })
    const archives = await source.load()
    expect(archives?.map((a) => a.sessionId)).toEqual(['keynote-ouverture'])

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const parsed = new URL(url)
    expect(parsed.origin).toBe('https://projet-de-test.supabase.co')
    expect(parsed.pathname).toBe('/rest/v1/session_archives')
    expect(parsed.searchParams.get('published')).toBe('eq.true')
    expect(init.method).toBe('GET')
    const headers = init.headers as Record<string, string>
    expect(headers.apikey).toBe(ENV.VITE_SUPABASE_ANON_KEY)
    expect(headers.Authorization).toBe(`Bearer ${ENV.VITE_SUPABASE_ANON_KEY}`)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('table vide : [] (rien n’est publié), distinct de null (illisible)', async () => {
    const source = createArchivesSource({ getEnv: () => ENV, fetchImpl: vi.fn().mockResolvedValue(jsonResponse([])), now: clock().now })
    expect(await source.load()).toEqual([])
  })

  it('cache de 60 s : une seule requête pour tous les visiteurs, puis une relecture', async () => {
    const c = clock()
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse([row()])))
    const source = createArchivesSource({ getEnv: () => ENV, fetchImpl, now: c.now })
    await Promise.all(Array.from({ length: 50 }, () => source.load()))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    c.advance(ARCHIVES_CACHE_MS - 1)
    await source.load()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    c.advance(2)
    await source.load()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('une nouvelle archive publiée apparaît à la relecture suivante', async () => {
    const c = clock()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([row()]))
    const source = createArchivesSource({ getEnv: () => ENV, fetchImpl, now: c.now })
    expect(await source.load()).toEqual([])
    c.advance(ARCHIVES_CACHE_MS + 1)
    expect((await source.load())?.length).toBe(1)
  })

  it('variables absentes ou mal formées : null, sans appeler le réseau', async () => {
    for (const env of [{}, { VITE_SUPABASE_URL: ENV.VITE_SUPABASE_URL }, { VITE_SUPABASE_ANON_KEY: 'k' }, { VITE_SUPABASE_URL: 'pas une url', VITE_SUPABASE_ANON_KEY: 'k' }]) {
      const fetchImpl = vi.fn()
      const source = createArchivesSource({ getEnv: () => env, fetchImpl, now: clock().now })
      expect(await source.load(), JSON.stringify(env)).toBeNull()
      expect(fetchImpl).not.toHaveBeenCalled()
    }
  })

  it('panne : réseau coupé, HTTP 500, corps illisible, pas un tableau → null, jamais d’exception', async () => {
    const failures: (() => Promise<Response>)[] = [
      () => Promise.reject(new TypeError('fetch failed')),
      () => Promise.resolve(new Response('oups', { status: 500 })),
      () => Promise.resolve(new Response('<html>page d’erreur</html>', { status: 200 })),
      () => Promise.resolve(jsonResponse({ message: 'JWT expired' })),
    ]
    for (const failure of failures) {
      const source = createArchivesSource({ getEnv: () => ENV, fetchImpl: vi.fn().mockImplementation(failure), now: clock().now })
      expect(await source.load()).toBeNull()
    }
  })

  it('délai court : une réponse qui ne vient pas est abandonnée au bout de ARCHIVES_TIMEOUT_MS', async () => {
    vi.useFakeTimers()
    try {
      let aborted = false
      const fetchImpl = vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              aborted = true
              reject(new DOMException('aborted', 'AbortError'))
            })
          }),
      )
      const source = createArchivesSource({ getEnv: () => ENV, fetchImpl, now: Date.now })
      const pending = source.load()
      await vi.advanceTimersByTimeAsync(ARCHIVES_TIMEOUT_MS + 1)
      expect(await pending).toBeNull()
      expect(aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('un échec n’est mémorisé que 10 s : Supabase revenu, les archives reviennent', async () => {
    const c = clock()
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse([row()]))
    const source = createArchivesSource({ getEnv: () => ENV, fetchImpl, now: c.now })
    expect(await source.load()).toBeNull()
    expect(await source.load()).toBeNull() // dans les 10 s : on ne martèle pas un service en panne
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    c.advance(ARCHIVES_FAILURE_CACHE_MS + 1)
    expect((await source.load())?.length).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('lit l’environnement à chaque lecture (variable ajoutée sans redémarrage)', async () => {
    const c = clock()
    const env: ArchivesEnv = {}
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([row()]))
    const source = createArchivesSource({ getEnv: () => env, fetchImpl, now: c.now })
    expect(await source.load()).toBeNull()
    Object.assign(env, ENV)
    c.advance(ARCHIVES_FAILURE_CACHE_MS + 1)
    expect((await source.load())?.length).toBe(1)
  })
})
