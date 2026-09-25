// STUB — propriétaire : workflow « Archives de 2040 ». Signature contractuelle à conserver.
import type { Dialogue } from '../types'

export type ArchivistEvent =
  | { kind: 'welcome' }
  | { kind: 'talk'; consulted: number; total: number; published: number }

export const ARCHIVIST_NAME = { fr: "L'Archiviste", en: 'The Archivist' }

/** Dialogues de l'hologramme de l'Archiviste (voix de 2040). */
export function archivistDialogue(event: ArchivistEvent): Dialogue {
  return {
    id: `archivist-${event.kind}`,
    speaker: ARCHIVIST_NAME,
    lines: [{ text: { fr: 'Bienvenue dans les Archives de 2040.', en: 'Welcome to the 2040 Archives.' } }],
  }
}
