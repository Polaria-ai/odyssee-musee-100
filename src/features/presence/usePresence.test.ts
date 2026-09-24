import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from '../../state/gameStore'
import { player } from '../../state/runtime'
import type { AvatarConfig } from '../../types'
import { clearPeers, peerStore } from './peers'
import { usePresence } from './usePresence'
import type { ChannelStatus, RealtimeChannelLike, RealtimeClientLike } from './realtimeClient'

function avatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    name: 'Ada',
    skinTone: '#f5c9a3',
    hairColor: '#3b2a1e',
    outfit: 'tee',
    outfitColor: '#7bc47f',
    accessory: 'none',
    ...overrides,
  }
}

function presenceEntry(id: string, joinTs: number) {
  return { id, avatar: avatar(), joinTs }
}

class FakeChannel implements RealtimeChannelLike {
  state: Record<string, unknown[]> = {}
  statusCb: ((status: ChannelStatus) => void) | null = null
  syncCb: (() => void) | null = null
  broadcastCbs = new Map<string, (payload: unknown) => void>()
  sendCalls: Array<{ event: string; payload: unknown }> = []
  trackCalls: unknown[] = []
  unsubscribed = false

  constructor(public name: string) {}

  onBroadcast(event: string, cb: (payload: unknown) => void) {
    this.broadcastCbs.set(event, cb)
  }
  onPresenceSync(cb: () => void) {
    this.syncCb = cb
  }
  presenceState() {
    return this.state
  }
  subscribe(cb: (status: ChannelStatus) => void) {
    this.statusCb = cb
  }
  send(event: string, payload: unknown) {
    this.sendCalls.push({ event, payload })
  }
  track(payload: unknown) {
    this.trackCalls.push(payload)
  }
  unsubscribe() {
    this.unsubscribed = true
  }

  emitStatus(status: ChannelStatus) {
    this.statusCb?.(status)
  }
  emitSync(state: Record<string, unknown[]>) {
    this.state = state
    this.syncCb?.()
  }
  emitBroadcast(event: string, payload: unknown) {
    this.broadcastCbs.get(event)?.(payload)
  }
}

class FakeClient implements RealtimeClientLike {
  channels: FakeChannel[] = []
  channel(name: string): RealtimeChannelLike {
    const ch = new FakeChannel(name)
    this.channels.push(ch)
    return ch
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  clearPeers(peerStore)
  useGame.setState({ peersCount: 0 })
  player.x = 0
  player.z = 0
  player.rotY = 0
  player.moving = false
})

afterEach(() => {
  clearPeers(peerStore)
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('usePresence — solo silencieux', () => {
  it('sans Supabase configuré (getClient renvoie null), ne fait rien', () => {
    const { unmount } = renderHook(() => usePresence(true, { getClient: () => null, now: () => Date.now() }))
    expect(useGame.getState().peersCount).toBe(0)
    unmount()
  })

  it('avec VITE_PRESENCE=off, ne se connecte à rien même si Supabase est configuré', () => {
    vi.stubEnv('VITE_PRESENCE', 'off')
    const client = new FakeClient()
    const { unmount } = renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    expect(client.channels).toHaveLength(0)
    unmount()
  })

  it('enabled=false ne se connecte pas', () => {
    const client = new FakeClient()
    const { unmount } = renderHook(() => usePresence(false, { getClient: () => client, now: () => Date.now() }))
    expect(client.channels).toHaveLength(0)
    unmount()
  })
})

describe('usePresence — rejoindre une salle', () => {
  it('rejoint room-1, trackе l’avatar une fois abonné, et suit le nombre de pairs', () => {
    const client = new FakeClient()
    const visitorId = useGame.getState().visitorId
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))

    expect(client.channels).toHaveLength(1)
    const room1 = client.channels[0]
    expect(room1.name).toBe('musee:v1:room-1')

    act(() => room1.emitStatus('SUBSCRIBED'))
    expect(room1.trackCalls).toHaveLength(1)
    expect(room1.trackCalls[0]).toMatchObject({ id: visitorId })

    act(() =>
      room1.emitSync({
        a: [presenceEntry('p1', 10)],
        b: [presenceEntry('p2', 20)],
      }),
    )
    expect(useGame.getState().peersCount).toBe(2)
    expect(peerStore.peers.size).toBe(2)
  })

  it('republie l’avatar (track) quand il change, sans rejoindre une nouvelle salle', () => {
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    const room1 = client.channels[0]
    act(() => room1.emitStatus('SUBSCRIBED'))
    expect(room1.trackCalls).toHaveLength(1)

    act(() => useGame.getState().setAvatar(avatar({ outfitColor: '#e76f6f' })))

    expect(client.channels).toHaveLength(1) // toujours la même salle
    expect(room1.trackCalls).toHaveLength(2) // mais un nouveau track()
  })
})

