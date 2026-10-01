// @vitest-environment node
/**
 * Auto-contrôle du faux serveur Realtime : il est exercé par le VRAI SDK (`createClient` de supabase-js),
 * sans aucune ligne de la présence du jeu. Si l'un de ces tests casse, le banc n'est plus fidèle au SDK et
 * les verdicts de `presenceSession.sdk.test.ts` ne valent plus rien.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FakeRealtimeServer,
  SERVER_MESSAGE_TOO_MANY_MESSAGES,
  SERVER_MESSAGE_TOO_MANY_PRESENCE,
  SERVER_REASON_TOO_MANY_CONNECTIONS,
  SERVER_REASON_TOO_MANY_JOINS,
} from './fakePhoenixServer'

type Status = string

const settle = (ms = 0) => vi.advanceTimersByTimeAsync(ms)

function makeSb(server: FakeRealtimeServer, label: string, opts: { timeout?: number } = {}): SupabaseClient {
  return createClient('https://fake-project.supabase.co', 'sb_publishable_FAKE', server.clientOptions({ label, ...opts }))
}

interface Joined {
  ch: RealtimeChannel
  statuses: Status[]
  errors: Array<Error | undefined>
  syncs: number
  received: unknown[]
}

function joinChannel(sb: SupabaseClient, topic: string): Joined {
  const ch = sb.channel(topic, { config: { broadcast: { self: false } } })
  const j: Joined = { ch, statuses: [], errors: [], syncs: 0, received: [] }
  ch.on('broadcast', { event: 'pos' }, ({ payload }) => j.received.push(payload))
  ch.on('presence', { event: 'sync' }, () => {
    j.syncs += 1
  })
  ch.subscribe((status, err) => {
    j.statuses.push(status)
    j.errors.push(err)
  })
  return j
}

function presenceIds(j: Joined): string[] {
  return Object.values(j.ch.presenceState())
    .flat()
    .map((p) => (p as unknown as { id: string }).id)
    .sort()
}

describe('fakePhoenixServer (banc vérifié avec le SDK seul)', () => {
  let server: FakeRealtimeServer
  const unhandled: unknown[] = []
  const nodeProcess = (globalThis as unknown as { process: { on(e: string, f: (x: unknown) => void): void; off(e: string, f: (x: unknown) => void): void } }).process
  const onUnhandled = (e: unknown) => unhandled.push(e)

  beforeEach(() => {
    vi.useFakeTimers()
    server = new FakeRealtimeServer()
    unhandled.length = 0
    nodeProcess.on('unhandledRejection', onUnhandled)
    nodeProcess.on('uncaughtException', onUnhandled)
  })
  afterEach(() => {
    nodeProcess.off('unhandledRejection', onUnhandled)
    nodeProcess.off('uncaughtException', onUnhandled)
    vi.useRealTimers()
  })

  it('join nominal : SUBSCRIBED, presence_state puis presence_diff, track et untrack vus des autres', async () => {
    const a = makeSb(server, 'a')
    const b = makeSb(server, 'b')
    const ja = joinChannel(a, 'room-1')
    const jb = joinChannel(b, 'room-1')
    await settle()
    expect(ja.statuses).toEqual(['SUBSCRIBED'])
    expect(jb.statuses).toEqual(['SUBSCRIBED'])
    expect(server.memberCount('room-1')).toBe(2)
    expect(server.joinCount('room-1')).toBe(2)

    expect(await ja.ch.track({ id: 'A', joinTs: 1 })).toBe('ok')
    expect(await jb.ch.track({ id: 'B', joinTs: 2 })).toBe('ok')
    await settle()
    expect(presenceIds(ja)).toEqual(['A', 'B'])
    expect(presenceIds(jb)).toEqual(['A', 'B'])
    expect(server.trackedPayloads('room-1').map((p) => p.id).sort()).toEqual(['A', 'B'])

    // un nouvel arrivant reçoit l'état courant (presence_state)
    const c = makeSb(server, 'c')
    const jc = joinChannel(c, 'room-1')
    await settle()
    expect(presenceIds(jc)).toEqual(['A', 'B'])

    // retrack : l'ancienne méta est remplacée, pas dupliquée
    await ja.ch.track({ id: 'A', joinTs: 9 })
    await settle()
    expect(presenceIds(jb)).toEqual(['A', 'B'])
    expect(server.trackedPayloads('room-1').filter((p) => p.id === 'A')).toHaveLength(1)

    expect(await jb.ch.untrack()).toBe('ok')
    await settle()
    expect(presenceIds(ja)).toEqual(['A'])
    expect(unhandled).toEqual([])
  })

  it('broadcast : relayé aux autres abonnés (trame binaire), pas à l\'émetteur, jamais en REST', async () => {
    const a = makeSb(server, 'a')
    const b = makeSb(server, 'b')
    const ja = joinChannel(a, 'room-1')
    const jb = joinChannel(b, 'room-1')
    await settle()
    expect(await ja.ch.send({ type: 'broadcast', event: 'pos', payload: { i: 'A', x: 1.5, z: -2, r: 0, m: 1 } })).toBe('ok')
    await settle()
    expect(jb.received).toEqual([{ i: 'A', x: 1.5, z: -2, r: 0, m: 1 }])
    expect(ja.received).toEqual([])
    expect(server.broadcastCount('room-1', 'a')).toBe(1)
    expect(server.frames.find((f) => f.event === 'broadcast')?.binary).toBe(true)
    expect(server.restBroadcasts).toHaveLength(0)
  })

  it('REST : un send() sur un canal non joint bascule en POST /realtime/v1/api/broadcast, compté par le faux fetch', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = makeSb(server, 'a')
    const ja = joinChannel(a, 'room-1')
    await settle()
    await a.removeChannel(ja.ch)
    await settle()
    // canal fermé : le SDK retombe en REST (le comportement dangereux que la session ne doit jamais provoquer)
    expect(await ja.ch.send({ type: 'broadcast', event: 'pos', payload: { i: 'A' } })).toBe('ok')
    expect(server.restBroadcasts).toHaveLength(1)
    expect(server.restBroadcasts[0]).toMatchObject({ method: 'POST', label: 'a' })
    expect(server.restBroadcasts[0].pathname).toBe('/realtime/v1/api/broadcast')
    warn.mockRestore()
  })

  it('join refusé 2 fois : CHANNEL_ERROR avec la raison, puis phoenix rejoint seul (1 s, 2 s) et SUBSCRIBED', async () => {
    server.rejectJoins('room-1', 2, 'too_many_joins')
    const a = makeSb(server, 'a')
    const ja = joinChannel(a, 'room-1')
    await settle()
    expect(ja.statuses).toEqual(['CHANNEL_ERROR'])
    expect(ja.errors[0]?.message).toBe('too_many_joins')
    await settle(1000)
    await settle(2000)
    expect(ja.statuses).toEqual(['CHANNEL_ERROR', 'CHANNEL_ERROR', 'SUBSCRIBED'])
    expect(server.joinCount('room-1')).toBe(3)
    expect(a.getChannels()).toHaveLength(1)
    expect(server.pendingJoinRules()).toBe(0)
  })

  it('join sans réponse : TIMED_OUT au bout du timeout, puis le SDK rejoint et réussit', async () => {
    server.silenceJoins('room-1', 1)
    const a = makeSb(server, 'a', { timeout: 500 })
    const ja = joinChannel(a, 'room-1')
    await settle(499)
    expect(ja.statuses).toEqual([])
    await settle(2)
    expect(ja.statuses).toEqual(['TIMED_OUT'])
    await settle(1000)
    expect(ja.statuses).toEqual(['TIMED_OUT', 'SUBSCRIBED'])
    expect(server.memberCount('room-1')).toBe(1)
  })

  it('message system + phx_close : CLOSED côté client, canal retiré du client, membre retiré côté serveur', async () => {
    const a = makeSb(server, 'a')
    const b = makeSb(server, 'b')
    const ja = joinChannel(a, 'room-1')
    const jb = joinChannel(b, 'room-1')
    await settle()
    await ja.ch.track({ id: 'A', joinTs: 1 })
    await settle()
    expect(presenceIds(jb)).toEqual(['A'])

    expect(server.rateLimitChannel('room-1', 'a')).toBe(1)
    await settle()
    expect(ja.statuses).toEqual(['SUBSCRIBED', 'CLOSED'])
    expect(a.getChannels()).toHaveLength(0)
    expect(server.memberCount('room-1')).toBe(1)
    expect(presenceIds(jb)).toEqual([]) // son départ de présence est diffusé
    expect(b.getChannels()).toHaveLength(1)
  })

  it('coupure WebSocket : les canaux passent en erreur, le socket se reconnecte, phoenix rejoint, un seul track actif', async () => {
    const a = makeSb(server, 'a')
    const ja = joinChannel(a, 'room-1')
    await settle()
    await ja.ch.track({ id: 'A', joinTs: 1 })
    expect(server.connectionAttempts('a')).toBe(1)

    expect(server.dropSockets('a')).toBe(1)
    expect(server.memberCount('room-1')).toBe(0)
    await settle(5000)
    expect(ja.statuses[0]).toBe('SUBSCRIBED')
    expect(ja.statuses).toContain('CHANNEL_ERROR')
    expect(ja.statuses.at(-1)).toBe('SUBSCRIBED')
    expect(server.connectionAttempts('a')).toBe(2)
    expect(server.memberCount('room-1')).toBe(1)
  })

  it('connexion refusée : le SDK insiste tant que le serveur refuse, puis se connecte quand il accepte', async () => {
    server.refuseConnections(Infinity)
    const a = makeSb(server, 'a')
    const ja = joinChannel(a, 'room-1')
    await settle(3000)
    expect(server.connectionAttempts('a')).toBeGreaterThan(1)
    expect(ja.statuses.every((s) => s === 'CHANNEL_ERROR' || s === 'TIMED_OUT')).toBe(true)
    server.allowConnections()
    await settle(15000)
    expect(ja.statuses.at(-1)).toBe('SUBSCRIBED')
    expect(server.memberCount('room-1')).toBe(1)
  })

  it('removeChannel : le serveur voit phx_leave, le canal quitte client.channels, plus aucun membre', async () => {
    const a = makeSb(server, 'a')
    const ja = joinChannel(a, 'room-1')
    await settle()
    await ja.ch.track({ id: 'A', joinTs: 1 })
    expect(await a.removeChannel(ja.ch)).toBe('ok')
    expect(server.leaveCount('room-1', 'a')).toBe(1)
    expect(a.getChannels()).toHaveLength(0)
    expect(server.memberCount('room-1')).toBe(0)
    expect(server.trackedPayloads()).toEqual([])
  })

  it('heartbeat : le serveur répond ; sans réponse, le SDK rompt et se reconnecte', async () => {
    const a = makeSb(server, 'a')
    // heartbeat par défaut 25 s
    const ja = joinChannel(a, 'room-1')
    await settle()
    await settle(25_000)
    expect(server.heartbeatCount()).toBe(1)
    expect(ja.statuses).toEqual(['SUBSCRIBED'])
    server.heartbeatReplies = false
    await settle(25_000) // envoi du prochain battement
    await settle(25_000) // pas de réponse : heartbeat timeout
    expect(ja.statuses).toContain('CHANNEL_ERROR')
  })

  it('maxConnections : la jointure d’une nouvelle socket au-delà du plafond est refusée (CHANNEL_ERROR « Too many connected users »)', async () => {
    server = new FakeRealtimeServer({ maxConnections: 2 })
    const a = makeSb(server, 'a')
    const b = makeSb(server, 'b')
    const c = makeSb(server, 'c')
    const ja = joinChannel(a, 'room-1')
    const jb = joinChannel(b, 'room-1')
    await settle()
    const jc = joinChannel(c, 'room-1')
    await settle()

    expect(ja.statuses).toEqual(['SUBSCRIBED'])
    expect(jb.statuses).toEqual(['SUBSCRIBED'])
    expect(jc.statuses[0]).toBe('CHANNEL_ERROR')
    expect(jc.errors[0]?.message).toBe(SERVER_REASON_TOO_MANY_CONNECTIONS) // le texte du serveur est le message de l'Error du SDK
    expect(jc.errors[0]?.cause).toEqual({ reason: SERVER_REASON_TOO_MANY_CONNECTIONS }) // et la réponse brute est dans sa cause
    expect(server.connectedUsers()).toBe(2)
    expect(server.peakConnectedUsers()).toBe(2)
    expect(server.quotaRefusals.connections).toBeGreaterThanOrEqual(1)

    // Une socket déjà comptée change de canal sans être recomptée.
    const jaOther = joinChannel(a, 'room-2')
    await settle()
    expect(jaOther.statuses).toEqual(['SUBSCRIBED'])
    expect(server.connectedUsers()).toBe(2)

    // Quand un utilisateur part, une place se libère : à la fermeture de sa socket, pas au départ de son dernier canal
    // (le SDK garde la socket ouverte ~50 s ; le serveur la compte tant qu'elle est ouverte).
    // Le canal en erreur de `c` est retiré : phoenix ne le rejoindrait pas seul.
    await c.removeChannel(jc.ch)
    await a.removeChannel(ja.ch)
    await a.removeChannel(jaOther.ch)
    await settle()
    expect(server.connectedUsers()).toBe(2)
    void a.realtime.disconnect()
    await settle(100)
    expect(server.connectedUsers()).toBe(1)
    const jc2 = joinChannel(c, 'room-1')
    await settle()
    expect(jc2.statuses).toEqual(['SUBSCRIBED'])
    expect(server.connectedUsers()).toBe(2)
    expect(unhandled).toEqual([])
  })

  it('maxJoinsPerSecond : le dépassement est refusé (« ClientJoinRateLimitReached ») puis la fenêtre glisse', async () => {
    server = new FakeRealtimeServer({ maxJoinsPerSecond: 3 })
    const joined: Joined[] = []
    for (let i = 0; i < 5; i++) joined.push(joinChannel(makeSb(server, `c${i}`), `room-${i}`))
    await settle()
    expect(joined.filter((j) => j.statuses[0] === 'SUBSCRIBED')).toHaveLength(3)
    const refused = joined.filter((j) => j.statuses[0] === 'CHANNEL_ERROR')
    expect(refused).toHaveLength(2)
    expect(refused[0].errors[0]?.message).toBe(SERVER_REASON_TOO_MANY_JOINS)
    expect(server.peakJoinsPerSecond()).toBeGreaterThanOrEqual(3)

    await settle(1000)
    const later = joinChannel(makeSb(server, 'later'), 'room-9')
    await settle()
    expect(later.statuses).toEqual(['SUBSCRIBED'])
  })

  it('système « Too many messages per second » : le SDK livre la charge utile à channel.on("system"), puis CLOSED sans Error', async () => {
    const a = makeSb(server, 'a')
    const ja = joinChannel(a, 'room-1')
    const systems: unknown[] = []
    ja.ch.on('system', {}, (payload) => systems.push(payload))
    await settle()
    expect(systems).toEqual([expect.objectContaining({ status: 'ok', extension: 'postgres_changes' })]) // « Subscribed to PostgreSQL » à la jointure
    systems.length = 0

    expect(server.rateLimitChannel('room-1', 'a')).toBe(1)
    await settle()
    expect(systems).toEqual([
      { message: SERVER_MESSAGE_TOO_MANY_MESSAGES, status: 'error', extension: 'system', channel: 'room-1' },
    ])
    expect(ja.statuses.at(-1)).toBe('CLOSED')
    expect(ja.errors.at(-1)).toBeUndefined() // le CLOSED du SDK ne porte aucune cause : seul le message système la donne
  })

  it('présence : « Too many presence messages per second » puis fermeture', async () => {
    const a = makeSb(server, 'a')
    const ja = joinChannel(a, 'room-1')
    const systems: Array<{ message?: string }> = []
    ja.ch.on('system', {}, (payload) => systems.push(payload as { message?: string }))
    await settle()
    systems.length = 0
    expect(server.presenceLimitChannel('room-1', 'a')).toBe(1)
    await settle()
    expect(systems.map((x) => x.message)).toEqual([SERVER_MESSAGE_TOO_MANY_PRESENCE])
    expect(ja.statuses.at(-1)).toBe('CLOSED')
  })
})
