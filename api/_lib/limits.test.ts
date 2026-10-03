// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_MESSAGES_PER_VISITOR } from './config.js'
import { clientIp, createRemiLimiter } from './limits.js'

function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms: number) => void (t += ms) }
}

const call = (ip: string, visitorId: string, userMessageCount = 1) => ({ ip, visitorId, userMessageCount })
const callAs = (persona: 'remi' | 'archiviste', ip: string, visitorId: string, userMessageCount = 1) => ({ ip, visitorId, persona, userMessageCount })

describe('plafond de débit par (IP, visiteur)', () => {
  it('accepte une rafale de 3, refuse la 4e avec le délai d’attente, puis recharge un jeton toutes les 2 s', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now })
    for (let i = 0; i < 3; i += 1) expect(limiter.check(call('1.1.1.1', 'v1')).ok).toBe(true)
    expect(limiter.check(call('1.1.1.1', 'v1'))).toEqual({ ok: false, code: 'rate_limited', retryAfterSec: 2 })
    c.advance(1000)
    expect(limiter.check(call('1.1.1.1', 'v1'))).toEqual({ ok: false, code: 'rate_limited', retryAfterSec: 1 })
    c.advance(1000)
    expect(limiter.check(call('1.1.1.1', 'v1')).ok).toBe(true)
    expect(limiter.check(call('1.1.1.1', 'v1')).ok).toBe(false)
  })

  it('un refus ne dépense aucun jeton : la recharge reste régulière', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now })
    for (let i = 0; i < 3; i += 1) limiter.check(call('1.1.1.1', 'v1'))
    for (let i = 0; i < 10; i += 1) expect(limiter.check(call('1.1.1.1', 'v1')).ok).toBe(false)
    c.advance(2000)
    expect(limiter.check(call('1.1.1.1', 'v1')).ok).toBe(true)
  })

  it('deux visiteurs derrière la même IP (Wi-Fi de la salle) ne se gênent pas', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now })
    for (let i = 0; i < 3; i += 1) limiter.check(call('9.9.9.9', 'visiteur-a'))
    expect(limiter.check(call('9.9.9.9', 'visiteur-a')).ok).toBe(false)
    expect(limiter.check(call('9.9.9.9', 'visiteur-b')).ok).toBe(true)
  })

  it('le seau par IP arrête un script qui change d’identifiant à chaque requête', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now, ip: { capacity: 5, refillMs: 1000 } })
    for (let i = 0; i < 5; i += 1) expect(limiter.check(call('6.6.6.6', `forge-${i}`)).ok).toBe(true)
    expect(limiter.check(call('6.6.6.6', 'forge-5'))).toEqual({ ok: false, code: 'rate_limited', retryAfterSec: 1 })
    expect(limiter.check(call('7.7.7.7', 'forge-6')).ok).toBe(true) // une autre IP n'est pas touchée
  })

  it('le seau par IP par défaut laisse passer 200 visiteurs d’une même IP qui écrivent tous en même temps, et plus encore', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now })
    let refused = 0
    for (let i = 0; i < 200; i += 1) if (!limiter.check(call('203.0.113.1', `visiteur-${i}`)).ok) refused += 1 // tous dans la même seconde
    expect(refused).toBe(0)
    for (let i = 0; i < 600; i += 1) {
      c.advance(50) // puis 20 requêtes par seconde pendant 30 s
      if (!limiter.check(call('203.0.113.1', `suite-${i}`)).ok) refused += 1
    }
    expect(refused).toBe(0)
  })
})

describe('plafond de messages par visiteur', () => {
  it(`refuse en limit_reached après ${MAX_MESSAGES_PER_VISITOR} messages acceptés`, () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now })
    for (let i = 0; i < MAX_MESSAGES_PER_VISITOR; i += 1) {
      expect(limiter.check(call('1.1.1.1', 'bavard')).ok).toBe(true)
      c.advance(2000)
    }
    expect(limiter.check(call('1.1.1.1', 'bavard'))).toEqual({ ok: false, code: 'limit_reached' })
    expect(limiter.check(call('1.1.1.1', 'autre')).ok).toBe(true)
  })

  it('refuse aussi quand l’historique reçu compte déjà plus de messages du visiteur que le plafond', () => {
    const limiter = createRemiLimiter()
    expect(limiter.check(call('1.1.1.1', 'v1', MAX_MESSAGES_PER_VISITOR + 1))).toEqual({ ok: false, code: 'limit_reached' })
    expect(limiter.check(call('1.1.1.1', 'v1', MAX_MESSAGES_PER_VISITOR)).ok).toBe(true)
  })

  it('rend le message au visiteur quand la requête échoue en amont, une seule fois', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now, visitorCap: 2 })
    const first = limiter.check(call('1.1.1.1', 'v1'))
    expect(first.ok).toBe(true)
    c.advance(2000)
    expect(limiter.check(call('1.1.1.1', 'v1')).ok).toBe(true)
    c.advance(2000)
    expect(limiter.check(call('1.1.1.1', 'v1'))).toEqual({ ok: false, code: 'limit_reached' })
    if (first.ok) {
      first.refund()
      first.refund() // sans effet supplémentaire
    }
    expect(limiter.check(call('1.1.1.1', 'v1')).ok).toBe(true)
    c.advance(2000)
    expect(limiter.check(call('1.1.1.1', 'v1'))).toEqual({ ok: false, code: 'limit_reached' })
  })

  it('le plafond passe avant le débit : pas de jeton dépensé pour un refus définitif', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now, visitorCap: 1 })
    expect(limiter.check(call('1.1.1.1', 'v1')).ok).toBe(true)
    expect(limiter.check(call('1.1.1.1', 'v1'))).toEqual({ ok: false, code: 'limit_reached' })
  })
})

