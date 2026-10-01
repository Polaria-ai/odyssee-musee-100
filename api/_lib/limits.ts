/**
 * Plafonds du chat, tenus EN MÉMOIRE, PAR INSTANCE de la fonction : sur Vercel, plusieurs instances
 * peuvent tourner en parallèle et chacune a ses propres compteurs. C'est un garde-fou « au mieux »
 * contre l'emballement d'un client ou d'un script ; le vrai butoir de dépense est la limite de crédit
 * posée sur la clé OpenRouter (voir `docs/REMI-IA.md`).
 *
 * Trois protections :
 *  - plafond de messages par visiteur (`MAX_MESSAGES_PER_VISITOR`) → `limit_reached` ;
 *  - seau à jetons par couple (IP, visiteur) : un visiteur ne peut pas enchaîner les requêtes ;
 *    chaque téléphone a son propre seau, donc 200 personnes derrière le Wi-Fi de la salle (une seule IP
 *    publique) ne se gênent pas entre elles ;
 *  - seau à jetons par IP, volontairement large : il borne un script qui changerait de `visitorId`
 *    à chaque requête, sans bloquer la salle entière → `rate_limited`.
 *
 * La mémoire est bornée : les entrées inactives sont purgées, et au-delà de `maxEntries` les plus
 * anciennes sont évincées. L'IP n'est jamais conservée en clair (empreinte salée, propre à l'instance).
 */
import { createHash, randomUUID } from 'node:crypto'
import { MAX_MESSAGES_PER_VISITOR } from './config.js'

export interface BucketConfig {
  /** Rafale autorisée : jetons disponibles au repos. */
  capacity: number
  /** Un jeton se recharge toutes les `refillMs` millisecondes. */
  refillMs: number
}

export interface LimiterOptions {
  now?: () => number
  visitorCap?: number
  /** Seau par couple (IP, visiteur) : 1 requête / 2 s, rafale de 3. */
  pair?: BucketConfig
  /** Seau par IP, très large (le Wi-Fi de la salle = une seule IP pour 200 joueurs) : 20 requêtes / s, rafale de 200. */
  ip?: BucketConfig
  /** Entrées conservées au plus par table. */
  maxEntries?: number
  /** Inactivité au-delà de laquelle le compteur d'un visiteur est oublié. */
  visitorIdleMs?: number
  /** Intervalle minimal entre deux purges. */
  purgeEveryMs?: number
}

export interface LimitInput {
  ip: string
  visitorId: string
  /** Messages du visiteur dans l'historique reçu (le nouveau compris). */
  userMessageCount: number
}

export type LimitDecision =
  | { ok: true; refund: () => void }
  | { ok: false; code: 'limit_reached' }
  | { ok: false; code: 'rate_limited'; retryAfterSec: number }

export interface RemiLimiter {
  check(input: LimitInput): LimitDecision
  /** Taille des tables, pour les tests. */
  sizes(): { pair: number; ip: number; visitors: number }
}

interface Bucket {
  tokens: number
  at: number
}
interface Counter {
  count: number
  at: number
}

export const DEFAULT_PAIR_BUCKET: BucketConfig = { capacity: 3, refillMs: 2000 }
export const DEFAULT_IP_BUCKET: BucketConfig = { capacity: 200, refillMs: 50 }

/** Retire `key` puis le réinscrit : l'ordre d'itération d'une `Map` devient l'ordre d'usage (le plus ancien d'abord). */
function touch<V>(map: Map<string, V>, key: string, value: V): void {
  map.delete(key)
  map.set(key, value)
}

/** Seau rechargé à l'instant `t` (créé plein s'il n'existe pas). */
function refilled(map: Map<string, Bucket>, key: string, cfg: BucketConfig, t: number): Bucket {
  const found = map.get(key)
  if (!found) return { tokens: cfg.capacity, at: t }
  const gained = Math.max(0, t - found.at) / cfg.refillMs
  return { tokens: Math.min(cfg.capacity, found.tokens + gained), at: t }
}

function retryAfterSec(bucket: Bucket, cfg: BucketConfig): number {
  return Math.max(1, Math.ceil(((1 - bucket.tokens) * cfg.refillMs) / 1000))
}

