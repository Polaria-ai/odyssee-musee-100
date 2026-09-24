/**
 * Toutes les tables de textes du projet (tout fichier `strings.ts` sous src) doivent être complètes
 * en français ET en anglais : le musée est bilingue.
 */
import { describe, expect, it } from 'vitest'
import { format, pick, translate } from './index'
import type { StringTable } from './index'

const modules = import.meta.glob<Record<string, unknown>>('../**/strings.ts', { eager: true })

describe('tables de textes', () => {
  const tables = Object.entries(modules).flatMap(([file, mod]) =>
    Object.entries(mod)
      .filter(([, v]) => v && typeof v === 'object')
      .map(([name, table]) => ({ file, name, table: table as StringTable })),
  )

  it.each(tables.length ? tables : [{ file: '(aucune)', name: '-', table: {} as StringTable }])(
    '$file › $name est complet en FR et EN',
    ({ table }) => {
      for (const [key, value] of Object.entries(table)) {
        expect(value.fr?.trim(), `${key}.fr`).toBeTruthy()
        expect(value.en?.trim(), `${key}.en`).toBeTruthy()
        const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
        expect(vars(value.en), `${key} : mêmes variables en FR et EN`).toEqual(vars(value.fr))
      }
    },
  )
})

describe('pick / format / translate', () => {
  it('retombe sur le français quand l’anglais est vide', () => {
    expect(pick({ fr: 'Bonjour', en: '' }, 'en')).toBe('Bonjour')
    expect(pick({ fr: 'Bonjour', en: 'Hello' }, 'en')).toBe('Hello')
    expect(pick(undefined, 'fr')).toBe('')
  })
  it('remplace les variables et laisse les inconnues', () => {
    expect(format('{n} sur {total}', { n: 3, total: 100 })).toBe('3 sur 100')
    expect(format('{x}', {})).toBe('{x}')
  })
  it('traduit une table', () => {
    const t = translate({ hi: { fr: 'Salut {name}', en: 'Hi {name}' } }, 'en')
    expect(t('hi', { name: 'Ada' })).toBe('Hi Ada')
  })
})
