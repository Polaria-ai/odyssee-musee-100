import { describe, expect, it } from 'vitest'
import { EXHIBIT_WINGS } from '../types'
import { MINERVE_NAME, minerveDialogue } from './minerveScript'
import type { Dialogue } from '../types'

const MAX_LINE_LENGTH = 140

function expectWellFormed(dialogue: Dialogue): void {
  expect(dialogue.speaker).toEqual(MINERVE_NAME)
  expect(dialogue.lines.length).toBeGreaterThanOrEqual(1)
  for (const l of dialogue.lines) {
    expect(l.text.fr.trim().length, `fr vide pour ${dialogue.id}`).toBeGreaterThan(0)
    expect(l.text.en.trim().length, `en vide pour ${dialogue.id}`).toBeGreaterThan(0)
    expect(l.text.fr.length, `fr trop long pour ${dialogue.id} : "${l.text.fr}"`).toBeLessThanOrEqual(MAX_LINE_LENGTH)
    expect(l.text.en.length, `en trop long pour ${dialogue.id} : "${l.text.en}"`).toBeLessThanOrEqual(MAX_LINE_LENGTH)
  }
}

describe('minerveDialogue', () => {
  it('welcome : au moins une ligne, bien formée', () => {
    const d = minerveDialogue({ kind: 'welcome' })
    expect(d.id).toBe('welcome')
    expect(d.lines.length).toBeGreaterThanOrEqual(5)
    expect(d.lines.length).toBeLessThanOrEqual(8)
    expectWellFormed(d)
  })

  it('welcome : mentionne la Porte de 2040 / les Archives', () => {
    const d = minerveDialogue({ kind: 'welcome' })
    expect(d.lines.some((l) => /2040/.test(l.text.fr))).toBe(true)
    expect(d.lines.some((l) => /2040/.test(l.text.en))).toBe(true)
  })

  it('welcome : humeurs variées (au moins deux distinctes)', () => {
    const d = minerveDialogue({ kind: 'welcome' })
    const moods = new Set(d.lines.map((l) => l.mood))
    expect(moods.size).toBeGreaterThanOrEqual(2)
  })

  it('complete : au moins une ligne, bien formée, id stable', () => {
    const d = minerveDialogue({ kind: 'complete' })
    expect(d.id).toBe('complete')
    expectWellFormed(d)
  })

  describe('stamp', () => {
    it('chaque aile a son propre dialogue de tampon', () => {
      const ids = new Set<string>()
      for (const wing of EXHIBIT_WINGS) {
        const d = minerveDialogue({ kind: 'stamp', wing })
        expectWellFormed(d)
        expect(d.id).toContain(wing)
        ids.add(d.id)
      }
      expect(ids.size).toBe(EXHIBIT_WINGS.length)
    })
  })

  describe('talk', () => {
    // Paliers de progression, comme décrit dans le contenu :
    // aucun portrait vu / quelques-uns / 1 ou 2 tampons / carte complète.
    const tiers: Array<{ name: string; visitedCount: number; stampsCount: number }> = [
      { name: 'aucun portrait vu', visitedCount: 0, stampsCount: 0 },
      { name: 'quelques portraits', visitedCount: 4, stampsCount: 0 },
      { name: '1 tampon', visitedCount: 10, stampsCount: 1 },
      { name: '2 tampons', visitedCount: 20, stampsCount: 2 },
      { name: 'carte complète', visitedCount: 40, stampsCount: 3 },
    ]

    it.each(tiers)('$name : au moins une ligne, bien formée', ({ visitedCount, stampsCount }) => {
      const d = minerveDialogue({ kind: 'talk', visitedCount, stampsCount, total: 100 })
      expectWellFormed(d)
    })

    it('varie selon la progression : les quatre paliers ne renvoient pas le même dialogue', () => {
      const none = minerveDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 0, total: 100 })
      const some = minerveDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 0, total: 100 })
      const stamps = minerveDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 1, total: 100 })
      const complete = minerveDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 3, total: 100 })
      // "aucun vu" et "quelques-uns" ne se distinguent que par visitedCount (0 vs >0) :
      // on vérifie donc chaque palier face aux trois autres, pas les cinq entre eux.
      const zeroVisited = minerveDialogue({ kind: 'talk', visitedCount: 0, stampsCount: 0, total: 100 })
      expect(zeroVisited.id).not.toBe(some.id)
      const ids = [some.id, stamps.id, complete.id]
      expect(new Set(ids).size).toBe(ids.length)
      expect(none.id).toBe(some.id) // même palier, même visitedCount : id identique (déterministe)
    })

    it('1 ou 2 tampons partagent le même palier (mêmes variantes), carte complète en est distincte', () => {
      const oneStamp = minerveDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 1, total: 100 })
      const twoStamps = minerveDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 2, total: 100 })
      const complete = minerveDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 3, total: 100 })
      expect(oneStamp.id).toBe(twoStamps.id)
      expect(oneStamp.id).not.toBe(complete.id)
    })

    it('varie de façon déterministe à partir de visitedCount, au sein d\'un même palier', () => {
      const results = Array.from({ length: 6 }, (_, i) =>
        minerveDialogue({ kind: 'talk', visitedCount: i, stampsCount: 0, total: 100 }),
      )
      // Toutes les fiches sont valides...
      results.forEach(expectWellFormed)
      // ...et il existe bien plusieurs variantes différentes (pas une seule répétée).
      const distinctIds = new Set(results.map((d) => d.id))
      expect(distinctIds.size).toBeGreaterThan(1)
    })

    it('est déterministe : même entrée, même sortie', () => {
      const a = minerveDialogue({ kind: 'talk', visitedCount: 7, stampsCount: 1, total: 100 })
      const b = minerveDialogue({ kind: 'talk', visitedCount: 7, stampsCount: 1, total: 100 })
      expect(a).toEqual(b)
    })

    it('mentionne le nombre de tampons obtenus au palier 1-2 tampons', () => {
      const d = minerveDialogue({ kind: 'talk', visitedCount: 0, stampsCount: 1, total: 100 })
      expect(d.lines.some((l) => l.text.fr.includes('1'))).toBe(true)
    })

    describe('archivesToVisit', () => {
      it('absent ou faux : dialogue inchangé, aucune mention de 2040', () => {
        const withoutFlag = minerveDialogue({ kind: 'talk', visitedCount: 3, stampsCount: 0, total: 100 })
        const withFalse = minerveDialogue({ kind: 'talk', visitedCount: 3, stampsCount: 0, total: 100, archivesToVisit: false })
        expect(withoutFlag).toEqual(withFalse)
        expect(withoutFlag.lines.some((l) => /2040/.test(l.text.fr))).toBe(false)
      })

      it('vrai : ajoute une ligne mentionnant les Archives de 2040, bien formée', () => {
        const base = minerveDialogue({ kind: 'talk', visitedCount: 3, stampsCount: 0, total: 100 })
        const withHint = minerveDialogue({ kind: 'talk', visitedCount: 3, stampsCount: 0, total: 100, archivesToVisit: true })
        expectWellFormed(withHint)
        expect(withHint.lines.length).toBe(base.lines.length + 1)
        expect(withHint.id).not.toBe(base.id)
        expect(withHint.lines.some((l) => /2040/.test(l.text.fr) && /2040/.test(l.text.en))).toBe(true)
      })
    })
  })
})