describe('usePresence — dépassement de salle', () => {
  it('passe à la salle suivante de façon déterministe quand on est parmi les derniers arrivés', () => {
    vi.setSystemTime(1_000_000) // horodatage d'arrivée du joueur dans room-1
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    const room1 = client.channels[0]
    act(() => room1.emitStatus('SUBSCRIBED'))

    // 8 autres arrivés avant nous (joinTs < 1_000_000) : avec nous, la salle a 9 membres → on part.
    const others = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`p${i}`, [presenceEntry(`p${i}`, 900_000 + i * 1000)]]),
    )
    act(() => room1.emitSync(others))

    expect(room1.unsubscribed).toBe(true)
    expect(client.channels).toHaveLength(2)
    expect(client.channels[1].name).toBe('musee:v1:room-2')
  })

  it('reste dans la salle quand on est parmi les 8 premiers arrivés', () => {
    vi.setSystemTime(100) // arrivé tôt
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    const room1 = client.channels[0]
    act(() => room1.emitStatus('SUBSCRIBED'))

    const others = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`p${i}`, [presenceEntry(`p${i}`, 200_000 + i * 1000)]]),
    )
    act(() => room1.emitSync(others))

    expect(room1.unsubscribed).toBe(false)
    expect(client.channels).toHaveLength(1)
  })
})

describe('usePresence — erreurs de canal', () => {
  it('bascule en mode solo après 3 tentatives de reconnexion, sans boucle infinie', () => {
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    expect(client.channels).toHaveLength(1)

    const delays = [1000, 2000, 4000]
    for (const delay of delays) {
      act(() => client.channels[client.channels.length - 1].emitStatus('CHANNEL_ERROR'))
      act(() => vi.advanceTimersByTime(delay))
    }
    expect(client.channels).toHaveLength(4) // 1 tentative initiale + 3 reconnexions

    act(() => client.channels[3].emitStatus('TIMED_OUT'))
    act(() => vi.advanceTimersByTime(20000))
    expect(client.channels).toHaveLength(4) // pas de 5e tentative : mode solo
    expect(useGame.getState().peersCount).toBe(0)
  })
})

describe('usePresence — throttle des envois de position', () => {
  it('en mouvement, au plus ~2 envois/s', () => {
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    const room1 = client.channels[0]
    act(() => room1.emitStatus('SUBSCRIBED'))

    act(() => {
      player.moving = true
      vi.advanceTimersByTime(2000)
    })
    // t≈100 (premier envoi immédiat) puis toutes les 500ms : 100, 600, 1100, 1600.
    expect(room1.sendCalls).toHaveLength(4)
    expect(room1.sendCalls.every((c) => c.event === 'pos')).toBe(true)
  })

  it('à l’arrêt, pas d’envoi hors du battement périodique', () => {
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    const room1 = client.channels[0]
    act(() => room1.emitStatus('SUBSCRIBED'))
    act(() => vi.advanceTimersByTime(150)) // laisse partir l'annonce de position initiale
    room1.sendCalls = [] // ignore ce premier envoi (nécessaire pour être visible dès l'arrivée)

    act(() => vi.advanceTimersByTime(2000))
    expect(room1.sendCalls).toHaveLength(0) // bien avant les 10 s du battement
  })
})

describe('usePresence — pause onglet caché', () => {
  it('ne publie rien tant que l’onglet est caché, puis reprend au retour', () => {
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    const room1 = client.channels[0]
    act(() => room1.emitStatus('SUBSCRIBED'))
    room1.sendCalls = []

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    act(() => {
      player.moving = true
      vi.advanceTimersByTime(3000)
    })
    expect(room1.sendCalls).toHaveLength(0)

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => vi.advanceTimersByTime(200))
    expect(room1.sendCalls.length).toBeGreaterThan(0)
  })
})

describe('usePresence — nettoyage au démontage', () => {
  it('quitte le canal et remet le compteur à zéro', () => {
    const client = new FakeClient()
    const { unmount } = renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    const room1 = client.channels[0]
    act(() => room1.emitStatus('SUBSCRIBED'))
    act(() => room1.emitSync({ a: [presenceEntry('p1', 1)] }))
    expect(useGame.getState().peersCount).toBe(1)

    unmount()

    expect(room1.unsubscribed).toBe(true)
    expect(useGame.getState().peersCount).toBe(0)
    expect(peerStore.peers.size).toBe(0)

    room1.sendCalls = []
    act(() => vi.advanceTimersByTime(5000))
    expect(room1.sendCalls).toHaveLength(0) // plus aucune boucle active après démontage
  })
})
