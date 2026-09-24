import { describe, expect, it } from 'vitest'
import { generatePlaceholderPeople } from './placeholder'
import { PersonSchema } from './schema'
import { EXHIBIT_WINGS } from '../types'

describe('generatePlaceholderPeople', () => {
  it('génère 100 fiches par défaut', () => {
    expect(generatePlaceholderPeople()).toHaveLength(100)
  })

  it('répartit 34/33/33 sur les trois ailes', () => {
    const people = generatePlaceholderPeople(100)
    const counts = Object.fromEntries(EXHIBIT_WINGS.map((w) => [w, 0])) as Record<(typeof EXHIBIT_WINGS)[number], number>
    for (const p of people) counts[p.wing] += 1
    const values = EXHIBIT_WINGS.map((w) => counts[w]).sort((a, b) => b - a)
    expect(values).toEqual([34, 33, 33])
    expect(values.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('est déterministe (mêmes fiches à chaque appel)', () => {
    expect(generatePlaceholderPeople(20)).toEqual(generatePlaceholderPeople(20))
  })

  it('ne contient jamais de vrai nom : tout commence par « Portrait n° »', () => {
    for (const p of generatePlaceholderPeople(30)) {
      expect(p.name).toMatch(/^Portrait n°\d+$/)
      expect(p.placeholder).toBe(true)
      expect(p.photoUrl).toBeNull()
    }
  })

  it('a des id uniques et kebab-case', () => {
    const people = generatePlaceholderPeople(50)
    const ids = new Set(people.map((p) => p.id))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('produit des fiches valides au regard de PersonSchema', () => {
    for (const p of generatePlaceholderPeople(15)) {
      expect(PersonSchema.safeParse(p).success).toBe(true)
    }
  })

  it('varie les rôles génériques tout en restant bilingue', () => {
    const people = generatePlaceholderPeople(10)
    const roles = new Set(people.map((p) => p.role.fr))
    expect(roles.size).toBeGreaterThan(1)
    for (const p of people) {
      expect(p.role.fr.length).toBeGreaterThan(0)
      expect(p.role.en.length).toBeGreaterThan(0)
    }
  })
})
