import { describe, expect, it } from 'vitest'
import {
  IDLE_HEARTBEAT_MS,
  MAX_VISIBLE_PEERS,
  MOVE_SEND_INTERVAL_MS,
  clearPeers,
  createPeerStore,
  getPeer,
  getRenderTransform,
  pruneStale,
  recordPosition,
  removePeer,
  round2,
  selectVisiblePeers,
  shouldSendPosition,
  subscribeRoster,
  upsertPeer,
} from './peers'

describe('round2', () => {
  it('arrondit à 2 décimales', () => {
    expect(round2(1.23456)).toBe(1.23)
    expect(round2(1.006)).toBe(1.01)
    expect(round2(-2.6789)).toBe(-2.68)
  })
})

describe('upsertPeer / removePeer / clearPeers — roster', () => {
  it('notifie le roster à la première apparition d’un pair, pas au simple rafraîchissement', () => {
    const store = createPeerStore()
    let notifications = 0
    subscribeRoster(store, () => notifications++)

    upsertPeer(store, 'p1', 1000)
    expect(notifications).toBe(1)

    upsertPeer(store, 'p1', 1500) // juste un rafraîchissement de présence : la présence resynchronise tout le monde
    expect(notifications).toBe(1)
    expect(getPeer(store, 'p1')?.lastSeen).toBe(1500)

    upsertPeer(store, 'p2', 2000) // un autre pair arrive
    expect(notifications).toBe(2)
  })

  it('notifie aussi quand la présence arrive après la première position (le pair devient visible)', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 0, z: 0, r: 0, m: false }, 1000) // position d'abord : pair encore invisible
    let notifications = 0
    subscribeRoster(store, () => notifications++)

    upsertPeer(store, 'p1', 1010)
    expect(notifications).toBe(1)
    expect(selectVisiblePeers(store, 0, 0).map((p) => p.id)).toEqual(['p1'])
  })

  it('removePeer notifie seulement si le pair existait', () => {
    const store = createPeerStore()
    let notifications = 0
    subscribeRoster(store, () => notifications++)

    removePeer(store, 'inconnu')
    expect(notifications).toBe(0)

    upsertPeer(store, 'p1', 1000)
    removePeer(store, 'p1')
    expect(notifications).toBe(2)
    expect(getPeer(store, 'p1')).toBeUndefined()
  })

  it('clearPeers vide tout et ne notifie pas si déjà vide', () => {
    const store = createPeerStore()
    let notifications = 0
    subscribeRoster(store, () => notifications++)
    clearPeers(store)
    expect(notifications).toBe(0)

    upsertPeer(store, 'p1', 1000)
    clearPeers(store)
    expect(store.peers.size).toBe(0)
    expect(notifications).toBe(2)
  })

  it('recordPosition notifie une seule fois, à la position qui rend le pair visible', () => {
    // La présence est déjà là (upsertPeer a déjà notifié une fois) mais aucune position encore :
    // `selectVisiblePeers` exige présence + position, donc ce pair est encore invisible. La toute
    // première position doit notifier le roster pour que `RemoteVisitors` le fasse apparaître —
    // sinon il resterait invisible jusqu'à l'arrivée ou au départ fortuit d'un tiers.
    const store = createPeerStore()
    let notifications = 0
    subscribeRoster(store, () => notifications++)
    upsertPeer(store, 'p1', 1000)
    notifications = 0

    recordPosition(store, 'p1', { x: 1, z: 1, r: 0, m: true }, 1010) // devient visible
    expect(notifications).toBe(1)

    recordPosition(store, 'p1', { x: 2, z: 1, r: 0, m: true }, 1020) // déjà visible : pas de nouvelle notification
    expect(notifications).toBe(1)
  })

  it('recordPosition avant toute présence ne notifie pas (le pair reste invisible tant que sa présence manque)', () => {
    const store = createPeerStore()
    let notifications = 0
    subscribeRoster(store, () => notifications++)

    recordPosition(store, 'no-presence-yet', { x: 0, z: 0, r: 0, m: false }, 1000)
    expect(notifications).toBe(0)
  })

  it('se désabonner arrête les notifications', () => {
    const store = createPeerStore()
    let notifications = 0
    const unsubscribe = subscribeRoster(store, () => notifications++)
    unsubscribe()
    upsertPeer(store, 'p1', 1000)
    expect(notifications).toBe(0)
  })
})

