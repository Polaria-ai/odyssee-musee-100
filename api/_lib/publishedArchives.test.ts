// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ARCHIVE_SESSIONS } from '../../src/data/eveningProgram.js'
import { ARCHIVES_CACHE_MS, ARCHIVES_FAILURE_CACHE_MS, ARCHIVES_TIMEOUT_MS } from './config.js'
import { createArchivesSource, orderByProgram, parseArchiveRows, type ArchivesEnv } from './publishedArchives.js'

const ENV: ArchivesEnv = { VITE_SUPABASE_URL: 'https://projet-de-test.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-de-test-sans-valeur' }

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session_id: 'table-ronde-1',
    transcript_fr: 'Modération — Une transcription intégrale de test.',
    transcript_en: 'Moderator — A full test transcript.',
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
  it('lit une transcription bilingue publiée d’une table ronde', () => {
    expect(parseArchiveRows([row()])).toEqual([
      {
        sessionId: 'table-ronde-1',
        transcript: { fr: 'Modération — Une transcription intégrale de test.', en: 'Moderator — A full test transcript.' },
      },
    ])
  })

  it('n’accepte que les transcriptions publiées des trois tables rondes', () => {
    expect(parseArchiveRows([row({ published: false }), row({ session_id: 'keynote-ouverture' }), row({ session_id: 'film' })])).toEqual([])
  })

  it('écarte les lignes mal formées, vides ou trop longues sans faire échouer les autres', () => {
    const rows = [
      row({ session_id: 'Pas Valide' }),
      row({ transcript_fr: '' }),
      row({ transcript_fr: 'x'.repeat(40_001) }),
      row({ transcript_en: 42 }),
      'pas un objet',
      null,
      row({ session_id: 'table-ronde-2', transcript_fr: 'Transcription deux.' }),
    ]
    expect(parseArchiveRows(rows).map((archive) => archive.sessionId)).toEqual(['table-ronde-2'])
  })

  it('retire les caractères de contrôle et ignore le doublon d’une table ronde', () => {
    const archives = parseArchiveRows([
      row({ transcript_fr: 'Texte\u0000 propre\u0007.' }),
      row({ transcript_fr: 'Ne remplace pas la première.' }),
    ])
    expect(archives).toHaveLength(1)
    expect(archives[0].transcript.fr).toBe('Texte propre.')
  })

  it('une réponse qui n’est pas un tableau donne une liste vide', () => {
    for (const raw of [null, undefined, {}, 'oups', 42]) expect(parseArchiveRows(raw)).toEqual([])
  })
})

describe('orderByProgram', () => {
  it('suit l’ordre des tables rondes', () => {
    const [first, second] = ARCHIVE_SESSIONS
    const archives = [
      { sessionId: second.id, transcript: { fr: 'x', en: '' } },
      { sessionId: first.id, transcript: { fr: 'x', en: '' } },
    ]
    expect(orderByProgram(archives, ARCHIVE_SESSIONS).map((archive) => archive.sessionId)).toEqual([first.id, second.id])
  })
})

describe('createArchivesSource', () => {
  it('lit les transcriptions publiées avec la clé anon et rien d’autre', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([row()]))
    const source = createArchivesSource({ getEnv: () => ENV, fetchImpl, now: clock().now })
    const archives = await source.load()
    expect(archives?.map((archive) => archive.sessionId)).toEqual(['table-ronde-1'])

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const parsed = new URL(url)
    expect(parsed.origin).toBe('https://projet-de-test.supabase.co')
    expect(parsed.pathname).toBe('/rest/v1/session_archives')
    expect(parsed.searchParams.get('published')).toBe('eq.true')
    expect(parsed.searchParams.get('select')).toBe('session_id,transcript_fr,transcript_en,published')
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

  it('variables absentes ou mal formées : null, sans appeler le réseau', async () => {
    for (const env of [{}, { VITE_SUPABASE_URL: ENV.VITE_SUPABASE_URL }, { VITE_SUPABASE_ANON_KEY: 'k' }, { VITE_SUPABASE_URL: 'pas une url', VITE_SUPABASE_ANON_KEY: 'k' }]) {
      const fetchImpl = vi.fn()
      const source = createArchivesSource({ getEnv: () => env, fetchImpl, now: clock().now })
      expect(await source.load(), JSON.stringify(env)).toBeNull()
      expect(fetchImpl).not.toHaveBeenCalled()
    }
  })

  it('panne et délai : null, jamais d’exception', async () => {
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

  it('un échec n’est mémorisé que 10 s : Supabase revenu, les transcriptions reviennent', async () => {
    const c = clock()
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse([row()]))
    const source = createArchivesSource({ getEnv: () => ENV, fetchImpl, now: c.now })
    expect(await source.load()).toBeNull()
    expect(await source.load()).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    c.advance(ARCHIVES_FAILURE_CACHE_MS + 1)
    expect((await source.load())?.length).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
