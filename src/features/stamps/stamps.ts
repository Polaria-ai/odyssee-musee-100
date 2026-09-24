// Propriétaire : agent avatar+tampons. Logique pure, testée. API contractuelle.
import type { ExhibitWingId, Person } from '../../types'
import { EXHIBIT_WINGS } from '../../types'

/** Part des portraits d'une aile à consulter pour obtenir son tampon. */
export const STAMP_RATIO = 0.3
/** Minimum absolu de portraits consultés par aile (petites ailes). */
export const STAMP_MIN = 3

export interface WingProgress {
  seen: number
  total: number
  required: number
}

export function requiredFor(total: number): number {
  return Math.min(total, Math.max(STAMP_MIN, Math.ceil(total * STAMP_RATIO)))
}

export function wingProgress(people: Person[], visited: Record<string, number>): Record<ExhibitWingId, WingProgress> {
  const out = {} as Record<ExhibitWingId, WingProgress>
  for (const wing of EXHIBIT_WINGS) {
    const inWing = people.filter((p) => p.wing === wing)
    const seen = inWing.filter((p) => visited[p.id]).length
    out[wing] = { seen, total: inWing.length, required: requiredFor(inWing.length) }
  }
  return out
}

export function stampsToAward(
  people: Person[],
  visited: Record<string, number>,
  stamps: Partial<Record<ExhibitWingId, number>>,
): ExhibitWingId[] {
  const progress = wingProgress(people, visited)
  return EXHIBIT_WINGS.filter((w) => !stamps[w] && progress[w].total > 0 && progress[w].seen >= progress[w].required)
}

/**
 * Carte complète = un tampon par aile. Si `people` est fourni, ignore les ailes vides
 * (aucune personne à exposer) : elles ne comptent ni pour ni contre la complétion.
 */
export function isCardComplete(stamps: Partial<Record<ExhibitWingId, number>>, people?: Person[]): boolean {
  const relevantWings = people ? EXHIBIT_WINGS.filter((w) => people.some((p) => p.wing === w)) : EXHIBIT_WINGS
  return relevantWings.length > 0 && relevantWings.every((w) => Boolean(stamps[w]))
}
