/**
 * Format des messages échangés sur le canal Realtime, et leur décodage défensif : tout ce qui
 * arrive par le réseau (broadcast ou présence) vient d'un autre visiteur et n'est pas fiable —
 * on ne fait jamais confiance à sa forme.
 */
import type { AvatarConfig } from '../../types'
import { sanitizeAvatar } from '../avatar/options'
import { round2, type PositionSample } from './peers'

export const POSITION_EVENT = 'pos'

/** Charge utile minimale diffusée par broadcast, arrondie à 2 décimales, `m` en 0/1. */
export interface PositionWireMessage {
  /** Identifiant de l'émetteur (visitorId). */
  i: string
  x: number
  z: number
  r: number
  m: 0 | 1
}

export function encodePosition(id: string, x: number, z: number, rotY: number, moving: boolean): PositionWireMessage {
  return { i: id, x: round2(x), z: round2(z), r: round2(rotY), m: moving ? 1 : 0 }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Décode une charge utile réseau non fiable en `{ id, sample }`. `null` si malformée. */
export function decodePosition(raw: unknown): { id: string; sample: PositionSample } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.i !== 'string' || !r.i) return null
  if (!isFiniteNumber(r.x) || !isFiniteNumber(r.z) || !isFiniteNumber(r.r)) return null
  if (r.m !== 0 && r.m !== 1) return null
  return { id: r.i, sample: { x: r.x, z: r.z, r: r.r, m: r.m === 1 } }
}

/** Charge utile trackée via `presence.track` : identité + avatar nettoyé + date d'arrivée en salle. */
export interface PresenceWireMessage {
  id: string
  avatar: AvatarConfig
  joinTs: number
}

export function encodePresence(id: string, avatar: AvatarConfig, joinTs: number): PresenceWireMessage {
  return { id, avatar, joinTs }
}

/** Décode une entrée de présence non fiable. `null` si malformée (avatar rejeté par `sanitizeAvatar`). */
export function decodePresence(raw: unknown): PresenceWireMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id) return null
  if (!isFiniteNumber(r.joinTs)) return null
  const avatar = sanitizeAvatar(r.avatar)
  if (!avatar) return null
  return { id: r.id, avatar, joinTs: r.joinTs }
}
