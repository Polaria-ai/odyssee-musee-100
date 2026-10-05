import { describe, expect, it } from 'vitest'
import { EVENING_META, EVENING_PROGRAM, EVENING_SPEAKERS } from './eveningProgram'
import { EveningSessionSchema } from './eveningSchema'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

describe('EVENING_PROGRAM', () => {
  it('contient les 19 séquences du programme du 24/09', () => {
    expect(EVENING_PROGRAM).toHaveLength(19)
  })

  it('a des id uniques, en kebab-case', () => {
    const ids = EVENING_PROGRAM.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('est trié par ordre croissant, ordre == index + 1', () => {
    EVENING_PROGRAM.forEach((s, i) => expect(s.order).toBe(i + 1))
  })

  it('a des heures de début au format HH:MM, strictement croissantes', () => {
    for (const s of EVENING_PROGRAM) expect(s.startTime).toMatch(TIME_RE)
    for (let i = 1; i < EVENING_PROGRAM.length; i += 1) {
      expect(toMinutes(EVENING_PROGRAM[i].startTime)).toBeGreaterThan(toMinutes(EVENING_PROGRAM[i - 1].startTime))
    }
  })

  it('seules les séquences incomplètes au 24/09 restent provisoires', () => {
    const provisoires = EVENING_PROGRAM.filter((s) => s.provisional).map((s) => s.id)
    expect(provisoires).toEqual(['table-ronde-1', 'table-ronde-2', 'face-a-face-2'])
  })

  it('chaque séquence est valide selon EveningSessionSchema', () => {
    for (const s of EVENING_PROGRAM) {
      const result = EveningSessionSchema.safeParse(s)
      expect(result.success, `${s.id} : ${!result.success ? JSON.stringify(result.error.issues) : ''}`).toBe(true)
    }
  })

  it("n'attribue aucune séquence à Octave Klaba, Maya Noël, Anne Bouverot ou Xavier Boilaud (absents de l'annonce du 22/09)", () => {
    const excluded = ['Octave Klaba', 'Maya Noël', 'Anne Bouverot', 'Xavier Boilaud']
    const allNames = EVENING_PROGRAM.flatMap((s) => s.speakers.map((sp) => sp.name))
    for (const name of excluded) expect(allNames).not.toContain(name)
  })

  it('les intervenant·es de chaque séquence appartiennent tou·tes à EVENING_SPEAKERS', () => {
    const known = new Set(EVENING_SPEAKERS.map((s) => s.name))
    for (const session of EVENING_PROGRAM) {
      for (const sp of session.speakers) expect(known.has(sp.name), `${session.id} : ${sp.name}`).toBe(true)
    }
  })

  it('le second face-à-face est sans intervenant·e (« en attente de validation » au 24/09)', () => {
    expect(EVENING_PROGRAM.find((s) => s.id === 'face-a-face-2')?.speakers).toEqual([])
  })

  it('le premier face-à-face et la keynote de clôture ont leurs intervenant·es du 24/09', () => {
    expect(EVENING_PROGRAM.find((s) => s.id === 'face-a-face-1')?.speakers.map((s) => s.name)).toEqual([
      'Jessyn Katchera',
      'Sébastien Rozanes',
      'Rémi Godeau',
    ])
    expect(EVENING_PROGRAM.find((s) => s.id === 'keynote-cloture')?.speakers.map((s) => s.name)).toEqual(['Laurent Solly', 'Rémi Godeau'])
  })

  it('les trois tables rondes ont un thème (la phrase entre guillemets de la source A)', () => {
    for (const id of ['table-ronde-1', 'table-ronde-2', 'table-ronde-3']) {
      const session = EVENING_PROGRAM.find((s) => s.id === id)
      expect(session?.theme?.fr.length).toBeGreaterThan(0)
    }
  })

  it('la table ronde 1 attribue Raphaël Doan et Muriel Motte (modératrice), sans les intervenants en attente de confirmation', () => {
    const session = EVENING_PROGRAM.find((s) => s.id === 'table-ronde-1')
    expect(session?.speakers).toEqual([
      { name: 'Raphaël Doan', role: { fr: 'Auteur', en: 'Author' } },
      { name: 'Muriel Motte', role: { fr: 'Journaliste', en: 'Journalist' }, organization: "L'Opinion", moderator: true },
    ])
  })

  it('la table ronde 3 attribue Boucher, Fitoussi et Menasé, modérée par David Lacombled', () => {
    const session = EVENING_PROGRAM.find((s) => s.id === 'table-ronde-3')
    expect(session?.speakers.map((s) => s.name)).toEqual(['Louise Boucher', 'Samuel Fitoussi', 'Marc Menasé', 'David Lacombled'])
    expect(session?.speakers.filter((s) => s.moderator).map((s) => s.name)).toEqual(['David Lacombled'])
  })
})

describe('EVENING_SPEAKERS', () => {
  it('a 17 intervenant·es, sans doublon', () => {
    expect(EVENING_SPEAKERS).toHaveLength(17)
    expect(new Set(EVENING_SPEAKERS.map((s) => s.name)).size).toBe(17)
  })

  it('chaque entrée a un rôle FR et EN non vides', () => {
    for (const s of EVENING_SPEAKERS) {
      expect(s.role.fr.length).toBeGreaterThan(0)
      expect(s.role.en.length).toBeGreaterThan(0)
    }
  })
})

describe('EVENING_META', () => {
  it('annonce un programme au 24/09, susceptible d’évoluer (FR + EN), tant qu’une séquence est incomplète', () => {
    expect(EVENING_META.provisional).toBe(EVENING_PROGRAM.some((s) => s.provisional))
    expect(EVENING_META.provisionalNotice.fr).toMatch(/24 septembre/)
    expect(EVENING_META.provisionalNotice.en).toMatch(/24 September/)
  })

  it('a une date, un lieu et au moins une source', () => {
    expect(EVENING_META.date).toBe('2026-10-06')
    expect(EVENING_META.address.length).toBeGreaterThan(0)
    expect(EVENING_META.sources.length).toBeGreaterThan(0)
  })
})
