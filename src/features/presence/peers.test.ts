import { describe, expect, it } from 'vitest'
import {
  EXTRAPOLATE_CAP_MS,
  IDLE_HEARTBEAT_MS,
  INTERP_DELAY_MS,
  MAX_EXTRAPOLATION_SPEED,
  MAX_PEER_RECORDS,
  MAX_POSITION_BUFFER,
  MAX_VISIBLE_PEERS,
  MOVE_SEND_INTERVAL_MS,
  PEER_SILENCE_TIMEOUT_MS,
  REMOTE_MAX_CATCHUP_SPEED,
  REMOTE_SNAP_DISTANCE,
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
  stepToward,
  subscribeRoster,
  upsertPeer,
  type PeerStore,
  type RenderTransform,
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

  it('avec un seul échantillon, reste sur sa position, sans marcher sur place', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 3, z: 4, r: 1.2, m: true }, 1000)
    const t = getRenderTransform(getPeer(store, 'p1'), 1200)
    expect(t).toEqual({ x: 3, z: 4, rotY: 1.2, moving: false })
  })

  it('interpole linéairement entre deux échantillons, INTERP_DELAY_MS dans le passé', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 0, z: 0, r: 0, m: true }, 0)
    recordPosition(store, 'p1', { x: 10, z: 0, r: 0, m: true }, 1000)
    // renderTime = 500 → exactement au milieu du segment [0, 1000]
    const t = getRenderTransform(getPeer(store, 'p1'), 500 + INTERP_DELAY_MS)
    expect(t?.x).toBeCloseTo(5, 5)
    expect(t?.z).toBeCloseTo(0, 5)
    expect(t?.moving).toBe(true)
  })

  it('le retard d’affichage dépasse l’intervalle d’envoi (1 Hz) : on interpole au lieu d’extrapoler', () => {
    expect(INTERP_DELAY_MS).toBeGreaterThan(MOVE_SEND_INTERVAL_MS * 1.1) // + le tick de 100 ms de la boucle d'envoi
    expect(INTERP_DELAY_MS - MOVE_SEND_INTERVAL_MS * 1.1).toBeGreaterThanOrEqual(200) // marge de gigue réseau
    expect(MAX_POSITION_BUFFER).toBeGreaterThanOrEqual(Math.ceil(INTERP_DELAY_MS / MOVE_SEND_INTERVAL_MS) + 2)
  })

  it('avant le premier échantillon (juste après réception), reste bloqué sur le premier point', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 1, z: 1, r: 0, m: false }, 1000)
    recordPosition(store, 'p1', { x: 2, z: 2, r: 0, m: false }, 1010)
    // now = 1010 → renderTime en retard sur le premier échantillon : on n'a pas encore rattrapé le retard.
    const t = getRenderTransform(getPeer(store, 'p1'), 1010)
    expect(t).toEqual({ x: 1, z: 1, rotY: 0, moving: false })
  })

  it('un pair qui démarre ne marche pas sur place avant son premier échantillon en marche', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 5, z: 5, r: 0, m: false }, 0) // battement au repos
    recordPosition(store, 'p1', { x: 5.05, z: 5, r: 0, m: true }, 10_000) // il vient de partir
    recordPosition(store, 'p1', { x: 8, z: 5, r: 0, m: true }, 11_000)
    // Dans le segment [0, 10 000] : immobile. Dans [10 000, 11 000] : en marche.
    expect(getRenderTransform(getPeer(store, 'p1'), 9000 + INTERP_DELAY_MS)?.moving).toBe(false)
    expect(getRenderTransform(getPeer(store, 'p1'), 10_500 + INTERP_DELAY_MS)?.moving).toBe(true)
  })

  it('extrapole un pair en marche au-delà du dernier échantillon, borné à EXTRAPOLATE_CAP_MS', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 0, z: 0, r: 0, m: true }, 0)
    recordPosition(store, 'p1', { x: 3, z: 0, r: 0, m: true }, 1000) // 3 m/s
    const rec = getPeer(store, 'p1')
    // 200 ms après le dernier échantillon (renderTime = 1200) : 0,6 m de plus.
    const soon = getRenderTransform(rec, 1200 + INTERP_DELAY_MS)
    expect(soon?.x).toBeCloseTo(3.6, 5)
    expect(soon?.moving).toBe(true)
    // Au cap exact : 1,5 m de plus ; au-delà, figé et plus de marche.
    expect(getRenderTransform(rec, 1000 + EXTRAPOLATE_CAP_MS + INTERP_DELAY_MS)?.x).toBeCloseTo(3 + 3 * (EXTRAPOLATE_CAP_MS / 1000), 5)
    const frozen = getRenderTransform(rec, 1000 + EXTRAPOLATE_CAP_MS + 1 + INTERP_DELAY_MS)
    expect(frozen).toEqual({ x: 3, z: 0, rotY: 0, moving: false })
    expect(getRenderTransform(rec, 60_000)).toEqual({ x: 3, z: 0, rotY: 0, moving: false })
  })

  it('n’extrapole jamais un pair arrêté : l’arrêt est propre, sans glissade au-delà du point d’arrêt', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 0, z: 0, r: 0, m: true }, 0)
    recordPosition(store, 'p1', { x: 3, z: 0, r: 0, m: true }, 1000)
    recordPosition(store, 'p1', { x: 4, z: 0, r: 0, m: false }, 1400) // position d'arrêt
    const rec = getPeer(store, 'p1')
    for (let at = 1400; at <= 20_000; at += 100) {
      const t = getRenderTransform(rec, at + INTERP_DELAY_MS)!
      expect(t.x).toBeLessThanOrEqual(4 + 1e-9)
    }
    expect(getRenderTransform(rec, 1400 + 100 + INTERP_DELAY_MS)).toEqual({ x: 4, z: 0, rotY: 0, moving: false })
  })

  it('borne la vitesse extrapolée : des échantillons livrés en rafale ne projettent pas le pair à des dizaines de mètres', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 0, z: 0, r: 0, m: true }, 5000)
    recordPosition(store, 'p1', { x: 5.6, z: 0, r: 0, m: true }, 5020) // 1 s de marche livrée 20 ms plus tard
    const t = getRenderTransform(getPeer(store, 'p1'), 5020 + 400 + INTERP_DELAY_MS)!
    expect(t.x - 5.6).toBeLessThanOrEqual(MAX_EXTRAPOLATION_SPEED * 0.4 + 1e-9)
  })

  it('interpole l’angle par le chemin le plus court (pas le grand tour à ±π), sans l’extrapoler', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 0, z: 0, r: 3, m: false }, 0) // proche de +π
    recordPosition(store, 'p1', { x: 0, z: 0, r: -3, m: false }, 1000) // proche de -π
    const t = getRenderTransform(getPeer(store, 'p1'), 500 + INTERP_DELAY_MS) // milieu du segment
    // Le chemin court passe par π (pas par 0) : le résultat doit être proche de ±π, pas de 0.
    expect(Math.abs(t!.rotY)).toBeGreaterThan(3)
    expect(getRenderTransform(getPeer(store, 'p1'), 5000)?.rotY).toBe(-3) // au-delà : la rotation ne dérive pas
  })

  it('réutilise l’objet fourni (aucune allocation par image)', () => {
    const store = createPeerStore()
    recordPosition(store, 'p1', { x: 1, z: 2, r: 0.5, m: false }, 0)
    const out: RenderTransform = { x: 0, z: 0, rotY: 0, moving: true }
    expect(getRenderTransform(getPeer(store, 'p1'), 5000, out)).toBe(out)
    expect(out).toEqual({ x: 1, z: 2, rotY: 0.5, moving: false })
  })

  it('garde au plus MAX_POSITION_BUFFER échantillons, les plus récents', () => {
    const store = createPeerStore()
    for (let i = 0; i < 12; i++) recordPosition(store, 'p1', { x: i, z: 0, r: 0, m: true }, i * 1000)
    const buffer = getPeer(store, 'p1')!.buffer
    expect(buffer).toHaveLength(MAX_POSITION_BUFFER)
    expect(buffer.map((b) => b.x)).toEqual([7, 8, 9, 10, 11])
  })
})