describe('pruneStale — expiration par silence', () => {
  it('retire un pair silencieux depuis plus de `timeoutMs`, garde les autres', () => {
    const store = createPeerStore()
    upsertPeer(store, 'stale', 0)
    upsertPeer(store, 'fresh', 5000)

    const removed = pruneStale(store, 6001, 6000)
    expect(removed).toEqual(['stale'])
    expect(getPeer(store, 'stale')).toBeUndefined()
    expect(getPeer(store, 'fresh')).toBeDefined()
  })

  it('ne retire rien avant le délai', () => {
    const store = createPeerStore()
    upsertPeer(store, 'p1', 0)
    const removed = pruneStale(store, 5999, 6000)
    expect(removed).toEqual([])
    expect(getPeer(store, 'p1')).toBeDefined()
  })

  it('recordPosition repousse l’expiration (dernier signal = position, pas seulement présence)', () => {
    const store = createPeerStore()
    upsertPeer(store, 'p1', 0)
    recordPosition(store, 'p1', { x: 0, z: 0, r: 0, m: false }, 5000)
    const removed = pruneStale(store, 5000 + 6000 - 1, 6000)
    expect(removed).toEqual([])
    expect(getPeer(store, 'p1')).toBeDefined()
  })
})

describe('getRenderTransform — interpolation / extrapolation', () => {
  it('renvoie null sans aucun échantillon', () => {
    expect(getRenderTransform(undefined, 1000)).toBeNull()
    expect(getRenderTransform({ buffer: [] }, 1000)).toBeNull()
  })

  it('avec un seul échantillon, renvoie sa position telle quelle', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 3, z: 4, r: 1.2, m: true }, 1000)
    const t = getRenderTransform(getPeer(store, 'p1'), 1200)
    expect(t).toEqual({ x: 3, z: 4, rotY: 1.2, moving: true })
  })

  it('interpole linéairement entre deux échantillons, 150 ms dans le passé', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 0, z: 0, r: 0, m: true }, 0)
    recordPosition(store, 'p1', { x: 10, z: 0, r: 0, m: true }, 1000)
    // now = 650 → renderTime = 500 → exactement au milieu du segment [0, 1000]
    const t = getRenderTransform(getPeer(store, 'p1'), 650)
    expect(t?.x).toBeCloseTo(5, 5)
    expect(t?.z).toBeCloseTo(0, 5)
  })

  it('avant le premier échantillon (juste après réception), reste bloqué sur le premier point', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 1, z: 1, r: 0, m: false }, 1000)
    recordPosition(store, 'p1', { x: 2, z: 2, r: 0, m: false }, 1010)
    // now = 1010 → renderTime = 860, avant older.recvT (1000) : on n'a pas encore rattrapé le retard.
    const t = getRenderTransform(getPeer(store, 'p1'), 1010)
    expect(t).toEqual({ x: 1, z: 1, rotY: 0, moving: false })
  })

  it('extrapole au-delà du dernier échantillon, borné à 300 ms', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 0, z: 0, r: 0, m: true }, 0)
    recordPosition(store, 'p1', { x: 10, z: 0, r: 0, m: true }, 1000) // vitesse = 10 unités/1000ms
    // now = 2150 → renderTime = 2000 → 1000 ms après le dernier échantillon, borné à 300 ms d'extra.
    const t = getRenderTransform(getPeer(store, 'p1'), 2150)
    expect(t?.x).toBeCloseTo(13, 5) // 10 + 10/1000 * 300
  })

  it('interpole l’angle par le chemin le plus court (pas le grand tour à ±π)', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 0, z: 0, r: 3, m: false }, 0) // proche de +π
    recordPosition(store, 'p1', { x: 0, z: 0, r: -3, m: false }, 1000) // proche de -π
    const t = getRenderTransform(getPeer(store, 'p1'), 650) // renderTime = 500, milieu
    // Le chemin court passe par π (pas par 0) : le résultat doit être proche de ±π, pas de 0.
    expect(Math.abs(t!.rotY)).toBeGreaterThan(3)
  })
})

