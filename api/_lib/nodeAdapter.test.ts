// @vitest-environment node
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable, Writable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { createApiMiddleware, sendWebResponse, toWebRequest } from './nodeAdapter.js'

/** Requête Node simulée : un flux lisible avec méthode, URL et en-têtes. */
function fakeReq(init: { method?: string; url?: string; headers?: Record<string, string | string[]>; body?: string }): IncomingMessage {
  const stream = Readable.from(init.body === undefined ? [] : [Buffer.from(init.body)])
  return Object.assign(stream, {
    method: init.method ?? 'GET',
    url: init.url ?? '/',
    headers: { host: 'localhost:5173', ...init.headers },
  }) as unknown as IncomingMessage
}

/** Réponse Node simulée : enregistre le statut, les en-têtes et les morceaux écrits. */
class FakeRes extends Writable {
  statusCode = 200
  headers: Record<string, string | string[]> = {}
  headersSent = false
  chunks: Buffer[] = []
  setHeader(name: string, value: string | string[]) {
    this.headers[name.toLowerCase()] = value
    return this
  }
  flushHeaders() {
    this.headersSent = true
  }
  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.headersSent = true
    this.chunks.push(Buffer.from(chunk))
    callback()
  }
  get text() {
    return Buffer.concat(this.chunks).toString('utf8')
  }
}
const asRes = (res: FakeRes) => res as unknown as ServerResponse
const closed = (res: FakeRes) => new Promise<void>((resolve) => res.once('close', resolve))

describe('toWebRequest', () => {
  it('reconstruit l’URL, la méthode, les en-têtes et un corps lisible', async () => {
    const res = new FakeRes()
    const request = toWebRequest(
      fakeReq({
        method: 'POST',
        url: '/api/remi?x=1',
        headers: { 'content-type': 'application/json', 'x-multi': ['a', 'b'] },
        body: '{"salut":"é"}',
      }),
      asRes(res),
    )
    expect(request.method).toBe('POST')
    expect(request.url).toBe('http://localhost:5173/api/remi?x=1')
    expect(request.headers.get('content-type')).toBe('application/json')
    expect(request.headers.get('x-multi')).toBe('a, b')
    expect(await request.json()).toEqual({ salut: 'é' })
  })

  it('n’attache pas de corps aux requêtes GET', () => {
    const request = toWebRequest(fakeReq({ method: 'GET', url: '/api/remi' }), asRes(new FakeRes()))
    expect(request.body).toBeNull()
  })

  it('abandonne request.signal quand la connexion se ferme avant la fin de la réponse', async () => {
    const res = new FakeRes()
    const request = toWebRequest(fakeReq({ method: 'POST', body: '{}' }), asRes(res))
    expect(request.signal.aborted).toBe(false)
    const done = closed(res)
    res.destroy()
    await done
    expect(request.signal.aborted).toBe(true)
  })

  it('ne l’abandonne pas quand la réponse s’est terminée normalement', async () => {
    const res = new FakeRes()
    const request = toWebRequest(fakeReq({ method: 'POST', body: '{}' }), asRes(res))
    const done = closed(res)
    res.end('fin')
    await done
    expect(request.signal.aborted).toBe(false)
  })
})

describe('sendWebResponse', () => {
  it('écrit le statut, les en-têtes et le corps morceau par morceau', async () => {
    const res = new FakeRes()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode('data: un\n\n'))
        controller.enqueue(encoder.encode('data: deux\n\n'))
        controller.close()
      },
    })
    const done = closed(res)
    await sendWebResponse(asRes(res), new Response(body, { status: 201, headers: { 'content-type': 'text/event-stream', 'x-test': 'oui' } }))
    await done
    expect(res.statusCode).toBe(201)
    expect(res.headers['content-type']).toBe('text/event-stream')
    expect(res.headers['x-test']).toBe('oui')
    expect(res.chunks.map((c) => c.toString())).toEqual(['data: un\n\n', 'data: deux\n\n'])
    expect(res.writableEnded).toBe(true)
  })

  it('ferme la réponse quand le corps est vide', async () => {
    const res = new FakeRes()
    await sendWebResponse(asRes(res), new Response(null, { status: 204 }))
    expect(res.statusCode).toBe(204)
    expect(res.writableEnded).toBe(true)
  })

  it('annule la lecture du flux quand le navigateur ferme la connexion', async () => {
    const res = new FakeRes()
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('x'))
        return new Promise((resolve) => setTimeout(resolve, 5))
      },
      cancel() {
        cancelled = true
      },
    })
    const sending = sendWebResponse(asRes(res), new Response(body))
    await new Promise((resolve) => setTimeout(resolve, 20))
    res.destroy()
    await sending
    expect(cancelled).toBe(true)
  })
})

describe('createApiMiddleware', () => {
  it('appelle l’export du nom de la méthode HTTP et relaie sa réponse', async () => {
    const POST = vi.fn(async (request: Request) => Response.json({ reçu: await request.json() }, { status: 200 }))
    const middleware = createApiMiddleware(async () => ({ POST }), 'test')
    const res = new FakeRes()
    const done = closed(res)
    await middleware(fakeReq({ method: 'POST', url: '/', headers: { 'content-type': 'application/json' }, body: '{"a":1}' }), asRes(res))
    await done
    expect(POST).toHaveBeenCalledTimes(1)
    expect(JSON.parse(res.text)).toEqual({ reçu: { a: 1 } })
  })

  it('répond 405 quand le module n’exporte pas la méthode', async () => {
    const middleware = createApiMiddleware(async () => ({}), 'test')
    const res = new FakeRes()
    await middleware(fakeReq({ method: 'DELETE' }), asRes(res))
    expect(res.statusCode).toBe(405)
    expect(res.headers.allow).toBe('POST')
    expect(JSON.parse(res.text)).toEqual({ type: 'error', code: 'bad_request' })
  })

  it('répond 500 « unavailable » sans détail ni contenu quand la fonction plante', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const middleware = createApiMiddleware(
      async () => ({
        POST: () => {
          throw new Error('détail interne SECRET-123')
        },
      }),
      'test',
    )
    const res = new FakeRes()
    await middleware(fakeReq({ method: 'POST', body: '{}' }), asRes(res))
    expect(res.statusCode).toBe(500)
    expect(JSON.parse(res.text)).toEqual({ type: 'error', code: 'unavailable' })
    spy.mockRestore()
  })

  it('répond 500 quand le module ne se charge pas', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const middleware = createApiMiddleware(() => Promise.reject(new Error('syntaxe')), 'test')
    const res = new FakeRes()
    await middleware(fakeReq({ method: 'POST' }), asRes(res))
    expect(res.statusCode).toBe(500)
    spy.mockRestore()
  })
})
