// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RemiStreamEvent } from '../../src/features/remiChat/contract.js'
import { MAX_HISTORY_MESSAGES, MAX_OUTPUT_TOKENS, OPENROUTER_REFERER, OPENROUTER_TITLE, OPENROUTER_URL, REMI_MODEL, TEMPERATURE } from './config.js'
import { createRemiHandler, errorResponse, methodNotAllowed, type HandlerDeps, type LogEntry } from './handler.js'
import { createRemiLimiter } from './limits.js'
import { buildSystemPrompt } from './remiPrompt.js'
import {
  bytesStream,
  jsonRequest,
  parseSse,
  readAll,
  sseResponse,
  UPSTREAM_DONE,
  UPSTREAM_PROCESSING,
  upstreamDelta,
  validPayload,
} from './test-utils.js'

const API_KEY = 'cle-de-test-sans-valeur-0123456789'

interface Harness {
  handle: (request: Request) => Promise<Response>
  fetchMock: ReturnType<typeof vi.fn>
  logs: LogEntry[]
  env: { OPENROUTER_API_KEY?: string; REMI_CHAT_DISABLED?: string }
}

function harness(over: Partial<HandlerDeps> = {}): Harness {
  const logs: LogEntry[] = []
  const env: Harness['env'] = { OPENROUTER_API_KEY: API_KEY }
  const fetchMock = vi.fn()
  const handle = createRemiHandler({
    getEnv: () => env,
    fetchImpl: fetchMock as unknown as typeof fetch,
    log: (entry) => logs.push(entry),
    ...over,
  })
  return { handle, fetchMock, logs, env }
}

const okStream = () => sseResponse([UPSTREAM_PROCESSING, upstreamDelta('Bonjour'), upstreamDelta(' et bienvenue.', 'stop'), UPSTREAM_DONE])

let h: Harness
beforeEach(() => {
  h = harness()
})

