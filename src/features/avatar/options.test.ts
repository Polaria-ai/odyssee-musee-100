import { describe, expect, it } from 'vitest'
import {
  ACCESSORIES,
  DEFAULT_AVATAR,
  HAIR_COLORS,
  OUTFITS,
  OUTFIT_COLORS,
  SKIN_TONES,
  defaultVisitorName,
  defaultVisitorNumber,
  isProfaneName,
  randomAppearance,
  resolveDisplayName,
  sanitizeAvatar,
  sanitizeName,
} from './options'

describe('sanitizeName', () => {
  it('coupe à 16 caractères et retire les espaces superflus', () => {
    expect(sanitizeName('  Une personne très bavarde  ')).toBe('Une personne trè')
    expect(sanitizeName('  Une personne très bavarde  ').length).toBeLessThanOrEqual(16)
  })
  it('retire les caractères de contrôle et les chevrons', () => {
    expect(sanitizeName('a<b>c\u0000d')).toBe('abcd')
  })
  it('renvoie une chaîne vide pour une valeur non-string', () => {
    expect(sanitizeName(42)).toBe('')
    expect(sanitizeName(null)).toBe('')
  })
})

describe('sanitizeAvatar', () => {
  it('valide une configuration correcte', () => {
    const result = sanitizeAvatar({ ...DEFAULT_AVATAR, name: 'Ada' })
    expect(result).toEqual({ ...DEFAULT_AVATAR, name: 'Ada' })
  })
  it('rejette une configuration incomplète ou invalide', () => {
    expect(sanitizeAvatar(null)).toBeNull()
    expect(sanitizeAvatar({ ...DEFAULT_AVATAR, outfit: 'nope' })).toBeNull()
    expect(sanitizeAvatar({ ...DEFAULT_AVATAR, skinTone: 'red' })).toBeNull()
  })
})

describe('randomAppearance', () => {
  it('renvoie toujours des valeurs appartenant aux ensembles autorisés', () => {
    for (let i = 0; i < 30; i++) {
      const a = randomAppearance()
      expect(SKIN_TONES).toContain(a.skinTone)
      expect(HAIR_COLORS).toContain(a.hairColor)
      expect(OUTFITS).toContain(a.outfit)
      expect(OUTFIT_COLORS).toContain(a.outfitColor)
      expect(ACCESSORIES).toContain(a.accessory)
    }
  })
})

describe('pseudo par défaut', () => {
  it('est déterministe pour un même visitorId', () => {
    const n1 = defaultVisitorNumber('visitor-abc')
    const n2 = defaultVisitorNumber('visitor-abc')
    expect(n1).toBe(n2)
    expect(n1).toBeGreaterThanOrEqual(0)
    expect(n1).toBeLessThan(1000)
  })
  it('diffère (en général) pour des visitorId différents', () => {
    expect(defaultVisitorNumber('visitor-a')).not.toBe(defaultVisitorNumber('visitor-b'))
  })
  it('formate un pseudo bilingue avec un numéro à 3 chiffres', () => {
    expect(defaultVisitorName('visitor-abc', 'fr')).toMatch(/^Visiteur \d{3}$/)
    expect(defaultVisitorName('visitor-abc', 'en')).toMatch(/^Visitor \d{3}$/)
  })
})

describe('isProfaneName', () => {
  it('détecte un mot injurieux direct', () => {
    expect(isProfaneName('merde')).toBe(true)
    expect(isProfaneName('fuck you')).toBe(true)
  })
  it('détecte le leet basique et les accents', () => {
    expect(isProfaneName('m3rd3')).toBe(true)
    expect(isProfaneName('éncûlé')).toBe(true)
  })
  it('laisse passer un pseudo neutre', () => {
    expect(isProfaneName('Ada Lovelace')).toBe(false)
    expect(isProfaneName('')).toBe(false)
  })
})

describe('resolveDisplayName', () => {
  it('garde un pseudo propre', () => {
    expect(resolveDisplayName('Ada', 'visitor-x', 'fr')).toBe('Ada')
  })
  it('retombe sur le pseudo par défaut si vide', () => {
    expect(resolveDisplayName('', 'visitor-x', 'fr')).toBe(defaultVisitorName('visitor-x', 'fr'))
    expect(resolveDisplayName('   ', 'visitor-x', 'en')).toBe(defaultVisitorName('visitor-x', 'en'))
  })
  it('retombe sur le pseudo par défaut si injurieux', () => {
    expect(resolveDisplayName('putain', 'visitor-x', 'fr')).toBe(defaultVisitorName('visitor-x', 'fr'))
  })
})
