/**
 * Faux `/api/remi` des E2E (chat avec Rémi · IA, V5 WEL-920) : aucun test n'appelle jamais le vrai réseau
 * (ni OpenRouter, ni la fonction Vercel). Les réponses sont au format EXACT du contrat
 * (`src/features/remiChat/contract.ts`) : `text/event-stream`, une ligne `data: <json>` par événement
 * (`delta`, puis `done` ou `error`), requête en JSON `{ messages, lang, visitorId, context }`. Elles restent
 * donc valables avec le vrai client (`client.ts`), qui poste sur cette route et lit ce flux.
 *
 * Les types ci-dessous sont une copie locale et minimale du contrat (même raison que `museeApi.ts` : le projet
 * TypeScript des tests n'a pas la lib DOM de l'application).
 *
 * - `gotoMusee` pose `stubRemiDefault` sur le contexte : une réponse courte, valable pour tous les tests.
 * - Un test qui veut piloter la réponse appelle `stubRemiApi(page, …)` : les routes d'une page sont
 *   prioritaires sur celles du contexte (même mécanisme que `supabaseStub.ts`).
 */
import type { BrowserContext, Page, Route } from '@playwright/test'

export type RemiErrorCode = 'rate_limited' | 'limit_reached' | 'bad_request' | 'unavailable'

export type RemiStreamEvent = { type: 'delta'; text: string } | { type: 'done' } | { type: 'error'; code: RemiErrorCode }

/** Corps de la requête du navigateur (`RemiChatRequest`). */
export interface RemiRequestBody {
  messages: { role: 'user' | 'assistant'; content: string }[]
  lang: 'fr' | 'en'
  visitorId: string
  context?: { visitedCount: number; stampsCount: number; total: number }
}

/** Ce que répond le faux serveur à une requête. */
export type RemiStub =
  /** Flux normal : un événement `delta` par morceau, puis `done`. */
  | { kind: 'reply'; chunks: string[] }
  /** Flux qui se termine par un événement `error` (après d'éventuels morceaux). */
  | { kind: 'sse-error'; code: RemiErrorCode; chunks?: string[] }
  /** Erreur HTTP avant tout flux (503 : service indisponible, 429 : trop de requêtes, 400 : requête invalide). */
  | { kind: 'http'; status: number }
  /** Ne répond jamais : sert à vérifier que fermer le chat annule la requête. */
  | { kind: 'hang' }

export const DEFAULT_REMI_REPLY: RemiStub = { kind: 'reply', chunks: ['Bonjour, ', 'je suis Rémi.'] }

/** Corps d'un flux SSE au format du contrat. */
export function sseBody(events: RemiStreamEvent[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
}

function eventsFor(stub: RemiStub): RemiStreamEvent[] {
  if (stub.kind === 'reply') return [...stub.chunks.map((text): RemiStreamEvent => ({ type: 'delta', text })), { type: 'done' }]
  if (stub.kind === 'sse-error') return [...(stub.chunks ?? []).map((text): RemiStreamEvent => ({ type: 'delta', text })), { type: 'error', code: stub.code }]
  return []
}

const HTTP_ERROR_CODES: Record<number, RemiErrorCode> = { 400: 'bad_request', 429: 'rate_limited' }

async function respond(route: Route, stub: RemiStub): Promise<void> {
  if (stub.kind === 'hang') return
  if (stub.kind === 'http') {
    await route.fulfill({
      status: stub.status,
      contentType: 'application/json',
      body: JSON.stringify({ error: HTTP_ERROR_CODES[stub.status] ?? 'unavailable' }),
    })
    return
  }
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
    body: sseBody(eventsFor(stub)),
  })
}

const stubbedContexts = new WeakSet<BrowserContext>()

/** Réponse par défaut de tout un contexte (appelée par `gotoMusee`) : aucun test n'atteint le vrai réseau. */
export async function stubRemiDefault(context: BrowserContext): Promise<void> {
  if (stubbedContexts.has(context)) return
  stubbedContexts.add(context)
  await context.route('**/api/remi', (route) => respond(route, DEFAULT_REMI_REPLY))
}

export interface RemiStubHandle {
  /** Corps JSON de chaque requête reçue, dans l'ordre. */
  requests: RemiRequestBody[]
  /** Méthodes HTTP reçues (toujours POST avec le vrai client). */
  methods: string[]
}

/**
 * Pilote la réponse de `/api/remi` pour cette page : une réponse fixe, ou une fonction du numéro de la
 * requête (1, 2…) et de son corps. À appeler avant ou après `gotoMusee`.
 */
export async function stubRemiApi(
  page: Page,
  behavior: RemiStub | ((n: number, body: RemiRequestBody) => RemiStub) = DEFAULT_REMI_REPLY,
): Promise<RemiStubHandle> {
  const handle: RemiStubHandle = { requests: [], methods: [] }
  await page.route('**/api/remi', async (route) => {
    const request = route.request()
    let body = { messages: [], lang: 'fr', visitorId: '' } as RemiRequestBody
    try {
      body = request.postDataJSON() as RemiRequestBody
    } catch {
      // Corps absent ou illisible : la requête est comptée quand même, le test jugera.
    }
    handle.requests.push(body)
    handle.methods.push(request.method())
    await respond(route, typeof behavior === 'function' ? behavior(handle.requests.length, body) : behavior)
  })
  return handle
}
