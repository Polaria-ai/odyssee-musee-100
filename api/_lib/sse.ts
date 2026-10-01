/**
 * Flux SSE : lecture de celui d'OpenRouter (`readUpstreamEvents`) et écriture de celui du navigateur
 * (`encodeSseEvent`, format `RemiStreamEvent`). Fonctions pures, testées avec des flux simulés.
 *
 * Le flux d'OpenRouter ressemble à (compatible OpenAI) :
 *
 *   : OPENROUTER PROCESSING                      ← commentaire de maintien de connexion, ignoré
 *   data: {"choices":[{"delta":{"content":"Bon"},"finish_reason":null}]}
 *   data: {"choices":[{"delta":{"content":"jour"},"finish_reason":"stop"}]}
 *   data: {"choices":[],"usage":{…}}              ← décompte final, inutile ici
 *   data: [DONE]
 *
 * Une erreur en cours de route arrive comme un événement `data:` portant un objet `error`. Chaque
 * ligne `data:` est traitée dès qu'elle est complète (ce flux n'utilise jamais de `data:` multiligne).
 */
import type { RemiChatErrorCode, RemiStreamEvent } from '../../src/features/remiChat/contract.js'

/** Une ligne `data: <json>` suivie d'une ligne vide, comme la lit le navigateur. */
export function encodeSseEvent(event: RemiStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Erreur annoncée par OpenRouter dans le flux : seul le dépassement de débit a un sens pour le visiteur. */
function errorCodeOf(error: unknown): RemiChatErrorCode {
  if (isRecord(error)) {
    const code = error.code
    if (code === 429 || code === '429' || (typeof code === 'string' && /rate.?limit/i.test(code))) return 'rate_limited'
  }
  return 'unavailable'
}

/**
 * Événements portés par UNE ligne SSE complète (sans son saut de ligne). Une même ligne peut porter
 * un morceau de texte et la fin du message : on renvoie alors `delta` puis `done`.
 */
export function eventsOfSseLine(line: string): RemiStreamEvent[] {
  if (!line.startsWith('data:')) return [] // commentaire (« : … »), ligne vide, event:, id:, retry:
  const payload = line.slice(5).trim()
  if (payload === '') return []
  if (payload === '[DONE]') return [{ type: 'done' }]

  let json: unknown
  try {
    json = JSON.parse(payload)
  } catch {
    return [] // ligne illisible : on l'ignore, la suite du flux peut être saine
  }
  if (!isRecord(json)) return []
  if (json.error) return [{ type: 'error', code: errorCodeOf(json.error) }]

  const choice = Array.isArray(json.choices) ? json.choices[0] : undefined
  if (!isRecord(choice)) return [] // décompte final (`choices: []`) ou fragment sans contenu

  const events: RemiStreamEvent[] = []
  const delta = choice.delta
  if (isRecord(delta) && typeof delta.content === 'string' && delta.content.length > 0) {
    events.push({ type: 'delta', text: delta.content })
  }
  const finish = choice.finish_reason
  if (finish === 'error') events.push({ type: 'error', code: 'unavailable' })
  else if (typeof finish === 'string' && finish.length > 0) events.push({ type: 'done' })
  return events
}

const UNAVAILABLE: RemiStreamEvent = { type: 'error', code: 'unavailable' }

/**
 * Lit le corps d'une réponse OpenRouter et en tire des `RemiStreamEvent`. Le flux produit se termine
 * toujours par `done` ou `error` (jamais les deux) :
 *  - fin normale (`finish_reason`, `[DONE]`) → `done` ;
 *  - erreur annoncée, coupure réseau, connexion fermée sans signal de fin → `error`.
 * Le décodage UTF-8 et le découpage en lignes tiennent compte de morceaux coupés n'importe où, y
 * compris au milieu d'un caractère accentué. Quand le consommateur s'arrête (`return`), la lecture
 * en amont est annulée.
 */
export async function* readUpstreamEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<RemiStreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      let chunk: Awaited<ReturnType<typeof reader.read>>
      try {
        chunk = await reader.read()
      } catch {
        yield UNAVAILABLE // coupure réseau, délai dépassé ou abandon
        return
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
        for (const event of eventsOfSseLine(line)) {
          yield event
          if (event.type !== 'delta') return
        }
        newline = buffer.indexOf('\n')
      }
    }

    // Dernière ligne, sans saut de ligne final.
    for (const event of eventsOfSseLine(buffer.replace(/\r$/, ''))) {
      yield event
      if (event.type !== 'delta') return
    }
    yield UNAVAILABLE // flux fermé sans `finish_reason` ni `[DONE]` : réponse tronquée
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}
