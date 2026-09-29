import { describe, expect, it } from 'vitest'
import { decodePosition, decodePresence, encodePosition, encodePresence } from './protocol'

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
  it('fait l’aller-retour : identité et date d’arrivée, rien d’autre (plus d’avatar sur le réseau)', () => {
    const wire = encodePresence('v1', 1000)
    expect(wire).toEqual({ id: 'v1', joinTs: 1000 })
    expect(decodePresence(wire)).toEqual({ id: 'v1', joinTs: 1000 })
  })

  it('accepte et ignore l’avatar d’un client d’une version précédente (compatibilité de lecture)', () => {
    const legacyAvatar = { name: 'Ada', skinTone: '#f5c9a3', hairColor: '#3b2a1e', outfit: 'tee', outfitColor: '#7bc47f', accessory: 'none' }
    expect(decodePresence({ id: 'v1', avatar: legacyAvatar, joinTs: 1000 })).toEqual({ id: 'v1', joinTs: 1000 })
  })

  it.each([
    ['un avatar malformé', { outfit: 'not-an-outfit' }],
    ['un avatar qui n’est pas un objet', 'Ada'],
    ['un avatar nul', null],
  ])('ne rejette pas la présence à cause de %s : il n’est jamais lu', (_label, avatar) => {
    expect(decodePresence({ id: 'v1', avatar, joinTs: 1000 })).toEqual({ id: 'v1', joinTs: 1000 })
  })

  it('ne recopie aucun champ inconnu dans le message décodé', () => {
    const decoded = decodePresence({ id: 'v1', avatar: { name: '<b>x</b>' }, joinTs: 5, extra: 'x' })
    expect(Object.keys(decoded ?? {}).sort()).toEqual(['id', 'joinTs'])
  })

  it.each([null, 'nope', {}, { id: 'v1' }, { id: '', joinTs: 1 }, { id: 'v1', joinTs: Number.NaN }, { id: 42, joinTs: 1 }])(
    'rejette une charge utile malformée : %j',
    (raw) => {
      expect(decodePresence(raw)).toBeNull()
    },
  )
})
