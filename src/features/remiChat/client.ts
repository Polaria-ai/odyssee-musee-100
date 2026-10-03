/**
 * Client du chat avec Rémi · IA et l'Archiviste · IA (même fonction, `persona` de la requête) : poste sur
 * `REMI_CHAT_ENDPOINT` et lit le flux `text/event-stream`
 * (une ligne `data: <json>` par `RemiStreamEvent`, terminée par `done` ou `error`).
 *
 * Ne lève jamais d'exception : tout échec (réseau, abandon, délai, HTTP 4xx/5xx, corps qui n'est pas du
 * SSE, flux coupé) devient `{ ok: false, code, partialText }`, avec le texte déjà reçu. Le navigateur
 * n'appelle que `/api/remi` : la clé du fournisseur reste côté serveur (`api/`, `docs/REMI-IA.md`).
 *
 * Signature figée par l'orchestrateur (`streamRemiReply`) : l'interface de chat l'importe telle quelle.
 */
import type {
  RemiChatErrorCode,
  RemiChatRequest,
  RemiChatResult,
  RemiStreamEvent,
  RemiStreamHandlers,
} from './contract'
import { DEFAULT_PERSONA, REMI_CHAT_ENDPOINT } from './contract'

/** Le serveur abandonne le fournisseur à 20 s : au-delà de 30 s, c'est le réseau qui est en panne. */
export const CLIENT_TIMEOUT_MS = 30_000

const ERROR_CODES: readonly RemiChatErrorCode[] = ['rate_limited', 'limit_reached', 'bad_request', 'unavailable']

function isErrorCode(value: unknown): value is RemiChatErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value)
}

/** Événement porté par une ligne SSE complète, ou `null` (commentaire, ligne vide, JSON illisible ou inconnu). */
export function parseStreamLine(line: string): RemiStreamEvent | null {
  if (!line.startsWith('data:')) return null
  const payload = line.slice(5).trim()
  if (payload === '') return null
  let json: unknown
  try {
    json = JSON.parse(payload)
  } catch {
    return null
  }
  if (typeof json !== 'object' || json === null) return null
  const event = json as { type?: unknown; text?: unknown; code?: unknown }
  if (event.type === 'delta' && typeof event.text === 'string') return { type: 'delta', text: event.text }
  if (event.type === 'done') return { type: 'done' }
  if (event.type === 'error') return { type: 'error', code: isErrorCode(event.code) ? event.code : 'unavailable' }
  return null
}

/**
 * Corps JSON de la requête. Rémi est la persona par défaut du serveur : on n'écrit pas le champ pour lui, donc sa
 * requête reste octet pour octet celle d'avant l'Archiviste (et celle des clients déjà en ligne).
 */
export function serializeRequest(request: RemiChatRequest): string {
  if (request.persona === undefined || request.persona === DEFAULT_PERSONA) {
    const { persona: _omitted, ...rest } = request
    return JSON.stringify(rest)
  }
  return JSON.stringify(request)
}

/** Code d'une réponse HTTP en erreur : celui du corps JSON s'il est valide, sinon déduit du statut. */
async function codeFromErrorResponse(response: Response): Promise<RemiChatErrorCode> {
  try {
    const body: unknown = await response.json()
    const code = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined
    if (isErrorCode(code)) return code
  } catch {
    // Corps absent, ou page d'erreur HTML d'un intermédiaire : on retombe sur le statut.
  }
  return response.status === 429 ? 'rate_limited' : 'unavailable'
}

export async function streamRemiReply(request: RemiChatRequest, handlers: RemiStreamHandlers): Promise<RemiChatResult> {
  let text = ''
  const fail = (code: RemiChatErrorCode): RemiChatResult => ({ ok: false, code, partialText: text })

  if (handlers.signal?.aborted) return fail('unavailable')

  // Abandon demandé par l'interface, ou délai dépassé : un seul signal pour `fetch` et pour la lecture.
  const controller = new AbortController()
  const abort = () => controller.abort()
  handlers.signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, CLIENT_TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetch(REMI_CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: serializeRequest(request),
        signal: controller.signal,
        cache: 'no-store',
      })
    } catch {
      return fail('unavailable')
    }
    if (!response.ok) return fail(await codeFromErrorResponse(response))

    /** Traite une ligne ; renvoie le résultat final si la ligne termine le flux. */
    const handleLine = (line: string): RemiChatResult | null => {
      const event = parseStreamLine(line)
      if (!event) return null
      if (event.type === 'delta') {
        text += event.text
        try {
          handlers.onDelta(event.text)
        } catch {
          // Une erreur de l'interface ne doit pas casser la lecture : le texte reste cumulé dans `text`.
        }
        return null
      }
      return event.type === 'done' ? { ok: true, text } : fail(event.code)
    }

    // Navigateur sans corps lisible en flux : on lit tout, puis on traite ligne à ligne.
    if (!response.body) {
      let whole: string
      try {
        whole = await response.text()
      } catch {
        return fail('unavailable')
      }
      for (const line of whole.split('\n')) {
        const result = handleLine(line.replace(/\r$/, ''))
        if (result) return result
      }
      return fail('unavailable')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      for (;;) {
        let chunk: Awaited<ReturnType<typeof reader.read>>
        try {
          chunk = await reader.read()
        } catch {
          return fail('unavailable') // coupure réseau, abandon ou délai : on garde le texte déjà reçu
        }
        if (chunk.done) {
          buffer += decoder.decode()
          break
        }
        buffer += decoder.decode(chunk.value, { stream: true })

        let newline = buffer.indexOf('\n')
        while (newline !== -1) {
          const line = buffer.slice(0, newline).replace(/\r$/, '')
          buffer = buffer.slice(newline + 1)
          const result = handleLine(line)
          if (result) return result
          newline = buffer.indexOf('\n')
        }
      }
      // Dernière ligne, sans saut de ligne final.
      const result = handleLine(buffer.replace(/\r$/, ''))
      if (result) return result
      // Flux fermé sans `done` ni `error` : réponse tronquée, ou corps qui n'était pas du SSE.
      return fail('unavailable')
    } finally {
      await reader.cancel().catch(() => undefined)
    }
  } finally {
    clearTimeout(timer)
    handlers.signal?.removeEventListener('abort', abort)
  }
}
