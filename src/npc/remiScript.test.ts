/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXHIBIT_WINGS } from '../types'
import { REMI_NAME, remiDialogue, type RemiEvent } from './remiScript'
import type { Dialogue } from '../types'

const MAX_LINE_LENGTH = 140

function expectWellFormed(dialogue: Dialogue): void {
  expect(dialogue.speaker).toEqual(REMI_NAME)
  expect(dialogue.lines.length).toBeGreaterThanOrEqual(1)
  for (const l of dialogue.lines) {
    expect(l.text.fr.trim().length, `fr vide pour ${dialogue.id}`).toBeGreaterThan(0)
    expect(l.text.en.trim().length, `en vide pour ${dialogue.id}`).toBeGreaterThan(0)
    expect(l.text.fr.length, `fr trop long pour ${dialogue.id} : "${l.text.fr}"`).toBeLessThanOrEqual(MAX_LINE_LENGTH)
    expect(l.text.en.length, `en trop long pour ${dialogue.id} : "${l.text.en}"`).toBeLessThanOrEqual(MAX_LINE_LENGTH)
  }
}

/** Tous les dialogues atteignables en jeu (chaque palier de progression, chaque variante, avec et sans conseil Archives). */
function reachableDialogues(): Array<{ event: RemiEvent; dialogue: Dialogue }> {
  const events: RemiEvent[] = [{ kind: 'welcome' }, { kind: 'complete' }]
  for (const wing of EXHIBIT_WINGS) events.push({ kind: 'stamp', wing })
  for (const archivesToVisit of [false, true]) {
    for (let stampsCount = 0; stampsCount <= EXHIBIT_WINGS.length; stampsCount++) {
      for (let visitedCount = 0; visitedCount < 6; visitedCount++) {
        events.push({ kind: 'talk', visitedCount, stampsCount, total: 100, archivesToVisit })
      }
    }
  }
  return events.map((event) => ({ event, dialogue: remiDialogue(event) }))
}

