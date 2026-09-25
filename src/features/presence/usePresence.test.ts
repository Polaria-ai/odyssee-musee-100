import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from '../../state/gameStore'
import { player } from '../../state/runtime'
import type { AvatarConfig } from '../../types'
import { IDLE_HEARTBEAT_MS, clearPeers, peerStore } from './peers'
import { EFFECTIVE_PEER_TIMEOUT_MS, usePresence } from './usePresence'
import { MAX_ROOMS, ROOM_CAPACITY } from './roomSelection'
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
  untrackCalls = 0
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
  untrack() {
    this.untrackCalls += 1
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

describe('usePresence — visiteurs fantômes (onglet caché longtemps)', () => {
  it('quitte le canal après 30 s caché (untrack + unsubscribe), et le rejoint au retour au premier plan', () => {
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    const room1 = client.channels[0]
    act(() => room1.emitStatus('SUBSCRIBED'))
    act(() => room1.emitSync({ a: [presenceEntry('p1', 1)] }))
    expect(useGame.getState().peersCount).toBe(1)

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => vi.advanceTimersByTime(30000))

    // Onglet caché depuis plus de 30 s : on ne doit plus rester un visiteur fantôme figé sur place.
    expect(room1.untrackCalls).toBeGreaterThan(0)
    expect(room1.unsubscribed).toBe(true)
    expect(useGame.getState().peersCount).toBe(0)
    expect(peerStore.peers.size).toBe(0)

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(client.channels).toHaveLength(2) // rejoint une salle fraîche au retour au premier plan
    const room2 = client.channels[1]
    act(() => room2.emitStatus('SUBSCRIBED'))
    expect(room2.trackCalls).toHaveLength(1)
  })

  it('monté directement sur un onglet déjà caché : quitte quand même après 30 s (pas d’attente d’un premier `visibilitychange`)', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    const room1 = client.channels[0]
    act(() => room1.emitStatus('SUBSCRIBED'))

    act(() => vi.advanceTimersByTime(30000))

    expect(room1.untrackCalls).toBeGreaterThan(0)
    expect(room1.unsubscribed).toBe(true)
    expect(useGame.getState().peersCount).toBe(0)

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(client.channels).toHaveLength(2) // rejoint bien une salle fraîche au premier passage au premier plan
  })

  it('ne quitte pas le canal si l’onglet redevient visible avant les 30 s', () => {
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    const room1 = client.channels[0]
    act(() => room1.emitStatus('SUBSCRIBED'))

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => vi.advanceTimersByTime(29000))

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => vi.advanceTimersByTime(5000))

    expect(room1.untrackCalls).toBe(0)
    expect(room1.unsubscribed).toBe(false)
    expect(client.channels).toHaveLength(1)
  })
})

describe('usePresence — dépassement au-delà de la dernière salle', () => {
  it('repasse en solo silencieux quand la dernière salle déborde aussi (réutilise nextRoomIndex)', () => {
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))

    // Fait déborder chaque salle jusqu'à MAX_ROOMS : `others` arrivés à joinTs 0..7 (bien avant
    // notre propre `Date.now()`), donc nous sommes toujours le dernier arrivé et partons.
    for (let i = 1; i <= MAX_ROOMS; i++) {
      const room = client.channels[client.channels.length - 1]
      act(() => room.emitStatus('SUBSCRIBED'))
      const others = Object.fromEntries(
        Array.from({ length: ROOM_CAPACITY }, (_, k) => [`p${i}-${k}`, [presenceEntry(`p${i}-${k}`, k)]]),
      )
      act(() => room.emitSync(others))
    }

    expect(client.channels).toHaveLength(MAX_ROOMS) // jamais de salle au-delà de MAX_ROOMS
    expect(useGame.getState().peersCount).toBe(0) // mode solo silencieux, pas d'erreur visible
  })
})

describe('EFFECTIVE_PEER_TIMEOUT_MS — cohérence des délais', () => {
  it('reste strictement supérieur à 1.5x le battement au repos, pour ne jamais clignoter un pair immobile', () => {
    expect(EFFECTIVE_PEER_TIMEOUT_MS).toBeGreaterThan(IDLE_HEARTBEAT_MS * 1.5)
  })
})

describe('usePresence — reconnexion en vol pendant un onglet caché longtemps', () => {
  it('une tentative de reconnexion encore en vol au moment du départ pour onglet caché ne doit jamais republier la présence', () => {
    // Reproduit une coupure réseau (fréquente quand l'OS met l'onglet en veille) juste avant le
    // seuil des 30 s : une reconnexion est lancée (nouveau canal créé) mais pas encore confirmée
    // `SUBSCRIBED` quand `leaveForHidden` décide de quitter. Le canal en vol ne doit plus jamais
    // pouvoir republier notre présence (track) une fois sa confirmation tardive arrivée : sinon on
    // redevient exactement le visiteur fantôme que ce correctif devait supprimer.
    const client = new FakeClient()
    renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))
    const room1 = client.channels[0]

    // room1 ne se subscribe jamais : une coupure réseau arrive avant toute confirmation.
    act(() => room1.emitStatus('CHANNEL_ERROR'))
    act(() => vi.advanceTimersByTime(1000)) // premier backoff : relance immédiate d'un nouveau canal
    expect(client.channels).toHaveLength(2)
    const room2 = client.channels[1]

    // L'onglet passe en arrière-plan avant que room2 ne confirme sa connexion.
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => vi.advanceTimersByTime(30000)) // seuil des 30 s : on quitte pour onglet caché

    // La confirmation réseau de room2, tardive, arrive après coup.
    act(() => room2.emitStatus('SUBSCRIBED'))

    expect(room2.trackCalls).toHaveLength(0) // jamais republié : le départ pour onglet caché a gagné
    expect(useGame.getState().peersCount).toBe(0)
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
