import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from '../../state/gameStore'
import { player } from '../../state/runtime'
import type { MuseeDebugApi } from '../../scene/debugApi'
import { IDLE_HEARTBEAT_MS, clearPeers, peerStore } from './peers'
import { MAX_ROOMS, ROOM_CAPACITY } from './roomSelection'
import { EFFECTIVE_PEER_TIMEOUT_MS, presenceConfigFromEnv, usePresence } from './usePresence'
import type { ChannelStatus, RealtimeChannelLike, RealtimeClientLike } from './realtimeClient'

function presenceEntry(id: string, joinTs: number) {
  return { id, joinTs }
}

/** `n` autres visiteurs arrivés bien avant nous (joinTs très anciens). */
function earlier(n: number, prefix = 'p'): Record<string, unknown[]> {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i}`, [presenceEntry(`${prefix}${i}`, i)]]))
}

/** Entrée publiée par un client d'une version précédente : elle porte encore un avatar (ignoré à la lecture). */
function legacyPresenceEntry(id: string, joinTs: number) {
  return {
    id,
    joinTs,
    avatar: { name: 'Ada', skinTone: '#f5c9a3', hairColor: '#3b2a1e', outfit: 'tee', outfitColor: '#7bc47f', accessory: 'none' },
  }
}

/**
 * Faux canal FIDÈLE au SDK : `on('presence' | 'broadcast')` lève une fois `subscribe()` appelé (comme
 * `RealtimeChannel.on` sur un canal rejoint ou en cours de jointure), `subscribe()` sur un canal déjà
 * abonné ne fait rien, `unsubscribe()` est asynchrone et ne retire le canal du client qu'à sa résolution.
 */
class FakeChannel implements RealtimeChannelLike {
  state: Record<string, unknown[]> = {}
  statusCb: ((status: ChannelStatus, err?: Error) => void) | null = null
  syncCb: (() => void) | null = null
  broadcastCbs = new Map<string, (payload: unknown) => void>()
  sendCalls: Array<{ event: string; payload: unknown }> = []
  trackCalls: unknown[] = []
  untrackCalls = 0
  unsubscribed = false
  joined = false
  private subscribeCalled = false

  constructor(
    public name: string,
    private client: FakeClient,
  ) {}

  onBroadcast(event: string, cb: (payload: unknown) => void) {
    if (this.subscribeCalled) throw new Error('cannot add `broadcast` callbacks after `subscribe()`.')
    this.broadcastCbs.set(event, cb)
  }
  onPresenceSync(cb: () => void) {
    if (this.subscribeCalled) throw new Error('cannot add `presence` callbacks after `subscribe()`.')
    this.syncCb = cb
  }
  presenceState() {
    return this.state
  }
  subscribe(cb: (status: ChannelStatus, err?: Error) => void) {
    if (this.subscribeCalled) return
    this.subscribeCalled = true
    this.statusCb = cb
  }
  send(event: string, payload: unknown) {
    this.sendCalls.push({ event, payload })
  }
  track(payload: unknown) {
    this.trackCalls.push(payload)
    return Promise.resolve('ok')
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
    await Promise.resolve()
    this.client.remove(this)
  }

  emitStatus(status: ChannelStatus, err?: Error) {
    this.joined = status === 'SUBSCRIBED'
    this.statusCb?.(status, err)
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
  live = new Map<string, FakeChannel>()
  channels: FakeChannel[] = []
  channel(name: string): RealtimeChannelLike {
    const existing = this.live.get(name)
    if (existing) return existing // comme le SDK : même instance tant qu'elle n'a pas été retirée.
    const ch = new FakeChannel(name, this)
    this.live.set(name, ch)
    this.channels.push(ch)
    return ch
  }
  remove(ch: FakeChannel) {
    if (this.live.get(ch.name) === ch) this.live.delete(ch.name)
  }
}

/** Avance le temps (horloge factice) en laissant les promesses se résoudre, dans `act`. */
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** Gigue d'arrivée avec `Math.random() = 0,5` : 0,5 × 2 500 ms. */
const JOIN_JITTER_MS = 1250
/** Gigue avant un saut de salle avec `Math.random() = 0,5` : 150 + 0,5 × 450 ms. */
const HOP_MS = 375

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

function mount(client: FakeClient, enabled = true) {
  return renderHook(() => usePresence(enabled, { getClient: () => client, now: () => Date.now(), pickStartRoom: () => 1 }))
}

/** Monte, laisse passer la gigue d'arrivée et renvoie room-1 (créée, pas encore abonnée). */
async function mountAndJoin(client: FakeClient) {
  const hook = mount(client)
  await tick(JOIN_JITTER_MS)
  return { hook, room1: client.channels[0] }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
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
  vi.restoreAllMocks()
  vi.useRealTimers()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

describe('usePresence — solo silencieux', () => {
  it('sans Supabase configuré (getClient renvoie null), ne fait rien', () => {
    const { unmount } = renderHook(() => usePresence(true, { getClient: () => null, now: () => Date.now() }))
    expect(useGame.getState().peersCount).toBe(0)
    unmount()
  })

  it('avec VITE_PRESENCE=off, ne se connecte à rien même si Supabase est configuré', async () => {
    vi.stubEnv('VITE_PRESENCE', 'off')
    const client = new FakeClient()
    const { unmount } = mount(client)
    await tick(10_000)
    expect(client.channels).toHaveLength(0)
    unmount()
  })

  it('enabled=false ne se connecte pas', async () => {
    const client = new FakeClient()
    const { unmount } = mount(client, false)
    await tick(10_000)
    expect(client.channels).toHaveLength(0)
    unmount()
  })
})

describe('usePresence — rejoindre une salle', () => {
  it('rejoint room-1 après la gigue d’arrivée, trackе son identité une fois abonné, et suit le nombre de pairs', async () => {
    const client = new FakeClient()
    const visitorId = useGame.getState().visitorId
    const hook = mount(client)
    await tick(JOIN_JITTER_MS - 1)
    expect(client.channels).toHaveLength(0) // gigue : pas de ruée simultanée sur room-1
    await tick(1)

    expect(client.channels).toHaveLength(1)
    const room1 = client.channels[0]
    expect(room1.name).toBe('musee:v1:room-1')

    await act(async () => room1.emitStatus('SUBSCRIBED'))
    expect(room1.trackCalls).toHaveLength(1)
    // Identité et date d'arrivée seulement : plus d'avatar sur le réseau (tous les visiteurs sont Cyril).
    expect(Object.keys(room1.trackCalls[0] as object).sort()).toEqual(['id', 'joinTs'])
    expect(room1.trackCalls[0]).toMatchObject({ id: visitorId })

    act(() => room1.emitSync({ a: [presenceEntry('p1', 10)], b: [presenceEntry('p2', 20)] }))
    expect(useGame.getState().peersCount).toBe(2)
    expect(peerStore.peers.size).toBe(2)
    hook.unmount()
  })

  it('compte et affiche aussi un visiteur d’une version précédente (avatar ignoré à la lecture)', async () => {
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))

    act(() => room1.emitSync({ a: [legacyPresenceEntry('old', 10)], b: [presenceEntry('new', 20)] }))

    expect(useGame.getState().peersCount).toBe(2)
    expect([...peerStore.peers.keys()].sort()).toEqual(['new', 'old'])
    expect(peerStore.peers.get('old')?.present).toBe(true)
  })

  it('ne republie pas sa présence quand le profil du visiteur change (plus de suivi d’avatar)', async () => {
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))
    expect(room1.trackCalls).toHaveLength(1)

    act(() => useGame.setState({ lang: useGame.getState().lang === 'fr' ? 'en' : 'fr' }))
    await tick(5000)

    expect(client.channels).toHaveLength(1) // toujours la même salle
    expect(room1.trackCalls).toHaveLength(1) // aucun nouveau track()
  })

  it('un join refusé puis accepté finit SUBSCRIBED, avec un seul canal vivant, sans exception (P0-a)', async () => {
    // Avec le vrai SDK, `channel(topic)` renvoie l'instance existante tant qu'elle n'a pas été retirée :
    // l'ancien code ne retirait que les canaux abonnés, relançait sur l'instance périmée et levait.
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    const errors: unknown[] = []
    const onError = (e: ErrorEvent) => errors.push(e.error)
    window.addEventListener('error', onError)

    await act(async () => room1.emitStatus('CHANNEL_ERROR', new Error('server busy')))
    await tick(1000) // premier recul (×1,0)
    expect(client.channels).toHaveLength(2)
    const retry = client.channels[1]
    expect(retry).not.toBe(room1)
    expect(retry.name).toBe('musee:v1:room-1')
    await act(async () => retry.emitStatus('SUBSCRIBED'))

    window.removeEventListener('error', onError)
    expect(errors).toEqual([])
    expect(client.live.size).toBe(1)
    expect(retry.trackCalls).toHaveLength(1)
  })
})

describe('usePresence — dépassement de salle', () => {
  it('saute de façon déterministe vers la salle cible quand on est parmi les derniers arrivés', async () => {
    vi.setSystemTime(1_000_000) // horodatage d'arrivée du joueur dans room-1
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))

    // 30 autres arrivés avant nous : avec nous, la salle a 31 membres, nous sommes au rang 30 → room-2.
    act(() => room1.emitSync(earlier(ROOM_CAPACITY)))
    await tick(HOP_MS)

    expect(room1.unsubscribed).toBe(true)
    expect(room1.untrackCalls).toBe(1)
    expect(client.channels).toHaveLength(2)
    expect(client.channels[1].name).toBe('musee:v1:room-2')
  })

  it('reste dans la salle quand on est parmi les 30 premiers arrivés', async () => {
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))

    // 29 autres, tous arrivés après nous : nous sommes au rang 0, la salle est pleine (30) sans déborder.
    const later = Object.fromEntries(Array.from({ length: ROOM_CAPACITY - 1 }, (_, i) => [`p${i}`, [presenceEntry(`p${i}`, Date.now() + 1000 + i)]]))
    act(() => room1.emitSync(later))
    await tick(5000)

    expect(room1.unsubscribed).toBe(false)
    expect(client.channels).toHaveLength(1)
  })

  it('respecte VITE_PRESENCE_ROOM_CAPACITY (borné, repli sur 30 si invalide)', async () => {
    vi.stubEnv('VITE_PRESENCE_ROOM_CAPACITY', '2')
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))
    act(() => room1.emitSync(earlier(2)))
    await tick(HOP_MS)
    expect(client.channels.map((c) => c.name)).toEqual(['musee:v1:room-1', 'musee:v1:room-2'])
  })
})

describe('usePresence — erreurs de canal', () => {
  it('bascule en mode solo après 4 reconnexions avec recul exponentiel, sans boucle infinie', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const client = new FakeClient()
    await mountAndJoin(client)
    expect(client.channels).toHaveLength(1)

    for (const delay of [1000, 2000, 4000, 8000]) {
      await act(async () => client.channels[client.channels.length - 1].emitStatus('CHANNEL_ERROR'))
      await tick(delay)
    }
    expect(client.channels).toHaveLength(5) // 1 tentative initiale + 4 reconnexions

    await act(async () => client.channels[4].emitStatus('TIMED_OUT'))
    await tick(60_000)
    expect(client.channels).toHaveLength(5) // solo : pas de 6e tentative avant la nouvelle tentative lointaine
    expect(useGame.getState().peersCount).toBe(0)
    expect(info).toHaveBeenCalledTimes(1) // un seul message, avec la raison
    expect(String(info.mock.calls[0][0])).toContain('solo')
  })
})

describe('usePresence — quota dépassé', () => {
  it('« Too many connected users » à la jointure : solo tout de suite, un seul console.info, aucune erreur visible, pas de reconnexion', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = {} as MuseeDebugApi
    window.__musee = api
    try {
      const client = new FakeClient()
      const { room1 } = await mountAndJoin(client)
      await act(async () => room1.emitStatus('CHANNEL_ERROR', new Error('Too many connected users')))
      await tick(60_000)

      expect(client.channels).toHaveLength(1) // ni 1, ni 2, ni 4, ni 8 s : plus rien avant le délai long
      expect(api.presence?.().state).toBe('solo')
      expect(api.presence?.().soloReason).toBe('quota')
      expect(useGame.getState().peersCount).toBe(0)
      expect(info).toHaveBeenCalledTimes(1)
      expect(String(info.mock.calls[0][0])).toContain('quota')
      expect(error).not.toHaveBeenCalled()
      expect(warn).not.toHaveBeenCalled()

      await tick(400_000) // le délai long (5 min × 0,75–1,25) est passé : une seule salle sondée
      expect(client.channels).toHaveLength(2)
    } finally {
      delete window.__musee
    }
  })
})

describe('usePresence — throttle des envois de position', () => {
  it('en mouvement, au plus 1 envoi/s par défaut', async () => {
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))

    player.moving = true
    await tick(3000)
    // t≈100 (premier envoi immédiat) puis toutes les 1 000 ms : 100, 1100, 2100.
    expect(room1.sendCalls).toHaveLength(3)
    expect(room1.sendCalls.every((c) => c.event === 'pos')).toBe(true)
  })

  it('respecte VITE_PRESENCE_SEND_HZ', async () => {
    vi.stubEnv('VITE_PRESENCE_SEND_HZ', '2')
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))
    player.moving = true
    await tick(2000) // 100, 600, 1100, 1600
    expect(room1.sendCalls).toHaveLength(4)
  })

  it('à l’arrêt, pas d’envoi hors du battement périodique', async () => {
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))
    await tick(150) // laisse partir l'annonce de position initiale
    room1.sendCalls = []

    await tick(2000)
    expect(room1.sendCalls).toHaveLength(0) // bien avant les 10 s du battement
  })
})

describe('usePresence — pause onglet caché', () => {
  it('ne publie rien tant que l’onglet est caché, puis reprend au retour', async () => {
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))
    await tick(200)
    room1.sendCalls = []

    await act(async () => setVisibility('hidden'))
    player.moving = true
    await tick(3000)
    expect(room1.sendCalls).toHaveLength(0)

    await act(async () => setVisibility('visible'))
    await tick(200)
    expect(room1.sendCalls.length).toBeGreaterThan(0)
  })
})

describe('usePresence — visiteurs fantômes (onglet caché longtemps)', () => {
  it('quitte le canal après 30 s caché (untrack + unsubscribe), et le rejoint au retour au premier plan', async () => {
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))
    act(() => room1.emitSync({ a: [presenceEntry('p1', 1)] }))
    expect(useGame.getState().peersCount).toBe(1)

    await act(async () => setVisibility('hidden'))
    await tick(30_000)

    // Onglet caché depuis plus de 30 s : on ne doit plus rester un visiteur fantôme figé sur place.
    expect(room1.untrackCalls).toBeGreaterThan(0)
    expect(room1.unsubscribed).toBe(true)
    expect(useGame.getState().peersCount).toBe(0)
    expect(peerStore.peers.size).toBe(0)

    await act(async () => setVisibility('visible'))
    await tick(HOP_MS)

    expect(client.channels).toHaveLength(2) // rejoint une salle fraîche au retour au premier plan
    const room2 = client.channels[1]
    expect(room2.name).toBe('musee:v1:room-1')
    await act(async () => room2.emitStatus('SUBSCRIBED'))
    expect(room2.trackCalls).toHaveLength(1)
  })

  it('monté directement sur un onglet caché : ne rejoint rien (aucun fantôme) jusqu’au premier passage au premier plan', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const client = new FakeClient()
    mount(client)
    await tick(120_000)
    expect(client.channels).toHaveLength(0)

    await act(async () => setVisibility('visible'))
    await tick(HOP_MS)
    expect(client.channels).toHaveLength(1)
    expect(client.channels[0].name).toBe('musee:v1:room-1')
  })

  it('ne quitte pas le canal si l’onglet redevient visible avant les 30 s', async () => {
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))

    await act(async () => setVisibility('hidden'))
    await tick(29_000)
    await act(async () => setVisibility('visible'))
    await tick(5000)

    expect(room1.untrackCalls).toBe(0)
    expect(room1.unsubscribed).toBe(false)
    expect(client.channels).toHaveLength(1)
  })
})

describe('usePresence — dépassement au-delà de la dernière salle', () => {
  it('repasse en solo silencieux quand la dernière salle déborde aussi', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const client = new FakeClient()
    await mountAndJoin(client)

    // Chaque salle déborde (30 autres arrivés avant nous) : saut direct d'une salle, jusqu'à la dernière.
    for (let i = 1; i <= MAX_ROOMS; i++) {
      const room = client.channels[client.channels.length - 1]
      await act(async () => room.emitStatus('SUBSCRIBED'))
      act(() => room.emitSync(earlier(ROOM_CAPACITY, `p${i}-`)))
      await tick(HOP_MS)
    }

    expect(client.channels).toHaveLength(MAX_ROOMS) // jamais de salle au-delà de la huitième
    expect(useGame.getState().peersCount).toBe(0) // mode solo silencieux, pas d'erreur visible
  })
})

describe('EFFECTIVE_PEER_TIMEOUT_MS — cohérence des délais', () => {
  it('reste strictement supérieur à 1.5x le battement au repos, pour ne jamais clignoter un pair immobile', () => {
    expect(EFFECTIVE_PEER_TIMEOUT_MS).toBeGreaterThan(IDLE_HEARTBEAT_MS * 1.5)
  })
})

describe('usePresence — reconnexion en vol pendant un onglet caché longtemps', () => {
  it('une tentative de reconnexion encore en vol au moment du départ pour onglet caché ne doit jamais republier la présence', async () => {
    // Coupure réseau (fréquente quand l'OS met l'onglet en veille) juste avant le seuil des 30 s : une
    // reconnexion est lancée (nouveau canal créé) mais pas encore confirmée `SUBSCRIBED` quand on décide
    // de quitter. Sa confirmation tardive ne doit plus jamais republier notre présence (track).
    const client = new FakeClient()
    const { room1 } = await mountAndJoin(client)

    await act(async () => room1.emitStatus('CHANNEL_ERROR')) // room1 ne s'abonne jamais
    await tick(1000) // premier recul : nouveau canal
    expect(client.channels).toHaveLength(2)
    const room2 = client.channels[1]

    await act(async () => setVisibility('hidden'))
    await tick(30_000)

    await act(async () => room2.emitStatus('SUBSCRIBED')) // confirmation tardive

    expect(room2.trackCalls).toHaveLength(0) // jamais republié : le départ pour onglet caché a gagné
    expect(useGame.getState().peersCount).toBe(0)
  })
})

describe('usePresence — nettoyage au démontage', () => {
  it('quitte le canal et remet le compteur à zéro', async () => {
    const client = new FakeClient()
    const { hook, room1 } = await mountAndJoin(client)
    await act(async () => room1.emitStatus('SUBSCRIBED'))
    act(() => room1.emitSync({ a: [presenceEntry('p1', 1)] }))
    expect(useGame.getState().peersCount).toBe(1)

    hook.unmount()
    await tick(0)

    expect(room1.unsubscribed).toBe(true)
    expect(useGame.getState().peersCount).toBe(0)
    expect(peerStore.peers.size).toBe(0)

    room1.sendCalls = []
    await tick(5000)
    expect(room1.sendCalls).toHaveLength(0) // plus aucune boucle active après démontage
  })

  it('démonté pendant la gigue d’arrivée : ne rejoint jamais', async () => {
    const client = new FakeClient()
    const { unmount } = mount(client)
    unmount()
    await tick(10_000)
    expect(client.channels).toHaveLength(0)
  })
})

describe('usePresence — salle d’entrée', () => {
  const unpinned = (client: FakeClient) => renderHook(() => usePresence(true, { getClient: () => client, now: () => Date.now() }))

  it('par défaut, entre par room-1 (les petits groupes se retrouvent)', async () => {
    const client = new FakeClient()
    const { unmount } = unpinned(client)
    await tick(JOIN_JITTER_MS)
    expect(client.channels.map((c) => c.name)).toEqual(['musee:v1:room-1'])
    unmount()
  })

  it('avec VITE_PRESENCE_START=random, entre dans une salle tirée au hasard (Math.random 0,5 → room-5)', async () => {
    vi.stubEnv('VITE_PRESENCE_START', 'random')
    try {
      const client = new FakeClient()
      const { unmount } = unpinned(client)
      await tick(JOIN_JITTER_MS)
      expect(client.channels.map((c) => c.name)).toEqual(['musee:v1:room-5'])
      unmount()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('dans un espace de salles de test (?presenceRoom=), entre toujours par room-1 pour que deux onglets se retrouvent', async () => {
    window.history.replaceState(null, '', '/?e2e=1&presenceRoom=e2e-abc')
    try {
      const client = new FakeClient()
      const { unmount } = unpinned(client)
      await tick(JOIN_JITTER_MS)
      expect(client.channels.map((c) => c.name)).toEqual(['musee:v1:e2e-abc:room-1'])
      unmount()
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })
})

describe('usePresence — stats de debug', () => {
  it('expose window.__musee.presence() tant que la session tourne, et le retire au démontage', async () => {
    const api = {} as MuseeDebugApi
    window.__musee = api
    try {
      const client = new FakeClient()
      const { hook, room1 } = await mountAndJoin(client)
      await act(async () => room1.emitStatus('SUBSCRIBED'))
      expect(api.presence?.().state).toBe('subscribed')
      expect(api.presence?.().room).toBe(1)
      hook.unmount()
      expect(api.presence).toBeUndefined()
    } finally {
      delete window.__musee
    }
  })
})

describe('presenceConfigFromEnv — réglages Vite bornés', () => {
  it('rien de défini : aucun réglage (repli sur les valeurs par défaut)', () => {
    expect(presenceConfigFromEnv({})).toEqual({})
  })

  it('valeurs valides : capacité, salles, cadence d’envoi en Hz convertie en ms', () => {
    expect(
      presenceConfigFromEnv({ VITE_PRESENCE_ROOM_CAPACITY: '4', VITE_PRESENCE_MAX_ROOMS: '30', VITE_PRESENCE_SEND_HZ: '4' }),
    ).toEqual({ roomCapacity: 4, maxRooms: 30, moveSendIntervalMs: 250 })
    expect(presenceConfigFromEnv({ VITE_PRESENCE_SEND_HZ: '0.5' })).toEqual({ moveSendIntervalMs: 2000 })
  })

  it('bornes incluses, tout le reste est ignoré', () => {
    expect(presenceConfigFromEnv({ VITE_PRESENCE_ROOM_CAPACITY: '2' })).toEqual({ roomCapacity: 2 })
    expect(presenceConfigFromEnv({ VITE_PRESENCE_ROOM_CAPACITY: '40' })).toEqual({ roomCapacity: 40 })
    expect(presenceConfigFromEnv({ VITE_PRESENCE_ROOM_CAPACITY: '30' })).toEqual({ roomCapacity: 30 })
    expect(presenceConfigFromEnv({ VITE_PRESENCE_ROOM_CAPACITY: '1' })).toEqual({})
    expect(presenceConfigFromEnv({ VITE_PRESENCE_ROOM_CAPACITY: '41' })).toEqual({})
    expect(presenceConfigFromEnv({ VITE_PRESENCE_MAX_ROOMS: '0' })).toEqual({})
    expect(presenceConfigFromEnv({ VITE_PRESENCE_MAX_ROOMS: '51' })).toEqual({})
    expect(presenceConfigFromEnv({ VITE_PRESENCE_SEND_HZ: '0.4' })).toEqual({})
    expect(presenceConfigFromEnv({ VITE_PRESENCE_SEND_HZ: '4.1' })).toEqual({})
  })

  it('illisible, vide, décimal là où un entier est attendu, ou pas une chaîne : ignoré', () => {
    expect(
      presenceConfigFromEnv({
        VITE_PRESENCE_ROOM_CAPACITY: 'beaucoup',
        VITE_PRESENCE_MAX_ROOMS: '',
        VITE_PRESENCE_SEND_HZ: 'NaN',
      }),
    ).toEqual({})
    expect(presenceConfigFromEnv({ VITE_PRESENCE_ROOM_CAPACITY: '7.5' })).toEqual({})
    expect(presenceConfigFromEnv({ VITE_PRESENCE_ROOM_CAPACITY: 30 })).toEqual({})
    expect(presenceConfigFromEnv({ VITE_PRESENCE_ROOM_CAPACITY: 'Infinity' })).toEqual({})
  })
})
