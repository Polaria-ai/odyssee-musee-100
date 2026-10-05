// @vitest-environment node
/**
 * Routage par persona de `/api/remi` (WEL-929) : Rémi · IA (défaut) ou l'Archiviste · IA, prompt, archives publiées,
 * plafonds comptés séparément. Aucun appel réel : OpenRouter et Supabase sont des `fetch` simulés.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENING_PROGRAM } from '../../src/data/eveningProgram.js'
import type { RemiStreamEvent } from '../../src/features/remiChat/contract.js'
import { OPENROUTER_URL } from './config.js'
import { buildArchivistePrompt } from './archivistePrompt.js'
import { createRemiHandler, type HandlerDeps, type HandlerEnv, type LogEntry } from './handler.js'
import { createRemiLimiter } from './limits.js'
import type { ArchivesSource, PublishedArchive } from './publishedArchives.js'
import { buildSystemPrompt } from './remiPrompt.js'
import { jsonRequest, parseSse, readAll, sseResponse, UPSTREAM_DONE, upstreamDelta, validPayload } from './test-utils.js'

const API_KEY = 'cle-de-test-sans-valeur-0123456789'
const SUPABASE = 'https://projet-de-test.supabase.co'
const ANON = 'anon-de-test-sans-valeur'
const [first] = EVENING_PROGRAM

const published: PublishedArchive = {
  sessionId: first.id,
  summary: { fr: 'Synthèse publiée de la première séquence.', en: 'Published summary of the first session.' },
  quotes: [{ text: { fr: 'Une phrase publiée, mot pour mot.', en: 'A published sentence, word for word.' }, author: 'Public', verified: true }],
}

const okStream = () => sseResponse([upstreamDelta('Bonjour'), upstreamDelta(' et bienvenue.', 'stop'), UPSTREAM_DONE])

interface Harness {
  handle: (request: Request) => Promise<Response>
  /** `fetch` d'OpenRouter (et, sans `archives` injectée, de Supabase : voir `route`). */
  fetchMock: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
  logs: LogEntry[]
  env: HandlerEnv
}

function harness(over: Partial<HandlerDeps> = {}, archives: PublishedArchive[] | null = [published]): Harness {
  const logs: LogEntry[] = []
  const env: HandlerEnv = { OPENROUTER_API_KEY: API_KEY }
  const fetchMock = vi.fn()
  const load = vi.fn().mockResolvedValue(archives)
  const source: ArchivesSource = { load: load as ArchivesSource['load'] }
  const handle = createRemiHandler({
    getEnv: () => env,
    fetchImpl: fetchMock as unknown as typeof fetch,
    log: (entry) => logs.push(entry),
    archives: source,
    ...over,
  })
  return { handle, fetchMock, load, logs, env }
}

/** Ce que le handler a envoyé à OpenRouter : le prompt système. */
function systemPromptSent(h: Harness): string {
  const call = h.fetchMock.mock.calls.find(([url]) => url === OPENROUTER_URL) as [string, RequestInit] | undefined
  const body = JSON.parse(call?.[1].body as string) as { messages: { role: string; content: string }[] }
  expect(body.messages[0].role).toBe('system')
  return body.messages[0].content
}

let h: Harness
beforeEach(() => {
  h = harness()
  h.fetchMock.mockImplementation(() => Promise.resolve(okStream()))
})