/**
 * Marche simulée d'un pair à 1 envoi/s : le pair avance à `speed` m/s sur l'axe x, ses échantillons partent toutes les
 * `MOVE_SEND_INTERVAL_MS` et arrivent avec la gigue donnée ; on rend une image toutes les 16 ms et on rend compte de
 * tout ce que le joueur verrait. `late` : numéro d'échantillon → retard supplémentaire (ms) de son arrivée.
 */
function simulateWalk(opts: { speed: number; packets: number; jitter: number[]; late?: Record<number, number>; stopAfter?: number; frameMs?: number }) {
  const { speed, packets, jitter } = opts
  const frameMs = opts.frameMs ?? 16
  const store: PeerStore = createPeerStore()
  upsertPeer(store, 'p', 0)
  // Une WebSocket livre dans l'ordre : un paquet en retard retarde aussi les suivants (ils arrivent alors en rafale).
  let previousAt = -Infinity
  const arrivals = Array.from({ length: packets }, (_, k) => {
    const sentAt = k * MOVE_SEND_INTERVAL_MS
    const stopped = opts.stopAfter !== undefined && k >= opts.stopAfter
    const x = speed * (Math.min(k, opts.stopAfter ?? k) * MOVE_SEND_INTERVAL_MS) / 1000
    const at = Math.max(sentAt + 150 + (jitter[k % jitter.length] ?? 0) + (opts.late?.[k] ?? 0), previousAt + 5)
    previousAt = at
    return { at, sample: { x, z: 0, r: 0, m: !stopped }, k }
  })

  const frames: Array<{ t: number; x: number; moving: boolean; extrapolating: boolean; newestX: number }> = []
  let next = 0
  const out: RenderTransform = { x: 0, z: 0, rotY: 0, moving: false }
  const end = packets * MOVE_SEND_INTERVAL_MS + 6000
  for (let t = 0; t <= end; t += frameMs) {
    while (next < arrivals.length && arrivals[next].at <= t) {
      recordPosition(store, 'p', arrivals[next].sample, arrivals[next].at)
      next++
    }
    const rec = getPeer(store, 'p')
    if (!rec || rec.buffer.length < 2) continue
    const r = getRenderTransform(rec, t, out)!
    const newest = rec.buffer[rec.buffer.length - 1]
    frames.push({ t, x: r.x, moving: r.moving, extrapolating: t - INTERP_DELAY_MS > newest.recvT, newestX: newest.x })
  }
  return frames
}

