import { describe, expect, it } from 'vitest'
import type { Person } from '../../types'
import {
  archivesProgress,
  hasArchivesStamp,
  isCardComplete,
  requiredArchivesFor,
  requiredFor,
  stampsToAward,
  wingProgress,
  ARCHIVES_STAMP_MIN,
  STAMP_MIN,
  STAMP_RATIO,
} from './stamps'

function person(id: string, wing: Person['wing']): Person {
  return {
    id,
    order: 1,
    name: id,
    role: { fr: '', en: '' },
    organization: '—',
    country: 'EU',
    wing,
    bio: { fr: '', en: '' },
    story: { fr: '', en: '' },
    photoUrl: null,
    placeholder: true,
  }
}

describe('requiredFor', () => {
  it('applique le ratio avec un minimum absolu', () => {
    expect(requiredFor(0)).toBe(0)
    expect(requiredFor(3)).toBe(3) // min(3, max(3, ceil(0.9))) = 3
    expect(requiredFor(10)).toBe(STAMP_MIN) // max(3, ceil(3)) = 3
    expect(requiredFor(100)).toBe(Math.ceil(100 * STAMP_RATIO))
  })
  it('ne dépasse jamais le total', () => {
    expect(requiredFor(1)).toBeLessThanOrEqual(1)
    expect(requiredFor(2)).toBeLessThanOrEqual(2)
  })
})

describe('wingProgress', () => {
  it('ignore les ailes vides (total 0, required 0)', () => {
    const people = [person('a', 'infrastructures'), person('b', 'infrastructures')]
    const progress = wingProgress(people, {})
    expect(progress.culture).toEqual({ seen: 0, total: 0, required: 0 })
    expect(progress.infrastructures.total).toBe(2)
  })
})

describe('stampsToAward', () => {
  const people = [
    person('a', 'infrastructures'),
    person('b', 'infrastructures'),
    person('c', 'infrastructures'),
    person('d', 'infrastructures'),
    person('e', 'infrastructures'),
    person('f', 'infrastructures'),
    person('g', 'infrastructures'),
    person('h', 'infrastructures'),
    person('i', 'infrastructures'),
    person('j', 'infrastructures'),
  ]

  it('ignore les ailes vides même si le seuil est trivialement atteint', () => {
    expect(stampsToAward(people, {}, {})).toEqual([])
    // aucune personne en culture/industrialisation : jamais récompensées
    const result = stampsToAward(people, { a: 1 }, {})
    expect(result).not.toContain('culture')
    expect(result).not.toContain('industrialisation')
  })

  it('récompense une aile quand le seuil requis est atteint', () => {
    const visited = { a: 1, b: 2, c: 3 } // requiredFor(10) = 3
    expect(stampsToAward(people, visited, {})).toEqual(['infrastructures'])
  })

  it('ne récompense pas deux fois la même aile', () => {
    const visited = { a: 1, b: 2, c: 3, d: 4 }
    expect(stampsToAward(people, visited, { infrastructures: 1000 })).toEqual([])
  })
})

describe('isCardComplete', () => {
  it('sans people : exige les trois ailes', () => {
    expect(isCardComplete({})).toBe(false)
    expect(isCardComplete({ infrastructures: 1, industrialisation: 2 })).toBe(false)
    expect(isCardComplete({ infrastructures: 1, industrialisation: 2, culture: 3 })).toBe(true)
  })

  it('avec people : ignore les ailes sans aucune personne', () => {
    const people = [person('a', 'infrastructures'), person('b', 'culture')]
    expect(isCardComplete({ infrastructures: 1, culture: 2 }, people)).toBe(true)
    expect(isCardComplete({ infrastructures: 1 }, people)).toBe(false)
  })

  it('renvoie false si people est vide (rien à collectionner)', () => {
    expect(isCardComplete({}, [])).toBe(false)
  })

  const threeWings = { infrastructures: 1, industrialisation: 2, culture: 3 }

  it('sans contexte archives : identique au comportement historique (3 ailes suffisent)', () => {
    expect(isCardComplete(threeWings)).toBe(true)
  })

  it('programme non chargé (totalSessions 0) : ignore le tampon Archives, comme une aile vide', () => {
    expect(isCardComplete(threeWings, undefined, { visitedSessions: {}, totalSessions: 0 })).toBe(true)
  })

  it('programme chargé : exige aussi le tampon Archives', () => {
    expect(isCardComplete(threeWings, undefined, { visitedSessions: {}, totalSessions: 5 })).toBe(false)
    expect(
      isCardComplete(threeWings, undefined, { visitedSessions: { a: 1, b: 2, c: 3 }, totalSessions: 5 }),
    ).toBe(true)
  })

  it('les ailes incomplètes bloquent la complétion même si les Archives sont faites', () => {
    expect(
      isCardComplete({ infrastructures: 1 }, undefined, { visitedSessions: { a: 1, b: 2, c: 3 }, totalSessions: 3 }),
    ).toBe(false)
  })
})

describe('requiredArchivesFor', () => {
  it('au moins 3, ou toutes si le programme en a moins', () => {
    expect(requiredArchivesFor(0)).toBe(0)
    expect(requiredArchivesFor(1)).toBe(1)
    expect(requiredArchivesFor(2)).toBe(2)
    expect(requiredArchivesFor(3)).toBe(ARCHIVES_STAMP_MIN)
    expect(requiredArchivesFor(17)).toBe(ARCHIVES_STAMP_MIN)
  })
  it('ne descend jamais sous 0', () => {
    expect(requiredArchivesFor(-4)).toBe(0)
  })
})

describe('archivesProgress', () => {
  it('compte les séquences consultées, bornées au programme', () => {
    expect(archivesProgress({}, 17)).toEqual({ seen: 0, total: 17, required: 3 })
    expect(archivesProgress({ a: 1, b: 2 }, 17)).toEqual({ seen: 2, total: 17, required: 3 })
  })
  it('programme non chargé : total et required à 0', () => {
    expect(archivesProgress({}, 0)).toEqual({ seen: 0, total: 0, required: 0 })
  })
})

describe('hasArchivesStamp', () => {
  it('jamais obtenu si le programme n’a pas encore chargé', () => {
    expect(hasArchivesStamp({ a: 1, b: 2, c: 3 }, 0)).toBe(false)
  })
  it('obtenu à partir de 3 archives consultées', () => {
    expect(hasArchivesStamp({}, 17)).toBe(false)
    expect(hasArchivesStamp({ a: 1, b: 2 }, 17)).toBe(false)
    expect(hasArchivesStamp({ a: 1, b: 2, c: 3 }, 17)).toBe(true)
  })
  it('avec moins de 3 séquences au programme, toutes les consulter suffit', () => {
    expect(hasArchivesStamp({ a: 1 }, 2)).toBe(false)
    expect(hasArchivesStamp({ a: 1, b: 2 }, 2)).toBe(true)
  })
})
