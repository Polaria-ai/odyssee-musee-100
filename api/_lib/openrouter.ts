/**
 * Appel d'OpenRouter (API compatible OpenAI, en flux). La clé vient de l'appelant : ce module ne lit
 * jamais l'environnement et n'écrit rien dans les journaux.
 */
import type { ChatMessage, RemiChatErrorCode } from '../../src/features/remiChat/contract.js'
import {
  MAX_OUTPUT_TOKENS,
  OPENROUTER_REFERER,
  OPENROUTER_TITLE,
  OPENROUTER_URL,
  REMI_MODEL,
  TEMPERATURE,
} from './config.js'

export interface UpstreamRequestInput {
  apiKey: string
  /** Prompt système déjà construit (`buildSystemPrompt`). */
  system: string
  /** Historique tronqué, le message du visiteur en dernier. */
  messages: ChatMessage[]
  signal: AbortSignal
  fetchImpl: typeof fetch
}

export type UpstreamOpen =
  | { ok: true; body: ReadableStream<Uint8Array> }
  | { ok: false; code: RemiChatErrorCode; status: number }

/** Corps envoyé à OpenRouter. Exporté pour les tests. */
export function buildUpstreamBody(system: string, messages: ChatMessage[]): string {
  return JSON.stringify({
    model: REMI_MODEL,
    stream: true,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: TEMPERATURE,
    messages: [{ role: 'system', content: system }, ...messages],
  })
}

/**
 * 429 → `rate_limited`. Tout le reste (clé absente ou refusée, crédit épuisé, 5xx, 4xx inattendu,
 * panne réseau) → `unavailable` : le visiteur ne peut rien y faire et le client passe au repli scripté.
 */
export function codeForUpstreamStatus(status: number): RemiChatErrorCode {
  return status === 429 ? 'rate_limited' : 'unavailable'
}

/**
 * Ouvre le flux. Un statut `status: 0` signale une panne avant toute réponse HTTP (réseau, délai
 * dépassé, abandon). Le corps d'une réponse d'erreur est écarté sans être lu : il pourrait contenir
 * des éléments de la requête.
 */
export async function openUpstream(input: UpstreamRequestInput): Promise<UpstreamOpen> {
  let response: Response
  try {
    response = await input.fetchImpl(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'HTTP-Referer': OPENROUTER_REFERER,
        'X-Title': OPENROUTER_TITLE,
      },
      body: buildUpstreamBody(input.system, input.messages),
      signal: input.signal,
    })
  } catch {
    return { ok: false, code: 'unavailable', status: 0 }
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    return { ok: false, code: codeForUpstreamStatus(response.status), status: response.status }
  }
  if (!response.body) return { ok: false, code: 'unavailable', status: response.status }
  return { ok: true, body: response.body }
}
