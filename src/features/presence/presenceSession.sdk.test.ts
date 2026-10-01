// @vitest-environment node
/**
 * Tests de `presenceSession` contre le VRAI SDK Supabase (supabase-js / realtime-js 2.117.1, phoenix 0.4.5),
 * avec un faux serveur Realtime qui parle le protocole Phoenix vsn 2.0.0 (voir `testing/fakePhoenixServer.ts`).
 *
 * Pourquoi ce fichier existe : `usePresence.test.ts` (FakeClient) renvoyait un canal NEUF à chaque appel, alors que
 * le SDK renvoie l'instance existante pour un même topic, lève sur `on('presence')` d'un canal « joining », rejoint
 * seul un canal « errored », et bascule `send()` en POST REST sur un canal fermé. Les bugs du 30/09 n'étaient
 * visibles que face au vrai SDK ; ces tests le reproduisent, sans réseau.
 *
 * Horloge : fake timers de vitest (le faux serveur livre par micro-tâche, sans timer), config de session accélérée,
 * `random` injecté et déterministe.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_PEER_RECORDS, createPeerStore, getPeer, selectVisiblePeers, type PeerStore } from './peers'
import { DEFAULT_PRESENCE_CONFIG, createPresenceSession, type PresenceConfig, type PresenceSession, type PresenceStats, type PresenceTimers } from './presenceSession'
import { adaptSupabaseClient } from './realtimeClient'
import { roomName } from './roomSelection'
import { MAX_ROOMS, ROOM_CAPACITY } from './roomSelection'
import {
  FakeRealtimeServer,
  SERVER_MESSAGE_TOO_MANY_MESSAGES,
  SERVER_MESSAGE_TOO_MANY_PRESENCE,
  SERVER_REASON_TOO_MANY_CONNECTIONS,
  SERVER_REASON_TOO_MANY_JOINS,
} from './testing/fakePhoenixServer'

// ---------------------------------------------------------------------------------------------
// Banc

const NS = 'sdk'
const topicOf = (index: number) => roomName(index, NS)
const realtimeTopic = (index: number) => `realtime:${topicOf(index)}`

/** Config accélérée : gigues et reculs réduits d'un facteur ~10 ; pas de nouvelle tentative solo. */
const FAST: Partial<PresenceConfig> = {
  initialJoinJitterMs: 100,
  hopDelayMinMs: 10,
  hopDelayMaxMs: 50,
  reconnectMaxAttempts: 3,
  reconnectBaseMs: 100,
  reconnectMaxMs: 400,
  soloRetryMs: 0,
  hiddenLeaveMs: 1000,
  moveSendIntervalMs: 100,
  idleHeartbeatMs: 1000,
}

/** PRNG déterministe (mulberry32) : un par session, pour des gigues reproductibles et différentes. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface CountingTimers {
  timers: PresenceTimers
  /** Minuteurs posés par la session et pas encore échus ni annulés. */
  live: Set<unknown>
}

function countingTimers(): CountingTimers {
  const live = new Set<unknown>()
  const timers: PresenceTimers = {
    setTimeout(fn, ms) {
      const h = globalThis.setTimeout(() => {
        live.delete(h)
        fn()
      }, ms)
      live.add(h)
      return h
    },
    clearTimeout(h) {
      live.delete(h)
      globalThis.clearTimeout(h as ReturnType<typeof setTimeout>)
    },
    setInterval(fn, ms) {
      const h = globalThis.setInterval(fn, ms)
      live.add(h)
      return h
    },
    clearInterval(h) {
      live.delete(h)
      globalThis.clearInterval(h as ReturnType<typeof setInterval>)
    },
  }
  return { timers, live }
}

interface Rig {
  label: string
  visitorId: string
  sb: SupabaseClient
  session: PresenceSession
  store: PeerStore
  player: { x: number; z: number; rotY: number; moving: boolean }
  statsLog: PresenceStats[]
  peerCounts: number[]
  timers: CountingTimers
}

interface RigOptions {
  label?: string
  visitorId?: string
  seed?: number
  config?: Partial<PresenceConfig>
  /** Timeout de jointure du SDK (ms). */
  timeout?: number
  moving?: boolean
  hidden?: boolean
  /** Vrai : configuration de production (`DEFAULT_PRESENCE_CONFIG`) au lieu de la config accélérée `FAST` (bancs de charge). */
  prod?: boolean
  /** Défaut : room-1 (déterministe) ; `undefined` explicite = tirage aléatoire par défaut de la session. */
  pickStartRoom?: (() => number) | null
}