describe('remiDialogue', () => {
  it('welcome : une seule bulle bien formée, id stable', () => {
    const d = remiDialogue({ kind: 'welcome' })
    expect(d.id).toBe('welcome')
    expect(d.lines).toHaveLength(1)
    expectWellFormed(d)
  })

  it('welcome : au plus 30 mots et deux phrases dans chaque langue', () => {
    const { fr, en } = remiDialogue({ kind: 'welcome' }).lines[0].text
    for (const text of [fr, en]) {
      const words = text.trim().split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word))
      expect(words.length).toBeLessThanOrEqual(30)
      expect(text.match(/[.!?]/g)?.length ?? 0).toBeLessThanOrEqual(2)
    }
  })

  it('welcome : invite à explorer les portraits, les tampons et les Archives de 2040', () => {
    const { fr, en } = remiDialogue({ kind: 'welcome' }).lines[0].text
    expect(fr).toContain('Musée des 100')
    expect(en).toContain('Museum of the 100')
    expect(fr).toContain('portraits')
    expect(en).toContain('portraits')
    expect(fr).toContain('tampons')
    expect(en).toContain('stamps')
    expect(fr).toContain('Archives de 2040')
    expect(en).toContain('2040 Archives')
  })

  it('complete : au moins une ligne, bien formée, id stable', () => {
    const d = remiDialogue({ kind: 'complete' })
    expect(d.id).toBe('complete')
    expectWellFormed(d)
  })

  describe('stamp', () => {
    it('chaque aile a son propre dialogue de tampon', () => {
      const ids = new Set<string>()
      for (const wing of EXHIBIT_WINGS) {
        const d = remiDialogue({ kind: 'stamp', wing })
        expectWellFormed(d)
        expect(d.id).toContain(wing)
        ids.add(d.id)
      }
      expect(ids.size).toBe(EXHIBIT_WINGS.length)
    })
  })

  describe('talk', () => {
    // Paliers de progression, comme décrit dans le contenu :
    // aucun portrait vu / quelques-uns / 1 ou 2 tampons / trois ailes tamponnées.
    const tiers: Array<{ name: string; visitedCount: number; stampsCount: number }> = [
      { name: 'aucun portrait vu', visitedCount: 0, stampsCount: 0 },
      { name: 'quelques portraits', visitedCount: 4, stampsCount: 0 },
      { name: '1 tampon', visitedCount: 10, stampsCount: 1 },
      { name: '2 tampons', visitedCount: 20, stampsCount: 2 },
      { name: 'trois ailes tamponnées', visitedCount: 40, stampsCount: 3 },
    ]

    it.each(tiers)('$name : au moins une ligne, bien formée', ({ visitedCount, stampsCount }) => {
      const d = remiDialogue({ kind: 'talk', visitedCount, stampsCount, total: 100 })
      expectWellFormed(d)
    })

    it('varie selon la progression : les quatre paliers ne renvoient pas le même dialogue', () => {
      const none = remiDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 0, total: 100 })
      const some = remiDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 0, total: 100 })
      const stamps = remiDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 1, total: 100 })
      const complete = remiDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 3, total: 100 })
      // "aucun vu" et "quelques-uns" ne se distinguent que par visitedCount (0 vs >0) :
      // on vérifie donc chaque palier face aux trois autres, pas les cinq entre eux.
      const zeroVisited = remiDialogue({ kind: 'talk', visitedCount: 0, stampsCount: 0, total: 100 })
      expect(zeroVisited.id).not.toBe(some.id)
      const ids = [some.id, stamps.id, complete.id]
      expect(new Set(ids).size).toBe(ids.length)
      expect(none.id).toBe(some.id) // même palier, même visitedCount : id identique (déterministe)
    })

    it('1 ou 2 tampons partagent le même palier (mêmes variantes), trois tampons en sont distincts', () => {
      const oneStamp = remiDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 1, total: 100 })
      const twoStamps = remiDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 2, total: 100 })
      const complete = remiDialogue({ kind: 'talk', visitedCount: 5, stampsCount: 3, total: 100 })
      expect(oneStamp.id).toBe(twoStamps.id)
      expect(oneStamp.id).not.toBe(complete.id)
    })

    it("varie de façon déterministe à partir de visitedCount, au sein d'un même palier", () => {
      const results = Array.from({ length: 6 }, (_, i) =>
        remiDialogue({ kind: 'talk', visitedCount: i, stampsCount: 0, total: 100 }),
      )
      // Toutes les fiches sont valides...
      results.forEach(expectWellFormed)
      // ...et il existe bien plusieurs variantes différentes (pas une seule répétée).
      const distinctIds = new Set(results.map((d) => d.id))
      expect(distinctIds.size).toBeGreaterThan(1)
    })

    it('est déterministe : même entrée, même sortie', () => {
      const a = remiDialogue({ kind: 'talk', visitedCount: 7, stampsCount: 1, total: 100 })
      const b = remiDialogue({ kind: 'talk', visitedCount: 7, stampsCount: 1, total: 100 })
      expect(a).toEqual(b)
    })

    it('mentionne le nombre de tampons obtenus au palier 1-2 tampons', () => {
      const d = remiDialogue({ kind: 'talk', visitedCount: 0, stampsCount: 1, total: 100 })
      expect(d.lines.some((l) => l.text.fr.includes('1'))).toBe(true)
    })

    describe('archivesToVisit', () => {
      it('absent ou faux : dialogue inchangé, aucune mention de 2040', () => {
        const withoutFlag = remiDialogue({ kind: 'talk', visitedCount: 3, stampsCount: 0, total: 100 })
        const withFalse = remiDialogue({ kind: 'talk', visitedCount: 3, stampsCount: 0, total: 100, archivesToVisit: false })
        expect(withoutFlag).toEqual(withFalse)
        expect(withoutFlag.lines.some((l) => /2040/.test(l.text.fr))).toBe(false)
      })

      it('vrai : ajoute une ligne mentionnant les Archives de 2040, bien formée', () => {
        const base = remiDialogue({ kind: 'talk', visitedCount: 3, stampsCount: 0, total: 100 })
        const withHint = remiDialogue({ kind: 'talk', visitedCount: 3, stampsCount: 0, total: 100, archivesToVisit: true })
        expectWellFormed(withHint)
        expect(withHint.lines.length).toBe(base.lines.length + 1)
        expect(withHint.id).not.toBe(base.id)
        expect(withHint.lines.some((l) => /2040/.test(l.text.fr) && /2040/.test(l.text.en))).toBe(true)
      })
    })
  })
})

