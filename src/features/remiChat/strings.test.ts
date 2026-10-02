/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { strings } from './strings'

// Ces phrases sont prononcées au nom de Rémi Godeau, une personne réelle (voir l'en-tête de `strings.ts`) :
// mêmes garde-fous que `src/npc/remiScript.test.ts`.
const SPOKEN = ['greeting', 'fallbackPreface', 'rateLimited', 'limitReached', 'badRequest'] as const

describe('phrases du chat prononcées au nom de Rémi', () => {
  it('sont intégralement listées dans docs/TEXTES-REMI.md, le document envoyé à Rémi pour validation', () => {
    const doc = readFileSync(resolve(process.cwd(), 'docs/TEXTES-REMI.md'), 'utf8')
    for (const key of SPOKEN) {
      expect(doc.includes(strings[key].fr), `absent de docs/TEXTES-REMI.md (FR, ${key})`).toBe(true)
      expect(doc.includes(strings[key].en), `absent de docs/TEXTES-REMI.md (EN, ${key})`).toBe(true)
    }
  })

  it('vouvoient le visiteur en français, sans tutoiement', () => {
    const tutoiement = /(^|[^\p{L}])(?:(?:tu|toi|ton|ta|tes|te)(?![\p{L}])|t')|-toi(?![\p{L}])/iu
    for (const key of SPOKEN) expect(strings[key].fr, key).not.toMatch(tutoiement)
    expect(strings.greeting.fr).toMatch(/\bvos\b/i)
    expect(strings.limitReached.fr).toMatch(/\bvotre\b/i)
    expect(strings.badRequest.fr).toMatch(/\bvous\b/i)
  })

  it('ne formulent ni opinion, ni promesse, ni chiffre', () => {
    const opinion = /j'adore|je pense|je crois|je trouve|à mon avis|selon moi|incroyable|formidable|je vous promets|je vous garantis/i
    for (const key of SPOKEN) {
      for (const lang of ['fr', 'en'] as const) {
        expect(strings[key][lang], `${key}.${lang}`).not.toMatch(opinion)
        // Seuls nombres admis : les noms propres « 100 », « 2026 » et « 2040 » (comme dans `remiScript.ts`).
        expect(strings[key][lang].replace(/\b(100|2026|2040)\b/g, ''), `${key}.${lang}`).not.toMatch(/\d/)
      }
    }
  })
})
