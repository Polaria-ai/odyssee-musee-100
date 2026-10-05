/**
 * Cœur de la fonction `/api/remi` : reçoit la requête du navigateur, la valide, applique les plafonds,
 * appelle OpenRouter et relaie la réponse en `text/event-stream` (format `RemiStreamEvent`).
 *
 * Une seule fonction pour deux personas (`persona` de la requête, Rémi · IA par défaut) : le prompt système est
 * celui de Rémi (`remiPrompt.ts`) ou celui de l'Archiviste · IA (`archivistePrompt.ts`, alimenté par les archives
 * publiées lues dans Supabase, `publishedArchives.ts`) ; tout le reste (validation, plafonds comptés par persona,
 * appel, flux, erreurs) est commun.
 *
 * Deux sortes de réponses :
 *  - AVANT le premier mot : une erreur HTTP avec un corps JSON `{"type":"error","code":…}` (400
 *    `bad_request`, 403 `limit_reached`, 429 `rate_limited`, 503 `unavailable`). On attend donc le
 *    premier morceau de texte avant d'ouvrir le flux : une panne d'OpenRouter ou une réponse vide ne
 *    laisse jamais un flux `200` vide derrière elle.
 *  - APRÈS : un flux `200` qui se termine par `done` ou `error` ; si OpenRouter coupe en cours de
 *    route, le navigateur garde le texte déjà reçu (`partialText`).
 *
 * Journaux : un objet JSON par requête, avec des compteurs et un code de résultat. Jamais le contenu
 * d'un message, jamais l'IP, jamais l'identifiant du visiteur, jamais la clé.
 */
import type { RemiChatErrorCode, RemiStreamEvent } from '../../src/features/remiChat/contract.js'
import { MAX_BODY_BYTES, UPSTREAM_TIMEOUT_MS } from './config.js'
import { buildArchivistePrompt } from './archivistePrompt.js'
import { clientIp, createRemiLimiter, type RemiLimiter } from './limits.js'
import { openUpstream } from './openrouter.js'
import { createArchivesSource, type ArchivesEnv, type ArchivesSource, type PublishedArchives } from './publishedArchives.js'
import { buildSystemPrompt } from './remiPrompt.js'
import { encodeSseEvent, readUpstreamEvents } from './sse.js'
import { readJsonBody, validateRemiRequest } from './validate.js'

export interface HandlerEnv extends ArchivesEnv {
  OPENROUTER_API_KEY?: string
  REMI_CHAT_DISABLED?: string
}

export interface LogEntry {
  evt: 'remi'
  /** Résultat : `ok`, `disabled`, `no_key`, `invalid`, `rate_limited`, `upstream_error`… */
  outcome: string
  status: number
  ms: number
  [field: string]: string | number | boolean
}

export interface HandlerDeps {
  /** Lu à chaque requête (et non une fois pour toutes) : l'interrupteur agit sans redéploiement du code. */
  getEnv: () => HandlerEnv
  fetchImpl: typeof fetch
  limiter: RemiLimiter
  /** Archives publiées, lues pour l'Archiviste seulement (jamais pour Rémi). */
  archives: ArchivesSource
  now: () => number
  log: (entry: LogEntry) => void
  timeoutMs: number
}

const STATUS_BY_CODE: Record<RemiChatErrorCode, number> = {
  bad_request: 400,
  limit_reached: 403,
  rate_limited: 429,
  unavailable: 503,
}

const NO_STORE = 'no-store, no-transform'

/** Réponse d'erreur avant le flux : corps JSON au format d'un événement `error`. */
export function errorResponse(
  code: RemiChatErrorCode,
  extra: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const event: RemiStreamEvent = { type: 'error', code }
  return new Response(JSON.stringify(event), {
    status: extra.status ?? STATUS_BY_CODE[code],
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': NO_STORE, ...extra.headers },
  })
}

/** Refus propre des méthodes autres que POST. */
export function methodNotAllowed(): Response {
  return errorResponse('bad_request', { status: 405, headers: { Allow: 'POST' } })
}

function isDisabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? '').trim())
}

/**
 * Traite le flux d'OpenRouter pour le navigateur : écarte les espaces de tête, et transforme une fin
 * « normale » sans le moindre texte en erreur (réponse vide → `unavailable`).
 */
async function* guardEvents(events: AsyncGenerator<RemiStreamEvent>): AsyncGenerator<RemiStreamEvent> {
  let produced = false
  for await (const event of events) {
    if (event.type === 'delta') {
      const text = produced ? event.text : event.text.trimStart()
      if (text.length === 0) continue
      produced = true
      yield { type: 'delta', text }
      continue
    }
    yield event.type === 'done' && !produced ? { type: 'error', code: 'unavailable' } : event
    return
  }
  yield { type: 'error', code: 'unavailable' }
}

/** Valeur de journal pour les archives : leur nombre, ou `unavailable` quand elles n'ont pas pu être lues. */
function archivesLogValue(archives: PublishedArchives): number | string {
  return archives === null ? 'unavailable' : archives.length
}