// Rémi Godeau est une personne réelle : ces textes sont écrits en son nom (voir l'en-tête de `remiScript.ts`).
// Les garde-fous ci-dessous empêchent qu'une modification y glisse du tutoiement, une opinion, une promesse
// ou un chiffre qu'il n'a pas validés.
describe('textes prêtés à une personne réelle', () => {
  const all = reachableDialogues()
  const lines = all.flatMap(({ dialogue }) => dialogue.lines.map((l) => ({ id: dialogue.id, fr: l.text.fr, en: l.text.en })))

  it('couvre toutes les variantes (accueil, tampons, félicitations, chaque palier de discussion)', () => {
    const ids = new Set(all.map(({ dialogue }) => dialogue.id))
    for (const id of ['welcome', 'complete', 'talk-none-0', 'talk-some-0', 'talk-stamps-0', 'talk-complete-0']) {
      expect(ids.has(id), id).toBe(true)
    }
    expect(lines.length).toBeGreaterThan(30)
  })

  it("a toujours « Rémi Godeau » pour orateur, sans humeur (pas d'expression à animer)", () => {
    for (const { dialogue } of all) {
      expect(dialogue.speaker).toEqual({ fr: 'Rémi Godeau', en: 'Rémi Godeau' })
      for (const l of dialogue.lines) expect(l.mood).toBeUndefined()
    }
  })

  it('vouvoie partout en français', () => {
    const tutoiement =
      /(^|[^\p{L}])(?:(?:tu|toi|ton|ta|tes|te)(?![\p{L}])|t')|-toi(?![\p{L}])|(^|[^\p{L}])(?:reviens|viens|regarde|choisis|glisse|touche|appuie|approche|continue|pense|file|prends|lis|partage|n'oublie|n'hésite|vas-y)(?![\p{L}])/iu
    for (const l of lines) expect(l.fr, `tutoiement dans ${l.id}`).not.toMatch(tutoiement)
    expect(lines.some((l) => /\bvous\b/i.test(l.fr))).toBe(true)
  })

  it('ne formule ni opinion, ni prise de position, ni promesse', () => {
    const frOpinion =
      /j'adore|j'aime|je pense|je crois|je trouve|je suis (?:convaincu|persuadé|fier|ravi)|à mon avis|selon moi|passionnant|incroyable|formidable|magnifique|extraordinaire|fascinant|génial|révolution|incontournable|indispensable|le meilleur|je vous promets|je vous garantis/i
    const enOpinion =
      /\bi (?:love|like|think|believe|find)\b|in my opinion|i(?:'m| am) (?:convinced|proud|thrilled)|amazing|incredible|fascinating|wonderful|awesome|revolution|must-see|essential|\bthe best\b|i promise|i guarantee/i
    for (const l of lines) {
      expect(l.fr, `opinion (FR) dans ${l.id}`).not.toMatch(frOpinion)
      expect(l.en, `opinion (EN) dans ${l.id}`).not.toMatch(enOpinion)
    }
  })

  it('ne cite aucun chiffre hors noms propres (100, 2026, 2040) et nombre de tampons de la partie', () => {
    for (const { event, dialogue } of all) {
      // Seul nombre dynamique admis : le nombre de tampons déjà obtenus, dans la réplique « Déjà N tampon(s) ».
      const stampsCount = event.kind === 'talk' ? String(event.stampsCount) : ''
      for (const l of dialogue.lines) {
        for (const text of [l.text.fr, l.text.en]) {
          let rest = text.replace(/\b(100|2026|2040)\b/g, '')
          if (dialogue.id.startsWith('talk-stamps-0')) rest = rest.replace(stampsCount, '')
          expect(rest, `chiffre non validé dans ${dialogue.id} : "${text}"`).not.toMatch(/\d/)
        }
      }
    }
  })

  it('est intégralement listé dans docs/TEXTES-REMI.md, le document envoyé à Rémi pour validation', () => {
    const doc = readFileSync(resolve(process.cwd(), 'docs/TEXTES-REMI.md'), 'utf8')
    expect(doc).toContain("Textes à faire valider par Rémi Godeau / L'Opinion avant le 6 octobre")
    for (const l of lines) {
      expect(doc.includes(l.fr), `absent de docs/TEXTES-REMI.md (FR, ${l.id}) : ${l.fr}`).toBe(true)
      expect(doc.includes(l.en), `absent de docs/TEXTES-REMI.md (EN, ${l.id}) : ${l.en}`).toBe(true)
    }
  })
})
