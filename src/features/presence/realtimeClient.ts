/**
 * Petite façade autour d'un canal Realtime Supabase — juste ce dont la présence a besoin.
 * `usePresence` ne parle qu'à cette interface : en test, on injecte un faux client qui
 * l'implémente, sans dépendre du SDK ni du réseau.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '../../data/supabaseClient'

export type ChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'

export interface RealtimeChannelLike {
  onBroadcast(event: string, cb: (payload: unknown) => void): void
  onPresenceSync(cb: () => void): void
  presenceState(): Record<string, unknown[]>
  subscribe(cb: (status: ChannelStatus) => void): void
  send(event: string, payload: unknown): void
  track(payload: unknown): void
  /** Annonce explicitement notre départ de la présence (avant `unsubscribe`), ex. onglet caché longtemps. */
  untrack(): void
  unsubscribe(): void
}

export interface RealtimeClientLike {
  channel(name: string): RealtimeChannelLike
}

/**
 * `sb.removeChannel(ch)` plutôt qu'un simple `ch.unsubscribe()` : c'est le nettoyage recommandé par
 * Supabase (voir la JSDoc de `SupabaseClient.removeChannel` dans le SDK) — il fait également le
 * `teardown()` du canal (timers internes de rejoin arrêtés), important ici puisqu'un même client
 * peut créer et quitter beaucoup de canaux sur une soirée (changements de salle, reconnexions).
 */
function adaptChannel(sb: SupabaseClient, ch: RealtimeChannel): RealtimeChannelLike {
  return {
    onBroadcast(event, cb) {
      ch.on('broadcast', { event }, ({ payload }) => cb(payload))
    },
    onPresenceSync(cb) {
      ch.on('presence', { event: 'sync' }, cb)
    },
    presenceState() {
      return ch.presenceState()
    },
    subscribe(cb) {
      ch.subscribe((status) => cb(String(status) as ChannelStatus))
    },
    send(event, payload) {
      void ch.send({ type: 'broadcast', event, payload }).catch(() => {})
    },
    track(payload) {
      void ch.track(payload as Record<string, unknown>).catch(() => {})
    },
    untrack() {
      void ch.untrack().catch(() => {})
    },
    unsubscribe() {
      void sb.removeChannel(ch).catch(() => {})
    },
  }
}

export function adaptSupabaseClient(sb: SupabaseClient): RealtimeClientLike {
  return {
    channel(name) {
      return adaptChannel(sb, sb.channel(name, { config: { broadcast: { self: false } } }))
    },
  }
}

/** Client par défaut du jeu : `null` si Supabase n'est pas configuré (mode solo silencieux). */
export function defaultRealtimeClient(): RealtimeClientLike | null {
  const sb = getSupabase()
  return sb ? adaptSupabaseClient(sb) : null
}
