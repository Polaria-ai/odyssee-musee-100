import { describe, expect, it } from 'vitest'
import type { AvatarConfig } from '../../types'
import { decodePosition, decodePresence, encodePosition, encodePresence } from './protocol'

const validAvatar: AvatarConfig = {
  name: 'Ada',
  skinTone: '#f5c9a3',
  hairColor: '#3b2a1e',
  outfit: 'tee',
  outfitColor: '#7bc47f',
  accessory: 'none',
}

describe('encodePosition / decodePosition', () => {
  it('arrondit à 2 décimales et encode `moving` en 0/1', () => {
    const wire = encodePosition('v1', 1.23456, -4.5, 0.98765, true)
    expect(wire).toEqual({ i: 'v1', x: 1.23, z: -4.5, r: 0.99, m: 1 })
  })

  it('fait l’aller-retour', () => {
    const wire = encodePosition('v1', 1.2, 3.4, 0.5, false)
    expect(decodePosition(wire)).toEqual({ id: 'v1', sample: { x: 1.2, z: 3.4, r: 0.5, m: false } })
  })

  it.each([null, undefined, 42, 'nope', {}, { i: 'v1' }, { i: 'v1', x: 1, z: 1, r: 1, m: 2 }, { i: '', x: 1, z: 1, r: 1, m: 0 }, { i: 'v1', x: Number.NaN, z: 1, r: 1, m: 0 }])(
    'rejette une charge utile malformée : %j',
    (raw) => {
      expect(decodePosition(raw)).toBeNull()
    },
  )
})

describe('encodePresence / decodePresence', () => {
  it('fait l’aller-retour avec un avatar valide', () => {
    const wire = encodePresence('v1', validAvatar, 1000)
    expect(decodePresence(wire)).toEqual({ id: 'v1', avatar: validAvatar, joinTs: 1000 })
  })

  it('rejette un avatar invalide (sanitizeAvatar échoue)', () => {
    const raw = { id: 'v1', avatar: { ...validAvatar, outfit: 'not-an-outfit' }, joinTs: 1000 }
    expect(decodePresence(raw)).toBeNull()
  })

  it.each([null, 'nope', {}, { id: 'v1', avatar: validAvatar }, { id: '', avatar: validAvatar, joinTs: 1 }])(
    'rejette une charge utile malformée : %j',
    (raw) => {
      expect(decodePresence(raw)).toBeNull()
    },
  )
})
