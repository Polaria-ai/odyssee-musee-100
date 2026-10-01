// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLIENT_TIMEOUT_MS, parseStreamLine, streamRemiReply } from './client'
import { REMI_CHAT_ENDPOINT, type RemiChatRequest, type RemiStreamEvent } from './contract'

const request: RemiChatRequest = {
  messages: [{ role: 'user', content: 'Où est l’aile Culture ?' }],
  lang: 'fr',
  visitorId: 'visitor-0123456789',
  context: { visitedCount: 2, stampsCount: 0, total: 100 },
}

const enc = new TextEncoder()
const line = (event: RemiStreamEvent) => `data: ${JSON.stringify(event)}\n\n`
const delta = (text: string) => line({ type: 'delta', text })
const DONE = line({ type: 'done' })

/** Flux de réponse livré morceau par morceau ; `hangUntil` le laisse suspendu jusqu'à l'abandon de ce signal. */
function stream(chunks: (string | Uint8Array)[], opts: { hangUntil?: AbortSignal; failAfter?: boolean } = {}) {
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        const chunk = chunks[i++]
        controller.enqueue(typeof chunk === 'string' ? enc.encode(chunk) : chunk)
        return
      }
      if (opts.failAfter) return void controller.error(new TypeError('network error'))
      const signal = opts.hangUntil
      if (!signal) return void controller.close()
      return new Promise<void>((resolve) => {
        const fail = () => {
          controller.error(new DOMException('aborted', 'AbortError'))
          resolve()
        }
        if (signal.aborted) fail()
        else signal.addEventListener('abort', fail, { once: true })
      })
    },
  })
}

const sse = (chunks: (string | Uint8Array)[], opts?: Parameters<typeof stream>[1], init: ResponseInit = {}) =>
  new Response(stream(chunks, opts), { status: 200, headers: { 'content-type': 'text/event-stream' }, ...init })

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function collector() {
  const deltas: string[] = []
  return { deltas, handlers: { onDelta: (t: string) => void deltas.push(t) } }
}