describe('selectVisiblePeers — limite et tri par distance', () => {
  it('ignore les pairs sans présence ou sans position', () => {
    const store = createPeerStore()
    upsertPeer(store, 'no-position', 0) // présence connue, jamais de position
    recordPosition(store, 'no-presence', { x: 0, z: 0, r: 0, m: false }, 0) // position sans présence
    expect(selectVisiblePeers(store, 0, 0)).toEqual([])
  })

  it('trie par distance croissante au joueur', () => {
    const store = createPeerStore()
    for (const [id, x] of [['far', 100], ['near', 1], ['mid', 10]] as const) {
      upsertPeer(store, id, 0)
      recordPosition(store, id, { x, z: 0, r: 0, m: false }, 0)
    }
    const ids = selectVisiblePeers(store, 0, 0).map((p) => p.id)
    expect(ids).toEqual(['near', 'mid', 'far'])
  })

  it('limite à 8 Cyril distants rendus par défaut (budget d’une salle), en gardant les plus proches', () => {
    expect(MAX_VISIBLE_PEERS).toBe(8)
    const store = createPeerStore()
    for (let i = 0; i < 50; i++) {
      const id = `p${i}`
      upsertPeer(store, id, 0)
      recordPosition(store, id, { x: i, z: 0, r: 0, m: false }, 0) // p0 le plus proche, p49 le plus loin
    }
    const visible = selectVisiblePeers(store, 0, 0)
    expect(visible).toHaveLength(MAX_VISIBLE_PEERS)
    expect(visible.map((p) => p.id)).toEqual(Array.from({ length: MAX_VISIBLE_PEERS }, (_, i) => `p${i}`))
  })

  it('accepte une limite personnalisée', () => {
    const store = createPeerStore()
    for (let i = 0; i < 5; i++) {
      upsertPeer(store, `p${i}`, 0)
      recordPosition(store, `p${i}`, { x: i, z: 0, r: 0, m: false }, 0)
    }
    expect(selectVisiblePeers(store, 0, 0, 2)).toHaveLength(2)
  })
})

describe('shouldSendPosition — throttle sortant', () => {
  it('envoie toujours le tout premier message', () => {
    expect(shouldSendPosition(null, true, 0)).toBe(true)
    expect(shouldSendPosition(null, false, 0)).toBe(true)
  })

  it('en mouvement : au plus un envoi par MOVE_SEND_INTERVAL_MS', () => {
    const state = { lastSentAt: 1000, lastSentMoving: true }
    expect(shouldSendPosition(state, true, 1000 + MOVE_SEND_INTERVAL_MS - 1)).toBe(false)
    expect(shouldSendPosition(state, true, 1000 + MOVE_SEND_INTERVAL_MS)).toBe(true)
  })

  it('à l’arrêt : publie tout de suite la position d’arrêt puis retombe sur le battement', () => {
    const justStopped = { lastSentAt: 1000, lastSentMoving: true }
    expect(shouldSendPosition(justStopped, false, 1001)).toBe(true) // vient de s'arrêter : tout de suite

    const stillIdle = { lastSentAt: 1000, lastSentMoving: false }
    expect(shouldSendPosition(stillIdle, false, 1000 + IDLE_HEARTBEAT_MS - 1)).toBe(false)
    expect(shouldSendPosition(stillIdle, false, 1000 + IDLE_HEARTBEAT_MS)).toBe(true)
  })
})
