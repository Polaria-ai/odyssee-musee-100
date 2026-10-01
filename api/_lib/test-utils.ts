/**
 * Aides des tests de `api/` : flux SSE simulés (découpés comme on veut), requêtes du navigateur,
 * lecture d'une réponse en flux. Aucun appel réseau.
 */
import type { RemiChatRequest, RemiStreamEvent } from '../../src/features/remiChat/contract.js'

const encoder = new TextEncoder()

export interface StreamOptions {
  /** Après le dernier morceau, ne pas fermer : le flux reste suspendu jusqu'à l'abandon de ce signal (puis échoue). */
  hangUntilAbort?: AbortSignal
  /** Échoue (coupure réseau) après le dernier morceau. */
  failAfter?: boolean
}

/** Flux d'octets qui livre un morceau par lecture (texte encodé en UTF-8, ou octets bruts). */
export function bytesStream(chunks: (string | Uint8Array)[], options: StreamOptions = {}): ReadableStream<Uint8Array> {
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        const chunk = chunks[index++]
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
        return
      }
      if (options.failAfter) {
        controller.error(new Error('connexion coupée'))
        return
      }
      const signal = options.hangUntilAbort
      if (signal) {
        return new Promise<void>((resolve) => {
          const fail = () => {
            controller.error(new DOMException('aborted', 'AbortError'))
            resolve()
          }
          if (signal.aborted) fail()
          else signal.addEventListener('abort', fail, { once: true })
        })
      }
      controller.close()
    },
  })
}

export function sseResponse(chunks: (string | Uint8Array)[], options: StreamOptions = {}, init: ResponseInit = {}): Response {
  return new Response(bytesStream(chunks, options), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    ...init,
  })
}

/** Un événement `data:` d'OpenRouter portant un morceau de texte (et éventuellement la fin du message). */
export function upstreamDelta(text: string, finishReason: string | null = null): string {
  return `data: ${JSON.stringify({ id: 'gen-1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: text }, finish_reason: finishReason }] })}\n\n`
}
export const UPSTREAM_PROCESSING = ': OPENROUTER PROCESSING\n\n'
export const UPSTREAM_DONE = 'data: [DONE]\n\n'

export function validPayload(overrides: Partial<RemiChatRequest> = {}): RemiChatRequest {
  return {
    messages: [{ role: 'user', content: 'Où est l’aile Culture ?' }],
    lang: 'fr',
    visitorId: 'visitor-0123456789',
    ...overrides,
  }
}

export function jsonRequest(payload: unknown, headers: Record<string, string> = {}, signal?: AbortSignal): Request {
  return new Request('http://localhost/api/remi', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    signal,
  })
}

export async function readAll(response: Response): Promise<string> {
  return await response.text()
}

/** Événements d'un flux de sortie (`data: <json>` séparés par une ligne vide). */
export function parseSse(text: string): RemiStreamEvent[] {
  return text
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block.startsWith('data:'))
    .map((block) => JSON.parse(block.slice(5)) as RemiStreamEvent)
}