describe('streamRemiReply : requête', () => {
  it('poste le JSON de la requête sur /api/remi et lit un flux complet', async () => {
    fetchMock.mockResolvedValue(sse([delta('Bonjour'), delta(' et bienvenue.'), DONE]))
    const { deltas, handlers } = collector()
    const result = await streamRemiReply(request, handlers)

    expect(result).toEqual({ ok: true, text: 'Bonjour et bienvenue.' })
    expect(deltas).toEqual(['Bonjour', ' et bienvenue.'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(REMI_CHAT_ENDPOINT)
    expect(url).toBe('/api/remi')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual(request)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('appelle onDelta dans l’ordre, au fil de l’arrivée des morceaux', async () => {
    const received: string[] = []
    fetchMock.mockResolvedValue(sse([delta('un'), delta('deux'), delta('trois'), DONE]))
    const result = await streamRemiReply(request, { onDelta: (t) => void received.push(t) })
    expect(received).toEqual(['un', 'deux', 'trois'])
    expect(result).toEqual({ ok: true, text: 'undeuxtrois' })
  })
})

describe('streamRemiReply : lecture du flux', () => {
  it('relit correctement un événement coupé au milieu, en plein JSON ou au milieu d’un caractère', async () => {
    const full = enc.encode(delta('Bienvenue au Musée des 100 — à très vite ✨') + delta(' Suite.') + DONE)
    const expected = 'Bienvenue au Musée des 100 — à très vite ✨ Suite.'
    for (let cut = 1; cut < full.length; cut += 1) {
      fetchMock.mockResolvedValueOnce(sse([full.slice(0, cut), full.slice(cut)]))
      const { deltas, handlers } = collector()
      const result = await streamRemiReply(request, handlers)
      expect(result, `coupure à l'octet ${cut}`).toEqual({ ok: true, text: expected })
      expect(deltas.join('')).toBe(expected)
    }
  })

  it('lit un flux livré octet par octet, avec des fins de ligne CRLF et des commentaires', async () => {
    const text = ': ping\r\n\r\n' + (delta('Salut') + DONE).replace(/\n/g, '\r\n')
    fetchMock.mockResolvedValue(sse(Array.from(enc.encode(text), (b) => new Uint8Array([b]))))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: true, text: 'Salut' })
  })

  it('lit la dernière ligne même sans saut de ligne final', async () => {
    fetchMock.mockResolvedValue(sse([delta('Salut'), 'data: {"type":"done"}']))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: true, text: 'Salut' })
  })

  it('renvoie le texte déjà reçu (partialText) quand une erreur survient en plein flux', async () => {
    fetchMock.mockResolvedValue(sse([delta('Bonj'), delta('our'), line({ type: 'error', code: 'unavailable' })]))
    const { deltas, handlers } = collector()
    expect(await streamRemiReply(request, handlers)).toEqual({ ok: false, code: 'unavailable', partialText: 'Bonjour' })
    expect(deltas).toEqual(['Bonj', 'our'])
  })

  it('relaie le code de l’erreur annoncée dans le flux', async () => {
    fetchMock.mockResolvedValue(sse([delta('Bon'), line({ type: 'error', code: 'rate_limited' })]))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: false, code: 'rate_limited', partialText: 'Bon' })
  })

  it('traite un code d’erreur inconnu comme unavailable', async () => {
    fetchMock.mockResolvedValue(sse(['data: {"type":"error","code":"explosion"}\n\n']))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: false, code: 'unavailable', partialText: '' })
  })

  it('renvoie unavailable avec le texte reçu quand le flux se ferme sans done (coupure)', async () => {
    fetchMock.mockResolvedValue(sse([delta('Bonj')]))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: false, code: 'unavailable', partialText: 'Bonj' })
  })

  it('renvoie unavailable avec le texte reçu quand le réseau se coupe en cours de lecture', async () => {
    fetchMock.mockResolvedValue(sse([delta('Bonj')], { failAfter: true }))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: false, code: 'unavailable', partialText: 'Bonj' })
  })

  it('ignore les lignes illisibles et les événements inconnus', async () => {
    fetchMock.mockResolvedValue(sse(['data: {pas du json\n\n', 'data: {"type":"autre"}\n\n', 'event: x\n\n', delta('Salut'), DONE]))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: true, text: 'Salut' })
  })

  it('continue de lire quand onDelta lève une exception', async () => {
    fetchMock.mockResolvedValue(sse([delta('a'), delta('b'), DONE]))
    const onDelta = vi.fn(() => {
      throw new Error('bug d’interface')
    })
    expect(await streamRemiReply(request, { onDelta })).toEqual({ ok: true, text: 'ab' })
    expect(onDelta).toHaveBeenCalledTimes(2)
  })

  it('lit toute la réponse d’un coup quand le navigateur ne fournit pas de corps en flux', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, body: null, text: async () => delta('Bonjour') + DONE })
    const { deltas, handlers } = collector()
    expect(await streamRemiReply(request, handlers)).toEqual({ ok: true, text: 'Bonjour' })
    expect(deltas).toEqual(['Bonjour'])
  })
})

describe('streamRemiReply : erreurs HTTP et corps inattendus', () => {
  it('HTTP 429 sans corps utile → rate_limited', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 429 }))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: false, code: 'rate_limited', partialText: '' })
  })

  it('HTTP 429 avec un corps JSON rate_limited → rate_limited', async () => {
    fetchMock.mockResolvedValue(Response.json({ type: 'error', code: 'rate_limited' }, { status: 429 }))
    expect(await streamRemiReply(request, collector().handlers)).toMatchObject({ ok: false, code: 'rate_limited' })
  })

  it('prend le code du corps JSON quand il est valide : limit_reached, bad_request', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ type: 'error', code: 'limit_reached' }, { status: 403 }))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: false, code: 'limit_reached', partialText: '' })
    fetchMock.mockResolvedValueOnce(Response.json({ type: 'error', code: 'bad_request' }, { status: 400 }))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: false, code: 'bad_request', partialText: '' })
  })

  it('HTTP 500, 503 et pages d’erreur HTML → unavailable', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: false, code: 'unavailable', partialText: '' })
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }))
    expect(await streamRemiReply(request, collector().handlers)).toMatchObject({ ok: false, code: 'unavailable' })
    fetchMock.mockResolvedValueOnce(Response.json({ type: 'error', code: 'unavailable' }, { status: 503 }))
    expect(await streamRemiReply(request, collector().handlers)).toMatchObject({ ok: false, code: 'unavailable' })
  })

  it('un code JSON inconnu retombe sur le statut', async () => {
    fetchMock.mockResolvedValue(Response.json({ type: 'error', code: 'autre' }, { status: 429 }))
    expect(await streamRemiReply(request, collector().handlers)).toMatchObject({ code: 'rate_limited' })
  })

  it('corps non SSE en 200 (page d’accueil renvoyée par une réécriture) → unavailable', async () => {
    fetchMock.mockResolvedValue(new Response('<!doctype html><html><body>Musée</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    const { deltas, handlers } = collector()
    expect(await streamRemiReply(request, handlers)).toEqual({ ok: false, code: 'unavailable', partialText: '' })
    expect(deltas).toEqual([])
  })

  it('corps vide en 200 → unavailable', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }))
    expect(await streamRemiReply(request, collector().handlers)).toEqual({ ok: false, code: 'unavailable', partialText: '' })
  })

  it('erreur réseau (fetch rejette) → unavailable, sans exception', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(streamRemiReply(request, collector().handlers)).resolves.toEqual({ ok: false, code: 'unavailable', partialText: '' })
  })
})

