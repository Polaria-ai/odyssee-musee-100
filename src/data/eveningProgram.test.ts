import { describe, expect, it } from 'vitest'
import { EVENING_META, EVENING_PROGRAM, EVENING_SPEAKERS } from './eveningProgram'
import { EveningSessionSchema } from './eveningSchema'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

describe('EVENING_PROGRAM', () => {
  it('contient 18 séquences', () => {
    expect(EVENING_PROGRAM).toHaveLength(18)
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

  it('chaque séquence est provisoire', () => {
    for (const s of EVENING_PROGRAM) expect(s.provisional).toBe(true)
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

  it('les deux faces-à-face et la keynote de clôture sont sans intervenant·e (à annoncer)', () => {
    for (const id of ['face-a-face-1', 'face-a-face-2', 'keynote-cloture']) {
      const session = EVENING_PROGRAM.find((s) => s.id === id)
      expect(session?.speakers).toEqual([])
    }
  })

  it('les trois tables rondes ont un thème (la phrase entre guillemets de la source A)', () => {
    for (const id of ['table-ronde-1', 'table-ronde-2', 'table-ronde-3']) {
      const session = EVENING_PROGRAM.find((s) => s.id === id)
      expect(session?.theme?.fr.length).toBeGreaterThan(0)
    }
  })

  it('la table ronde 1 attribue Muriel Motte comme modératrice, sans Octave Klaba ni Maya Noël', () => {
    const session = EVENING_PROGRAM.find((s) => s.id === 'table-ronde-1')
    expect(session?.speakers).toEqual([{ name: 'Muriel Motte', role: { fr: 'Journaliste', en: 'Journalist' }, organization: "L'Opinion", moderator: true }])
  })

  it('la table ronde 3 attribue Fitoussi, Boucher et Menasé, sans modérateur (inconnu)', () => {
    const session = EVENING_PROGRAM.find((s) => s.id === 'table-ronde-3')
    expect(session?.speakers.map((s) => s.name)).toEqual(['Samuel Fitoussi', 'Louise Boucher', 'Marc Menasé'])
    expect(session?.speakers.every((s) => !s.moderator)).toBe(true)
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
  it('annonce un programme provisoire (FR + EN)', () => {
    expect(EVENING_META.provisional).toBe(true)
    expect(EVENING_META.provisionalNotice.fr).toMatch(/provisoire/i)
    expect(EVENING_META.provisionalNotice.en).toMatch(/provisional/i)
  })

  it('a une date, un lieu et au moins une source', () => {
    expect(EVENING_META.date).toBe('2026-10-06')
    expect(EVENING_META.address.length).toBeGreaterThan(0)
    expect(EVENING_META.sources.length).toBeGreaterThan(0)
  })
})