describe('routage par persona', () => {
  it('sans persona (clients déjà en ligne) : le prompt de Rémi, et aucune lecture des archives', async () => {
    const response = await h.handle(jsonRequest(validPayload({ context: { visitedCount: 2, stampsCount: 0, total: 100 } })))
    expect(response.status).toBe(200)
    await readAll(response)
    expect(systemPromptSent(h)).toBe(buildSystemPrompt({ lang: 'fr', context: { visitedCount: 2, stampsCount: 0, total: 100 } }))
    expect(h.load).not.toHaveBeenCalled()
    expect(h.logs[0]).toMatchObject({ outcome: 'ok', persona: 'remi' })
    expect(h.logs[0]).not.toHaveProperty('archives')
  })

  it('persona remi explicite : identique à l’absence de persona', async () => {
    await readAll(await h.handle(jsonRequest(validPayload({ persona: 'remi' }))))
    expect(systemPromptSent(h)).toBe(buildSystemPrompt({ lang: 'fr' }))
    expect(h.load).not.toHaveBeenCalled()
  })

  it('persona archiviste : le prompt de l’Archiviste, avec les archives publiées', async () => {
    const context = { visitedCount: 1, stampsCount: 0, total: 19 }
    const response = await h.handle(jsonRequest(validPayload({ persona: 'archiviste', lang: 'en', context })))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(parseSse(await readAll(response)).at(-1)).toEqual({ type: 'done' })

    const system = systemPromptSent(h)
    expect(system).toBe(buildArchivistePrompt({ lang: 'en', context, archives: [published] }))
    expect(system).toContain('« Archiviste · IA »')
    expect(system).not.toContain('Tu es « Rémi · IA »')
    expect(h.load).toHaveBeenCalledTimes(1)
    expect(h.logs[0]).toMatchObject({ outcome: 'ok', persona: 'archiviste', archives: 1 })
  })

  it('les synthèses et citations publiées arrivent telles quelles dans le prompt envoyé à OpenRouter', async () => {
    await readAll(await h.handle(jsonRequest(validPayload({ persona: 'archiviste' }))))
    const system = systemPromptSent(h)
    expect(system).toContain(published.summary.fr)
    expect(system).toContain(published.quotes[0].text.fr)
    expect(system).toContain(published.quotes[0].text.en)
  })

  it('l’historique de l’Archiviste part tel quel, avec le même plafond de 12 messages', async () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 === 0 ? ('user' as const) : ('assistant' as const), content: `m${i}` }))
    await readAll(await h.handle(jsonRequest(validPayload({ persona: 'archiviste', messages }))))
    const call = h.fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(call[1].body as string) as { messages: { content: string }[] }
    expect(body.messages).toHaveLength(13)
    expect(body.messages.at(-1)?.content).toBe('m14')
  })

  it('persona inconnue : bad_request (400), sans appeler OpenRouter ni lire les archives', async () => {
    for (const persona of ['curator', 'REMI', '', 7, false]) {
      const response = await h.handle(jsonRequest({ ...validPayload(), persona }))
      expect(response.status, String(persona)).toBe(400)
      expect(await response.json()).toEqual({ type: 'error', code: 'bad_request' })
    }
    expect(h.fetchMock).not.toHaveBeenCalled()
    expect(h.load).not.toHaveBeenCalled()
    expect(h.logs[0]).toMatchObject({ outcome: 'invalid', reason: 'persona.invalid' })
  })
})

describe('panne ou absence des archives', () => {
  it('Supabase illisible (null) : prompt sans archives, réponse normale, jamais d’erreur visible', async () => {
    h = harness({}, null)
    h.fetchMock.mockImplementation(() => Promise.resolve(okStream()))
    const response = await h.handle(jsonRequest(validPayload({ persona: 'archiviste' })))
    expect(response.status).toBe(200)
    expect(parseSse(await readAll(response)).at(-1)).toEqual({ type: 'done' })
    expect(systemPromptSent(h)).toBe(buildArchivistePrompt({ lang: 'fr', archives: null }))
    expect(systemPromptSent(h)).not.toContain(published.summary.fr)
    expect(h.logs[0]).toMatchObject({ outcome: 'ok', archives: 'unavailable' })
  })

  it('aucune archive publiée ([]) : prompt « rien n’est publié »', async () => {
    h = harness({}, [])
    h.fetchMock.mockImplementation(() => Promise.resolve(okStream()))
    await readAll(await h.handle(jsonRequest(validPayload({ persona: 'archiviste' }))))
    expect(systemPromptSent(h)).toBe(buildArchivistePrompt({ lang: 'fr', archives: [] }))
    expect(h.logs[0]).toMatchObject({ archives: 0 })
  })

  it('une source qui lève une exception est traitée comme une panne', async () => {
    h = harness({ archives: { load: () => Promise.reject(new Error('boom')) } })
    h.fetchMock.mockImplementation(() => Promise.resolve(okStream()))
    const response = await h.handle(jsonRequest(validPayload({ persona: 'archiviste' })))
    expect(response.status).toBe(200)
    await readAll(response)
    expect(systemPromptSent(h)).toBe(buildArchivistePrompt({ lang: 'fr', archives: null }))
  })

  describe('avec la vraie source (Supabase et OpenRouter simulés par un même fetch)', () => {
    /** Pas de source injectée : le handler construit la sienne, avec le même `fetch` que pour OpenRouter. */
    function route(supabase: () => Promise<Response>): Harness {
      const logs: LogEntry[] = []
      const env: HandlerEnv = { OPENROUTER_API_KEY: API_KEY, VITE_SUPABASE_URL: SUPABASE, VITE_SUPABASE_ANON_KEY: ANON }
      const fetchMock = vi.fn().mockImplementation((url: string) => (url === OPENROUTER_URL ? Promise.resolve(okStream()) : supabase()))
      const handle = createRemiHandler({ getEnv: () => env, fetchImpl: fetchMock as unknown as typeof fetch, log: (e) => logs.push(e) })
      return { handle, fetchMock, load: vi.fn(), logs, env }
    }

    const row = {
      session_id: first.id,
      summary_fr: published.summary.fr,
      summary_en: published.summary.en,
      quotes: published.quotes,
      published: true,
    }

    it('lit session_archives avec la clé anon, et injecte ce qui est publié', async () => {
      const r = route(() => Promise.resolve(new Response(JSON.stringify([row]), { status: 200 })))
      await readAll(await r.handle(jsonRequest(validPayload({ persona: 'archiviste' }))))
      const supabaseCall = r.fetchMock.mock.calls.find(([url]) => (url as string).startsWith(SUPABASE)) as [string, RequestInit]
      expect(new URL(supabaseCall[0]).pathname).toBe('/rest/v1/session_archives')
      expect((supabaseCall[1].headers as Record<string, string>).apikey).toBe(ANON)
      expect(systemPromptSent(r)).toContain(published.summary.fr)
    })

    it('Supabase en panne : la réponse part quand même, avec un prompt sans archives', async () => {
      const r = route(() => Promise.reject(new TypeError('fetch failed')))
      const response = await r.handle(jsonRequest(validPayload({ persona: 'archiviste' })))
      expect(response.status).toBe(200)
      await readAll(response)
      expect(systemPromptSent(r)).toBe(buildArchivistePrompt({ lang: 'fr', archives: null }))
    })

    it('Rémi ne lit jamais Supabase, même configuré', async () => {
      const r = route(() => Promise.resolve(new Response('[]', { status: 200 })))
      await readAll(await r.handle(jsonRequest(validPayload())))
      expect(r.fetchMock.mock.calls.map(([url]) => url)).toEqual([OPENROUTER_URL])
    })

    it('les clés Supabase ne se retrouvent jamais dans les journaux ni dans ce qui part à OpenRouter', async () => {
      const r = route(() => Promise.resolve(new Response(JSON.stringify([row]), { status: 200 })))
      await readAll(await r.handle(jsonRequest(validPayload({ persona: 'archiviste' }))))
      expect(JSON.stringify(r.logs)).not.toContain(ANON)
      expect(systemPromptSent(r)).not.toContain(ANON)
      expect(systemPromptSent(r)).not.toContain(SUPABASE)
    })
  })
})

