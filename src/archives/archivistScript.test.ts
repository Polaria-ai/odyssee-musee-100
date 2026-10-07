import { describe, expect, it } from 'vitest'
import type { Dialogue } from '../types'
import { ARCHIVIST_NAME, archivistDialogue } from './archivistScript'

const MAX_LINE_LENGTH = 140

function expectWellFormed(dialogue: Dialogue): void {
  expect(dialogue.speaker).toEqual(ARCHIVIST_NAME)
  expect(dialogue.lines.length).toBeGreaterThanOrEqual(1)
  for (const l of dialogue.lines) {
    expect(l.text.fr.trim().length, `fr vide pour ${dialogue.id}`).toBeGreaterThan(0)
    expect(l.text.en.trim().length, `en vide pour ${dialogue.id}`).toBeGreaterThan(0)
    expect(l.text.fr.length, `fr trop long pour ${dialogue.id} : "${l.text.fr}"`).toBeLessThanOrEqual(MAX_LINE_LENGTH)
    expect(l.text.en.length, `en trop long pour ${dialogue.id} : "${l.text.en}"`).toBeLessThanOrEqual(MAX_LINE_LENGTH)
  }
}

describe('archivistDialogue', () => {
  it('welcome : plusieurs lignes, bien formées', () => {
    const d = archivistDialogue({ kind: 'welcome' })
    expect(d.id).toBe('welcome')
    expect(d.lines.length).toBeGreaterThanOrEqual(4)
    expectWellFormed(d)
  })

  it('welcome : ne prétend rien sur le contenu de la soirée (pas de vrai nom, pas de citation)', () => {
    const d = archivistDialogue({ kind: 'welcome' })
    const allText = d.lines.map((l) => `${l.text.fr} ${l.text.en}`).join(' ')
    // Aucun nom propre d'intervenant·e connu ne doit apparaître ici : l'Archiviste ne sait rien
    // encore, il décrit seulement le principe des Archives.
    expect(allText).not.toMatch(/Vautrin|Gorintin|Arnould|Cloix/)
  })

  it('welcome : humeurs variées (au moins deux distinctes)', () => {
    const d = archivistDialogue({ kind: 'welcome' })
    const moods = new Set(d.lines.map((l) => l.mood))
    expect(moods.size).toBeGreaterThanOrEqual(2)
  })

  it('l’accueil présente les bulles publiées et leur passage source sans annoncer une future relecture', () => {
    const welcome = archivistDialogue({ kind: 'welcome' })
    const first = archivistDialogue({ kind: 'firstVisit' })
    const text = [...welcome.lines, ...first.lines].map((line) => `${line.text.fr} ${line.text.en}`).join(' ')
    expect(text).toMatch(/idées clés publiées/)
    expect(text).toMatch(/passage exact/)
    expect(text).not.toMatch(/attendent chacune|waiting for a panel transcript|relecture|after review|will show/i)
  })

  it('firstVisit : courte, bien formée, id stable', () => {
    const d = archivistDialogue({ kind: 'firstVisit' })
    expect(d.id).toBe('firstVisit')
    expectWellFormed(d)
  })

  it('stampAwarded : bien formée, id stable', () => {
    const d = archivistDialogue({ kind: 'stampAwarded' })
    expect(d.id).toBe('stampAwarded')
    expectWellFormed(d)
  })

  describe('talk', () => {
    const tiers: Array<{ name: string; consulted: number; total: number; published: number }> = [
      { name: 'programme non chargé', consulted: 0, total: 0, published: 0 },
      { name: 'rien de publié', consulted: 0, total: 3, published: 0 },
      { name: 'quelques transcriptions publiées', consulted: 2, total: 3, published: 1 },
      { name: 'tout publié', consulted: 3, total: 3, published: 3 },
    ]

    it.each(tiers)('$name : au moins une ligne, bien formée', ({ consulted, total, published }) => {
      const d = archivistDialogue({ kind: 'talk', consulted, total, published })
      expectWellFormed(d)
    })

    it("n'affirme jamais rien sur ce qui a été dit : pas de citation, pas de nom d'intervenant·e", () => {
      for (const t of tiers) {
        const d = archivistDialogue({ kind: 'talk', ...t })
        const allText = d.lines.map((l) => `${l.text.fr} ${l.text.en}`).join(' ')
        expect(allText).not.toMatch(/Vautrin|Gorintin|Arnould|Cloix|Fitoussi|Boucher|Menasé/)
      }
    })

    it('varie selon published : rien / partiel / tout ne renvoient pas le même dialogue', () => {
      const empty = archivistDialogue({ kind: 'talk', consulted: 3, total: 3, published: 0 })
      const partial = archivistDialogue({ kind: 'talk', consulted: 3, total: 3, published: 1 })
      const full = archivistDialogue({ kind: 'talk', consulted: 3, total: 3, published: 3 })
      const ids = [empty.id, partial.id, full.id]
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('programme non chargé (total 0) : traité comme "rien de publié"', () => {
      const notLoaded = archivistDialogue({ kind: 'talk', consulted: 0, total: 0, published: 0 })
      const emptyProgram = archivistDialogue({ kind: 'talk', consulted: 0, total: 3, published: 0 })
      expect(notLoaded.id).toBe(emptyProgram.id)
    })

    it('varie de façon déterministe à partir de consulted, au sein d’un même palier', () => {
      const results = Array.from({ length: 6 }, (_, i) =>
        archivistDialogue({ kind: 'talk', consulted: i, total: 3, published: 0 }),
      )
      results.forEach(expectWellFormed)
      const distinctIds = new Set(results.map((d) => d.id))
      expect(distinctIds.size).toBeGreaterThan(1)
    })

    it('est déterministe : même entrée, même sortie', () => {
      const a = archivistDialogue({ kind: 'talk', consulted: 2, total: 3, published: 1 })
      const b = archivistDialogue({ kind: 'talk', consulted: 2, total: 3, published: 1 })
      expect(a).toEqual(b)
    })
  })
})
