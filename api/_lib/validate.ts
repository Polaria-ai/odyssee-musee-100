/**
 * Validation stricte de la requête du chat (`RemiChatRequest`) et lecture bornée du corps JSON.
 * Fonctions pures : aucune ne lit l'environnement ni le réseau.
 *
 * Les raisons renvoyées (`reason`) décrivent le champ fautif, jamais son contenu : elles peuvent
 * sans risque aller dans les journaux.
 */
import type { ChatMessage, RemiChatContext, RemiChatRequest } from '../../src/features/remiChat/contract.js'
import {
  MAX_ASSISTANT_MESSAGE_CHARS,
  MAX_CONTEXT_COUNT,
  MAX_HISTORY_MESSAGES,
  MAX_RAW_MESSAGES,
  MAX_USER_MESSAGE_CHARS,
  MAX_VISITOR_ID_CHARS,
} from './config.js'

export interface ValidRequest {
  /** Les `MAX_HISTORY_MESSAGES` messages les plus récents, nettoyés. Le dernier est celui du visiteur. */
  messages: ChatMessage[]
  lang: RemiChatRequest['lang']
  visitorId: string
  context?: RemiChatContext
  /** Messages du visiteur dans l'historique reçu, avant troncature (le nouveau message compris). */
  userMessageCount: number
}

export type ValidationResult = { ok: true; value: ValidRequest } | { ok: false; reason: string }

/** Caractères de contrôle, sauf tabulation et saut de ligne. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const VISITOR_ID_RE = /^[\w.:-]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, '').trim()
}

function validateContext(raw: unknown): RemiChatContext | null {
  if (!isRecord(raw)) return null
  const { visitedCount, stampsCount, total } = raw
  for (const n of [visitedCount, stampsCount, total]) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > MAX_CONTEXT_COUNT) return null
  }
  return { visitedCount: visitedCount as number, stampsCount: stampsCount as number, total: total as number }
}

export function validateRemiRequest(raw: unknown): ValidationResult {
  if (!isRecord(raw)) return { ok: false, reason: 'body.not_object' }

  const { messages: rawMessages, lang, visitorId: rawVisitorId, context: rawContext } = raw

  if (lang !== 'fr' && lang !== 'en') return { ok: false, reason: 'lang.invalid' }

  if (typeof rawVisitorId !== 'string') return { ok: false, reason: 'visitorId.invalid' }
  const visitorId = rawVisitorId.trim()
  if (visitorId.length === 0 || visitorId.length > MAX_VISITOR_ID_CHARS || !VISITOR_ID_RE.test(visitorId)) {
    return { ok: false, reason: 'visitorId.invalid' }
  }

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) return { ok: false, reason: 'messages.empty' }
  if (rawMessages.length > MAX_RAW_MESSAGES) return { ok: false, reason: 'messages.too_many' }

  const messages: ChatMessage[] = []
  let userMessageCount = 0
  for (const item of rawMessages) {
    if (!isRecord(item)) return { ok: false, reason: 'message.not_object' }
    const { role, content } = item
    if (role !== 'user' && role !== 'assistant') return { ok: false, reason: 'message.role' }
    if (typeof content !== 'string') return { ok: false, reason: 'message.content_type' }
    const text = cleanText(content)
    if (text.length === 0) return { ok: false, reason: 'message.empty' }
    const max = role === 'user' ? MAX_USER_MESSAGE_CHARS : MAX_ASSISTANT_MESSAGE_CHARS
    if (text.length > max) return { ok: false, reason: `message.too_long_${role}` }
    if (role === 'user') userMessageCount += 1
    messages.push({ role, content: text })
  }

  // Une réponse se donne à un visiteur : le dernier mot doit être le sien.
  if (messages[messages.length - 1].role !== 'user') return { ok: false, reason: 'messages.last_not_user' }

  let context: RemiChatContext | undefined
  if (rawContext !== undefined && rawContext !== null) {
    const parsed = validateContext(rawContext)
    if (!parsed) return { ok: false, reason: 'context.invalid' }
    context = parsed
  }

  return {
    ok: true,
    value: {
      messages: messages.slice(-MAX_HISTORY_MESSAGES),
      lang,
      visitorId,
      ...(context ? { context } : {}),
      userMessageCount,
    },
  }
}

export type BodyReadResult =
  | { ok: true; json: unknown }
  | { ok: false; reason: 'too_large' | 'invalid_json' | 'unreadable' }

/**
 * Lit le corps en s'arrêtant dès que `maxBytes` est dépassé (l'en-tête `Content-Length` peut mentir
 * ou manquer : on compte les octets réellement reçus), puis le décode en JSON.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<BodyReadResult> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: 'too_large' }
  if (!request.body) return { ok: false, reason: 'invalid_json' }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, reason: 'too_large' }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, reason: 'unreadable' }
  }

  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return { ok: true, json: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  } catch {
    return { ok: false, reason: 'invalid_json' }
  }
}