export function createRemiHandler(overrides: Partial<HandlerDeps> = {}): (request: Request) => Promise<Response> {
  const base = {
    getEnv: (): HandlerEnv => process.env,
    fetchImpl: ((input, init) => globalThis.fetch(input, init)) as typeof fetch,
    limiter: createRemiLimiter(),
    now: Date.now,
    log: (entry: LogEntry) => console.log(JSON.stringify(entry)),
    timeoutMs: UPSTREAM_TIMEOUT_MS,
    ...overrides,
  }
  // Source des archives : construite avec les dépendances résolues (même `fetch`, même horloge, même environnement).
  const deps: HandlerDeps = {
    ...base,
    archives: overrides.archives ?? createArchivesSource({ getEnv: base.getEnv, fetchImpl: base.fetchImpl, now: base.now }),
  }

  return async function handleRemi(request: Request): Promise<Response> {
    const started = deps.now()
    const logEnd = (outcome: string, status: number, fields: Record<string, string | number | boolean> = {}) =>
      deps.log({ evt: 'remi', outcome, status, ms: deps.now() - started, ...fields })
    const reply = (response: Response, outcome: string, fields?: Record<string, string | number | boolean>) => {
      logEnd(outcome, response.status, fields)
      return response
    }

    const env = deps.getEnv()
    if (isDisabled(env.REMI_CHAT_DISABLED)) return reply(errorResponse('unavailable'), 'disabled')
    const apiKey = env.OPENROUTER_API_KEY?.trim()
    if (!apiKey) return reply(errorResponse('unavailable'), 'no_key')

    // Un type JSON obligatoire force un contrôle préalable (CORS) à tout site tiers qui voudrait
    // faire poster les navigateurs de ses visiteurs sur cette fonction.
    if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
      return reply(errorResponse('bad_request', { status: 415 }), 'bad_content_type')
    }
    const body = await readJsonBody(request, MAX_BODY_BYTES)
    if (!body.ok) {
      const status = body.reason === 'too_large' ? 413 : 400
      return reply(errorResponse('bad_request', { status }), `bad_body_${body.reason}`)
    }
    const parsed = validateRemiRequest(body.json)
    if (!parsed.ok) return reply(errorResponse('bad_request'), 'invalid', { reason: parsed.reason })
    const { value } = parsed

    const decision = deps.limiter.check({
      ip: clientIp(request.headers),
      visitorId: value.visitorId,
      persona: value.persona,
      userMessageCount: value.userMessageCount,
    })
    if (!decision.ok) {
      if (decision.code === 'limit_reached') return reply(errorResponse('limit_reached'), 'limit_reached')
      return reply(
        errorResponse('rate_limited', { headers: { 'Retry-After': String(decision.retryAfterSec) } }),
        'rate_limited',
      )
    }

    const fields: Record<string, string | number | boolean> = {
      persona: value.persona,
      lang: value.lang,
      history: value.messages.length,
      in_chars: value.messages.reduce((sum, m) => sum + m.content.length, 0),
    }

    // Prompt du persona. L'Archiviste lit d'abord les archives publiées (délai court, cache, jamais d'erreur : une
    // panne donne un prompt sans archives). Cette lecture se fait AVANT le délai accordé à OpenRouter, qu'elle ne
    // grignote pas ; elle est bornée (`ARCHIVES_TIMEOUT_MS`), donc la fonction reste très en deçà de ses 30 s.
    let system: string
    if (value.persona === 'archiviste') {
      const archives = await deps.archives.load().catch((): PublishedArchives => null)
      fields.archives = archivesLogValue(archives)
      system = buildArchivistePrompt({ lang: value.lang, context: value.context, archives })
    } else {
      system = buildSystemPrompt({ lang: value.lang, context: value.context })
    }

    // Un seul contrôleur pour OpenRouter : délai dépassé, client parti ou flux fermé l'abandonnent.
    const upstreamAbort = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      upstreamAbort.abort()
    }, deps.timeoutMs)
    const onClientGone = () => upstreamAbort.abort()
    if (request.signal.aborted) upstreamAbort.abort()
    else request.signal.addEventListener('abort', onClientGone, { once: true })
    const release = () => {
      clearTimeout(timer)
      request.signal.removeEventListener('abort', onClientGone)
    }

    const upstream = await openUpstream({
      apiKey,
      system,
      messages: value.messages,
      signal: upstreamAbort.signal,
      fetchImpl: deps.fetchImpl,
    })
    if (!upstream.ok) {
      release()
      decision.refund()
      return reply(errorResponse(upstream.code), 'upstream_error', {
        ...fields,
        upstream_status: upstream.status,
        timed_out: timedOut,
      })
    }

    const events = guardEvents(readUpstreamEvents(upstream.body))
    const first = await events.next()
    if (first.done || first.value.type !== 'delta') {
      const failure = first.done ? undefined : first.value
      const code: RemiChatErrorCode = failure?.type === 'error' ? failure.code : 'unavailable'
      upstreamAbort.abort()
      release()
      await events.return(undefined)
      decision.refund()
      return reply(errorResponse(code), 'upstream_empty_or_failed', { ...fields, timed_out: timedOut })
    }

    let outChars = 0
    let pending: RemiStreamEvent | null = first.value
    let ended = false
    const finish = (outcome: string, status = 200) => {
      if (ended) return
      ended = true
      release()
      logEnd(outcome, status, { ...fields, out_chars: outChars, timed_out: timedOut })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        let event: RemiStreamEvent
        if (pending) {
          event = pending
          pending = null
        } else {
          try {
            const next = await events.next()
            event = next.done ? { type: 'error', code: 'unavailable' } : next.value
          } catch {
            event = { type: 'error', code: 'unavailable' }
          }
        }
        if (event.type === 'delta') outChars += event.text.length
        controller.enqueue(encoder.encode(encodeSseEvent(event)))
        if (event.type !== 'delta') {
          finish(event.type === 'done' ? 'ok' : 'stream_error')
          controller.close()
        }
      },
      async cancel() {
        // Le navigateur a fermé la connexion : on cesse de payer pour une réponse que personne ne lit.
        upstreamAbort.abort()
        finish('client_closed')
        await events.return(undefined)
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': NO_STORE,
        'X-Accel-Buffering': 'no',
      },
    })
  }
}
