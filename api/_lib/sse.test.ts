// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { RemiStreamEvent } from '../../src/features/remiChat/contract.js'
import { encodeSseEvent, eventsOfSseLine, readUpstreamEvents } from './sse.js'
import { bytesStream, UPSTREAM_DONE, UPSTREAM_PROCESSING, upstreamDelta } from './test-utils.js'

async function collect(body: ReadableStream<Uint8Array>): Promise<RemiStreamEvent[]> {
  const out: RemiStreamEvent[] = []
  for await (const event of readUpstreamEvents(body)) out.push(event)
  return out
}

const FULL_STREAM =
  UPSTREAM_PROCESSING +
  UPSTREAM_PROCESSING +
  upstreamDelta('Bonjour, bienvenue au Musée') +
  upstreamDelta(' des 100 — à très vite ✨') +
  upstreamDelta('', 'stop') +
  'data: {"choices":[],"usage":{"prompt_tokens":10000,"completion_tokens":30}}\n\n' +
  UPSTREAM_DONE

const FULL_EVENTS: RemiStreamEvent[] = [
  { type: 'delta', text: 'Bonjour, bienvenue au Musée' },
  { type: 'delta', text: ' des 100 — à très vite ✨' },
  { type: 'done' },
]

describe('encodeSseEvent', () => {
  it('écrit une ligne « data: <json> » suivie d’une ligne vide', () => {
    expect(encodeSseEvent({ type: 'delta', text: 'Bonjour' })).toBe('data: {"type":"delta","text":"Bonjour"}\n\n')
    expect(encodeSseEvent({ type: 'done' })).toBe('data: {"type":"done"}\n\n')
    expect(encodeSseEvent({ type: 'error', code: 'rate_limited' })).toBe('data: {"type":"error","code":"rate_limited"}\n\n')
  })

  it('garde les sauts de ligne du texte dans le JSON (jamais dans le cadrage SSE)', () => {
    const encoded = encodeSseEvent({ type: 'delta', text: 'a\n\nb' })
    expect(encoded).toBe('data: {"type":"delta","text":"a\\n\\nb"}\n\n')
    expect(encoded.slice(0, -2)).not.toContain('\n')
  })
})

describe('eventsOfSseLine', () => {
  it('ignore commentaires, lignes vides et champs autres que data', () => {
    for (const line of ['', ': OPENROUTER PROCESSING', 'event: message', 'id: 4', 'retry: 1000', 'data:', 'data:   ']) {
      expect(eventsOfSseLine(line)).toEqual([])
    }
  })

  it('lit [DONE] et le texte, avec ou sans espace après « data: »', () => {
    expect(eventsOfSseLine('data: [DONE]')).toEqual([{ type: 'done' }])
    expect(eventsOfSseLine('data:[DONE]')).toEqual([{ type: 'done' }])
    expect(eventsOfSseLine(upstreamDelta('Salut').trim())).toEqual([{ type: 'delta', text: 'Salut' }])
  })

  it('ignore les morceaux sans texte (rôle seul, contenu vide, décompte final) et le JSON illisible', () => {
    expect(eventsOfSseLine('data: {"choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}')).toEqual([])
    expect(eventsOfSseLine(upstreamDelta('').trim())).toEqual([])
    expect(eventsOfSseLine('data: {"choices":[],"usage":{}}')).toEqual([])
    expect(eventsOfSseLine('data: {pas du json')).toEqual([])
    expect(eventsOfSseLine('data: 42')).toEqual([])
  })

  it('ignore le raisonnement du modèle : seul le contenu est relayé', () => {
    const line = 'data: {"choices":[{"delta":{"reasoning":"je réfléchis","content":""},"finish_reason":null}]}'
    expect(eventsOfSseLine(line)).toEqual([])
  })

  it('renvoie le texte puis la fin quand ils arrivent dans la même ligne', () => {
    expect(eventsOfSseLine(upstreamDelta('Fin.', 'stop').trim())).toEqual([
      { type: 'delta', text: 'Fin.' },
      { type: 'done' },
    ])
    expect(eventsOfSseLine(upstreamDelta('Coupé', 'length').trim())).toEqual([
      { type: 'delta', text: 'Coupé' },
      { type: 'done' },
    ])
  })

  it('transforme une erreur annoncée dans le flux : 429 → rate_limited, le reste → unavailable', () => {
    const rate = 'data: {"error":{"code":429,"message":"Rate limit exceeded"},"choices":[{"delta":{"content":""},"finish_reason":"error"}]}'
    const other = 'data: {"error":{"code":"server_error","message":"Provider disconnected unexpectedly"}}'
    expect(eventsOfSseLine(rate)).toEqual([{ type: 'error', code: 'rate_limited' }])
    expect(eventsOfSseLine(other)).toEqual([{ type: 'error', code: 'unavailable' }])
    expect(eventsOfSseLine('data: {"choices":[{"delta":{},"finish_reason":"error"}]}')).toEqual([
      { type: 'error', code: 'unavailable' },
    ])
  })
})