describe('streamRemiReply : abandon et délai', () => {
  it('abandon avant l’envoi → unavailable, sans appeler le réseau', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await streamRemiReply(request, { onDelta: vi.fn(), signal: controller.signal })
    expect(result).toEqual({ ok: false, code: 'unavailable', partialText: '' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('abandon pendant la requête → unavailable, sans exception non gérée', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const controller = new AbortController()
    const pending = streamRemiReply(request, { onDelta: vi.fn(), signal: controller.signal })
    controller.abort()
    await expect(pending).resolves.toEqual({ ok: false, code: 'unavailable', partialText: '' })
  })

  it('abandon en plein flux → unavailable avec le texte déjà reçu', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve(sse([delta('Bonj')], { hangUntil: init.signal as AbortSignal })),
    )
    const controller = new AbortController()
    const deltas: string[] = []
    const pending = streamRemiReply(request, {
      onDelta: (text) => {
        deltas.push(text)
        controller.abort() // l'interface abandonne dès le premier morceau
      },
      signal: controller.signal,
    })
    await expect(pending).resolves.toEqual({ ok: false, code: 'unavailable', partialText: 'Bonj' })
    expect(deltas).toEqual(['Bonj'])
  })

  it('abandonne la requête réseau quand le signal de l’interface s’abandonne', async () => {
    let netSignal: AbortSignal | undefined
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      netSignal = init.signal as AbortSignal
      return Promise.resolve(sse([], { hangUntil: netSignal }))
    })
    const controller = new AbortController()
    const pending = streamRemiReply(request, { onDelta: vi.fn(), signal: controller.signal })
    await Promise.resolve()
    expect(netSignal?.aborted).toBe(false)
    controller.abort()
    await pending
    expect(netSignal?.aborted).toBe(true)
  })

  it(`se rend après ${CLIENT_TIMEOUT_MS / 1000} s sans réponse → unavailable, avec le texte déjà reçu`, async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve(sse([delta('Bonj')], { hangUntil: init.signal as AbortSignal })),
    )
    const pending = streamRemiReply(request, { onDelta: vi.fn() })
    await vi.advanceTimersByTimeAsync(CLIENT_TIMEOUT_MS + 10)
    await expect(pending).resolves.toEqual({ ok: false, code: 'unavailable', partialText: 'Bonj' })
  })

  it('retire son écouteur et son minuteur une fois terminé', async () => {
    fetchMock.mockResolvedValue(sse([delta('Salut'), DONE]))
    const controller = new AbortController()
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener')
    await streamRemiReply(request, { onDelta: vi.fn(), signal: controller.signal })
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function))
  })
})

describe('parseStreamLine', () => {
  it('lit delta, done et error', () => {
    expect(parseStreamLine('data: {"type":"delta","text":"é"}')).toEqual({ type: 'delta', text: 'é' })
    expect(parseStreamLine('data:{"type":"done"}')).toEqual({ type: 'done' })
    expect(parseStreamLine('data: {"type":"error","code":"limit_reached"}')).toEqual({ type: 'error', code: 'limit_reached' })
  })

  it('renvoie null pour tout le reste', () => {
    for (const l of ['', ': ping', 'event: x', 'data:', 'data: nope', 'data: 12', 'data: null', 'data: {"type":"delta"}', 'data: {"type":"delta","text":3}']) {
      expect(parseStreamLine(l), l).toBeNull()
    }
  })
})
