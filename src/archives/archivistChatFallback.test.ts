import { describe, expect, it } from 'vitest'
import { ARCHIVIST_NAME } from './archivistScript'
import { archivistChatFallback } from './archivistChatFallback'

const MAX_LINE_LENGTH = 140

const tiers = [
  { name: 'programme non chargé', total: 0, published: 0 },
  { name: 'rien de publié', total: 3, published: 0 },
  { name: 'quelques transcriptions publiées', total: 3, published: 1 },
  { name: 'tout publié', total: 3, published: 3 },
]

const SERVED = [0, 1, 2, 3]

describe('archivistChatFallback (repli du chat de l’Archiviste · IA)', () => {
  it.each(tiers)('$name : bien formé, de l’Archiviste, FR et EN, lignes courtes', ({ total, published }) => {
    for (const served of SERVED) {
      const d = archivistChatFallback({ served, total, published })
      expect(d.speaker).toEqual(ARCHIVIST_NAME)
      expect(d.lines.length).toBeGreaterThanOrEqual(1)
      for (const l of d.lines) {
        expect(l.text.fr.trim().length, `fr vide pour ${d.id}`).toBeGreaterThan(0)
        expect(l.text.en.trim().length, `en vide pour ${d.id}`).toBeGreaterThan(0)
        expect(l.text.fr.length, `fr trop long pour ${d.id}`).toBeLessThanOrEqual(MAX_LINE_LENGTH)
        expect(l.text.en.length, `en trop long pour ${d.id}`).toBeLessThanOrEqual(MAX_LINE_LENGTH)
      }
    }
  })

  it('vouvoie le visiteur : aucun tutoiement en français', () => {
    const tutoiement = /(^|[^\p{L}])(?:(?:tu|toi|ton|ta|tes|te)(?![\p{L}])|t')|-toi(?![\p{L}])/iu
    for (const t of tiers) {
      for (const served of SERVED) {
        const d = archivistChatFallback({ served, total: t.total, published: t.published })
        for (const l of d.lines) expect(l.text.fr, d.id).not.toMatch(tutoiement)
      }
    }
  })

  it("n'affirme rien sur ce qui a été dit : pas de nom d'intervenant·e, pas de guillemets de citation", () => {
    for (const t of tiers) {
      for (const served of SERVED) {
        const d = archivistChatFallback({ served, total: t.total, published: t.published })
        const allText = d.lines.map((l) => `${l.text.fr} ${l.text.en}`).join(' ')
        expect(allText).not.toMatch(/Vautrin|Gorintin|Arnould|Cloix|Fitoussi|Boucher|Menasé|[«»“”]/)
      }
    }
  })

  it('tourne sur les variantes d’un palier et change de palier avec published', () => {
    const ids = (published: number) => new Set(SERVED.map((served) => archivistChatFallback({ served, total: 3, published }).id))
    expect(ids(0).size).toBeGreaterThan(1)
    const all = [...ids(0), ...ids(1), ...ids(3)]
    expect(new Set(all).size).toBe(ids(0).size + ids(1).size + ids(3).size)
  })

  it('programme non chargé (total 0) : traité comme « rien de publié »', () => {
    expect(archivistChatFallback({ served: 0, total: 0, published: 0 }).id).toBe(archivistChatFallback({ served: 0, total: 3, published: 0 }).id)
  })

  it('est déterministe et accepte un compteur quelconque', () => {
    const input = { served: 2, total: 3, published: 1 }
    expect(archivistChatFallback(input)).toEqual(archivistChatFallback(input))
    expect(archivistChatFallback({ served: 1000, total: 3, published: 1 }).lines.length).toBeGreaterThan(0)
  })
})
