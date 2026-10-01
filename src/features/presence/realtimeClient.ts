/**
 * Petite façade autour d'un canal Realtime Supabase — juste ce dont la présence a besoin.
 * `presenceSession.ts` ne parle qu'à cette interface : en test, on injecte un faux client qui
 * l'implémente, sans dépendre du SDK ni du réseau.
 *
 * Deux propriétés du SDK (realtime-js 2.117) dictent la forme de cette interface :
 * - `RealtimeClient.channel(topic)` renvoie l'instance EXISTANTE pour un même topic tant qu'elle n'a pas
 *   quitté `client.channels` ; `unsubscribe()` ne résout donc qu'une fois le canal réellement retiré, pour
 *   que le `channel(topic)` suivant ne ressorte jamais une instance périmée (voir `adaptChannel`).
 * - `on('presence')` LÈVE sur un canal déjà rejoint/en cours de jointure : les écouteurs se posent donc
 *   toujours avant `subscribe()`, sur un canal neuf.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '../../data/supabaseClient'

export type ChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'

export interface RealtimeChannelLike {
  onBroadcast(event: string, cb: (payload: unknown) => void): void
  onPresenceSync(cb: () => void): void
  presenceState(): Record<string, unknown[]>
  /**
   * Messages `system` du serveur (`{ extension, status, message, channel }`) : le seul endroit où figure la cause d'une
   * fermeture pour quota (« Too many messages per second »), le `CLOSED` qui suit n'ayant pas d'Error. Optionnel : un
   * faux client de test peut l'ignorer. À poser avant `subscribe()`.
   */
  onSystem?(cb: (payload: unknown) => void): void
  /**
   * `err` : l'Error du SDK quand il en donne une. Jointure refusée par le serveur : CHANNEL_ERROR avec le texte du
   * serveur (« Too many connected users »…) ; jointure sans réponse : TIMED_OUT sans Error ; `phx_close` : CLOSED sans Error.
   */
  subscribe(cb: (status: ChannelStatus, err?: Error) => void): void
  /** Ne doit être appelé que si `isJoined()` : hors canal rejoint, le SDK bascule en POST REST. */
  send(event: string, payload: unknown): void
  /** `'ok'` | `'error'` | `'timed out'` (jamais de rejet). */
  track(payload: unknown): Promise<string>
  /** Annonce explicitement notre départ de la présence (avant `unsubscribe`). Jamais de rejet. */
  untrack(): Promise<string>
  isJoined(): boolean
  /** `sb.removeChannel`, résolu (jamais rejeté) quand le canal a quitté `client.channels`. */
  unsubscribe(): Promise<void>
}

export interface RealtimeClientLike {
  channel(name: string): RealtimeChannelLike
  /**
   * Ferme la WebSocket s'il ne reste aucun canal (solo, onglet caché). Sans cela le SDK la garde ouverte environ
   * 50 s (2 × heartbeat) après le départ du dernier canal. Une jointure ultérieure la rouvre. Jamais de rejet.
   */
  disconnect?(): void
}

/**
 * `sb.removeChannel(ch)` plutôt qu'un simple `ch.unsubscribe()` : c'est le nettoyage recommandé par
 * Supabase — il fait également le `teardown()` du canal (timers internes de rejoin arrêtés), important
 * ici puisqu'un même client peut créer et quitter beaucoup de canaux sur une soirée.
 */
function adaptChannel(sb: SupabaseClient, ch: RealtimeChannel): RealtimeChannelLike {
  return {
    onBroadcast(event, cb) {
      ch.on('broadcast', { event }, ({ payload }) => cb(payload))
    },
    onPresenceSync(cb) {
      ch.on('presence', { event: 'sync' }, cb)
    },
    onSystem(cb) {
      ch.on('system', {}, (payload) => cb(payload))
    },
    presenceState() {
      return ch.presenceState()
    },
    subscribe(cb) {
      ch.subscribe((status, err) => cb(String(status) as ChannelStatus, err))
    },
    send(event, payload) {
      void ch.send({ type: 'broadcast', event, payload }).catch(() => {})
    },
    async track(payload) {
      try {
        return String(await ch.track(payload as Record<string, unknown>))
      } catch {
        return 'error'
      }
    },
    async untrack() {
      try {
        return String(await ch.untrack())
      } catch {
        return 'error'
      }
    },
    isJoined() {
      return ch.state === 'joined'
    },
    async unsubscribe() {
      try {
        await sb.removeChannel(ch)
      } catch {
        // rien à faire : on vérifie plus bas que le canal est bien sorti de la liste.
      }
      // Filet : une réponse d'erreur du serveur au départ laisse parfois le canal dans `client.channels`,
      // et `channel(topic)` le ressortirait alors (instance périmée, jamais rejoignable). On le retire
      // explicitement (API interne du SDK, donc défensif : sans effet si elle change).
      try {
        if (sb.getChannels().includes(ch)) {
          ch.teardown()
          const realtime = sb.realtime as unknown as { _remove?: (c: RealtimeChannel) => void }
          realtime._remove?.(ch)
        }
      } catch {
        // idem : au pire, la prochaine jointure échouera et passera par le recul.
      }
    },
  }
}

export function adaptSupabaseClient(sb: SupabaseClient): RealtimeClientLike {
  return {
    channel(name) {
      return adaptChannel(sb, sb.channel(name, { config: { broadcast: { self: false } } }))
    },
    disconnect() {
      try {
        if (sb.getChannels().length === 0) void sb.realtime.disconnect().catch(() => {})
      } catch {
        // au pire, le SDK ferme lui-même la socket inutile au bout de ~50 s.
      }
    },
  }
}

/** Client par défaut du jeu : `null` si Supabase n'est pas configuré (mode solo silencieux). */
export function defaultRealtimeClient(): RealtimeClientLike | null {
  const sb = getSupabase()
  return sb ? adaptSupabaseClient(sb) : null
}