describe('mémoire bornée', () => {
  it('n’inscrit jamais plus de maxEntries entrées par table, même avec des identifiants forgés', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now, maxEntries: 50 })
    for (let i = 0; i < 500; i += 1) {
      limiter.check(call(`10.0.${i % 250}.${i % 7}`, `forge-${i}`))
      c.advance(10)
    }
    const sizes = limiter.sizes()
    expect(sizes.pair).toBeLessThanOrEqual(51)
    expect(sizes.visitors).toBeLessThanOrEqual(51)
    expect(sizes.ip).toBeLessThanOrEqual(51)
  })

  it('purge les entrées inactives', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now, purgeEveryMs: 1000, visitorIdleMs: 60_000 })
    for (let i = 0; i < 20; i += 1) limiter.check(call(`10.1.0.${i}`, `v-${i}`))
    expect(limiter.sizes()).toEqual({ pair: 20, ip: 20, visitors: 20 })
    c.advance(30_000)
    limiter.check(call('10.2.0.1', 'recent')) // déclenche la purge : seaux inactifs oubliés, compteurs conservés
    expect(limiter.sizes()).toEqual({ pair: 1, ip: 1, visitors: 21 })
    c.advance(120_000)
    limiter.check(call('10.2.0.2', 'recent-2'))
    expect(limiter.sizes().visitors).toBe(1)
  })

  it('un visiteur évincé repart de zéro sans erreur', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now, maxEntries: 3 })
    for (let i = 0; i < 10; i += 1) limiter.check(call('2.2.2.2', `v-${i}`))
    expect(limiter.check(call('2.2.2.2', 'v-0')).ok).toBe(true)
  })
})

describe('clientIp', () => {
  it('préfère les en-têtes posés par Vercel, puis x-forwarded-for, sinon « unknown »', () => {
    expect(clientIp(new Headers({ 'x-vercel-forwarded-for': '203.0.113.5', 'x-forwarded-for': '1.2.3.4' }))).toBe('203.0.113.5')
    expect(clientIp(new Headers({ 'x-real-ip': '203.0.113.6' }))).toBe('203.0.113.6')
    expect(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }))).toBe('198.51.100.1')
    expect(clientIp(new Headers())).toBe('unknown')
  })
})

describe('comptés séparément par persona', () => {
  it('sans persona, c’est Rémi : les mêmes compteurs que persona remi', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now, visitorCap: 2, pair: { capacity: 10, refillMs: 1 } })
    expect(limiter.check(call('1.1.1.1', 'v1')).ok).toBe(true)
    expect(limiter.check(callAs('remi', '1.1.1.1', 'v1')).ok).toBe(true)
    expect(limiter.check(call('1.1.1.1', 'v1'))).toEqual({ ok: false, code: 'limit_reached' })
  })

  it('le plafond de messages de Rémi n’entame pas celui de l’Archiviste, et inversement', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now, visitorCap: 2, pair: { capacity: 10, refillMs: 1 } })
    for (let i = 0; i < 2; i += 1) expect(limiter.check(callAs('remi', '1.1.1.1', 'v1')).ok).toBe(true)
    expect(limiter.check(callAs('remi', '1.1.1.1', 'v1'))).toEqual({ ok: false, code: 'limit_reached' })
    for (let i = 0; i < 2; i += 1) expect(limiter.check(callAs('archiviste', '1.1.1.1', 'v1')).ok).toBe(true)
    expect(limiter.check(callAs('archiviste', '1.1.1.1', 'v1'))).toEqual({ ok: false, code: 'limit_reached' })
  })

  it('le débit est compté par persona : la rafale de Rémi ne retarde pas l’Archiviste', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now })
    for (let i = 0; i < 3; i += 1) expect(limiter.check(callAs('remi', '1.1.1.1', 'v1')).ok).toBe(true)
    expect(limiter.check(callAs('remi', '1.1.1.1', 'v1')).ok).toBe(false)
    expect(limiter.check(callAs('archiviste', '1.1.1.1', 'v1')).ok).toBe(true)
  })

  it('le seau par IP est lui aussi propre à chaque persona', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now, ip: { capacity: 2, refillMs: 1000 } })
    expect(limiter.check(callAs('remi', '6.6.6.6', 'a')).ok).toBe(true)
    expect(limiter.check(callAs('remi', '6.6.6.6', 'b')).ok).toBe(true)
    expect(limiter.check(callAs('remi', '6.6.6.6', 'c')).ok).toBe(false)
    expect(limiter.check(callAs('archiviste', '6.6.6.6', 'c')).ok).toBe(true)
  })

  it('un message rendu après un échec du fournisseur est rendu à la bonne persona', () => {
    const c = clock()
    const limiter = createRemiLimiter({ now: c.now, visitorCap: 1, pair: { capacity: 10, refillMs: 1 } })
    const decision = limiter.check(callAs('archiviste', '1.1.1.1', 'v1'))
    expect(decision.ok).toBe(true)
    if (decision.ok) decision.refund()
    expect(limiter.check(callAs('archiviste', '1.1.1.1', 'v1')).ok).toBe(true)
  })
})