describe('presenceSession contre le vrai SDK Supabase', () => {
  let server: FakeRealtimeServer
  let rigs: Rig[]
  let unhandled: unknown[]
  let warn: { mock: { calls: unknown[][] }; mockRestore(): void }

  const nodeProcess = (globalThis as unknown as { process: { on(e: string, f: (x: unknown) => void): void; off(e: string, f: (x: unknown) => void): void } }).process
  const onUnhandled = (e: unknown) => unhandled.push(e)

  const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)

  /** Fait avancer l'horloge simulée par pas de 25 ms jusqu'à ce que `pred` soit vrai (échoue après `maxMs`). */
  async function until(pred: () => boolean, what: string, maxMs = 60_000, stepMs = 25): Promise<void> {
    let waited = 0
    while (!pred()) {
      if (waited >= maxMs) throw new Error(`délai dépassé (${maxMs} ms simulées) : ${what}`)
      await run(stepMs)
      waited += stepMs
    }
  }

  function makeRig(opts: RigOptions = {}): Rig {
    const index = rigs.length + 1
    const label = opts.label ?? `c${index}`
    const visitorId = opts.visitorId ?? `v${index}`
    const sb = createClient('https://fake-project.supabase.co', 'sb_publishable_FAKE', server.clientOptions({ label, timeout: opts.timeout }))
    const store = createPeerStore()
    const player = { x: 1.5, z: -2, rotY: 0.25, moving: opts.moving ?? true }
    const statsLog: PresenceStats[] = []
    const peerCounts: number[] = []
    const timers = countingTimers()
    const session = createPresenceSession({
      client: adaptSupabaseClient(sb),
      visitorId,
      namespace: NS,
      getPlayer: () => player,
      onPeersCount: (n) => peerCounts.push(n),
      onStats: (s) => statsLog.push(s),
      store,
      now: () => Date.now(),
      random: seeded(opts.seed ?? 1000 + index),
      timers: timers.timers,
      config: { ...(opts.prod ? DEFAULT_PRESENCE_CONFIG : FAST), ...opts.config },
      hidden: opts.hidden,
      pickStartRoom: opts.pickStartRoom === null ? undefined : (opts.pickStartRoom ?? (() => 1)),
    })
    const rig: Rig = { label, visitorId, sb, session, store, player, statsLog, peerCounts, timers }
    rigs.push(rig)
    return rig
  }

  const channelsFor = (rig: Rig, index: number) => rig.sb.getChannels().filter((c) => c.topic === realtimeTopic(index))
  const state = (rig: Rig) => rig.session.stats().state
  const restWarnings = () => warn.mock.calls.filter((c) => String(c[0]).includes('falling back to REST')).length

  beforeEach(() => {
    vi.useFakeTimers()
    server = new FakeRealtimeServer()
    rigs = []
    unhandled = []
    nodeProcess.on('unhandledRejection', onUnhandled)
    nodeProcess.on('uncaughtException', onUnhandled)
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(async () => {
    for (const r of rigs) r.session.stop()
    await run(0)
    // Aucun des tests ne doit avoir laissé une exception non rattrapée dans un timer ou une promesse.
    expect(unhandled, 'exceptions non gérées').toEqual([])
    nodeProcess.off('unhandledRejection', onUnhandled)
    nodeProcess.off('uncaughtException', onUnhandled)
    warn.mockRestore()
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------------------------

  it('(a) join refusé 2 fois puis accepté : subscribed, track reçu, un seul canal pour le topic, aucune exception', async () => {
    server.rejectJoins(topicOf(1), 2, 'db_unavailable') // une erreur ordinaire (« too_many_joins » serait un quota : solo tout de suite)
    const r = makeRig()
    r.session.start()

    await until(() => state(r) === 'subscribed', 'subscribed après deux refus')
    await run(200)

    const stats = r.session.stats()
    expect(stats.room).toBe(1)
    expect(stats.joins).toBe(3) // 2 refusés + 1 accepté
    expect(stats.reconnects).toBe(2)
    expect(stats.errors).toEqual({ db_unavailable: 2 })
    expect(stats.lastError).toBe('db_unavailable')
    expect(stats.soloReason).toBeNull()

    // Le serveur n'a reçu que nos 3 joins : pas de re-jointure automatique de phoenix en plus.
    expect(server.joinCount(topicOf(1))).toBe(3)
    // Et le track attendu, une seule fois.
    expect(server.trackCount(topicOf(1))).toBe(1)
    const tracked = server.trackedPayloads(topicOf(1))
    expect(tracked).toHaveLength(1)
    expect(tracked[0]).toMatchObject({ id: r.visitorId })
    expect(typeof tracked[0].joinTs).toBe('number')
    // Un seul canal pour ce topic dans le client, et il est joint.
    expect(channelsFor(r, 1)).toHaveLength(1)
    expect(channelsFor(r, 1)[0].state).toBe('joined')
    expect(r.sb.getChannels()).toHaveLength(1)
    expect(server.restBroadcasts).toHaveLength(0)
  })

  it('(b) join sans réponse : TIMED_OUT, reprise, subscribed', async () => {
    server.silenceJoins(topicOf(1), 1)
    const r = makeRig({ timeout: 300 })
    r.session.start()

    await until(() => r.session.stats().errors.TIMED_OUT === 1, 'TIMED_OUT après le silence du serveur')
    expect(state(r)).toBe('backoff')
    await until(() => state(r) === 'subscribed', 'subscribed après reprise')
    await run(200)

    const stats = r.session.stats()
    expect(stats.errors).toEqual({ TIMED_OUT: 1 })
    expect(stats.reconnects).toBe(1)
    expect(stats.room).toBe(1)
    expect(server.joinCount(topicOf(1))).toBe(2) // un sans réponse, un accepté
    expect(server.memberCount(topicOf(1))).toBe(1)
    expect(server.trackedPayloads(topicOf(1)).filter((p) => p.id === r.visitorId)).toHaveLength(1)
    expect(channelsFor(r, 1)).toHaveLength(1)
    expect(r.sb.getChannels()).toHaveLength(1)
  })

  it("(c) phx_close du serveur sans cause : closedByServer=1, ZÉRO POST REST, reprise dans la même salle", async () => {
    const r = makeRig()
    r.session.start()
    await until(() => state(r) === 'subscribed', 'subscribed')
    await until(() => server.broadcastCount(topicOf(1)) >= 2, 'quelques envois de position par WebSocket')
    expect(r.session.stats().sent).toBeGreaterThan(0)

    // Le serveur ferme le canal sans en donner la raison (un message système de quota, lui, mène au solo : voir (m) et (n)).
    expect(server.closeChannel(topicOf(1), r.label)).toBe(1)
    const broadcastsAtClose = server.broadcastCount(topicOf(1))
    await run(0)

    expect(r.session.stats().closedByServer).toBe(1)
    expect(state(r)).toBe('backoff')
    expect(channelsFor(r, 1)).toHaveLength(0) // le SDK l'a retiré ; la session n'en garde aucun

    // Pendant tout le recul (100 ms × gigue 0,5–1,5) : aucun envoi, ni WebSocket ni REST.
    await run(40)
    expect(server.broadcastCount(topicOf(1))).toBe(broadcastsAtClose)
    expect(server.restBroadcasts).toHaveLength(0)

    await until(() => state(r) === 'subscribed', 'reprise après phx_close')
    await run(1500) // laisse la boucle d'envoi reprendre
    expect(r.session.stats().room).toBe(1) // la MÊME salle
    expect(server.joinCount(topicOf(1))).toBe(2)
    expect(server.broadcastCount(topicOf(1))).toBeGreaterThan(broadcastsAtClose) // l'envoi reprend, par WebSocket
    expect(server.restBroadcasts).toHaveLength(0)
    expect(server.fetchCalls.filter((c) => c.method === 'POST')).toHaveLength(0)
    expect(restWarnings()).toBe(0)
    expect(channelsFor(r, 1)).toHaveLength(1)
    expect(server.trackedPayloads(topicOf(1)).filter((p) => p.id === r.visitorId)).toHaveLength(1)
  })

  it('(d) coupure WebSocket : reprise, un seul track actif côté serveur pour ce visiteur', async () => {
    const r = makeRig()
    r.session.start()
    await until(() => state(r) === 'subscribed', 'subscribed')
    await run(100)
    expect(server.trackedPayloads().filter((p) => p.id === r.visitorId)).toHaveLength(1)
    expect(server.connectionAttempts(r.label)).toBe(1)

    expect(server.dropSockets(r.label)).toBe(1)
    // Côté serveur, la socket coupée n'a plus aucune présence.
    expect(server.trackedPayloads().filter((p) => p.id === r.visitorId)).toHaveLength(0)
    expect(server.memberCount(topicOf(1))).toBe(0)

    await until(() => r.session.stats().reconnects >= 1 && state(r) === 'subscribed', 'reprise après la coupure')
    await run(3000) // le SDK reconnecte sa socket et phoenix rejoue ses propres minuteurs : rien ne doit doubler

    const tracked = server.trackedPayloads().filter((p) => p.id === r.visitorId)
    expect(tracked).toHaveLength(1)
    expect(server.memberCount(topicOf(1))).toBe(1)
    expect(server.openConnections(r.label)).toHaveLength(1)
    expect(channelsFor(r, 1)).toHaveLength(1)
    expect(r.sb.getChannels()).toHaveLength(1)
    expect(r.session.stats().room).toBe(1)
    // L'Error du SDK est gardée : transport coupé (événement error du navigateur, puis close 1006).
    expect(Object.keys(r.session.stats().errors).some((k) => /^(channel error|socket closed)/.test(k))).toBe(true)
    expect(r.session.stats().lastError).toMatch(/^(channel error|socket closed)/)
    expect(server.restBroadcasts).toHaveLength(0)
    // Jamais deux présences actives pour ce visiteur, à aucun moment : 1 track avant la coupure, 1 après.
    expect(server.trackCount(undefined, r.label)).toBe(2)
  })

  it('(e) refus persistant : solo après reconnectMaxAttempts, plus aucun join ensuite, plus aucun canal', async () => {
    server.rejectJoins(topicOf(1), Infinity, 'db_unavailable')
    const r = makeRig({ config: { reconnectMaxAttempts: 3, soloRetryMs: 0 } })
    r.session.start()

    await until(() => state(r) === 'solo', 'solo après échecs répétés')
    const stats = r.session.stats()
    expect(stats.soloReason).toMatch(/connexion impossible/)
    expect(stats.errors).toEqual({ db_unavailable: 4 })
    expect(stats.joins).toBe(4) // 1 + reconnectMaxAttempts
    expect(stats.reconnects).toBe(3)
    expect(server.joinCount(topicOf(1))).toBe(4)

    const joinsAtSolo = server.joinCount()
    const framesAtSolo = server.frames.length
    await run(120_000) // bien au-delà de tout recul : plus rien ne doit partir
    expect(state(r)).toBe('solo')
    expect(server.joinCount()).toBe(joinsAtSolo)
    expect(server.frames.filter((f) => f.event === 'phx_join')).toHaveLength(4)
    // Hors heartbeat du SDK (qui tourne tant que la socket est ouverte), aucune trame liée au canal.
    expect(server.frames.slice(framesAtSolo).filter((f) => f.event !== 'heartbeat' && f.event !== 'phx_leave')).toEqual([])
    expect(r.sb.getChannels()).toHaveLength(0)
    expect(channelsFor(r, 1)).toHaveLength(0)
    expect(server.memberCount(topicOf(1))).toBe(0)
    expect(r.session.stats().joins).toBe(4)
  })

  it('(f) 12 sessions, capacité 4, 2 salles : 8 placées (4+4), 4 en solo « musée plein », au plus 2 joins chacune', async () => {
    const config: Partial<PresenceConfig> = { roomCapacity: 4, maxRooms: 2, soloRetryMs: 0, initialJoinJitterMs: 400 }
    for (let i = 1; i <= 12; i++) makeRig({ config, seed: 7000 + i * 31 }).session.start()

    await until(() => rigs.every((r) => state(r) === 'subscribed' || state(r) === 'solo'), 'toutes les sessions posées')
    await run(5000) // aucun mouvement ne doit suivre

    const subscribed = rigs.filter((r) => state(r) === 'subscribed')
    const solo = rigs.filter((r) => state(r) === 'solo')
    expect(subscribed).toHaveLength(8)
    expect(solo).toHaveLength(4)
    expect(subscribed.filter((r) => r.session.stats().room === 1)).toHaveLength(4)
    expect(subscribed.filter((r) => r.session.stats().room === 2)).toHaveLength(4)
    expect(server.memberCount(topicOf(1))).toBe(4)
    expect(server.memberCount(topicOf(2))).toBe(4)
    expect(server.memberCount(topicOf(3))).toBe(0)
    for (const r of solo) {
      expect(r.session.stats().soloReason).toBe('musée plein')
      expect(r.session.stats().room).toBeNull()
      expect(r.sb.getChannels()).toHaveLength(0)
    }
    // Saut direct par rang : jamais plus d'un saut, donc 2 jointures au plus — côté session ET côté serveur
    // (qui compte aussi les re-jointures automatiques de phoenix).
    for (const r of rigs) {
      expect(r.session.stats().joins).toBeLessThanOrEqual(2)
      expect(server.joinCount(undefined, r.label)).toBeLessThanOrEqual(2)
      expect(r.session.stats().reconnects).toBe(0)
    }
    expect(server.joinCount()).toBeLessThanOrEqual(24)
    // Une seule présence active par visiteur placé, aucun doublon.
    const ids = server.trackedPayloads().map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(8)
    expect(server.restBroadcasts).toHaveLength(0)
  })

  it('(i) arrivées étalées : le départ dans une salle tirée au hasard réduit fortement le nombre de jointures (P1-c)', async () => {
    const config: Partial<PresenceConfig> = { roomCapacity: 4, maxRooms: 6, soloRetryMs: 0, initialJoinJitterMs: 6000 }
    const joinsFor = async (pick: (() => number) | null): Promise<{ joins: number; placed: number; solo: number }> => {
      for (const r of rigs) r.session.stop()
      rigs = []
      server = new FakeRealtimeServer()
      for (let i = 1; i <= 40; i++) makeRig({ config, seed: 9000 + i * 17, pickStartRoom: pick }).session.start()
      await until(() => rigs.every((r) => state(r) === 'subscribed' || state(r) === 'solo'), 'toutes les sessions posées')
      await run(3000)
      return { joins: server.joinCount(), placed: rigs.filter((r) => state(r) === 'subscribed').length, solo: rigs.filter((r) => state(r) === 'solo').length }
    }

    const fromRoom1 = await joinsFor(() => 1)
    const random = await joinsFor(null)

    // Depuis room-1, chaque arrivée tardive retraverse les salles pleines une à une (rang 4 → floor(4/4) = 1 salle).
    expect(fromRoom1.joins).toBeGreaterThan(100)
    expect(random.joins).toBeLessThan(fromRoom1.joins * 0.65)
    // Les salles ne dépassent jamais leur capacité et chaque session est soit placée, soit en solo.
    expect(random.placed + random.solo).toBe(40)
    for (let i = 1; i <= 6; i++) expect(server.memberCount(topicOf(i))).toBeLessThanOrEqual(4)
    expect(random.placed).toBeGreaterThan(fromRoom1.placed - 8) // sous saturation, l'aléa peut laisser quelques places vides
  })

  it('(j) track qui ne répond jamais "ok" + canal fermé juste après chaque SUBSCRIBED : solo, pas de boucle (le compteur ne se remet pas à zéro)', async () => {
    const r = makeRig({ config: { reconnectMaxAttempts: 3, soloRetryMs: 0 } })
    r.session.start()
    let lastSeenJoins = 0
    await until(() => {
      const st = r.session.stats()
      if (st.state === 'subscribed' && st.joins !== lastSeenJoins) {
        lastSeenJoins = st.joins
        server.closeChannel(topicOf(1), r.label) // le serveur referme le canal aussitôt accepté
      }
      return st.state === 'solo'
    }, 'solo malgré des SUBSCRIBED successifs', 120_000)
    const stats = r.session.stats()
    expect(stats.joins).toBe(4) // 1 + reconnectMaxAttempts, pas une reconnexion de plus
    expect(stats.closedByServer).toBe(4)
    expect(stats.soloReason).toMatch(/connexion impossible/)
    const joinsAtSolo = server.joinCount()
    await run(300_000)
    expect(server.joinCount()).toBe(joinsAtSolo)
  })

  it('(k) solo : la WebSocket est fermée tout de suite (pas 50 s plus tard) et rouverte à la nouvelle tentative', async () => {
    server.rejectJoins(topicOf(1), 4, 'db_unavailable')
    const r = makeRig({ config: { reconnectMaxAttempts: 3, soloRetryMs: 5000, maxRooms: 1 } })
    r.session.start()
    await until(() => state(r) === 'solo', 'solo')
    await run(50) // laisse la fermeture de la socket se propager, bien avant les 2 × heartbeat du SDK
    expect(server.openConnections(r.label)).toHaveLength(0)
    expect(r.sb.getChannels()).toHaveLength(0)
    const attempts = server.connectionAttempts(r.label)

    await until(() => state(r) === 'subscribed', 'nouvelle tentative depuis le solo', 15_000)
    expect(server.connectionAttempts(r.label)).toBeGreaterThan(attempts)
    expect(server.openConnections(r.label)).toHaveLength(1)
    expect(channelsFor(r, 1)).toHaveLength(1)
  })

  it('(l) onglet caché longtemps : la socket se ferme avec le dernier canal, et le retour rejoint la même salle', async () => {
    const r = makeRig({ config: { hiddenLeaveMs: 1000 } })
    r.session.start()
    await until(() => state(r) === 'subscribed', 'subscribed')
    r.session.setHidden(true)
    await until(() => state(r) === 'hidden', 'hidden', 5000)
    await run(50)
    expect(server.openConnections(r.label)).toHaveLength(0)
    expect(server.memberCount(topicOf(1))).toBe(0)
    r.session.setHidden(false)
    await until(() => state(r) === 'subscribed', 'retour au premier plan')
    expect(r.session.stats().room).toBe(1)
    expect(server.memberCount(topicOf(1))).toBe(1)
  })

  it('(g) stop() : le serveur voit untrack et leave, plus aucune présence, aucun minuteur actif', async () => {
    const r = makeRig()
    r.session.start()
    await until(() => state(r) === 'subscribed', 'subscribed')
    await run(300)
    expect(r.timers.live.size).toBeGreaterThan(0) // l'instrumentation voit bien les minuteurs de la session
    expect(server.trackedPayloads().filter((p) => p.id === r.visitorId)).toHaveLength(1)

    r.session.stop()
    await run(0)

    expect(r.session.stats().state).toBe('stopped')
    expect(server.untrackCount(topicOf(1), r.label)).toBe(1)
    expect(server.leaveCount(topicOf(1), r.label)).toBe(1)
    expect(server.memberCount(topicOf(1))).toBe(0)
    expect(server.trackedPayloads()).toEqual([])
    expect(r.sb.getChannels()).toHaveLength(0)
    expect(r.timers.live.size).toBe(0) // aucun minuteur de la session encore armé
    expect(r.peerCounts.at(-1)).toBe(0)

    // Idempotent, et rien ne repart.
    r.session.stop()
    const framesAfterStop = server.frames.length
    await run(60_000)
    expect(server.frames.slice(framesAfterStop).filter((f) => f.event !== 'heartbeat')).toEqual([])
    expect(r.timers.live.size).toBe(0)
    // Le SDK ferme la socket inutile (2 × heartbeat) puis plus rien : aucun minuteur du tout, session ou SDK.
    await run(30_000)
    expect(server.openConnections(r.label)).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(h) deux sessions dans la même salle se voient : positions reçues dans leurs stores respectifs', async () => {
    const a = makeRig({ visitorId: 'alice', label: 'alice' })
    const b = makeRig({ visitorId: 'bob', label: 'bob' })
    a.player.x = 3
    a.player.z = 4
    b.player.x = -5
    b.player.z = 6
    a.session.start()
    b.session.start()

    await until(() => state(a) === 'subscribed' && state(b) === 'subscribed', 'les deux abonnées')
    await until(() => (getPeer(a.store, 'bob')?.buffer.length ?? 0) > 0 && (getPeer(b.store, 'alice')?.buffer.length ?? 0) > 0, 'positions croisées reçues')

    const bobSeenByAlice = getPeer(a.store, 'bob')
    const aliceSeenByBob = getPeer(b.store, 'alice')
    expect(bobSeenByAlice?.present).toBe(true)
    expect(aliceSeenByBob?.present).toBe(true)
    expect(bobSeenByAlice?.buffer.at(-1)).toMatchObject({ x: -5, z: 6, r: 0.25, m: true })
    expect(aliceSeenByBob?.buffer.at(-1)).toMatchObject({ x: 3, z: 4, r: 0.25, m: true })
    // Chacune ne voit que l'autre, jamais elle-même.
    expect([...a.store.peers.keys()]).toEqual(['bob'])
    expect([...b.store.peers.keys()]).toEqual(['alice'])
    expect(selectVisiblePeers(a.store, 0, 0).map((p) => p.id)).toEqual(['bob'])
    expect(selectVisiblePeers(b.store, 0, 0).map((p) => p.id)).toEqual(['alice'])
    expect(a.peerCounts.at(-1)).toBe(1)
    expect(b.peerCounts.at(-1)).toBe(1)
    expect(a.session.stats().received).toBeGreaterThan(0)
    expect(b.session.stats().received).toBeGreaterThan(0)
    expect(server.memberCount(topicOf(1))).toBe(2)
    expect(server.restBroadcasts).toHaveLength(0)

    // Le départ de l'une est vu de l'autre (untrack + leave), sans attendre l'expiration par silence.
    a.session.stop()
    await until(() => !b.store.peers.has('alice'), 'départ d\'alice vu par bob', 5000)
    expect(b.peerCounts.at(-1)).toBe(0)
  })

  // -------------------------------------------------------------------------------------------
  // Quotas : solo immédiat (décision du 01/10), puis bancs de 200 et 260 joueurs

  it.each([
    ['« Too many connected users » (too_many_connections)', SERVER_REASON_TOO_MANY_CONNECTIONS, 'too_many_connections'],
    ['« ClientJoinRateLimitReached… » (too_many_joins)', SERVER_REASON_TOO_MANY_JOINS, 'too_many_joins'],
    ['« ChannelRateLimitReached… » (too_many_channels)', 'ChannelRateLimitReached: Too many channels', 'too_many_channels'],
  ])('(m) jointure refusée pour quota, %s : solo immédiat, WebSocket fermée, aucune jointure avant le délai long', async (_label, reason, kind) => {
    server.rejectJoins(topicOf(1), Infinity, reason)
    const r = makeRig({ prod: true, config: { initialJoinJitterMs: 100 } })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    r.session.start()

    await until(() => state(r) === 'solo', 'solo dès le premier refus', 5000)
    let stats = r.session.stats()
    expect(stats.soloReason).toBe('quota')
    expect(stats.quota).toBe(kind)
    expect(stats.joins).toBe(1) // pas une des 4 reconnexions
    expect(stats.reconnects).toBe(0)
    expect(stats.errors).toEqual({ [reason]: 1 })
    expect(server.joinCount()).toBe(1)
    await run(50) // laisse la fermeture de la socket se propager
    expect(server.openConnections(r.label)).toHaveLength(0)
    expect(r.sb.getChannels()).toHaveLength(0)

    // Le délai long est de 300 s × [0,75 ; 1,25[ : rien avant 225 s, la sonde d'une seule salle avant 375 s.
    await run(220_000)
    expect(server.joinCount()).toBe(1)
    expect(state(r)).toBe('solo')
    await until(() => server.joinCount() === 2, 'sondage unique après le délai long', 160_000, 500)
    expect(server.joinCount()).toBe(2)

    // Refusé de nouveau : retour en solo, avec un nouveau délai long.
    await until(() => state(r) === 'solo' && r.session.stats().soloReason === 'quota', 'solo de nouveau', 5000)
    await run(220_000)
    expect(server.joinCount()).toBe(2)
    expect(r.session.stats().reconnects).toBe(0)
    expect(consoleError).not.toHaveBeenCalled() // aucune erreur visible
    stats = r.session.stats()
    expect(stats.joins).toBe(2)
    consoleError.mockRestore()
  })

  it.each([
    ['« Too many messages per second » puis fermeture', 'too_many_messages', SERVER_MESSAGE_TOO_MANY_MESSAGES, (rig: Rig) => server.rateLimitChannel(topicOf(1), rig.label)],
    ['« Too many presence messages per second » puis fermeture', 'presence_limit', SERVER_MESSAGE_TOO_MANY_PRESENCE, (rig: Rig) => server.presenceLimitChannel(topicOf(1), rig.label)],
  ])('(n) %s, canal abonné en mouvement : solo tout de suite, plus aucun envoi, aucun POST REST, aucune jointure avant le délai long', async (_label, kind, message, inject) => {
    const r = makeRig({ prod: true, moving: true, config: { initialJoinJitterMs: 100 } })
    r.session.start()
    await until(() => state(r) === 'subscribed', 'subscribed')
    await run(3500)
    expect(server.broadcastCount(topicOf(1))).toBeGreaterThanOrEqual(3) // 1 envoi/s en mouvement
    const joinsBefore = server.joinCount()
    expect(joinsBefore).toBe(1)

    expect(inject(r)).toBe(1)
    await run(0)
    const stats = r.session.stats()
    expect(stats.state).toBe('solo')
    expect(stats.soloReason).toBe('quota')
    expect(stats.quota).toBe(kind)
    expect(stats.errors).toEqual({ [message]: 1 })
    expect(stats.reconnects).toBe(0)
    expect(stats.closedByServer).toBe(0) // le message système a précédé le phx_close : la cause est connue, le CLOSED est ignoré
    const broadcastsAtClose = server.broadcastCount(topicOf(1))
    await run(50)
    expect(server.openConnections(r.label)).toHaveLength(0)
    expect(r.sb.getChannels()).toHaveLength(0)
    expect(server.memberCount(topicOf(1))).toBe(0)

    await run(220_000)
    expect(server.joinCount()).toBe(joinsBefore) // aucune des 4 reconnexions, aucune sonde avant 225 s
    expect(server.broadcastCount(topicOf(1))).toBe(broadcastsAtClose)
    expect(server.restBroadcasts).toHaveLength(0)
    expect(restWarnings()).toBe(0)
    await until(() => server.joinCount() === joinsBefore + 1, 'sondage unique', 160_000, 500)
  })

  it('(m bis) un message système d’erreur qui n’est pas un quota ne change rien', async () => {
    const r = makeRig({ prod: true, config: { initialJoinJitterMs: 100 } })
    r.session.start()
    await until(() => state(r) === 'subscribed', 'subscribed')
    server.sendSystem(topicOf(1), { message: 'Unable to subscribe to changes with given parameters' }, r.label)
    await run(5000)
    expect(state(r)).toBe('subscribed')
    expect(r.session.stats().soloReason).toBeNull()
    expect(server.joinCount()).toBe(1)
  })

  it('(q) limite de jointures par seconde (100 sur le plan gratuit) : les refusés jouent seuls sans réessayer, les autres sont placés', async () => {
    server = new FakeRealtimeServer({ maxJoinsPerSecond: 10 })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (let i = 1; i <= 40; i++) makeRig({ prod: true, moving: false, seed: 300 + i * 11, config: { initialJoinJitterMs: 200, quotaSoloRetryMs: 0 } }).session.start()
    await until(() => rigs.every((r) => state(r) === 'subscribed' || state(r) === 'solo'), 'toutes les sessions posées', 20_000)
    await run(5000)

    const placed = rigs.filter((r) => state(r) === 'subscribed')
    const solo = rigs.filter((r) => state(r) === 'solo')
    expect(placed).toHaveLength(10)
    expect(solo).toHaveLength(30)
    for (const r of solo) {
      expect(r.session.stats().soloReason).toBe('quota')
      expect(r.session.stats().quota).toBe('too_many_joins')
      expect(r.session.stats().joins).toBe(1) // un seul essai chacun : pas de tempête de reconnexions
    }
    expect(server.joinCount()).toBe(40)
    expect(server.quotaRefusals.joins).toBe(30)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  /**
   * Arrivée groupée : les joueurs scannent le QR code de fin de soirée sur ~60 s. La gigue d'arrivée de la session
   * (`initialJoinJitterMs`) la simule ; sa valeur de production (2,5 s) n'est que le lissage d'une rafale.
   */
  const ARRIVAL_SPREAD_MS = 60_000

  /** Nombre maximal d'événements dans une fenêtre glissante d'une seconde. */
  function peakPerSecond(times: number[]): number {
    let peak = 0
    for (let i = 0, j = 0; i < times.length; i++) {
      while (times[i] - times[j] >= 1000) j++
      peak = Math.max(peak, i - j + 1)
    }
    return peak
  }

  it('(o) banc : 200 joueurs arrivés sur 60 s, salles de 30 × 8, quotas du plan gratuit simulés — aucune salle au-dessus de 30, une seule salle chacun, 7 salles au plus', async () => {
    server = new FakeRealtimeServer({ maxConnections: 200, maxJoinsPerSecond: 100 })
    const N = 200
    for (let i = 1; i <= N; i++) makeRig({ prod: true, moving: false, seed: 4000 + i * 7, config: { initialJoinJitterMs: ARRIVAL_SPREAD_MS, soloRetryMs: 0, quotaSoloRetryMs: 0 } }).session.start()

    let maxOccupied = 0
    let maxStore = 0
    let duplicateSamples = 0
    const sample = () => {
      let occupied = 0
      for (let i = 1; i <= MAX_ROOMS; i++) if (server.memberCount(topicOf(i)) > 0) occupied++
      maxOccupied = Math.max(maxOccupied, occupied)
      const ids = server.trackedPayloads().map((p) => p.id)
      if (new Set(ids).size !== ids.length) duplicateSamples++
      for (const r of rigs) maxStore = Math.max(maxStore, r.store.peers.size)
    }
    for (let t = 0; t < 100_000; t += 500) {
      await run(500)
      sample()
    }
    await run(20_000) // régime établi : plus aucune jointure
    sample()

    // Tous placés, aucun en solo, aucun quota atteint.
    expect(rigs.filter((r) => state(r) === 'subscribed')).toHaveLength(N)
    expect(rigs.filter((r) => state(r) === 'solo')).toHaveLength(0)
    expect(server.quotaRefusals).toEqual({ connections: 0, joins: 0 })

    // Aucune salle au-dessus de 30 (en régime établi), chacun dans une seule salle, 7 salles au plus.
    const finalCounts = Array.from({ length: MAX_ROOMS }, (_, i) => server.memberCount(topicOf(i + 1)))
    expect(Math.max(...finalCounts)).toBeLessThanOrEqual(ROOM_CAPACITY)
    expect(finalCounts.reduce((a, b) => a + b, 0)).toBe(N)
    expect(finalCounts.filter((n) => n > 0).length).toBeLessThanOrEqual(7)
    expect(maxOccupied).toBeLessThanOrEqual(7)
    expect(duplicateSamples).toBe(0)
    const ids = server.trackedPayloads().map((p) => p.id)
    expect(new Set(ids).size).toBe(N)
    // Pic transitoire : une salle déborde un instant (les derniers arrivés la traversent, puis la quittent), de quelques places.
    const peaks = Array.from({ length: MAX_ROOMS }, (_, i) => server.peakMemberCount(topicOf(i + 1)))
    expect(Math.max(...peaks)).toBeLessThanOrEqual(ROOM_CAPACITY + 12)

    // Trafic de jointures borné, sous le plafond de 100 jointures/s du plan gratuit.
    const joins = server.joinCount()
    expect(joins).toBeLessThanOrEqual(900)
    expect(server.peakJoinsPerSecond()).toBeLessThanOrEqual(100)
    expect(Math.max(...rigs.map((r) => r.session.stats().joins))).toBeLessThanOrEqual(MAX_ROOMS)
    expect(Math.max(...rigs.map((r) => r.session.stats().reconnects))).toBe(0)
    expect(server.peakConnectedUsers()).toBeLessThanOrEqual(200)
    // Registre des pairs borné : une salle de 30, jamais plus de 29 autres (+ quelques retardataires).
    expect(maxStore).toBeLessThanOrEqual(ROOM_CAPACITY + 6)
    expect(maxStore).toBeLessThanOrEqual(MAX_PEER_RECORDS)
    expect(server.restBroadcasts).toHaveLength(0)

    // Arrêt général : plus aucune présence, aucun canal, aucun minuteur de session.
    for (const r of rigs) r.session.stop()
    await run(1000)
    expect(server.trackedPayloads()).toEqual([])
    expect(rigs.every((r) => r.timers.live.size === 0)).toBe(true)
    expect(rigs.every((r) => r.store.peers.size === 0)).toBe(true)

    // Les chiffres mesurés (reproductibles : PRNG et horloge simulés) sont consignés dans le README.
    const presenceFrames = server.frames.filter((f) => f.event === 'presence').map((f) => f.t)
    console.info(
      `[banc 200] jointures=${joins} pic jointures/s=${server.peakJoinsPerSecond()} track=${server.trackCount()} untrack=${server.untrackCount()} ` +
        `pic présence/s=${peakPerSecond(presenceFrames)} pic membres par salle=${peaks.join('/')} salles finales=${finalCounts.join('/')} ` +
        `max jointures par joueur=${Math.max(...rigs.map((r) => r.session.stats().joins))} pic connexions=${server.peakConnectedUsers()}`,
    )
  }, 300_000)

  it('(p) banc : 260 joueurs, serveur refusant au-delà de 200 connexions — les 60 suivants jouent seuls, sans erreur, sans réessayer avant le délai long', async () => {
    server = new FakeRealtimeServer({ maxConnections: 200, maxJoinsPerSecond: 100 })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const N = 260
    for (let i = 1; i <= N; i++) makeRig({ prod: true, moving: false, seed: 8000 + i * 7, config: { initialJoinJitterMs: ARRIVAL_SPREAD_MS } }).session.start()

    for (let t = 0; t < 100_000; t += 500) await run(500)

    const placed = rigs.filter((r) => state(r) === 'subscribed')
    const solo = rigs.filter((r) => state(r) === 'solo')
    expect(placed).toHaveLength(200)
    expect(solo).toHaveLength(60)
    expect(server.peakConnectedUsers()).toBe(200) // jamais au-delà
    expect(server.quotaRefusals.connections).toBe(60)
    for (const r of solo) {
      const stats = r.session.stats()
      expect(stats.soloReason).toBe('quota')
      expect(stats.quota).toBe('too_many_connections')
      expect(stats.joins).toBe(1) // refusé à la première jointure : aucune reconnexion
      expect(stats.reconnects).toBe(0)
      expect(server.openConnections(r.label)).toHaveLength(0) // WebSocket fermée : ils ne pèsent plus sur le serveur
    }
    // Les 200 placés ne sont pas dérangés : tous dans une salle de 30 au plus.
    const finalCounts = Array.from({ length: MAX_ROOMS }, (_, i) => server.memberCount(topicOf(i + 1)))
    expect(Math.max(...finalCounts)).toBeLessThanOrEqual(ROOM_CAPACITY)
    expect(finalCounts.reduce((a, b) => a + b, 0)).toBe(200)
    // Aucune erreur visible : ni console.error, ni repli REST.
    expect(consoleError).not.toHaveBeenCalled()
    expect(server.restBroadcasts).toHaveLength(0)
    expect(restWarnings()).toBe(0)

    // Les 60 en solo ne réessaient pas : le délai long est de 225 à 375 s (la sonde elle-même est vérifiée en (m)).
    const joinsAtSolo = server.joinCount()
    await run(60_000)
    expect(server.joinCount()).toBe(joinsAtSolo)
    for (const r of solo) expect(r.session.stats().joins).toBe(1)
    expect(solo.every((r) => state(r) === 'solo')).toBe(true) // toujours seuls, toujours silencieux
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  }, 300_000)
})