describe('requête valide', () => {
  it('relaie le texte au format RemiStreamEvent et se termine par done', async () => {
    h.fetchMock.mockResolvedValue(okStream())
    const response = await h.handle(jsonRequest(validPayload()))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(response.headers.get('cache-control')).toContain('no-store')
    const text = await readAll(response)
    expect(text).toBe(
      'data: {"type":"delta","text":"Bonjour"}\n\n' +
        'data: {"type":"delta","text":" et bienvenue."}\n\n' +
        'data: {"type":"done"}\n\n',
    )
  })

  it('appelle OpenRouter avec la clé, les en-têtes d’identification et le bon corps', async () => {
    h.fetchMock.mockResolvedValue(okStream())
    await readAll(
      await h.handle(
        jsonRequest(validPayload({ lang: 'en', context: { visitedCount: 3, stampsCount: 0, total: 100 } })),
      ),
    )

    expect(h.fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = h.fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(OPENROUTER_URL)
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`)
    expect(headers['HTTP-Referer']).toBe('https://www.odyssee-musee-100.com')
    expect(headers['HTTP-Referer']).toBe(OPENROUTER_REFERER)
    expect(headers['X-Title']).toBe(OPENROUTER_TITLE)
    expect(() => new Headers(headers)).not.toThrow() // valeurs d'en-tête valides (accent compris)

    const body = JSON.parse(init.body as string) as Record<string, unknown> & { messages: { role: string; content: string }[] }
    expect(body.model).toBe(REMI_MODEL)
    expect(body.model).toBe('deepseek/deepseek-v4.1-flash')
    expect(body.stream).toBe(true)
    expect(body.max_tokens).toBe(MAX_OUTPUT_TOKENS)
    expect(body.temperature).toBe(TEMPERATURE)
    expect(body.messages[0]).toEqual({
      role: 'system',
      content: buildSystemPrompt({ lang: 'en', context: { visitedCount: 3, stampsCount: 0, total: 100 } }),
    })
    expect(body.messages.slice(1)).toEqual([{ role: 'user', content: 'Où est l’aile Culture ?' }])
    expect(JSON.stringify(body)).not.toContain(API_KEY)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('n’envoie à OpenRouter que les MAX_HISTORY_MESSAGES messages les plus récents', async () => {
    h.fetchMock.mockResolvedValue(okStream())
    const messages = Array.from({ length: 21 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `m${i}`,
    }))
    await readAll(await h.handle(jsonRequest(validPayload({ messages }))))
    const body = JSON.parse((h.fetchMock.mock.calls[0][1] as RequestInit).body as string) as { messages: { content: string }[] }
    expect(body.messages).toHaveLength(1 + MAX_HISTORY_MESSAGES)
    expect(body.messages.at(-1)?.content).toBe('m20')
    expect(body.messages[1].content).toBe('m9')
  })

  it('relaie un flux dont les lignes et les caractères sont coupés entre deux morceaux', async () => {
    const full = new TextEncoder().encode(upstreamDelta('Bonjour à tous') + upstreamDelta(' — ravi de vous voir', 'stop') + UPSTREAM_DONE)
    const pieces = [full.slice(0, 20), full.slice(20, 71), full.slice(71, 72), full.slice(72)]
    h.fetchMock.mockResolvedValue(sseResponse(pieces))
    const events = parseSse(await readAll(await h.handle(jsonRequest(validPayload()))))
    expect(events).toEqual([
      { type: 'delta', text: 'Bonjour à tous' },
      { type: 'delta', text: ' — ravi de vous voir' },
      { type: 'done' },
    ])
  })

  it('écarte les espaces de tête de la réponse', async () => {
    h.fetchMock.mockResolvedValue(sseResponse([upstreamDelta('\n'), upstreamDelta('  '), upstreamDelta('  Bonjour', 'stop')]))
    const events = parseSse(await readAll(await h.handle(jsonRequest(validPayload()))))
    expect(events).toEqual([{ type: 'delta', text: 'Bonjour' }, { type: 'done' }])
  })

  it('journalise un résumé sans aucun contenu, ni IP, ni identifiant, ni clé', async () => {
    h.fetchMock.mockResolvedValue(okStream())
    const secretMessage = 'Mon numéro de carte est 4970-1010-2020-3030'
    const request = jsonRequest(
      validPayload({ messages: [{ role: 'user', content: secretMessage }], visitorId: 'visiteur-identifiant-unique' }),
      { 'x-forwarded-for': '203.0.113.77', 'x-real-ip': '203.0.113.77' },
    )
    await readAll(await h.handle(request))

    expect(h.logs).toHaveLength(1)
    expect(h.logs[0]).toMatchObject({ evt: 'remi', outcome: 'ok', status: 200, lang: 'fr', history: 1, out_chars: 'Bonjour et bienvenue.'.length })
    const dump = JSON.stringify(h.logs)
    for (const forbidden of [secretMessage, '4970', '203.0.113.77', 'visiteur-identifiant-unique', API_KEY, 'Bonjour et bienvenue']) {
      expect(dump).not.toContain(forbidden)
    }
  })
})

describe('erreurs avant le flux', () => {
  it('429 d’OpenRouter → rate_limited (HTTP 429) et le message du visiteur lui est rendu', async () => {
    h = harness({ limiter: createRemiLimiter({ visitorCap: 1 }) })
    h.fetchMock.mockResolvedValueOnce(new Response('{"error":{"code":429}}', { status: 429 })).mockResolvedValueOnce(okStream())
    const first = await h.handle(jsonRequest(validPayload()))
    expect(first.status).toBe(429)
    expect(await first.json()).toEqual({ type: 'error', code: 'rate_limited' })
    // Le plafond était de 1 message : l'échec ne l'a pas consommé.
    const second = await h.handle(jsonRequest(validPayload()))
    expect(second.status).toBe(200)
  })

  it.each([401, 402, 403, 404, 408, 500, 502, 503, 529])('statut %i d’OpenRouter → unavailable (HTTP 503)', async (status) => {
    h.fetchMock.mockResolvedValue(new Response('{"error":{"message":"détail"}}', { status }))
    const response = await h.handle(jsonRequest(validPayload()))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ type: 'error', code: 'unavailable' })
    expect(h.logs[0]).toMatchObject({ outcome: 'upstream_error', upstream_status: status })
  })

  it('réseau en panne (fetch lève) → unavailable', async () => {
    h.fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const response = await h.handle(jsonRequest(validPayload()))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ type: 'error', code: 'unavailable' })
  })

  it('réponse vide (fin sans aucun texte) → unavailable', async () => {
    h.fetchMock.mockResolvedValue(sseResponse([upstreamDelta('', 'stop'), UPSTREAM_DONE]))
    const response = await h.handle(jsonRequest(validPayload()))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ type: 'error', code: 'unavailable' })
  })

  it('réponse faite d’espaces seulement → unavailable', async () => {
    h.fetchMock.mockResolvedValue(sseResponse([upstreamDelta('  \n '), upstreamDelta('', 'stop')]))
    const response = await h.handle(jsonRequest(validPayload()))
    expect(response.status).toBe(503)
  })

  it('flux sans aucun événement exploitable (page HTML en 200) → unavailable', async () => {
    h.fetchMock.mockResolvedValue(new Response('<html>erreur</html>', { status: 200 }))
    expect((await h.handle(jsonRequest(validPayload()))).status).toBe(503)
  })

  it('erreur annoncée dans le flux avant tout texte → unavailable, ou rate_limited pour un 429', async () => {
    h.fetchMock.mockResolvedValueOnce(sseResponse(['data: {"error":{"code":"server_error","message":"x"}}\n\n']))
    const unavailable = await h.handle(jsonRequest(validPayload({ visitorId: 'visiteur-a-0001' })))
    expect(unavailable.status).toBe(503)
    h.fetchMock.mockResolvedValueOnce(sseResponse(['data: {"error":{"code":429,"message":"x"}}\n\n']))
    const limited = await h.handle(jsonRequest(validPayload({ visitorId: 'visiteur-b-0002' })))
    expect(limited.status).toBe(429)
    expect(await limited.json()).toEqual({ type: 'error', code: 'rate_limited' })
  })

  it('délai dépassé avant la première réponse → unavailable', async () => {
    h = harness({ timeoutMs: 30 })
    h.fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const response = await h.handle(jsonRequest(validPayload()))
    expect(response.status).toBe(503)
    expect(h.logs[0]).toMatchObject({ outcome: 'upstream_error', timed_out: true })
  })

  it('délai dépassé avant le premier mot (en-têtes reçus, flux muet) → unavailable', async () => {
    h = harness({ timeoutMs: 30 })
    h.fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve(sseResponse([UPSTREAM_PROCESSING], { hangUntilAbort: init.signal as AbortSignal })),
    )
    const response = await h.handle(jsonRequest(validPayload()))
    expect(response.status).toBe(503)
    expect(h.logs[0]).toMatchObject({ outcome: 'upstream_empty_or_failed', timed_out: true })
  })
})

describe('erreurs pendant le flux', () => {
  it('garde le texte reçu puis termine par error quand OpenRouter annonce une erreur', async () => {
    h.fetchMock.mockResolvedValue(
      sseResponse([upstreamDelta('Bon'), 'data: {"error":{"code":"server_error","message":"x"},"choices":[{"finish_reason":"error"}]}\n\n']),
    )
    const response = await h.handle(jsonRequest(validPayload()))
    expect(response.status).toBe(200)
    expect(parseSse(await readAll(response))).toEqual([
      { type: 'delta', text: 'Bon' },
      { type: 'error', code: 'unavailable' },
    ])
    expect(h.logs[0]).toMatchObject({ outcome: 'stream_error', out_chars: 3 })
  })

  it('termine par error quand la connexion à OpenRouter est coupée', async () => {
    h.fetchMock.mockResolvedValue(sseResponse([upstreamDelta('Bon')], { failAfter: true }))
    const events = parseSse(await readAll(await h.handle(jsonRequest(validPayload()))))
    expect(events).toEqual([
      { type: 'delta', text: 'Bon' },
      { type: 'error', code: 'unavailable' },
    ])
  })

  it('termine par error quand le flux se ferme sans fin annoncée (réponse tronquée)', async () => {
    h.fetchMock.mockResolvedValue(sseResponse([upstreamDelta('Bon')]))
    const events = parseSse(await readAll(await h.handle(jsonRequest(validPayload()))))
    expect(events.at(-1)).toEqual({ type: 'error', code: 'unavailable' })
  })

  it('abandonne OpenRouter au bout du délai si le flux se fige en plein milieu', async () => {
    h = harness({ timeoutMs: 40 })
    let upstreamSignal: AbortSignal | undefined
    h.fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      upstreamSignal = init.signal as AbortSignal
      return Promise.resolve(sseResponse([upstreamDelta('Bon')], { hangUntilAbort: upstreamSignal }))
    })
    const events = parseSse(await readAll(await h.handle(jsonRequest(validPayload()))))
    expect(events).toEqual([
      { type: 'delta', text: 'Bon' },
      { type: 'error', code: 'unavailable' },
    ])
    expect(upstreamSignal?.aborted).toBe(true)
    expect(h.logs[0]).toMatchObject({ outcome: 'stream_error', timed_out: true })
  })
})

describe('abandon par le navigateur', () => {
  it('abandonne OpenRouter quand le client se déconnecte (request.signal)', async () => {
    let upstreamSignal: AbortSignal | undefined
    h.fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      upstreamSignal = init.signal as AbortSignal
      return Promise.resolve(sseResponse([upstreamDelta('Bon')], { hangUntilAbort: upstreamSignal }))
    })
    const gone = new AbortController()
    const response = await h.handle(jsonRequest(validPayload(), {}, gone.signal))
    const reader = response.body!.getReader()
    expect((await reader.read()).done).toBe(false)
    expect(upstreamSignal?.aborted).toBe(false)
    gone.abort()
    expect(upstreamSignal?.aborted).toBe(true)
    await reader.cancel()
  })

  it('abandonne OpenRouter quand le navigateur ferme le flux, et le journalise', async () => {
    let upstreamSignal: AbortSignal | undefined
    h.fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      upstreamSignal = init.signal as AbortSignal
      return Promise.resolve(sseResponse([upstreamDelta('Bon')], { hangUntilAbort: upstreamSignal }))
    })
    const response = await h.handle(jsonRequest(validPayload()))
    const reader = response.body!.getReader()
    await reader.read()
    await reader.cancel()
    expect(upstreamSignal?.aborted).toBe(true)
    expect(h.logs).toHaveLength(1)
    expect(h.logs[0]).toMatchObject({ outcome: 'client_closed' })
  })

  it('n’appelle pas OpenRouter si le client est déjà parti', async () => {
    h.fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      expect((init.signal as AbortSignal).aborted).toBe(true)
      return Promise.reject(new DOMException('aborted', 'AbortError'))
    })
    const gone = new AbortController()
    gone.abort()
    const response = await h.handle(jsonRequest(validPayload(), {}, gone.signal))
    expect(response.status).toBe(503)
  })
})

describe('interrupteur et clé', () => {
  it('sans clé : unavailable, sans appel réseau', async () => {
    h.env.OPENROUTER_API_KEY = undefined
    const response = await h.handle(jsonRequest(validPayload()))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ type: 'error', code: 'unavailable' })
    expect(h.fetchMock).not.toHaveBeenCalled()
    expect(h.logs[0]).toMatchObject({ outcome: 'no_key' })
  })

  it('clé vide ou faite d’espaces : unavailable', async () => {
    h.env.OPENROUTER_API_KEY = '   '
    expect((await h.handle(jsonRequest(validPayload()))).status).toBe(503)
    expect(h.fetchMock).not.toHaveBeenCalled()
  })

  it.each(['1', 'true', 'TRUE', ' on '])('REMI_CHAT_DISABLED=%j → unavailable, sans appel réseau', async (value) => {
    h.env.REMI_CHAT_DISABLED = value
    const response = await h.handle(jsonRequest(validPayload()))
    expect(response.status).toBe(503)
    expect(h.fetchMock).not.toHaveBeenCalled()
    expect(h.logs[0]).toMatchObject({ outcome: 'disabled' })
  })

  it.each(['0', '', 'false', 'non'])('REMI_CHAT_DISABLED=%j n’éteint pas le chat', async (value) => {
    h.env.REMI_CHAT_DISABLED = value
    h.fetchMock.mockResolvedValue(okStream())
    expect((await h.handle(jsonRequest(validPayload()))).status).toBe(200)
  })

  it('lit l’environnement à chaque requête : l’interrupteur agit sans redémarrer l’instance', async () => {
    h.fetchMock.mockImplementation(() => Promise.resolve(okStream()))
    expect((await h.handle(jsonRequest(validPayload({ visitorId: 'visiteur-a-0001' })))).status).toBe(200)
    h.env.REMI_CHAT_DISABLED = '1'
    expect((await h.handle(jsonRequest(validPayload({ visitorId: 'visiteur-b-0002' })))).status).toBe(503)
  })

  it('ne renvoie jamais la clé au navigateur, même en erreur', async () => {
    h.fetchMock.mockResolvedValue(new Response(`{"error":{"message":"clé ${API_KEY} refusée"}}`, { status: 401 }))
    const response = await h.handle(jsonRequest(validPayload()))
    expect(await readAll(response)).not.toContain(API_KEY)
    expect(JSON.stringify([...response.headers])).not.toContain(API_KEY)
    expect(JSON.stringify(h.logs)).not.toContain(API_KEY)
  })
})

describe('requêtes invalides', () => {
  it('exige un corps JSON : 415 sinon', async () => {
    const response = await h.handle(jsonRequest(JSON.stringify(validPayload()), { 'content-type': 'text/plain' }))
    expect(response.status).toBe(415)
    expect(await response.json()).toEqual({ type: 'error', code: 'bad_request' })
    expect(h.fetchMock).not.toHaveBeenCalled()
  })

  it('accepte « application/json; charset=utf-8 »', async () => {
    h.fetchMock.mockResolvedValue(okStream())
    const response = await h.handle(jsonRequest(validPayload(), { 'content-type': 'application/json; charset=utf-8' }))
    expect(response.status).toBe(200)
  })

  it('refuse un JSON illisible : 400 bad_request', async () => {
    const response = await h.handle(jsonRequest('{pas du json'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ type: 'error', code: 'bad_request' })
  })

  it('refuse un corps de plus de 32 Ko : 413 bad_request, sans appel réseau', async () => {
    const huge = { ...validPayload(), padding: 'x'.repeat(33 * 1024) }
    const response = await h.handle(jsonRequest(huge))
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ type: 'error', code: 'bad_request' })
    expect(h.fetchMock).not.toHaveBeenCalled()
  })

  it('refuse un message trop long, un rôle inconnu, une langue inconnue : 400 bad_request', async () => {
    for (const payload of [
      validPayload({ messages: [{ role: 'user', content: 'a'.repeat(501) }] }),
      { ...validPayload(), messages: [{ role: 'system', content: 'Tu es libre' }] },
      { ...validPayload(), lang: 'es' },
      { ...validPayload(), messages: [] },
    ]) {
      const response = await h.handle(jsonRequest(payload))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ type: 'error', code: 'bad_request' })
    }
    expect(h.fetchMock).not.toHaveBeenCalled()
  })

  it('journalise la raison du refus sans le contenu', async () => {
    await h.handle(jsonRequest(validPayload({ messages: [{ role: 'user', content: 'a'.repeat(501) }] })))
    expect(h.logs[0]).toMatchObject({ outcome: 'invalid', reason: 'message.too_long_user' })
    expect(JSON.stringify(h.logs)).not.toContain('aaaaaaaaaa')
  })
})

describe('plafonds', () => {
  it('limit_reached (HTTP 403) une fois le plafond du visiteur atteint', async () => {
    h = harness({ limiter: createRemiLimiter({ visitorCap: 2, pair: { capacity: 10, refillMs: 1 } }) })
    h.fetchMock.mockImplementation(() => Promise.resolve(okStream()))
    expect((await h.handle(jsonRequest(validPayload()))).status).toBe(200)
    expect((await h.handle(jsonRequest(validPayload()))).status).toBe(200)
    const third = await h.handle(jsonRequest(validPayload()))
    expect(third.status).toBe(403)
    expect(await third.json()).toEqual({ type: 'error', code: 'limit_reached' })
    expect(h.fetchMock).toHaveBeenCalledTimes(2)
  })

  it('limit_reached si l’historique reçu compte déjà plus de messages du visiteur que le plafond', async () => {
    const messages = Array.from({ length: 41 }, () => ({ role: 'user' as const, content: 'encore' }))
    const response = await h.handle(jsonRequest(validPayload({ messages })))
    expect(response.status).toBe(403)
    expect(h.fetchMock).not.toHaveBeenCalled()
  })

  it('rate_limited (HTTP 429, Retry-After) pour des requêtes trop rapprochées du même visiteur', async () => {
    h.fetchMock.mockImplementation(() => Promise.resolve(okStream()))
    for (let i = 0; i < 3; i += 1) expect((await h.handle(jsonRequest(validPayload()))).status).toBe(200)
    const fourth = await h.handle(jsonRequest(validPayload()))
    expect(fourth.status).toBe(429)
    expect(Number(fourth.headers.get('retry-after'))).toBeGreaterThanOrEqual(1)
    expect(await fourth.json()).toEqual({ type: 'error', code: 'rate_limited' })
    expect(h.fetchMock).toHaveBeenCalledTimes(3)
  })

  it('un autre visiteur, même IP, n’est pas bloqué', async () => {
    h.fetchMock.mockImplementation(() => Promise.resolve(okStream()))
    for (let i = 0; i < 4; i += 1) await h.handle(jsonRequest(validPayload({ visitorId: 'visiteur-a-0001' }), { 'x-real-ip': '198.51.100.9' }))
    const other = await h.handle(jsonRequest(validPayload({ visitorId: 'visiteur-b-0002' }), { 'x-real-ip': '198.51.100.9' }))
    expect(other.status).toBe(200)
  })
})

describe('réponses utilitaires', () => {
  it('errorResponse : corps JSON au format d’un événement error, jamais mis en cache', async () => {
    const response = errorResponse('bad_request')
    expect(response.status).toBe(400)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect((await response.json()) as RemiStreamEvent).toEqual({ type: 'error', code: 'bad_request' })
  })

  it('methodNotAllowed : 405 avec Allow: POST', async () => {
    const response = methodNotAllowed()
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })

  it('bytesStream sans fin laisse bien la lecture en suspens (garde-fou des tests)', async () => {
    const abort = new AbortController()
    const reader = bytesStream([], { hangUntilAbort: abort.signal }).getReader()
    const pending = reader.read().then(
      () => 'résolu',
      () => 'échoué',
    )
    abort.abort()
    expect(await pending).toBe('échoué')
  })
})
