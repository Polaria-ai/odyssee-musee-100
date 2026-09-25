// Propriétaire : agent avatar+tampons. Logique pure, testée. API contractuelle.
import type { ExhibitWingId, Person } from '../../types'
import { EXHIBIT_WINGS } from '../../types'

/** Part des portraits d'une aile à consulter pour obtenir son tampon. */
export const STAMP_RATIO = 0.3
/** Minimum absolu de portraits consultés par aile (petites ailes). */
export const STAMP_MIN = 3

/** Identifiant d'un des quatre tampons du carnet : les trois ailes, plus les Archives de 2040. */
export type StampId = ExhibitWingId | 'archives'
export const ALL_STAMPS: readonly StampId[] = [...EXHIBIT_WINGS, 'archives'] as const

/** Minimum absolu d'archives consultées pour le 4e tampon (moins s'il y en a moins au programme). */
export const ARCHIVES_STAMP_MIN = 3

/** Encre cyan du tampon des Archives de 2040 (dédiée : distincte des couleurs d'aile). */
export const ARCHIVES_INK = '#0f7a8c'

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

/** Nombre d'archives à consulter pour le 4e tampon : au moins 3, ou toutes si le programme en a moins. */
export function requiredArchivesFor(totalSessions: number): number {
  return Math.min(Math.max(totalSessions, 0), ARCHIVES_STAMP_MIN)
}

/** Progression du tampon Archives (même forme que `wingProgress`, pour un rendu uniforme). */
export function archivesProgress(visitedSessions: Record<string, number>, totalSessions: number): WingProgress {
  const seen = Object.keys(visitedSessions).length
  return { seen, total: Math.max(totalSessions, 0), required: requiredArchivesFor(totalSessions) }
}

/**
 * Le 4e tampon (Archives) n'est pas stocké : il se déduit de `visitedSessions` (déjà persisté par
 * `gameStore`), obtenu après au moins 3 archives consultées (ou toutes, si le programme en a moins).
 * `totalSessions` à 0 (programme pas encore chargé) : jamais obtenu, comme une aile sans personne.
 */
export function hasArchivesStamp(visitedSessions: Record<string, number>, totalSessions: number): boolean {
  if (totalSessions <= 0) return false
  return Object.keys(visitedSessions).length >= requiredArchivesFor(totalSessions)
}

/** Contexte optionnel du 4e tampon pour `isCardComplete` (voir `hasArchivesStamp`). */
export interface ArchivesStampContext {
  visitedSessions: Record<string, number>
  totalSessions: number
}

/**
 * Carte complète = un tampon par aile, plus le tampon Archives si `archives` est fourni et que le
 * programme de la soirée compte au moins une séquence (sinon, comme une aile vide : ignoré, ni pour
 * ni contre la complétion — le carnet ne doit pas rester bloqué si le programme n'a pas encore chargé).
 * Si `people` est fourni, ignore aussi les ailes vides (aucune personne à exposer).
 */
export function isCardComplete(
  stamps: Partial<Record<ExhibitWingId, number>>,
  people?: Person[],
  archives?: ArchivesStampContext,
): boolean {
  const relevantWings = people ? EXHIBIT_WINGS.filter((w) => people.some((p) => p.wing === w)) : EXHIBIT_WINGS
  const wingsComplete = relevantWings.length > 0 && relevantWings.every((w) => Boolean(stamps[w]))
  if (!wingsComplete) return false
  if (!archives || archives.totalSessions <= 0) return true
  return hasArchivesStamp(archives.visitedSessions, archives.totalSessions)
}