describe('readUpstreamEvents', () => {
  const bytes = new TextEncoder().encode(FULL_STREAM)

  it('lit un flux complet : commentaires ignorés, décompte final et [DONE] sans effet', async () => {
    expect(await collect(bytesStream([FULL_STREAM]))).toEqual(FULL_EVENTS)
  })

  it('donne le même résultat quel que soit l’endroit où le flux est coupé en deux (y compris au milieu d’un caractère)', async () => {
    for (let cut = 1; cut < bytes.length; cut += 1) {
      const events = await collect(bytesStream([bytes.slice(0, cut), bytes.slice(cut)]))
      expect(events, `coupure à l'octet ${cut}`).toEqual(FULL_EVENTS)
    }
  })

  it('lit un flux livré octet par octet', async () => {
    const singles = Array.from(bytes, (b) => new Uint8Array([b]))
    expect(await collect(bytesStream(singles))).toEqual(FULL_EVENTS)
  })

  it('accepte des fins de ligne CRLF', async () => {
    expect(await collect(bytesStream([FULL_STREAM.replace(/\n/g, '\r\n')]))).toEqual(FULL_EVENTS)
  })

  it('traite la dernière ligne même sans saut de ligne final', async () => {
    const events = await collect(bytesStream([upstreamDelta('Salut') + 'data: [DONE]']))
    expect(events).toEqual([{ type: 'delta', text: 'Salut' }, { type: 'done' }])
  })

  it('s’arrête à la fin du message sans attendre [DONE]', async () => {
    const events = await collect(bytesStream([upstreamDelta('Salut', 'stop')], { hangUntilAbort: new AbortController().signal }))
    expect(events).toEqual([{ type: 'delta', text: 'Salut' }, { type: 'done' }])
  })

  it('relaie le texte reçu puis une erreur survenue en plein flux', async () => {
    const stream = upstreamDelta('Bonjour') + 'data: {"error":{"code":"server_error","message":"x"},"choices":[{"finish_reason":"error"}]}\n\n'
    expect(await collect(bytesStream([stream]))).toEqual([
      { type: 'delta', text: 'Bonjour' },
      { type: 'error', code: 'unavailable' },
    ])
  })

  it('signale une erreur quand la connexion se ferme sans signal de fin (réponse tronquée)', async () => {
    expect(await collect(bytesStream([upstreamDelta('Bonj')]))).toEqual([
      { type: 'delta', text: 'Bonj' },
      { type: 'error', code: 'unavailable' },
    ])
  })

  it('signale une erreur sur un flux vide', async () => {
    expect(await collect(bytesStream([]))).toEqual([{ type: 'error', code: 'unavailable' }])
  })

  it('signale une erreur quand le réseau se coupe', async () => {
    expect(await collect(bytesStream([upstreamDelta('Bonj')], { failAfter: true }))).toEqual([
      { type: 'delta', text: 'Bonj' },
      { type: 'error', code: 'unavailable' },
    ])
  })

  it('annule la lecture en amont quand le consommateur s’arrête', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode(upstreamDelta('encore')))
      },
      cancel() {
        cancelled = true
      },
    })
    for await (const event of readUpstreamEvents(body)) {
      expect(event.type).toBe('delta')
      break
    }
    expect(cancelled).toBe(true)
  })
})