export function createRemiLimiter(options: LimiterOptions = {}): RemiLimiter {
  const now = options.now ?? Date.now
  const visitorCap = options.visitorCap ?? MAX_MESSAGES_PER_VISITOR
  const pairCfg = options.pair ?? DEFAULT_PAIR_BUCKET
  const ipCfg = options.ip ?? DEFAULT_IP_BUCKET
  const maxEntries = options.maxEntries ?? 5000
  const visitorIdleMs = options.visitorIdleMs ?? 3 * 60 * 60 * 1000
  const purgeEveryMs = options.purgeEveryMs ?? 60_000
  const salt = randomUUID()

  const pairBuckets = new Map<string, Bucket>()
  const ipBuckets = new Map<string, Bucket>()
  const visitors = new Map<string, Counter>()
  let lastPurge = now()

  const fingerprint = (ip: string) => createHash('sha256').update(salt).update(ip).digest('hex').slice(0, 16)

  /** Un seau inactif depuis `capacity × refillMs` est plein : le supprimer ne change rien. */
  function purge(t: number): void {
    const tables: [Map<string, { at: number }>, number][] = [
      [pairBuckets, pairCfg.capacity * pairCfg.refillMs],
      [ipBuckets, ipCfg.capacity * ipCfg.refillMs],
      [visitors, visitorIdleMs],
    ]
    for (const [table, idleMs] of tables) {
      // L'ordre d'itération est l'ordre d'usage : on s'arrête à la première entrée encore active.
      for (const [key, entry] of table) {
        if (t - entry.at < idleMs) break
        table.delete(key)
      }
      // Trop d'entrées actives (identifiants forgés) : on évince les plus anciennes.
      for (const key of table.keys()) {
        if (table.size <= maxEntries) break
        table.delete(key)
      }
    }
    lastPurge = t
  }

  return {
    check({ ip, visitorId, userMessageCount }) {
      const t = now()
      if (t - lastPurge >= purgeEveryMs || pairBuckets.size > maxEntries || visitors.size > maxEntries) purge(t)

      const counter = visitors.get(visitorId)
      const sent = counter?.count ?? 0
      if (sent >= visitorCap || userMessageCount > visitorCap) return { ok: false, code: 'limit_reached' }

      const ipKey = fingerprint(ip)
      const pairKey = `${ipKey}:${visitorId}`
      const pair = refilled(pairBuckets, pairKey, pairCfg, t)
      const ipBucket = refilled(ipBuckets, ipKey, ipCfg, t)

      if (pair.tokens < 1 || ipBucket.tokens < 1) {
        // Le temps écoulé est comptabilisé même en cas de refus ; aucun jeton n'est dépensé.
        touch(pairBuckets, pairKey, pair)
        touch(ipBuckets, ipKey, ipBucket)
        const wait = Math.max(pair.tokens < 1 ? retryAfterSec(pair, pairCfg) : 0, ipBucket.tokens < 1 ? retryAfterSec(ipBucket, ipCfg) : 0)
        return { ok: false, code: 'rate_limited', retryAfterSec: wait }
      }

      pair.tokens -= 1
      ipBucket.tokens -= 1
      touch(pairBuckets, pairKey, pair)
      touch(ipBuckets, ipKey, ipBucket)
      touch(visitors, visitorId, { count: sent + 1, at: t })

      let refunded = false
      return {
        ok: true,
        // Rend le message au visiteur quand OpenRouter n'a rien répondu (pas sa faute). Les jetons de
        // débit, eux, restent dépensés : un échec ne doit pas donner de requêtes gratuites.
        refund() {
          if (refunded) return
          refunded = true
          const current = visitors.get(visitorId)
          if (current && current.count > 0) current.count -= 1
        },
      }
    },
    sizes: () => ({ pair: pairBuckets.size, ip: ipBuckets.size, visitors: visitors.size }),
  }
}

/** IP du client telle que Vercel la transmet (en-têtes posés par la plateforme, non falsifiables). */
export function clientIp(headers: Headers): string {
  const direct = headers.get('x-vercel-forwarded-for') ?? headers.get('x-real-ip')
  if (direct) return direct.split(',')[0].trim() || 'unknown'
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim() || 'unknown'
  return 'unknown'
}
