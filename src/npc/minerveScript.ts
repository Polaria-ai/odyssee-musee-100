// STUB — propriétaire : agent Minerve.
import type { Dialogue, ExhibitWingId } from '../types'

export type MinerveEvent =
  | { kind: 'welcome' }
  | { kind: 'talk'; visitedCount: number; stampsCount: number; total: number }
  | { kind: 'stamp'; wing: ExhibitWingId }
  | { kind: 'complete' }

export const MINERVE_NAME = { fr: 'Minerve', en: 'Minerva' }

export function minerveDialogue(event: MinerveEvent): Dialogue {
  return { id: event.kind, speaker: MINERVE_NAME, lines: [{ text: { fr: 'Bienvenue au musée !', en: 'Welcome to the museum!' } }] }
}
