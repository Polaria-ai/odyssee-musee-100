// @vitest-environment node
/**
 * Tests unitaires de la machine d'état de présence, sans React, sans réseau, sans `window` : faux client
 * FIDÈLE au SDK (même instance par topic tant qu'elle n'a pas été retirée, écouteurs qui lèvent après
 * `subscribe`, `unsubscribe` asynchrone) et horloge virtuelle qui sait aussi compter les minuteurs vivants.
 */
import { describe, expect, it } from 'vitest'
import { createPeerStore, type PeerStore } from './peers'
import {
  DEFAULT_PRESENCE_CONFIG,
  EFFECTIVE_PEER_TIMEOUT_MS,
  createPresenceSession,
  type PresenceSessionOptions,
  type PresenceStats,
  type PresenceTimers,
} from './presenceSession'
import { POSITION_EVENT } from './protocol'
import type { ChannelStatus, RealtimeChannelLike, RealtimeClientLike } from './realtimeClient'

// ---------------------------------------------------------------------------------------------
// Outils de test

/** Capacité d'une salle et nombre de salles par défaut (décision du 01/10 : 30 × 8). Les tests suivent la config. */
const CAP = DEFAULT_PRESENCE_CONFIG.roomCapacity
const ROOMS = DEFAULT_PRESENCE_CONFIG.maxRooms

