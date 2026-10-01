/**
 * Passerelle Node ↔ Web pour le serveur de dev (`pnpm dev`) : fait tourner `api/remi.ts` comme sur
 * Vercel, c'est-à-dire en lui passant une `Request` Web et en relayant sa `Response` (flux compris).
 * Utilisée seulement par le plugin de `vite.config.ts` ; rien de ceci n'est embarqué dans le bundle
 * du navigateur ni dans la fonction déployée.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'

/** Gestionnaires exportés par une fonction `api/*.ts` (un par méthode HTTP). */
export type ApiModule = Record<string, unknown>
type WebHandler = (request: Request) => Response | Promise<Response>

export function toWebRequest(req: IncomingMessage, res: ServerResponse): Request {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || name.startsWith(':')) continue
    if (Array.isArray(value)) for (const v of value) headers.append(name, v)
    else headers.set(name, value)
  }

  // Le navigateur ferme la connexion avant la fin de la réponse : `request.signal` s'abandonne,
  // comme sur Vercel.
  const gone = new AbortController()
  res.on('close', () => {
    if (!res.writableFinished) gone.abort()
  })

  const method = req.method ?? 'GET'
  const hasBody = method !== 'GET' && method !== 'HEAD'
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
    method,
    headers,
    signal: gone.signal,
    ...(hasBody ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: 'half' } : {}),
  } as RequestInit)
}

/** Écrit une `Response` Web dans la réponse Node, morceau par morceau (SSE compris), avec contre-pression. */
export async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, name) => res.setHeader(name, value))
  res.flushHeaders()
  if (!response.body) {
    res.end()
    return
  }

  const reader = response.body.getReader()
  res.once('close', () => void reader.cancel().catch(() => undefined))
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done || res.destroyed) break
      if (!res.write(value)) {
        await new Promise<void>((resolve) => {
          res.once('drain', resolve)
          res.once('close', resolve)
        })
      }
    }
  } catch {
    // Flux interrompu en amont : la réponse est simplement close.
  } finally {
    if (!res.writableEnded) res.end()
  }
}

/**
 * Middleware connect : `load()` renvoie le module de la fonction (rechargé à chaque modification en dev),
 * dont on appelle l'export du nom de la méthode HTTP. Une panne ne laisse sortir ni détail ni contenu.
 */
export function createApiMiddleware(load: () => Promise<ApiModule>, label: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const handler = (await load())[req.method ?? 'GET']
      if (typeof handler !== 'function') {
        res.statusCode = 405
        res.setHeader('Allow', 'POST')
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ type: 'error', code: 'bad_request' }))
        return
      }
      await sendWebResponse(res, await (handler as WebHandler)(toWebRequest(req, res)))
    } catch (error) {
      console.error(`[${label}] erreur :`, error instanceof Error ? error.message : 'inconnue')
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ type: 'error', code: 'unavailable' }))
      } else if (!res.writableEnded) {
        res.end()
      }
    }
  }
}