describe('getRenderTransform à 1 envoi/s — fluidité', () => {
  const SPEED = 3 // m/s, la marche
  const nominalStep = (SPEED * 16) / 1000 // 0,048 m par image de 16 ms

  it('gigue réseau de ± 200 ms (jusqu’à 400 ms d’écart entre deux paquets) : aucun saut, aucune extrapolation, aucun retour en arrière', () => {
    const frames = simulateWalk({ speed: SPEED, packets: 40, jitter: [0, 120, -150, 200, -200, 60, -90, 170, -30, 110] })
    // On ignore le démarrage (le temps de remplir le tampon et de rattraper le retard d'affichage).
    const steady = frames.filter((f) => f.t > 5000 && f.t < 36_000)
    expect(steady.length).toBeGreaterThan(1500)
    let maxStep = 0
    let minStep = Infinity
    for (let i = 1; i < steady.length; i++) {
      const step = steady[i].x - steady[i - 1].x
      maxStep = Math.max(maxStep, step)
      minStep = Math.min(minStep, step)
    }
    // Les segments durent 600 à 1 400 ms pour 3 m : la vitesse affichée varie, mais reste dans un rapport de 2.
    expect(minStep).toBeGreaterThanOrEqual(0) // jamais en arrière
    expect(maxStep).toBeLessThan(nominalStep * 2.1)
    expect(steady.every((f) => !f.extrapolating)).toBe(true)
    expect(steady.every((f) => f.moving)).toBe(true) // il marche en continu
    expect(steady.every((f) => f.x <= f.newestX + 1e-9)).toBe(true) // jamais au-delà de ce qui a été reçu
  })

  it('l’avatar affiché retarde sur la vérité d’environ le retard d’affichage, pas davantage', () => {
    const frames = simulateWalk({ speed: SPEED, packets: 30, jitter: [0, 100, -100] })
    for (const f of frames.filter((fr) => fr.t > 6000 && fr.t < 25_000)) {
      const truthAtDisplayedTime = f.x / SPEED * 1000 // l'instant d'émission que montre l'avatar
      const lag = f.t - truthAtDisplayedTime
      // 150 ms de latence réseau nominale + le retard d'affichage, à la gigue près.
      expect(lag).toBeGreaterThan(INTERP_DELAY_MS + 150 - 250)
      expect(lag).toBeLessThan(INTERP_DELAY_MS + 150 + 250)
    }
  })

  it('un paquet en retard de 700 ms : extrapolation bornée, puis rattrapage sans téléportation', () => {
    const frames = simulateWalk({ speed: SPEED, packets: 30, jitter: [0], late: { 15: 700 } })
    const steady = frames.filter((f) => f.t > 5000 && f.t < 25_000)
    expect(steady.some((f) => f.extrapolating)).toBe(true)
    let maxJump = 0
    for (let i = 1; i < steady.length; i++) maxJump = Math.max(maxJump, Math.abs(steady[i].x - steady[i - 1].x))
    // Le pire à-coup est la correction à l'arrivée du paquet : moins que ce que l'extrapolation a pu avancer.
    expect(maxJump).toBeLessThan(MAX_EXTRAPOLATION_SPEED * (EXTRAPOLATE_CAP_MS / 1000))
    expect(maxJump).toBeLessThan(REMOTE_SNAP_DISTANCE)
  })

  it('un paquet perdu (2 s sans rien) : le pair est figé et ne marche plus au-delà du cap, puis repart', () => {
    const frames = simulateWalk({ speed: SPEED, packets: 30, jitter: [0], late: { 15: 2000 } })
    // Dernier paquet reçu à ~14 150 ms ; l'affichage l'atteint à 15 650, extrapole 500 ms, puis reste figé.
    const frozen = frames.filter((f) => f.t > 16_300 && f.t < 17_000)
    expect(frozen.length).toBeGreaterThan(30)
    expect(frozen.every((f) => f.extrapolating && !f.moving)).toBe(true) // figé, avec l'animation d'arrêt
    expect(new Set(frozen.map((f) => f.x)).size).toBe(1) // aucune dérive
    const after = frames.filter((f) => f.t > 26_000 && f.t < 31_000)
    expect(after.every((f) => f.moving)).toBe(true) // reparti
  })

  it('arrêt propre : l’avatar s’immobilise exactement au point d’arrêt, sans le dépasser ni glisser', () => {
    const frames = simulateWalk({ speed: SPEED, packets: 24, jitter: [0, 80, -80], stopAfter: 12 })
    const stopX = SPEED * 12
    expect(Math.max(...frames.map((f) => f.x))).toBeLessThanOrEqual(stopX + 1e-9)
    const end = frames.at(-1)!
    expect(end.x).toBeCloseTo(stopX, 6)
    expect(end.moving).toBe(false)
    // Il marche jusqu'à y arriver : tant qu'il avance encore, `moving` est vrai.
    const advancing = frames.filter((f, i) => i > 0 && f.x > frames[i - 1].x + 1e-9 && f.x < stopX - 1e-6)
    expect(advancing.every((f) => f.moving)).toBe(true)
  })
})

