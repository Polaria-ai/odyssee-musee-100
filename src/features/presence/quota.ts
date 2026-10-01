/**
 * Reconnaissance d'un quota Supabase Realtime dépassé, pour passer DIRECTEMENT en solo (décision du 01/10 :
 * des salles de 30 joueurs au plus ; si le quota du projet est dépassé, le joueur joue seul, sans erreur visible).
 *
 * Fonctions pures, sans dépendance : `presenceSession.ts` leur donne les textes d'erreur qu'il reçoit.
 *
 * Ce que le SDK émet (vérifié dans node_modules : `@supabase/realtime-js` 2.117.1 et `@supabase/phoenix` 0.4.5) :
 * - Le SDK ne contient AUCUN libellé de quota ni erreur « limite de débit » dédiée : tout vient du serveur.
 * - Jointure refusée par le serveur (`phx_reply` en statut `error`) : `subscribe()` rappelle `CHANNEL_ERROR` avec
 *   `new Error(Object.values(response).join(', '), { cause: response })` (`RealtimeChannel.subscribe`) : le texte du
 *   serveur est donc le `message` de l'Error, la réponse brute est dans `cause`. C'est le chemin de
 *   `too_many_connections` (200 connexions du plan gratuit), `too_many_channels` et `too_many_joins`.
 * - Jointure sans réponse : `TIMED_OUT`, sans Error. Pas un quota reconnaissable.
 * - Fermeture du canal (`phx_close`) : `CLOSED`, SANS Error (`_onClose`). Un `CLOSED` seul ne dit donc rien de sa cause ;
 *   c'est le message `system` qui le précède qui la porte, d'où l'écoute de `channel.on('system', …)` dans
 *   `realtimeClient.ts` (charge utile `RealtimeSystemPayload` : `{ extension, status, message, channel }`).
 * - Coupure de transport (socket refusée ou fermée) : `CHANNEL_ERROR` avec `normalizeChannelError` :
 *   « socket closed: <code> (<raison>) », « channel error: transport failure » ou « channel error: connection lost ».
 *   Un navigateur ne donne ni statut HTTP (403, 429…) ni corps pour une WebSocket refusée : ce chemin n'est pas
 *   reconnaissable comme quota et reste une erreur ordinaire (reconnexions puis solo).
 *
 * Libellés du serveur (supabase/realtime, `lib/realtime_web/channels/realtime_channel.ex`, branche principale, lus en
 * ligne le 01/10/2026 : à jour du dépôt, PAS vérifiés sur la version déployée sur le projet de la soirée) :
 * - `too_many_connections` → « Too many connected users »
 * - `too_many_channels`    → « ChannelRateLimitReached: Too many channels »
 * - `too_many_joins`       → « ClientJoinRateLimitReached: Too many joins per second »
 * - message `system` d'erreur « Too many messages per second » puis fermeture du canal (scénario observé le 30/09)
 * - présence : message `system` « Too many presence messages per second » puis fermeture ; `ClientPresenceRateLimitReached`
 *   (« Client presence rate limit exceeded »).
 * - `DatabaseConnectionRateLimitReached: Too many database connections attempts per second` (canaux privés seulement)
 * Les motifs ci-dessous couvrent ces libellés, leurs variantes en snake_case (`too_many_joins`), les codes d'erreur
 * en CamelCase, un 429 et les formulations génériques « rate limit » / « quota ».
 */

export type QuotaKind =
  | 'too_many_connections'
  | 'too_many_channels'
  | 'too_many_joins'
  | 'too_many_messages'
  | 'presence_limit'
  | 'rate_limit'
  | 'http_429'

/** Passe en minuscules et remplace `_` et `-` par des espaces : `too_many_joins` et « Too many joins » se confondent. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[_-]+/g, ' ')
}

/**
 * Type de quota désigné par ces textes (le premier qui en désigne un), ou `null` : une erreur ordinaire
 * (« socket closed: 1006 », « channel error: transport failure », `TIMED_OUT`, `track error`…) ne l'est jamais.
 */
export function classifyQuota(...texts: ReadonlyArray<unknown>): QuotaKind | null {
  for (const raw of texts) {
    if (typeof raw !== 'string' || raw === '') continue
    const t = normalize(raw)
    if (t.includes('presence') && /too many|rate ?limit|limit/.test(t)) return 'presence_limit'
    if (/too many messages|messages per second/.test(t)) return 'too_many_messages'
    if (/too many joins|joins per second|clientjoinratelimit/.test(t)) return 'too_many_joins'
    if (/too many channels|channelratelimit/.test(t)) return 'too_many_channels'
    if (/database.*(rate ?limit|too many)/.test(t)) return 'rate_limit'
    if (/too many (connected users|connections|concurrent|clients)|connectionratelimit|concurrent (users|connections)/.test(t)) {
      return 'too_many_connections'
    }
    if (/rate ?limit|\bquota\b|limit exceeded|exceeded (the |its )?limit|throttl/.test(t)) return 'rate_limit'
    if (/\b429\b|too many requests/.test(t)) return 'http_429'
  }
  return null
}

/** Textes à examiner dans une erreur du SDK : son message, et ce que porte sa `cause` (réponse brute du serveur). */
export function errorTexts(err: unknown): string[] {
  if (err === null || err === undefined) return []
  if (typeof err === 'string') return [err]
  const out: string[] = []
  const add = (v: unknown) => {
    if (typeof v === 'string' && v !== '') out.push(v)
  }
  if (typeof err === 'object') {
    const e = err as { message?: unknown; reason?: unknown; cause?: unknown }
    add(e.message)
    add(e.reason)
    const cause = e.cause
    if (typeof cause === 'string') add(cause)
    else if (cause && typeof cause === 'object') {
      const c = cause as { message?: unknown; reason?: unknown }
      add(c.message)
      add(c.reason)
    }
  }
  return out
}

/**
 * Charge utile d'un message `system` du serveur (`RealtimeSystemPayload`) : un quota seulement si `status` vaut
 * `error` ET que le message en désigne un (« Subscribed to PostgreSQL » avec `status: 'ok'` ne l'est jamais).
 */
export function quotaFromSystemPayload(payload: unknown): { kind: QuotaKind; message: string } | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as { status?: unknown; message?: unknown; reason?: unknown }
  if (p.status !== 'error') return null
  const message = typeof p.message === 'string' ? p.message : typeof p.reason === 'string' ? p.reason : ''
  const kind = classifyQuota(message)
  return kind ? { kind, message } : null
}
