import { describe, expect, it } from 'vitest'
import { flagEmoji, safeUrl, splitParagraphs } from './format'

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
