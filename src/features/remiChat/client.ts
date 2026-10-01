/**
 * Client du chat avec Rémi · IA : poste sur `REMI_CHAT_ENDPOINT` et lit le flux SSE.
 * BOUCHON posé par l'orchestrateur : l'agent `chat-api` le remplace par la vraie implémentation, en
 * gardant cette signature. L'agent `chat-ui` l'importe tel quel et ne le modifie pas.
 */
import type { RemiChatRequest, RemiChatResult, RemiStreamHandlers } from './contract'

export async function streamRemiReply(request: RemiChatRequest, handlers: RemiStreamHandlers): Promise<RemiChatResult> {
  const text = request.lang === 'en' ? 'Hello, I am Rémi.' : 'Bonjour, je suis Rémi.'
  handlers.onDelta(text)
  return { ok: true, text }
}