describe('stepToward — rattrapage sans téléportation', () => {
  it('suit sans retard une cible qui avance à la vitesse de marche ou de course', () => {
    const pos = { x: 0, z: 0 }
    for (let i = 1; i <= 120; i++) {
      stepToward(pos, 5.6 * (i / 60), 0, 1 / 60) // 5,6 m/s : la course du joueur
      expect(pos.x).toBeCloseTo(5.6 * (i / 60), 9)
    }
  })

  it('une cible qui bondit de 6 m est rejointe par une course continue, à REMOTE_MAX_CATCHUP_SPEED', () => {
    const pos = { x: 0, z: 0 }
    const dt = 1 / 60
    stepToward(pos, 6, 0, dt)
    expect(pos.x).toBeCloseTo(REMOTE_MAX_CATCHUP_SPEED * dt, 9)
    let frames = 1
    while (pos.x < 6 && frames < 200) {
      const before = pos.x
      stepToward(pos, 6, 0, dt)
      expect(pos.x - before).toBeLessThanOrEqual(REMOTE_MAX_CATCHUP_SPEED * dt + 1e-9)
      frames++
    }
    expect(pos.x).toBe(6)
    expect(frames).toBeGreaterThan(30) // pas un saut : plus d'une demi-seconde
  })

  it('au-delà de REMOTE_SNAP_DISTANCE, le pair est replacé d’un coup', () => {
    const pos = { x: 0, z: 0 }
    stepToward(pos, REMOTE_SNAP_DISTANCE + 1, 0, 1 / 60)
    expect(pos.x).toBe(REMOTE_SNAP_DISTANCE + 1)
  })

  it('ne dépasse jamais la cible et tolère un pas de temps nul ou négatif', () => {
    const pos = { x: 1, z: 1 }
    stepToward(pos, 1.01, 1, 1 / 60)
    expect(pos).toEqual({ x: 1.01, z: 1 })
    const still = { x: 0, z: 0 }
    stepToward(still, 3, 0, 0)
    stepToward(still, 3, 0, -1)
    expect(still).toEqual({ x: 0, z: 0 })
  })
})