async function flush(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

class Clock implements PresenceTimers {
  t = 0
  private seq = 0
  private items = new Map<number, { at: number; fn: () => void; every?: number }>()
  now = () => this.t
  get live(): number {
    return this.items.size
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq
    this.items.set(id, { at: this.t + ms, fn })
    return id
  }
  clearTimeout(h: unknown): void {
    this.items.delete(h as number)
  }
  setInterval(fn: () => void, ms: number): unknown {
    const id = ++this.seq
    this.items.set(id, { at: this.t + ms, fn, every: ms })
    return id
  }
  clearInterval(h: unknown): void {
    this.items.delete(h as number)
  }
  async advance(ms: number): Promise<void> {
    const end = this.t + ms
    for (;;) {
      let next: [number, { at: number; fn: () => void; every?: number }] | null = null
      for (const entry of this.items) {
        if (entry[1].at <= end && (!next || entry[1].at < next[1].at || (entry[1].at === next[1].at && entry[0] < next[0]))) next = entry
      }
      if (!next) break
      const [id, item] = next
      this.t = item.at
      if (item.every) item.at += item.every
      else this.items.delete(id)
      item.fn()
      await flush()
    }
    this.t = end
    await flush()
  }
}

class FakeChannel implements RealtimeChannelLike {
  state: Record<string, unknown[]> = {}
  statusCb: ((status: ChannelStatus, err?: Error) => void) | null = null
  syncCb: (() => void) | null = null
  systemCb: ((payload: unknown) => void) | null = null
  broadcastCbs = new Map<string, (payload: unknown) => void>()
  sendCalls: Array<{ event: string; payload: unknown }> = []
  /** Envois faits alors que le canal n'était pas rejoint : le SDK les transformerait en POST REST. */
  restFallbacks = 0
  trackCalls: Array<Record<string, unknown>> = []
  trackResults: string[] = []
  untrackCalls = 0
  unsubscribed = false
  joined = false
  private subscribeCalled = false

  constructor(
    public name: string,
    private client: FakeClient,
  ) {}

  onBroadcast(event: string, cb: (payload: unknown) => void) {
    if (this.subscribeCalled) throw new Error(`cannot add \`broadcast\` callbacks for ${this.name} after \`subscribe()\`.`)
    this.broadcastCbs.set(event, cb)
  }
  onPresenceSync(cb: () => void) {
    if (this.subscribeCalled) throw new Error(`cannot add \`presence\` callbacks for ${this.name} after \`subscribe()\`.`)
    this.syncCb = cb
  }
  onSystem(cb: (payload: unknown) => void) {
    if (this.subscribeCalled) throw new Error(`cannot add \`system\` callbacks for ${this.name} after \`subscribe()\`.`)
    this.systemCb = cb
  }
  presenceState() {
    return this.state
  }
  subscribe(cb: (status: ChannelStatus, err?: Error) => void) {
    if (this.subscribeCalled) return // comme le SDK : subscribe() sur un canal non fermé ne fait rien.
    this.subscribeCalled = true
    this.statusCb = cb
  }
  send(event: string, payload: unknown) {
    if (!this.joined) this.restFallbacks += 1
    this.sendCalls.push({ event, payload })
  }
  track(payload: unknown) {
    this.trackCalls.push(payload as Record<string, unknown>)
    return Promise.resolve(this.trackResults.shift() ?? 'ok')
  }
  untrack() {
    this.untrackCalls += 1
    return Promise.resolve('ok')
  }
  isJoined() {
    return this.joined
  }
  async unsubscribe() {
    this.unsubscribed = true
    this.joined = false
    if (this.client.gate) await this.client.gate
    await Promise.resolve()
    this.client.remove(this)
  }

  accept() {
    this.joined = true
    this.statusCb?.('SUBSCRIBED')
  }
  fail(status: Exclude<ChannelStatus, 'SUBSCRIBED'>, err?: Error) {
    this.joined = false
    this.statusCb?.(status, err)
  }
  emitSync(state: Record<string, unknown[]>) {
    this.state = state
    this.syncCb?.()
  }
  emitBroadcast(event: string, payload: unknown) {
    this.broadcastCbs.get(event)?.(payload)
  }
  emitSystem(payload: unknown) {
    this.systemCb?.(payload)
  }
}

class FakeClient implements RealtimeClientLike {
  live = new Map<string, FakeChannel>()
  created: FakeChannel[] = []
  /** Si posée, `unsubscribe()` ne se résout qu'à sa résolution. */
  gate: Promise<void> | null = null
  /** Appels à `disconnect()` (fermeture de la WebSocket quand plus aucun canal). */
  disconnects = 0
  disconnect() {
    this.disconnects += 1
  }
  channel(name: string): RealtimeChannelLike {
    const existing = this.live.get(name)
    if (existing) return existing
    const ch = new FakeChannel(name, this)
    this.live.set(name, ch)
    this.created.push(ch)
    return ch
  }
  remove(ch: FakeChannel) {
    if (this.live.get(ch.name) === ch) this.live.delete(ch.name)
  }
}

function setup(over: Partial<PresenceSessionOptions> = {}) {
  const clock = new Clock()
  const client = new FakeClient()
  const store: PeerStore = createPeerStore()
  const rng = { v: 0.5 }
  const player = { x: 1, z: 2, rotY: 0.5, moving: false }
  const stats: PresenceStats[] = []
  const counts: number[] = []
  const logs: string[] = []
  const session = createPresenceSession({
    client,
    visitorId: 'me',
    getPlayer: () => player,
    onPeersCount: (n) => counts.push(n),
    onStats: (s) => stats.push(s),
    store,
    now: clock.now,
    random: () => rng.v,
    timers: clock,
    log: (m) => logs.push(m),
    pickStartRoom: () => 1, // déterministe ; le tirage aléatoire par défaut a son propre describe
    ...over,
  })
  return { clock, client, store, rng, player, stats, counts, logs, session }
}

type Ctx = ReturnType<typeof setup>

/** Démarre et laisse passer la gigue d'arrivée (random 0,5 → 1 250 ms) : room-1 est créée, pas encore abonnée. */
async function boot(ctx: Ctx): Promise<FakeChannel> {
  ctx.session.start()
  await ctx.clock.advance(1250)
  return ctx.client.created[0]
}

async function bootSubscribed(ctx: Ctx): Promise<FakeChannel> {
  const ch = await boot(ctx)
  ch.accept()
  await flush()
  return ch
}

function entry(id: string, joinTs: number) {
  return { id, joinTs }
}

/** `n` autres visiteurs arrivés avant nous (joinTs croissant, tous < à l'horloge). */
function others(n: number, prefix = 'p'): Record<string, unknown[]> {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i}`, [entry(`${prefix}${i}`, -1000 + i)]]))
}

// ---------------------------------------------------------------------------------------------

describe('configuration par défaut', () => {
  it('reprend les valeurs du contrat', () => {
    expect(DEFAULT_PRESENCE_CONFIG).toEqual({
      roomCapacity: 30,
      maxRooms: 8,
      moveSendIntervalMs: 1000,
      idleHeartbeatMs: 10000,
      initialJoinJitterMs: 2500,
      hopDelayMinMs: 150,
      hopDelayMaxMs: 600,
      reconnectMaxAttempts: 4,
      reconnectBaseMs: 1000,
      reconnectMaxMs: 15000,
      soloRetryMs: 180000,
      quotaSoloRetryMs: 300000,
      hiddenLeaveMs: 30000,
      peerTimeoutMs: EFFECTIVE_PEER_TIMEOUT_MS,
    })
    expect(CAP * ROOMS).toBe(240) // 240 places pour ~200 joueurs
    expect(EFFECTIVE_PEER_TIMEOUT_MS).toBe(16000)
  })
})

describe('1. arrivée : gigue initiale', () => {
  it('attend une gigue uniforme [0, initialJoinJitterMs[ en état waiting, puis rejoint room-1', async () => {
    const ctx = setup()
    ctx.rng.v = 0.4 // 0,4 × 2 500 = 1 000 ms
    ctx.session.start()
    expect(ctx.session.stats().state).toBe('waiting')
    await ctx.clock.advance(999)
    expect(ctx.client.created).toHaveLength(0)
    await ctx.clock.advance(1)
    expect(ctx.client.created.map((c) => c.name)).toEqual(['musee:v1:room-1'])
    expect(ctx.session.stats().state).toBe('joining')
    expect(ctx.session.stats().room).toBe(1)
  })

  it('une gigue de 0 rejoint tout de suite (au premier passage de l’horloge)', async () => {
    const ctx = setup()
    ctx.rng.v = 0
    ctx.session.start()
    await ctx.clock.advance(0)
    expect(ctx.client.created).toHaveLength(1)
  })

  it('utilise l’espace de noms de test pour nommer les salles', async () => {
    const ctx = setup({ namespace: 'e2e-ab' })
    const ch = await boot(ctx)
    expect(ch.name).toBe('musee:v1:e2e-ab:room-1')
  })

  it('démarré sur un onglet caché : ne rejoint rien ; au retour, rejoint avec la gigue de saut (pas l’initiale)', async () => {
    const ctx = setup({ hidden: true })
    ctx.session.start()
    expect(ctx.session.stats().state).toBe('hidden')
    await ctx.clock.advance(60_000)
    expect(ctx.client.created).toHaveLength(0) // aucun fantôme

    ctx.rng.v = 0 // gigue de saut = 150 ms (l'initiale aurait été 0, donc on distingue les deux)
    ctx.session.setHidden(false)
    expect(ctx.session.stats().state).toBe('waiting')
    await ctx.clock.advance(149)
    expect(ctx.client.created).toHaveLength(0)
    await ctx.clock.advance(1)
    expect(ctx.client.created).toHaveLength(1)
    expect(ctx.client.created[0].name).toBe('musee:v1:room-1')
  })
})

describe('1 bis. salle d’entrée : tirage aléatoire dans 1..maxRooms (P1-c)', () => {
  it('par défaut, l’arrivée se répartit sur toutes les salles au lieu de tout passer par room-1', async () => {
    const seen = new Set<string>()
    for (const v of [0, 0.3, 0.5, 0.75, 0.999]) {
      const ctx = setup({ pickStartRoom: undefined })
      ctx.rng.v = v
      ctx.session.start()
      await ctx.clock.advance(2500)
      seen.add(ctx.client.created[0].name)
      ctx.session.stop()
    }
    // 1 + floor(v × 8) : 0 → 1, 0,3 → 3, 0,5 → 5, 0,75 → 7, 0,999 → 8.
    expect([...seen].sort()).toEqual(['musee:v1:room-1', 'musee:v1:room-3', 'musee:v1:room-5', 'musee:v1:room-7', 'musee:v1:room-8'].sort())
  })

  it('respecte maxRooms (jamais au-delà) et le défaut reste dans 1..8', async () => {
    const ctx = setup({ pickStartRoom: undefined, config: { maxRooms: 3 } })
    ctx.rng.v = 0.999
    ctx.session.start()
    await ctx.clock.advance(2500)
    expect(ctx.client.created[0].name).toBe('musee:v1:room-3')
  })

  it('un pickStartRoom hors bornes ou illisible est ramené dans 1..maxRooms', async () => {
    const a = setup({ pickStartRoom: () => 99, config: { maxRooms: 4 } })
    a.session.start()
    await a.clock.advance(2500)
    expect(a.client.created[0].name).toBe('musee:v1:room-4')
    const b = setup({ pickStartRoom: () => Number.NaN })
    b.session.start()
    await b.clock.advance(2500)
    expect(b.client.created[0].name).toBe('musee:v1:room-1')
  })

  it('depuis une salle de départ tirée au hasard, le saut par rang reste vers l’avant et borné par maxRooms', async () => {
    const ctx = setup({ pickStartRoom: () => ROOMS - 2 })
    const ch = await boot(ctx)
    ch.accept()
    await flush()
    ch.emitSync(others(2 * CAP)) // 6 + floor(60 / 30) = 8
    await ctx.clock.advance(600)
    expect(ctx.client.created.map((c) => c.name)).toEqual(['musee:v1:room-6', 'musee:v1:room-8'])
    const ch2 = ctx.client.created[1]
    ch2.accept()
    await flush()
    ch2.emitSync(others(CAP)) // 8 + 1 > 8 : musée plein
    await ctx.clock.advance(600)
    expect(ctx.session.stats().state).toBe('solo')
    expect(ctx.session.stats().soloReason).toBe('musée plein')
  })
})

describe('2. retrait de l’ancien canal avant d’en recréer un (P0-a)', () => {
  it('un join refusé puis accepté finit SUBSCRIBED, avec un seul canal vivant, sans exception', async () => {
    const ctx = setup()
    const ch1 = await boot(ctx)
    ch1.fail('CHANNEL_ERROR', new Error('join refused: server busy'))
    await flush()
    expect(ctx.session.stats().state).toBe('backoff')
    expect(ch1.unsubscribed).toBe(true) // le canal jamais abonné est retiré quand même
    expect(ctx.client.live.size).toBe(0)

    await ctx.clock.advance(1000) // reconnectBaseMs × gigue 1,0 (random 0,5)
    expect(ctx.client.created).toHaveLength(2)
    const ch2 = ctx.client.created[1]
    expect(ch2).not.toBe(ch1) // jamais l'instance périmée
    expect(ch2.name).toBe('musee:v1:room-1') // la MÊME salle
    ch2.accept()
    await flush()

    expect(ctx.session.stats().state).toBe('subscribed')
    expect(ctx.client.live.size).toBe(1)
    expect(ch2.trackCalls).toHaveLength(1)
    expect(ctx.session.stats().errors).toEqual({ 'join refused: server busy': 1 })
    expect(ctx.session.stats().lastError).toBe('join refused: server busy')
    expect(ctx.session.stats().reconnects).toBe(1)
  })

  it('attend la résolution de unsubscribe() avant de recréer le canal', async () => {
    const ctx = setup()
    let release!: () => void
    ctx.client.gate = new Promise<void>((r) => (release = r))
    const ch1 = await boot(ctx)
    ch1.fail('TIMED_OUT')
    await ctx.clock.advance(1000) // le recul est écoulé mais l'ancien canal n'a pas fini de partir
    expect(ctx.client.created).toHaveLength(1)
    expect(ctx.client.live.get('musee:v1:room-1')).toBe(ch1)

    release()
    await flush()
    expect(ctx.client.created).toHaveLength(2)
    expect(ctx.client.live.size).toBe(1)
  })

  it('un unsubscribe qui ne répond jamais ne bloque pas la session (garde-fou)', async () => {
    const ctx = setup()
    const ch1 = await boot(ctx)
    ch1.unsubscribe = () => {
      ch1.unsubscribed = true
      ctx.client.remove(ch1)
      return new Promise<void>(() => {}) // ne se résout jamais
    }
    ch1.fail('CHANNEL_ERROR')
    await ctx.clock.advance(1000)
    expect(ctx.client.created).toHaveLength(1)
    await ctx.clock.advance(15_000)
    expect(ctx.client.created.length).toBeGreaterThan(1)
    expect(ctx.session.stats().errors['unsubscribe timeout']).toBe(1)
  })

  it('ignore les rappels d’un canal abandonné (génération)', async () => {
    const ctx = setup()
    const ch1 = await boot(ctx)
    ch1.fail('CHANNEL_ERROR')
    await flush()
    ch1.accept() // réponse tardive de l'ancien canal
    ch1.emitBroadcast(POSITION_EVENT, { i: 'p1', x: 1, z: 1, r: 0, m: 0 })
    await flush()
    expect(ch1.trackCalls).toHaveLength(0)
    expect(ctx.session.stats().state).toBe('backoff')
    expect(ctx.store.peers.size).toBe(0)
  })

  it('aucune exception ne remonte : client.channel() qui lève, unsubscribe() qui rejette', async () => {
    const ctx = setup()
    const ch1 = await boot(ctx)
    ch1.unsubscribe = () => {
      ctx.client.remove(ch1)
      return Promise.reject(new Error('boom'))
    }
    ch1.fail('CHANNEL_ERROR')
    await flush()
    const realChannel = ctx.client.channel.bind(ctx.client)
    let first = true
    ctx.client.channel = (name: string) => {
      if (first) {
        first = false
        throw new Error('client cassé')
      }
      return realChannel(name)
    }
    await ctx.clock.advance(1000)
    expect(ctx.session.stats().state).toBe('backoff') // la création a levé : recul, pas d'exception
    expect(ctx.session.stats().errors['client cassé']).toBe(1)
    await ctx.clock.advance(2000)
    expect(ctx.client.created).toHaveLength(2)
  })
})

describe('3. erreurs de canal : recul, même salle, solo', () => {
  it('délai = min(base × 2^(n-1), max) × gigue [0,5 ; 1,5[, puis solo après reconnectMaxAttempts reconnexions', async () => {
    const ctx = setup({ config: { soloRetryMs: 0 } })
    ctx.rng.v = 0.5 // initial 1 250 ; gigue de recul × 1,0
    await boot(ctx)
    const delays = [1000, 2000, 4000, 8000]
    for (const d of delays) {
      const ch = ctx.client.created[ctx.client.created.length - 1]
      ch.fail('CHANNEL_ERROR', new Error('x'))
      await ctx.clock.advance(d - 1)
      const before = ctx.client.created.length
      expect(ctx.client.created).toHaveLength(before)
      await ctx.clock.advance(1)
      expect(ctx.client.created).toHaveLength(before + 1)
    }
    expect(ctx.client.created).toHaveLength(5) // 1 initiale + 4 reconnexions
    ctx.client.created[4].fail('TIMED_OUT')
    await flush()
    expect(ctx.session.stats().state).toBe('solo')
    expect(ctx.session.stats().soloReason).toContain('connexion impossible')
    expect(ctx.logs).toHaveLength(1)
    await ctx.clock.advance(3_600_000)
    expect(ctx.client.created).toHaveLength(5) // soloRetryMs = 0 : on reste solo
  })

  it('applique la gigue du délai de recul (×0,5 à ×1,5) et le plafond reconnectMaxMs', async () => {
    const ctx = setup({ config: { reconnectBaseMs: 10_000, reconnectMaxMs: 12_000 } })
    const ch1 = await boot(ctx)
    ctx.rng.v = 0 // × 0,5
    ch1.fail('CHANNEL_ERROR')
    await ctx.clock.advance(4999)
    expect(ctx.client.created).toHaveLength(1)
    await ctx.clock.advance(1)
    expect(ctx.client.created).toHaveLength(2)

    ctx.rng.v = 0.999 // × ~1,5, sur un délai plafonné : min(20 000, 12 000) × 1,499
    ctx.client.created[1].fail('CHANNEL_ERROR')
    await ctx.clock.advance(17_000)
    expect(ctx.client.created).toHaveLength(2)
    await ctx.clock.advance(1_000)
    expect(ctx.client.created).toHaveLength(3)
  })

  it('un SUBSCRIBED seul ne remet PAS le compteur à zéro : il faut un track accepté puis 30 s sans échec', async () => {
    const ctx = setup()
    const ch1 = await boot(ctx)
    ch1.fail('CHANNEL_ERROR')
    await ctx.clock.advance(1000)
    ctx.client.created[1].fail('CHANNEL_ERROR')
    await ctx.clock.advance(2000) // second échec : 2 s
    ctx.client.created[2].accept()
    await flush() // track accepté, mais le canal tombe aussitôt
    await ctx.clock.advance(29_999)
    ctx.client.created[2].fail('CHANNEL_ERROR')
    await ctx.clock.advance(3999) // 3e échec consécutif : 4 s, pas 1 s
    expect(ctx.client.created).toHaveLength(3)
    await ctx.clock.advance(1)
    expect(ctx.client.created).toHaveLength(4)
  })

  it('un canal resté sain 30 s après un track accepté remet le compteur à zéro', async () => {
    const ctx = setup()
    const ch1 = await boot(ctx)
    ch1.fail('CHANNEL_ERROR')
    await ctx.clock.advance(1000)
    ctx.client.created[1].fail('CHANNEL_ERROR')
    await ctx.clock.advance(2000)
    ctx.client.created[2].accept()
    await flush()
    await ctx.clock.advance(30_000) // stable
    ctx.client.created[2].fail('CHANNEL_ERROR')
    await ctx.clock.advance(999)
    expect(ctx.client.created).toHaveLength(3)
    await ctx.clock.advance(1) // de nouveau 1 s
    expect(ctx.client.created).toHaveLength(4)
  })

  it('track refusé en permanence : pas de boucle sans fin, passage en solo après reconnectMaxAttempts', async () => {
    const ctx = setup({ config: { soloRetryMs: 0 } })
    await boot(ctx)
    for (let cycle = 0; cycle < 12 && ctx.session.stats().state !== 'solo'; cycle++) {
      const ch = ctx.client.created[ctx.client.created.length - 1]
      ch.trackResults = ['error', 'error']
      ch.accept() // le serveur accepte le join…
      await flush()
      await ctx.clock.advance(1500) // …puis refuse track deux fois (nouvel essai à 1–2 s)
      await ctx.clock.advance(20_000) // recul
    }
    expect(ctx.session.stats().state).toBe('solo')
    expect(ctx.session.stats().soloReason).toContain('track')
    expect(ctx.client.created).toHaveLength(5) // 1 + 4 reconnexions, puis plus rien
    await ctx.clock.advance(3_600_000)
    expect(ctx.client.created).toHaveLength(5)
  })

  it('canal refermé par le serveur juste après chaque SUBSCRIBED : solo, pas de reconnexion à l’infini', async () => {
    const ctx = setup({ config: { soloRetryMs: 0 } })
    await boot(ctx)
    for (let cycle = 0; cycle < 12 && ctx.session.stats().state !== 'solo'; cycle++) {
      const ch = ctx.client.created[ctx.client.created.length - 1]
      ch.accept()
      await flush() // track accepté
      await ctx.clock.advance(100)
      ch.fail('CLOSED', new Error('channel closed by server'))
      await ctx.clock.advance(20_000)
    }
    expect(ctx.session.stats().state).toBe('solo')
    expect(ctx.session.stats().closedByServer).toBe(5)
    expect(ctx.client.created).toHaveLength(5)
  })

  it('un saut de salle après un track accepté remet le compteur à zéro (le canal a fonctionné)', async () => {
    const ctx = setup()
    const ch1 = await boot(ctx)
    ch1.fail('CHANNEL_ERROR')
    await ctx.clock.advance(1000)
    const ch2 = ctx.client.created[1]
    ch2.accept()
    await flush()
    ch2.emitSync(others(CAP))
    await ctx.clock.advance(375) // saut vers room-2
    const ch3 = ctx.client.created[2]
    expect(ch3.name).toBe('musee:v1:room-2')
    ch3.fail('CHANNEL_ERROR')
    await ctx.clock.advance(999)
    expect(ctx.client.created).toHaveLength(3)
    await ctx.clock.advance(1) // 1 s (compteur remis à zéro au saut), pas 2 s
    expect(ctx.client.created).toHaveLength(4)
  })

  it('CLOSED non demandé : compté, boucle d’envoi coupée, même chemin que l’erreur', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ctx.player.moving = true
    await ctx.clock.advance(1000)
    const sentBefore = ch.sendCalls.length
    expect(sentBefore).toBeGreaterThan(0)

    ch.fail('CLOSED', new Error('channel closed by server'))
    await flush()
    const stats = ctx.session.stats()
    expect(stats.closedByServer).toBe(1)
    expect(stats.state).toBe('backoff')
    expect(stats.errors['channel closed by server']).toBe(1)

    await ctx.clock.advance(900) // avant la relance : plus aucun envoi
    expect(ch.sendCalls).toHaveLength(sentBefore)
    expect(ch.restFallbacks).toBe(0)

    await ctx.clock.advance(100)
    expect(ctx.client.created).toHaveLength(2)
    expect(ctx.client.created[1].name).toBe('musee:v1:room-1')
  })

  it('notre propre départ ne compte jamais comme un CLOSED du serveur', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ctx.session.stop()
    ch.fail('CLOSED') // le SDK notifie CLOSED après notre unsubscribe
    await flush()
    expect(ctx.session.stats().closedByServer).toBe(0)
  })
})

describe('4. boucle d’envoi', () => {
  it('en mouvement : 1 envoi/s, uniquement sur un canal abonné et rejoint', async () => {
    const ctx = setup()
    const ch = await boot(ctx)
    ctx.player.moving = true
    await ctx.clock.advance(1000) // pas encore SUBSCRIBED : rien n'est envoyé
    expect(ch.sendCalls).toHaveLength(0)

    ch.accept()
    await ctx.clock.advance(3000)
    // premier envoi au premier tick (100 ms), puis toutes les 1 000 ms : 100, 1100, 2100.
    expect(ch.sendCalls).toHaveLength(3)
    expect(ch.sendCalls.every((c) => c.event === POSITION_EVENT)).toBe(true)
    expect(ctx.session.stats().sent).toBe(3)
  })

  it('jamais plus de 1 envoi/s en mouvement par défaut, et un battement toutes les 10 s à l’arrêt', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ctx.player.moving = true
    await ctx.clock.advance(60_000)
    expect(ch.sendCalls.length).toBeLessThanOrEqual(61) // 1 par seconde, plus le premier
    expect(ch.sendCalls.length).toBeGreaterThanOrEqual(55)
    ctx.player.moving = false
    await ctx.clock.advance(100) // position d'arrêt, tout de suite
    ch.sendCalls = []
    await ctx.clock.advance(60_000)
    expect(ch.sendCalls).toHaveLength(6) // un battement toutes les 10 s
  })

  it('jamais de repli REST : pas d’envoi tant que isJoined() est faux', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ctx.player.moving = true
    ch.joined = false
    await ctx.clock.advance(3000)
    expect(ch.sendCalls).toHaveLength(0)
    expect(ch.restFallbacks).toBe(0)
  })

  it('respecte moveSendIntervalMs et idleHeartbeatMs de la configuration', async () => {
    const ctx = setup({ config: { moveSendIntervalMs: 250, idleHeartbeatMs: 3000 } })
    const ch = await bootSubscribed(ctx)
    ctx.player.moving = true
    await ctx.clock.advance(1000)
    expect(ch.sendCalls).toHaveLength(4) // ticks de 100 ms : envois à 100, 400, 700, 1000
    ctx.player.moving = false
    await ctx.clock.advance(100) // envoi d'arrêt immédiat
    ch.sendCalls = []
    await ctx.clock.advance(2000)
    expect(ch.sendCalls).toHaveLength(0)
    await ctx.clock.advance(1500) // battement de 3 s
    expect(ch.sendCalls).toHaveLength(1)
  })

  it('un envoi qui lève est traité comme une erreur de canal (et la boucle s’arrête)', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.send = () => {
      throw new Error('socket mort')
    }
    await ctx.clock.advance(200)
    expect(ctx.session.stats().state).toBe('backoff')
    expect(ctx.session.stats().errors['socket mort']).toBe(1)
  })
})

describe('5. track à l’abonnement', () => {
  it('track({ id, joinTs }) avec joinTs = l’instant d’entrée dans la salle', async () => {
    const ctx = setup()
    const ch = await boot(ctx) // t = 1250
    await ctx.clock.advance(300)
    ch.accept()
    await flush()
    expect(ch.trackCalls).toEqual([{ id: 'me', joinTs: 1250 }])
  })

  it('un refus de track : une nouvelle tentative 1–2 s plus tard, puis succès sans erreur de canal', async () => {
    const ctx = setup()
    const ch = await boot(ctx)
    ch.trackResults = ['error', 'ok']
    ch.accept()
    await flush()
    expect(ch.trackCalls).toHaveLength(1)
    await ctx.clock.advance(1499) // random 0,5 → 1 500 ms
    expect(ch.trackCalls).toHaveLength(1)
    await ctx.clock.advance(1)
    expect(ch.trackCalls).toHaveLength(2)
    expect(ctx.session.stats().state).toBe('subscribed')
    expect(ctx.session.stats().errors).toEqual({})
  })

  it('deux refus d’affilée : traité comme une erreur de canal (recul)', async () => {
    const ctx = setup()
    const ch = await boot(ctx)
    ch.trackResults = ['timed out', 'timed out']
    ch.accept()
    await flush()
    await ctx.clock.advance(1500)
    expect(ctx.session.stats().state).toBe('backoff')
    expect(ch.unsubscribed).toBe(true)
    expect(Object.keys(ctx.session.stats().errors)).toEqual(['track timed out'])
  })

  it('un refus de track ne relance rien si le canal a été abandonné entre-temps', async () => {
    const ctx = setup()
    const ch = await boot(ctx)
    ch.trackResults = ['error']
    ch.accept()
    ctx.session.stop()
    await ctx.clock.advance(5000)
    expect(ch.trackCalls).toHaveLength(1)
  })
})

describe('6. rang et saut direct de salle', () => {
  it('rang < capacité : on reste', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(CAP - 1))
    await ctx.clock.advance(5000)
    expect(ctx.client.created).toHaveLength(1)
    expect(ctx.session.stats().hops).toBe(0)
    expect(ctx.counts.at(-1)).toBe(CAP - 1)
  })

  it('rang 30 (31e arrivé) : saut vers room-2 après une gigue [150, 600[, avec untrack puis départ', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(CAP))
    await ctx.clock.advance(374) // random 0,5 → 150 + 0,5 × 450 = 375
    expect(ctx.client.created).toHaveLength(1)
    await ctx.clock.advance(1)
    expect(ch.untrackCalls).toBe(1)
    expect(ch.unsubscribed).toBe(true)
    expect(ctx.client.created.map((c) => c.name)).toEqual(['musee:v1:room-1', 'musee:v1:room-2'])
    expect(ctx.session.stats().hops).toBe(1)
    expect(ctx.session.stats().room).toBe(2)
    expect(ctx.store.peers.size).toBe(0) // l'ancien roster est vidé
  })

  it('rang 60 : saute directement à room-3, sans passer par room-2', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(2 * CAP))
    await ctx.clock.advance(600)
    expect(ctx.client.created.map((c) => c.name)).toEqual(['musee:v1:room-1', 'musee:v1:room-3'])
  })

  it('la décision est relue à l’échéance : si elle ne tient plus au dernier sync, pas de saut', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(CAP))
    await ctx.clock.advance(200)
    ch.emitSync(others(CAP - 1)) // quelqu'un est parti devant nous
    await ctx.clock.advance(2000)
    expect(ctx.client.created).toHaveLength(1)
    expect(ctx.session.stats().hops).toBe(0)
  })

  it('si la cible change entre deux syncs, on va à la dernière cible', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(CAP))
    await ctx.clock.advance(100)
    ch.emitSync(others(2 * CAP))
    await ctx.clock.advance(1000)
    expect(ctx.client.created.map((c) => c.name)).toEqual(['musee:v1:room-1', 'musee:v1:room-3'])
    expect(ctx.session.stats().hops).toBe(1)
  })

  it('déduplique par id (plus petit joinTs) : un même visiteur sur deux clés compte une fois', async () => {
    const ctx = setup({ config: { roomCapacity: 2 } })
    const ch = await bootSubscribed(ctx)
    ch.emitSync({ a: [entry('p1', -5), entry('p1', -9)], b: [entry('p1', -7)] })
    await ctx.clock.advance(2000)
    expect(ctx.client.created).toHaveLength(1) // rang 1 sur capacité 2 : on reste
    expect(ctx.counts.at(-1)).toBe(1)
  })

  it('un visiteur d’une version précédente (avatar en plus) compte dans le rang', async () => {
    const ctx = setup({ config: { roomCapacity: 1 } })
    const ch = await bootSubscribed(ctx)
    ch.emitSync({ old: [{ id: 'old', joinTs: -1, avatar: { name: 'Ada' } }] })
    await ctx.clock.advance(1000)
    expect(ctx.client.created.map((c) => c.name)).toEqual(['musee:v1:room-1', 'musee:v1:room-2'])
  })

  it('ignore les entrées de présence malformées', async () => {
    const ctx = setup({ config: { roomCapacity: 1 } })
    const ch = await bootSubscribed(ctx)
    ch.emitSync({ bad: [{ nope: true }, null, { id: 3, joinTs: 'x' }] })
    await ctx.clock.advance(1000)
    expect(ctx.client.created).toHaveLength(1)
    expect(ctx.counts.at(-1)).toBe(0)
  })

  it('au-delà de la dernière salle : solo « musée plein », canal fermé', async () => {
    const ctx = setup({ config: { roomCapacity: 2, maxRooms: 2, soloRetryMs: 0 } })
    const ch1 = await bootSubscribed(ctx)
    ch1.emitSync(others(2))
    await ctx.clock.advance(600)
    const ch2 = ctx.client.created[1]
    expect(ch2.name).toBe('musee:v1:room-2')
    ch2.accept()
    await flush()
    ch2.emitSync(others(2))
    await ctx.clock.advance(600)

    const stats = ctx.session.stats()
    expect(stats.state).toBe('solo')
    expect(stats.soloReason).toBe('musée plein')
    expect(ch2.unsubscribed).toBe(true)
    expect(ctx.client.created).toHaveLength(2) // jamais de salle 3
    expect(ctx.counts.at(-1)).toBe(0)
    expect(ctx.logs).toEqual(['[presence] mode solo : musée plein'])
  })

  it('ne recule jamais : le rang fait seulement avancer', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(CAP))
    await ctx.clock.advance(600)
    const ch2 = ctx.client.created[1]
    ch2.accept()
    await flush()
    ch2.emitSync(others(2, 'q')) // room-2 quasi vide : on y reste, on ne repart pas vers room-1
    await ctx.clock.advance(5000)
    expect(ctx.client.created.map((c) => c.name)).toEqual(['musee:v1:room-1', 'musee:v1:room-2'])
  })
})

describe('7. solo : nouvelle tentative', () => {
  async function toSolo(ctx: Ctx) {
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(CAP))
    await ctx.clock.advance(375) // gigue de saut (random 0,5) : le solo commence exactement ici
    return ch
  }

  it('réessaie après soloRetryMs × gigue [0,75 ; 1,25[ ; une salle pleine ramène aussitôt en solo', async () => {
    const ctx = setup({ config: { maxRooms: 1, soloRetryMs: 10_000 } })
    await toSolo(ctx)
    expect(ctx.session.stats().state).toBe('solo')
    await ctx.clock.advance(9999) // random 0,5 → × 1,0
    expect(ctx.client.created).toHaveLength(1)
    await ctx.clock.advance(1)
    expect(ctx.client.created).toHaveLength(2)
    expect(ctx.client.created[1].name).toBe('musee:v1:room-1')
    expect(ctx.session.stats().soloReason).toBeNull()

    ctx.client.created[1].accept()
    await flush()
    ctx.rng.v = 0 // nouvelle tentative × 0,75
    ctx.client.created[1].emitSync(others(CAP))
    await flush()
    expect(ctx.session.stats().state).toBe('solo') // tout de suite, sans gigue de saut
    expect(ctx.client.created[1].sendCalls).toHaveLength(0)
    await ctx.clock.advance(7499)
    expect(ctx.client.created).toHaveLength(2)
    await ctx.clock.advance(1)
    expect(ctx.client.created).toHaveLength(3)
  })

  it('le sondage ne traverse pas les salles : une seule salle tirée au hasard, abandonnée si elle est pleine', async () => {
    const ctx = setup({ pickStartRoom: undefined, config: { soloRetryMs: 10_000 } })
    ctx.rng.v = 0.5 // arrivée en room-5 (1 + floor(0,5 × 8))
    ctx.session.start()
    await ctx.clock.advance(1250)
    const first = ctx.client.created[0]
    expect(first.name).toBe('musee:v1:room-5')
    first.accept()
    await flush()
    // room-5 pleine et les suivantes aussi : saut direct jusqu'à la dernière salle (rang 90 → 5 + 3 = room-8), pleine elle aussi.
    first.emitSync(others(3 * CAP))
    await ctx.clock.advance(600)
    const last = ctx.client.created[ctx.client.created.length - 1]
    last.accept()
    await flush()
    last.emitSync(others(CAP))
    await ctx.clock.advance(600)
    expect(ctx.session.stats().state).toBe('solo')

    const createdAtSolo = ctx.client.created.length
    ctx.rng.v = 0.2 // à l'échéance (10 000 ms, gigue tirée au passage en solo) : room-2 (1 + floor(0,2 × 8))
    await ctx.clock.advance(10_000)
    expect(ctx.client.created).toHaveLength(createdAtSolo + 1)
    const probe = ctx.client.created[createdAtSolo]
    expect(probe.name).toBe('musee:v1:room-2')
    probe.accept()
    await flush()
    ctx.player.moving = true
    await ctx.clock.advance(1000) // aucune position tant que le sondage n'a pas conclu
    expect(probe.sendCalls).toHaveLength(0)
    probe.emitSync(others(CAP))
    await flush()
    // pleine : retour en solo AU LIEU de sauter en room-3, et jamais de position publiée
    expect(ctx.session.stats().state).toBe('solo')
    expect(probe.sendCalls).toHaveLength(0)
    expect(ctx.client.created).toHaveLength(createdAtSolo + 1)
  })

  it('un sondage concluant (place libre) publie ensuite sa position et reste en salle', async () => {
    const ctx = setup({ pickStartRoom: undefined, config: { maxRooms: 1, soloRetryMs: 10_000 } })
    await toSolo(ctx)
    await ctx.clock.advance(10_000)
    const probe = ctx.client.created[1]
    probe.accept()
    await flush()
    ctx.player.moving = true
    await ctx.clock.advance(1000)
    expect(probe.sendCalls).toHaveLength(0)
    probe.emitSync(others(2))
    await ctx.clock.advance(1000)
    expect(ctx.session.stats().state).toBe('subscribed')
    expect(probe.sendCalls.length).toBeGreaterThan(0)
  })

  it('un sondage qui ne reçoit jamais de sync finit par publier sa position (filet de 5 s)', async () => {
    const ctx = setup({ pickStartRoom: undefined, config: { maxRooms: 1, soloRetryMs: 10_000 } })
    await toSolo(ctx)
    await ctx.clock.advance(10_000)
    const probe = ctx.client.created[1]
    probe.accept()
    await flush()
    ctx.player.moving = true
    await ctx.clock.advance(4900)
    expect(probe.sendCalls).toHaveLength(0)
    await ctx.clock.advance(300)
    expect(probe.sendCalls.length).toBeGreaterThan(0)
  })

  it('avec soloRetryMs = 0, reste solo', async () => {
    const ctx = setup({ config: { maxRooms: 1, soloRetryMs: 0 } })
    await toSolo(ctx)
    await ctx.clock.advance(24 * 3_600_000)
    expect(ctx.client.created).toHaveLength(1)
    expect(ctx.session.stats().state).toBe('solo')
  })
})

describe('8. onglet caché', () => {
  it('après hiddenLeaveMs caché : untrack + départ, store vidé, état hidden ; au retour, rejoint sa dernière salle avec la gigue de saut', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync({ a: [entry('p1', -1)] })
    expect(ctx.store.peers.size).toBe(1)

    ctx.session.setHidden(true)
    await ctx.clock.advance(29_999)
    expect(ch.unsubscribed).toBe(false)
    await ctx.clock.advance(1)
    expect(ch.untrackCalls).toBe(1)
    expect(ch.unsubscribed).toBe(true)
    expect(ctx.session.stats().state).toBe('hidden')
    expect(ctx.store.peers.size).toBe(0)
    expect(ctx.counts.at(-1)).toBe(0)

    ctx.rng.v = 0.5 // saut : 375 ms ; l'initiale aurait été 1 250
    ctx.session.setHidden(false)
    expect(ctx.session.stats().state).toBe('waiting')
    await ctx.clock.advance(374)
    expect(ctx.client.created).toHaveLength(1)
    await ctx.clock.advance(1)
    expect(ctx.client.created).toHaveLength(2)
    ctx.client.created[1].accept()
    await flush()
    expect(ctx.client.created[1].trackCalls).toHaveLength(1)
  })

  it('pause courte : rien ne change, sauf le renvoi immédiat de la position', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    await ctx.clock.advance(200) // position initiale partie
    ch.sendCalls = []
    ctx.session.setHidden(true)
    await ctx.clock.advance(5000)
    expect(ch.sendCalls).toHaveLength(0) // rien publié pendant la pause
    ctx.session.setHidden(false)
    await ctx.clock.advance(100)
    expect(ch.sendCalls).toHaveLength(1) // renvoi immédiat, même à l'arrêt
    expect(ch.unsubscribed).toBe(false)
    expect(ctx.client.created).toHaveLength(1)
    await ctx.clock.advance(60_000)
    expect(ch.untrackCalls).toBe(0) // le délai de 30 s a été annulé au retour
  })

  it('un canal encore en vol au moment du départ ne republie jamais la présence (fantôme)', async () => {
    const ctx = setup()
    const ch1 = await boot(ctx)
    ch1.fail('CHANNEL_ERROR') // coupure réseau avant toute confirmation
    await ctx.clock.advance(1000)
    const ch2 = ctx.client.created[1]
    ctx.session.setHidden(true)
    await ctx.clock.advance(30_000)
    ch2.accept() // confirmation tardive
    await flush()
    expect(ch2.trackCalls).toHaveLength(0)
    expect(ctx.session.stats().state).toBe('hidden')
    await ctx.clock.advance(120_000)
    expect(ctx.client.created).toHaveLength(2) // aucune relance programmée ne survit
  })

  it('caché pendant un recul : le recul en attente est annulé', async () => {
    const ctx = setup({ config: { reconnectBaseMs: 60_000, reconnectMaxMs: 60_000 } })
    const ch1 = await boot(ctx)
    ch1.fail('CHANNEL_ERROR')
    await flush()
    expect(ctx.session.stats().state).toBe('backoff')
    ctx.session.setHidden(true)
    await ctx.clock.advance(30_000)
    expect(ctx.session.stats().state).toBe('hidden')
    await ctx.clock.advance(300_000)
    expect(ctx.client.created).toHaveLength(1) // le recul de 60 s n'a jamais rejoint
  })
})

describe('8 bis. retour d’un onglet caché et fermeture de la socket (P2-d)', () => {
  async function hideLong(ctx: Ctx) {
    ctx.session.setHidden(true)
    await ctx.clock.advance(30_000)
    expect(ctx.session.stats().state).toBe('hidden')
  }

  it('revient dans sa dernière salle (celle où un saut l’avait mené), pas dans room-1', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(CAP))
    await ctx.clock.advance(600)
    const ch2 = ctx.client.created[1]
    ch2.accept()
    await flush()
    await hideLong(ctx)
    ctx.rng.v = 0
    ctx.session.setHidden(false)
    await ctx.clock.advance(150)
    expect(ctx.client.created).toHaveLength(3)
    expect(ctx.client.created[2].name).toBe('musee:v1:room-2')
  })

  it('si la dernière salle est pleine au retour, il ne saute que vers l’avant', async () => {
    const ctx = setup({ pickStartRoom: () => 5 })
    const ch = await bootSubscribed(ctx)
    await hideLong(ctx)
    ctx.session.setHidden(false)
    await ctx.clock.advance(375)
    const back = ctx.client.created[1]
    expect(back.name).toBe('musee:v1:room-5')
    back.accept()
    await flush()
    back.emitSync(others(CAP))
    await ctx.clock.advance(600)
    expect(ctx.client.created[2].name).toBe('musee:v1:room-6')
    expect(ch.unsubscribed).toBe(true)
  })

  it('revenant du solo, il sonde une seule salle tirée au hasard (pas de traversée depuis room-1)', async () => {
    const ctx = setup({ pickStartRoom: undefined, config: { maxRooms: 1, soloRetryMs: 0 } })
    ctx.session.start()
    await ctx.clock.advance(1250)
    const ch = ctx.client.created[0]
    ch.accept()
    await flush()
    ch.emitSync(others(CAP))
    await ctx.clock.advance(600)
    expect(ctx.session.stats().state).toBe('solo')
    await hideLong(ctx)
    ctx.session.setHidden(false)
    await ctx.clock.advance(375)
    const probe = ctx.client.created[1]
    probe.accept()
    await flush()
    probe.emitSync(others(CAP))
    await flush()
    expect(ctx.session.stats().state).toBe('solo')
    expect(probe.sendCalls).toHaveLength(0)
    expect(ctx.client.created).toHaveLength(2)
  })

  it('démarré caché et jamais rejoint : au retour, salle d’entrée normale', async () => {
    const ctx = setup({ hidden: true, pickStartRoom: () => 4 })
    ctx.session.start()
    ctx.session.setHidden(false)
    await ctx.clock.advance(600)
    expect(ctx.client.created.map((c) => c.name)).toEqual(['musee:v1:room-4'])
  })

  it('ferme la WebSocket au passage en solo, une fois le dernier canal parti', async () => {
    const ctx = setup({ config: { maxRooms: 1, soloRetryMs: 0 } })
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(CAP))
    await ctx.clock.advance(600)
    expect(ctx.session.stats().state).toBe('solo')
    expect(ctx.client.disconnects).toBe(1)
    expect(ctx.client.live.size).toBe(0)
  })

  it('ferme la WebSocket quand l’onglet caché quitte la présence', async () => {
    const ctx = setup()
    await bootSubscribed(ctx)
    await hideLong(ctx)
    expect(ctx.client.disconnects).toBe(1)
  })

  it('attend la fin de unsubscribe() avant de fermer la socket, et ne la ferme pas si un canal a été recréé', async () => {
    const ctx = setup({ config: { maxRooms: 1, soloRetryMs: 10_000 } })
    let release!: () => void
    const ch = await bootSubscribed(ctx)
    ctx.client.gate = new Promise<void>((r) => (release = r))
    ch.emitSync(others(CAP))
    await ctx.clock.advance(600)
    expect(ctx.session.stats().state).toBe('solo')
    expect(ctx.client.disconnects).toBe(0) // l'ancien canal n'a pas fini de partir
    release()
    await flush()
    expect(ctx.client.disconnects).toBe(1)
  })

  it('pas de fermeture entre deux canaux : ni saut de salle ni reconnexion ne touchent la socket', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(CAP))
    await ctx.clock.advance(600)
    const ch2 = ctx.client.created[1]
    ch2.fail('CHANNEL_ERROR')
    await ctx.clock.advance(2000)
    expect(ctx.client.created).toHaveLength(3)
    expect(ctx.client.disconnects).toBe(0)
  })

  it('un client sans disconnect() (méthode optionnelle) ne pose aucun problème', async () => {
    const ctx = setup({ config: { maxRooms: 1, soloRetryMs: 0 } })
    ;(ctx.client as { disconnect?: () => void }).disconnect = undefined
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(CAP))
    await ctx.clock.advance(600)
    expect(ctx.session.stats().state).toBe('solo')
  })
})

describe('9. stop()', () => {
  it('annule tous les minuteurs, untrack, unsubscribe, vide le store, onPeersCount(0), état stopped', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync({ a: [entry('p1', -1)] })
    ctx.session.setHidden(true) // minuteur « caché » en cours
    await ctx.clock.advance(300)
    expect(ctx.clock.live).toBeGreaterThan(0)

    ctx.session.stop()
    expect(ctx.clock.live).toBe(0)
    expect(ch.untrackCalls).toBe(1)
    expect(ch.unsubscribed).toBe(true)
    expect(ctx.store.peers.size).toBe(0)
    expect(ctx.counts.at(-1)).toBe(0)
    expect(ctx.session.stats().state).toBe('stopped')

    await flush()
    expect(ctx.clock.live).toBe(0) // pas de garde-fou d'unsubscribe laissé derrière
    ch.accept()
    await ctx.clock.advance(60_000)
    expect(ch.trackCalls).toHaveLength(1) // aucune résurrection
    expect(ctx.client.created).toHaveLength(1)
  })

  it('est idempotent et sûr avant start() ou en pleine attente', async () => {
    const a = setup()
    a.session.stop()
    a.session.stop()
    expect(a.session.stats().state).toBe('stopped')

    const b = setup()
    b.session.start()
    b.session.stop()
    const callsAfterFirst = b.stats.length
    b.session.stop()
    await b.clock.advance(10_000)
    expect(b.client.created).toHaveLength(0)
    expect(b.stats).toHaveLength(callsAfterFirst)
    expect(b.clock.live).toBe(0)
  })

  it('start() après stop() ne relance rien', async () => {
    const ctx = setup()
    ctx.session.stop()
    ctx.session.start()
    await ctx.clock.advance(10_000)
    expect(ctx.client.created).toHaveLength(0)
  })
})

describe('10. messages reçus et observabilité', () => {
  it('met à jour le store, ignore ses propres messages et les charges malformées, compte received', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync({ a: [entry('p1', -1)] })
    ch.emitBroadcast(POSITION_EVENT, { i: 'p1', x: 3, z: 4, r: 0.5, m: 1 })
    ch.emitBroadcast(POSITION_EVENT, { i: 'me', x: 9, z: 9, r: 0, m: 0 })
    ch.emitBroadcast(POSITION_EVENT, { i: 'p1', x: 'NaN' })
    ch.emitBroadcast(POSITION_EVENT, null)
    const rec = ctx.store.peers.get('p1')
    expect(rec?.present).toBe(true)
    expect(rec?.buffer).toHaveLength(1)
    expect(rec?.buffer[0]).toMatchObject({ x: 3, z: 4, m: true })
    expect(ctx.store.peers.has('me')).toBe(false)
    expect(ctx.session.stats().received).toBe(4)
  })

  it('retire les pairs qui ne sont plus dans la présence', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync({ a: [entry('p1', -1)], b: [entry('p2', -2)] })
    expect(ctx.store.peers.size).toBe(2)
    ch.emitSync({ b: [entry('p2', -2)] })
    expect([...ctx.store.peers.keys()]).toEqual(['p2'])
    expect(ctx.counts.at(-1)).toBe(1)
  })

  it('expire un pair silencieux après peerTimeoutMs (vérifié toutes les 2 s)', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync({ a: [entry('p1', -1)] })
    await ctx.clock.advance(15_900)
    expect(ctx.store.peers.has('p1')).toBe(true)
    await ctx.clock.advance(2100)
    expect(ctx.store.peers.has('p1')).toBe(false)
  })

  it('onStats est appelé à chaque changement d’état, pas à chaque message', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    await ctx.clock.advance(300)
    const before = ctx.stats.length
    for (let i = 0; i < 50; i++) ch.emitBroadcast(POSITION_EVENT, { i: 'p1', x: i, z: 0, r: 0, m: 1 })
    ctx.player.moving = true
    await ctx.clock.advance(3000) // des envois aussi
    expect(ctx.stats).toHaveLength(before)
    expect(ctx.stats.map((s) => s.state)).toEqual(['waiting', 'joining', 'subscribed'])
  })

  it('stats() rend une copie : la modifier n’affecte pas la session', async () => {
    const ctx = setup()
    const ch = await boot(ctx)
    ch.fail('CHANNEL_ERROR', new Error('e'))
    const s = ctx.session.stats()
    s.errors.e = 99
    expect(ctx.session.stats().errors.e).toBe(1)
  })

  it('un observateur (onStats / onPeersCount) qui lève ne casse pas la session', async () => {
    const ctx = setup({
      onStats: () => {
        throw new Error('observateur cassé')
      },
      onPeersCount: () => {
        throw new Error('compteur cassé')
      },
    })
    const ch = await bootSubscribed(ctx)
    ch.emitSync({ a: [entry('p1', -1)] })
    expect(ctx.session.stats().state).toBe('subscribed')
    expect(ctx.store.peers.size).toBe(1)
  })

  it('un canal qui lève à la pose des écouteurs (instance périmée) passe par le recul, sans exception', async () => {
    const ctx = setup()
    const stale = new FakeChannel('musee:v1:room-1', ctx.client)
    stale.subscribe(() => {}) // déjà abonné : on('presence') lèverait
    ctx.client.live.set('musee:v1:room-1', stale)
    ctx.client.created.push(stale)
    ctx.session.start()
    await ctx.clock.advance(1250)
    expect(ctx.session.stats().state).toBe('backoff')
    expect(stale.unsubscribed).toBe(true)
    await ctx.clock.advance(1000)
    expect(ctx.client.created).toHaveLength(2)
    expect(ctx.client.created[1]).not.toBe(stale)
  })
})

describe('11. quota dépassé : solo immédiat, sans reconnexion', () => {
  const REFUSALS: Array<[string, string]> = [
    ['Too many connected users', 'too_many_connections'], // too_many_connections : 200 connexions du plan gratuit
    ['too_many_connections', 'too_many_connections'],
    ['ChannelRateLimitReached: Too many channels', 'too_many_channels'],
    ['ClientJoinRateLimitReached: Too many joins per second', 'too_many_joins'],
    ['too_many_joins', 'too_many_joins'],
  ]

  it.each(REFUSALS)('jointure refusée (« %s ») : solo tout de suite, motif quota, aucune des reconnexions, WebSocket fermée', async (text, kind) => {
    const ctx = setup()
    const ch = await boot(ctx)
    ch.fail('CHANNEL_ERROR', new Error(text))
    await flush()

    const stats = ctx.session.stats()
    expect(stats.state).toBe('solo')
    expect(stats.soloReason).toBe('quota')
    expect(stats.quota).toBe(kind)
    expect(stats.reconnects).toBe(0)
    expect(stats.room).toBeNull()
    expect(stats.errors).toEqual({ [text]: 1 })
    expect(ctx.logs).toEqual([`[presence] mode solo : quota (${kind})`]) // un seul message, jamais d'erreur visible
    expect(ch.unsubscribed).toBe(true)
    expect(ctx.client.live.size).toBe(0)
    expect(ctx.client.disconnects).toBe(1) // WebSocket fermée
    expect(ctx.counts.at(-1)).toBe(0)
    await ctx.clock.advance(200_000) // aucun recul de 1, 2, 4, 8 s : rien ne repart avant le délai long
    expect(ctx.client.created).toHaveLength(1)
  })

  it('la raison est lue aussi dans la cause de l’Error (réponse brute du serveur)', async () => {
    const ctx = setup()
    const ch = await boot(ctx)
    ch.fail('CHANNEL_ERROR', new Error('error', { cause: { reason: 'Too many connected users' } }))
    await flush()
    expect(ctx.session.stats().soloReason).toBe('quota')
    expect(ctx.session.stats().quota).toBe('too_many_connections')
  })

  it('message système « Too many messages per second » : solo avant même le CLOSED, sans untrack, le CLOSED suivant est ignoré', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ctx.player.moving = true
    await ctx.clock.advance(1500)
    const sentBefore = ch.sendCalls.length
    expect(sentBefore).toBeGreaterThan(0)

    ch.emitSystem({ extension: 'system', status: 'error', message: 'Too many messages per second', channel: 'room-1' })
    await flush()
    let stats = ctx.session.stats()
    expect(stats.state).toBe('solo')
    expect(stats.soloReason).toBe('quota')
    expect(stats.quota).toBe('too_many_messages')
    expect(stats.reconnects).toBe(0)
    expect(ch.untrackCalls).toBe(0) // le serveur ferme le canal : inutile d'annoncer le départ
    expect(ch.unsubscribed).toBe(true)
    expect(ctx.client.disconnects).toBe(1)
    expect(ctx.logs).toEqual(['[presence] mode solo : quota (too_many_messages)'])

    ch.fail('CLOSED') // le phx_close qui suit, sans Error
    await ctx.clock.advance(60_000)
    stats = ctx.session.stats()
    expect(stats.state).toBe('solo')
    expect(stats.closedByServer).toBe(0) // c'était un canal déjà abandonné
    expect(ctx.client.created).toHaveLength(1)
    expect(ch.sendCalls).toHaveLength(sentBefore) // plus aucun envoi
    expect(ch.restFallbacks).toBe(0)
  })

  it('limite de présence signalée par le serveur : même chemin', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSystem({ extension: 'system', status: 'error', message: 'Too many presence messages per second', channel: 'room-1' })
    await flush()
    expect(ctx.session.stats().soloReason).toBe('quota')
    expect(ctx.session.stats().quota).toBe('presence_limit')
  })

  it('un CLOSED qui porte lui-même le texte du quota (sans message système avant) mène aussi au solo', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.fail('CLOSED', new Error('Too many messages per second'))
    await flush()
    expect(ctx.session.stats().state).toBe('solo')
    expect(ctx.session.stats().soloReason).toBe('quota')
    expect(ctx.session.stats().closedByServer).toBe(1)
    expect(ctx.session.stats().reconnects).toBe(0)
  })

  it('les messages système ordinaires ne déclenchent rien (succès, ou erreur qui n’est pas un quota)', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSystem({ extension: 'postgres_changes', status: 'ok', message: 'Subscribed to PostgreSQL', channel: 'room-1' })
    ch.emitSystem({ extension: 'system', status: 'ok', message: 'Too many messages per second', channel: 'room-1' }) // jamais sans status error
    ch.emitSystem({ extension: 'system', status: 'error', message: 'Unable to subscribe to changes with given parameters', channel: 'room-1' })
    ch.emitSystem(null)
    ch.emitSystem('Too many messages per second')
    await ctx.clock.advance(5000)
    expect(ctx.session.stats().state).toBe('subscribed')
    expect(ctx.session.stats().soloReason).toBeNull()
  })

  it('un message système d’un canal abandonné est ignoré (génération)', async () => {
    const ctx = setup()
    const ch1 = await boot(ctx)
    ch1.fail('CHANNEL_ERROR', new Error('server busy'))
    await flush()
    ch1.emitSystem({ status: 'error', message: 'Too many messages per second' })
    await flush()
    expect(ctx.session.stats().state).toBe('backoff')
    expect(ctx.session.stats().soloReason).toBeNull()
  })

  it('les erreurs ordinaires gardent le chemin actuel : recul, même salle, reconnexions', async () => {
    const ctx = setup({ config: { soloRetryMs: 0 } })
    const ch = await boot(ctx)
    ch.fail('CHANNEL_ERROR', new Error('socket closed: 1006'))
    await flush()
    expect(ctx.session.stats().state).toBe('backoff')
    expect(ctx.session.stats().quota).toBeNull()
    await ctx.clock.advance(1000)
    expect(ctx.client.created).toHaveLength(2)
    expect(ctx.session.stats().reconnects).toBe(1)
  })

  it('aucune nouvelle jointure avant le délai long (5 min × gigue 0,75–1,25), puis UNE seule salle sondée', async () => {
    const ctx = setup({ pickStartRoom: undefined })
    ctx.rng.v = 0.5 // arrivée en room-5 ; gigue du délai × 1,0
    ctx.session.start()
    await ctx.clock.advance(1250)
    const ch = ctx.client.created[0]
    ch.fail('CHANNEL_ERROR', new Error('Too many connected users'))
    await flush()
    expect(ctx.session.stats().state).toBe('solo')

    await ctx.clock.advance(299_999)
    expect(ctx.client.created).toHaveLength(1)
    ctx.rng.v = 0.9 // la salle sondée est tirée à l'échéance : 1 + floor(0,9 × 8) = room-8
    await ctx.clock.advance(1)
    expect(ctx.client.created.map((c) => c.name)).toEqual(['musee:v1:room-5', 'musee:v1:room-8'])
    expect(ctx.session.stats().soloReason).toBeNull()
    expect(ctx.session.stats().quota).toBeNull()
    expect(ctx.session.stats().state).toBe('joining')
  })

  it('la gigue du délai long va de ×0,75 (225 s) à ×1,25 (375 s)', async () => {
    for (const [rng, expectedMs] of [[0, 225_000], [0.5, 300_000], [0.999, 374_850]] as const) {
      const ctx = setup()
      const ch = await boot(ctx)
      ctx.rng.v = rng
      ch.fail('CHANNEL_ERROR', new Error('Too many connected users'))
      await flush()
      await ctx.clock.advance(expectedMs - 1)
      expect(ctx.client.created, `rng ${rng}`).toHaveLength(1)
      await ctx.clock.advance(1)
      expect(ctx.client.created, `rng ${rng}`).toHaveLength(2)
    }
  })

  it('un sondage qui retombe sur le quota repart pour un délai long : le nombre de jointures reste borné', async () => {
    const ctx = setup()
    ctx.rng.v = 0 // gigue minimale : délai de 225 s
    const first = await boot(ctx)
    first.fail('CHANNEL_ERROR', new Error('Too many connected users'))
    await flush()
    // Une demi-heure d'un serveur saturé : chaque sondage est refusé.
    for (let elapsed = 0; elapsed < 1_800_000; elapsed += 1000) {
      await ctx.clock.advance(1000)
      const last = ctx.client.created[ctx.client.created.length - 1]
      if (ctx.session.stats().state === 'joining') last.fail('CHANNEL_ERROR', new Error('Too many connected users'))
    }
    // 1 jointure initiale + au plus une toutes les 225 s : 1 800 / 225 = 8.
    expect(ctx.client.created.length).toBeLessThanOrEqual(1 + 8)
    expect(ctx.client.created.length).toBeGreaterThanOrEqual(1 + 7)
    expect(ctx.session.stats().reconnects).toBe(0) // pas une seule des 4 reconnexions
    expect(ctx.session.stats().state).toBe('solo')
    expect(ctx.client.disconnects).toBeGreaterThanOrEqual(ctx.client.created.length - 1) // la socket est refermée après chaque refus
  })

  it('quotaSoloRetryMs = 0 : reste solo', async () => {
    const ctx = setup({ config: { quotaSoloRetryMs: 0 } })
    const ch = await boot(ctx)
    ch.fail('CHANNEL_ERROR', new Error('Too many connected users'))
    await ctx.clock.advance(24 * 3_600_000)
    expect(ctx.client.created).toHaveLength(1)
    expect(ctx.session.stats().state).toBe('solo')
  })

  it('un onglet caché puis rouvert pendant le délai ne le raccourcit pas', async () => {
    const ctx = setup()
    const ch = await boot(ctx) // t = 1 250
    ch.fail('CHANNEL_ERROR', new Error('Too many connected users'))
    await flush() // prochaine tentative à 1 250 + 300 000
    ctx.session.setHidden(true)
    await ctx.clock.advance(30_000)
    expect(ctx.session.stats().state).toBe('hidden')
    ctx.rng.v = 0
    await ctx.clock.advance(30_000)
    ctx.session.setHidden(false) // t = 61 250 : bien avant l'échéance
    expect(ctx.session.stats().state).toBe('solo')
    expect(ctx.session.stats().soloReason).toBe('quota')
    await ctx.clock.advance(200_000)
    expect(ctx.client.created).toHaveLength(1) // pas de jointure sur un serveur saturé
    await ctx.clock.advance(39_000) // t = 300 250 : l'échéance (301 250) approche
    expect(ctx.client.created).toHaveLength(1)
    await ctx.clock.advance(1_000)
    expect(ctx.client.created).toHaveLength(2) // exactement à l'échéance d'origine
    expect(ctx.session.stats().state).toBe('joining')
  })

  it('un onglet resté caché au-delà du délai sonde une salle au retour, comme d’habitude', async () => {
    const ctx = setup()
    const ch = await boot(ctx)
    ch.fail('CHANNEL_ERROR', new Error('Too many connected users'))
    await flush()
    ctx.session.setHidden(true)
    await ctx.clock.advance(400_000)
    expect(ctx.session.stats().state).toBe('hidden')
    expect(ctx.client.created).toHaveLength(1)
    ctx.session.setHidden(false)
    await ctx.clock.advance(600)
    expect(ctx.client.created).toHaveLength(2)
    expect(ctx.session.stats().soloReason).toBeNull()
  })

  it('stop() pendant le délai long annule tout', async () => {
    const ctx = setup()
    const ch = await boot(ctx)
    ch.fail('CHANNEL_ERROR', new Error('Too many connected users'))
    await flush()
    ctx.session.stop()
    await ctx.clock.advance(3_600_000)
    expect(ctx.client.created).toHaveLength(1)
    expect(ctx.clock.live).toBe(0)
  })
})

describe('12. 1 envoi/s : une position part toutes les secondes, une salle de 30 ne coûte pas de saut ni de reconnexion', () => {
  it('30 membres : on reste, 29 pairs au registre, un seul canal', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync(others(CAP - 1))
    await ctx.clock.advance(5000)
    expect(ctx.client.created).toHaveLength(1)
    expect(ctx.store.peers.size).toBe(CAP - 1)
    expect(ctx.counts.at(-1)).toBe(CAP - 1)
  })

  it('les pairs d’une salle de 30 qui parlent à 1 Hz ne sont jamais retirés ; un pair qui se tait l’est à EFFECTIVE_PEER_TIMEOUT_MS', async () => {
    const ctx = setup()
    const ch = await bootSubscribed(ctx)
    ch.emitSync({ a: [entry('walker', -2)], b: [entry('mute', -1)] })
    ch.emitBroadcast(POSITION_EVENT, { i: 'mute', x: 0, z: 0, r: 0, m: 0 })
    for (let s = 0; s < 40; s++) {
      ch.emitBroadcast(POSITION_EVENT, { i: 'walker', x: s * 3, z: 0, r: 0, m: 1 })
      await ctx.clock.advance(1000)
      if (s < 15) expect(ctx.store.peers.has('mute')).toBe(true) // 16 s de silence au plus
    }
    expect(ctx.store.peers.has('walker')).toBe(true)
    expect(ctx.store.peers.has('mute')).toBe(false)
    expect(ctx.session.stats().received).toBe(41)
  })
})
