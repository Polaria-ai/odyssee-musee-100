import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  countVisitedByWing,
  doorMarkers,
  flagEmoji,
  organizationLabel,
  photoCreditLabel,
  pitchForSpeaker,
  safePhotoUrl,
  safeUrl,
  splitParagraphs,
} from './format'
import type { RoomLayout } from '../types'

describe('flagEmoji', () => {
  it('compose le drapeau à partir d’un code pays ISO', () => {
    expect(flagEmoji('FR')).toBe('🇫🇷')
    expect(flagEmoji('fr')).toBe('🇫🇷')
    expect(flagEmoji('DE')).toBe('🇩🇪')
  })
  it('gère le pseudo-code EU', () => {
    expect(flagEmoji('EU')).toBe('🇪🇺')
  })
  it('renvoie une chaîne vide pour un code invalide', () => {
    expect(flagEmoji('')).toBe('')
    expect(flagEmoji(undefined)).toBe('')
    expect(flagEmoji(null)).toBe('')
    expect(flagEmoji('FRA')).toBe('')
    expect(flagEmoji('1')).toBe('')
  })
})

describe('splitParagraphs', () => {
  it('découpe sur les lignes vides', () => {
    expect(splitParagraphs('Un.\n\nDeux.\n\nTrois.')).toEqual(['Un.', 'Deux.', 'Trois.'])
  })
  it('ignore les espaces superflus et les paragraphes vides', () => {
    expect(splitParagraphs('  Un.  \n\n\n\n  Deux.  ')).toEqual(['Un.', 'Deux.'])
  })
  it('renvoie un tableau vide pour un texte vide ou absent', () => {
    expect(splitParagraphs('')).toEqual([])
    expect(splitParagraphs(undefined)).toEqual([])
    expect(splitParagraphs(null)).toEqual([])
  })
})

describe('safeUrl', () => {
  it('accepte http et https', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com/')
    expect(safeUrl('http://example.com/page')).toBe('http://example.com/page')
  })
  it('refuse les schémas dangereux', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeUrl('vbscript:msgbox(1)')).toBeNull()
  })
  it('refuse les chaînes vides ou mal formées', () => {
    expect(safeUrl('')).toBeNull()
    expect(safeUrl(undefined)).toBeNull()
    expect(safeUrl('not a url')).toBeNull()
  })
})

describe('photoCreditLabel', () => {
  it('retire le préfixe « Photo : » que la fiche ajoute déjà', () => {
    expect(photoCreditLabel('Photo : Exemple, CC BY 4.0, via Wikimedia Commons')).toBe('Exemple, CC BY 4.0, via Wikimedia Commons')
    expect(photoCreditLabel('photo: Exemple')).toBe('Exemple')
  })
  it('laisse intact un crédit sans préfixe', () => {
    expect(photoCreditLabel('  Exemple Média ')).toBe('Exemple Média')
    expect(photoCreditLabel('Photothèque Exemple')).toBe('Photothèque Exemple')
  })
})

describe('safePhotoUrl', () => {
  it('accepte les portraits locaux écrits par l’import', () => {
    expect(safePhotoUrl('/portraits/exemple-a-supprimer.webp')).toBe('/portraits/exemple-a-supprimer.webp')
    expect(safePhotoUrl(' /portraits/exemple.jpg ')).toBe('/portraits/exemple.jpg')
  })
  it('accepte les URL http(s), comme safeUrl', () => {
    expect(safePhotoUrl('https://example.com/p.webp')).toBe('https://example.com/p.webp')
  })
  it('refuse tout autre chemin ou schéma', () => {
    expect(safePhotoUrl('/autre/p.webp')).toBeNull()
    expect(safePhotoUrl('/portraits/../secret.webp')).toBeNull()
    expect(safePhotoUrl('javascript:alert(1)')).toBeNull()
    expect(safePhotoUrl('data:image/png;base64,AAAA')).toBeNull()
    expect(safePhotoUrl(null)).toBeNull()
  })
})