describe('plafonds comptés séparément par persona', () => {
  it('40 messages (ici 2) pour Rémi, 40 de plus pour l’Archiviste', async () => {
    h = harness({ limiter: createRemiLimiter({ visitorCap: 2, pair: { capacity: 10, refillMs: 1 } }) })
    h.fetchMock.mockImplementation(() => Promise.resolve(okStream()))
    for (let i = 0; i < 2; i += 1) expect((await h.handle(jsonRequest(validPayload()))).status).toBe(200)
    const refused = await h.handle(jsonRequest(validPayload()))
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ type: 'error', code: 'limit_reached' })

    for (let i = 0; i < 2; i += 1) expect((await h.handle(jsonRequest(validPayload({ persona: 'archiviste' })))).status).toBe(200)
    const refusedToo = await h.handle(jsonRequest(validPayload({ persona: 'archiviste' })))
    expect(refusedToo.status).toBe(403)
    expect(await refusedToo.json()).toEqual({ type: 'error', code: 'limit_reached' })
  })

  it('la rafale de Rémi (429) ne retarde pas l’Archiviste, même visiteur, même IP', async () => {
    const headers = { 'x-real-ip': '198.51.100.9' }
    for (let i = 0; i < 3; i += 1) expect((await h.handle(jsonRequest(validPayload(), headers))).status).toBe(200)
    expect((await h.handle(jsonRequest(validPayload(), headers))).status).toBe(429)
    expect((await h.handle(jsonRequest(validPayload({ persona: 'archiviste' }), headers))).status).toBe(200)
  })

  it('une réponse sans texte rend son message à l’Archiviste, pas à Rémi', async () => {
    h = harness({ limiter: createRemiLimiter({ visitorCap: 1, pair: { capacity: 10, refillMs: 1 } }) })
    h.fetchMock.mockResolvedValueOnce(new Response('erreur', { status: 500 })).mockImplementation(() => Promise.resolve(okStream()))
    const failed = await h.handle(jsonRequest(validPayload({ persona: 'archiviste' })))
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({ type: 'error', code: 'unavailable' } satisfies RemiStreamEvent)
    expect((await h.handle(jsonRequest(validPayload({ persona: 'archiviste' })))).status).toBe(200)
  })
})