describe('registre des pairs — borné, sans fuite', () => {
  it('ignore les positions d’ids inconnus au-delà de MAX_PEER_RECORDS, mais la présence fait toujours foi', () => {
    const store = createPeerStore()
    for (let i = 0; i < MAX_PEER_RECORDS + 50; i++) recordPosition(store, `ghost${i}`, { x: i, z: 0, r: 0, m: false }, 0)
    expect(store.peers.size).toBe(MAX_PEER_RECORDS)
    upsertPeer(store, 'real', 0) // un membre de la salle (présence) est toujours accepté
    expect(getPeer(store, 'real')?.present).toBe(true)
    recordPosition(store, 'ghost0', { x: 1, z: 1, r: 0, m: false }, 10) // un id connu continue d'être mis à jour
    expect(getPeer(store, 'ghost0')?.buffer).toHaveLength(2)
  })

  it('des dizaines de pairs qui arrivent et partent pendant une heure ne laissent rien derrière eux', () => {
    const store = createPeerStore()
    let notifications = 0
    const off = subscribeRoster(store, () => notifications++)
    let t = 0
    let maxSize = 0
    for (let wave = 0; wave < 120; wave++) {
      // Une salle de 30 : 30 pairs arrivent, bougent pendant 25 s, puis partent (présence retirée).
      for (let i = 0; i < 30; i++) upsertPeer(store, `w${wave}-${i}`, t)
      for (let s = 0; s < 25; s++) {
        t += 1000
        for (let i = 0; i < 30; i++) recordPosition(store, `w${wave}-${i}`, { x: s, z: i, r: 0, m: true }, t)
        pruneStale(store, t, 16_000)
      }
      maxSize = Math.max(maxSize, store.peers.size)
      for (let i = 0; i < 30; i++) removePeer(store, `w${wave}-${i}`)
      expect(store.peers.size).toBe(0)
    }
    expect(maxSize).toBeLessThanOrEqual(30)
    for (const rec of store.peers.values()) expect(rec.buffer.length).toBeLessThanOrEqual(MAX_POSITION_BUFFER)
    expect(notifications).toBeGreaterThan(0)
    off()
    expect(store.rosterListeners.size).toBe(0)
  })

  it('un pair silencieux disparaît du registre au délai fourni, jamais avant ; ceux qui parlent restent', () => {
    const store = createPeerStore()
    upsertPeer(store, 'mute', 0)
    upsertPeer(store, 'walker', 0)
    const removals: Array<[number, string]> = []
    for (let t = 1000; t <= 30_000; t += MOVE_SEND_INTERVAL_MS) {
      recordPosition(store, 'walker', { x: t, z: 0, r: 0, m: true }, t)
      for (const id of pruneStale(store, t, 16_000)) removals.push([t, id])
    }
    expect(removals).toEqual([[17_000, 'mute']]) // à 16 000 ms pile, il n'est pas encore expiré ; à 17 000, si
    expect(getPeer(store, 'walker')).toBeDefined()
    expect(PEER_SILENCE_TIMEOUT_MS).toBeLessThan(16_000)
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

  it('une salle de 30 : seuls les 8 plus proches sont montés, les 22 autres ne coûtent qu’une entrée de registre', () => {
    const store = createPeerStore()
    for (let i = 0; i < 29; i++) {
      upsertPeer(store, `p${i}`, 0)
      recordPosition(store, `p${i}`, { x: 29 - i, z: 0, r: 0, m: true }, 0) // p28 le plus proche
    }
    const visible = selectVisiblePeers(store, 0, 0).map((p) => p.id)
    expect(visible).toHaveLength(8)
    expect(visible).toEqual(['p28', 'p27', 'p26', 'p25', 'p24', 'p23', 'p22', 'p21'])
  })

  it('hystérésis : un pair déjà monté garde sa place face à un concurrent presque aussi proche', () => {
    const store = createPeerStore()
    for (const [id, x] of [['a', 10], ['b', 9.5]] as const) {
      upsertPeer(store, id, 0)
      recordPosition(store, id, { x, z: 0, r: 0, m: false }, 0)
    }
    expect(selectVisiblePeers(store, 0, 0, 1).map((p) => p.id)).toEqual(['b']) // sans historique : le plus proche
    expect(selectVisiblePeers(store, 0, 0, 1, new Set(['a'])).map((p) => p.id)).toEqual(['a']) // a est monté : il reste
    // Mais un concurrent nettement plus proche (au moins 20 %) le remplace.
    recordPosition(store, 'b', { x: 5, z: 0, r: 0, m: false }, 1)
    expect(selectVisiblePeers(store, 0, 0, 1, new Set(['a'])).map((p) => p.id)).toEqual(['b'])
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