describe('organizationLabel', () => {
  it('affiche l’organisation quand elle est renseignée', () => {
    expect(organizationLabel({ organization: 'Exemple SA', placeholder: false }, 'À dévoiler')).toBe('Exemple SA')
    expect(organizationLabel({ organization: 'Exemple SA', placeholder: true }, 'À dévoiler')).toBe('Exemple SA')
  })
  it('retombe sur le texte localisé pour une fiche d’attente sans organisation', () => {
    expect(organizationLabel({ organization: '', placeholder: true }, 'À dévoiler')).toBe('À dévoiler')
    expect(organizationLabel({ organization: '   ', placeholder: true }, 'À dévoiler')).toBe('À dévoiler')
  })
  it('ne substitue rien pour une fiche non-placeholder sans organisation (cas non attendu)', () => {
    expect(organizationLabel({ organization: '', placeholder: false }, 'À dévoiler')).toBe('')
  })
})

describe('countVisitedByWing', () => {
  it('compte les portraits vus par aile', () => {
    const people = [
      { id: 'a', wing: 'infrastructures' as const },
      { id: 'b', wing: 'infrastructures' as const },
      { id: 'c', wing: 'culture' as const },
    ]
    const visited = { a: 1000 }
    expect(countVisitedByWing(people, visited)).toEqual({
      infrastructures: { seen: 1, total: 2 },
      culture: { seen: 0, total: 1 },
    })
  })
  it('renvoie un objet vide sans personne', () => {
    expect(countVisitedByWing([], {})).toEqual({})
  })
})

describe('doorMarkers', () => {
  const hall: RoomLayout = {
    id: 'hall',
    bounds: { minX: -11, maxX: 11, minZ: -9, maxZ: 9 },
    label: { fr: 'Hall', en: 'Hall' },
    floorColor: '#000',
    wallColor: '#000',
    accentColor: '#000',
  }
  const west: RoomLayout = {
    id: 'infrastructures',
    bounds: { minX: -40, maxX: -11, minZ: -5, maxZ: 5 },
    label: { fr: 'Infrastructures', en: 'Infrastructures' },
    floorColor: '#000',
    wallColor: '#000',
    accentColor: '#000',
  }
  const north: RoomLayout = {
    id: 'industrialisation',
    bounds: { minX: -5, maxX: 5, minZ: -30, maxZ: -9 },
    label: { fr: 'Industrialisation', en: 'Industrialisation' },
    floorColor: '#000',
    wallColor: '#000',
    accentColor: '#000',
  }

  it('place une porte au centre du mur partagé (axe Z pour une aile est/ouest)', () => {
    const markers = doorMarkers([hall, west])
    expect(markers).toEqual([{ x: -11, z: 0, axis: 'z' }])
  })
  it('place une porte au centre du mur partagé (axe X pour une aile nord)', () => {
    const markers = doorMarkers([hall, north])
    expect(markers).toEqual([{ x: 0, z: -9, axis: 'x' }])
  })
  it('ignore une aile absente (répartition 100/0/0) et ne renvoie rien sans hall', () => {
    expect(doorMarkers([hall])).toEqual([])
    expect(doorMarkers([west, north])).toEqual([])
  })
})

describe('contrastRatio', () => {
  it('vaut 1 pour deux couleurs identiques', () => {
    expect(contrastRatio('#4a3728', '#4a3728')).toBeCloseTo(1, 5)
  })
  it('vaut 21 pour noir sur blanc', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })
  it('confirme le badge d’aile (encre sur papier) au-delà du seuil AA (4.5:1)', () => {
    // `.ui-portrait__wing` : var(--ink) sur var(--paper) (src/ui/ui.css, src/styles/tokens.ts).
    expect(contrastRatio('#4a3728', '#fdf1d6')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('pitchForSpeaker', () => {
  it('donne 0.85 pour Rémi Godeau, en français comme en anglais, avec ou sans accent', () => {
    expect(pitchForSpeaker({ fr: 'Rémi Godeau', en: 'Rémi Godeau' })).toBe(0.85)
    expect(pitchForSpeaker({ fr: '', en: 'Rémi Godeau' })).toBe(0.85)
    expect(pitchForSpeaker({ fr: 'Remi Godeau', en: '' })).toBe(0.85)
  })
  it('donne une variation stable et bornée pour un autre orateur', () => {
    const a = pitchForSpeaker({ fr: 'Quelqu’un', en: 'Someone' })
    const b = pitchForSpeaker({ fr: 'Quelqu’un', en: 'Someone' })
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0.95)
    expect(a).toBeLessThanOrEqual(1.05)
  })
})
