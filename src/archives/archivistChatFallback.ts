/**
 * Réponse de repli du chat de l'Archiviste · IA quand le service est indisponible (WEL-929) : l'état des trois
 * transcriptions (rien de publié, quelques-unes, toutes), au VOUVOIEMENT comme le reste du chat (les dialogues scriptés de
 * `archivistScript.ts`, eux, la font tutoyer). Déterministe : les variantes tournent sur `served`, le nombre de replis
 * déjà donnés, jamais au hasard. N'affirme rien sur ce qui a été dit pendant la soirée.
 *
 * Module à part (et non un `ArchivistEvent` de `archivistScript.ts`) : ce dernier est dans le paquet d'entrée du jeu, ces
 * phrases ne servent qu'au chat, chargé à la demande.
 */
import type { Dialogue, DialogueLine } from '../types'
import { ARCHIVIST_NAME } from './archivistScript'

function line(fr: string, en: string, mood?: DialogueLine['mood']): DialogueLine {
  return { text: { fr, en }, mood }
}

function dialogue(id: string, lines: DialogueLine[]): Dialogue {
  return { id, speaker: ARCHIVIST_NAME, lines }
}

/** Choisit une variante de façon stable à partir d'un compteur (jamais aléatoire). */
function pickVariant<T>(variants: readonly T[], seed: number): T {
  const n = variants.length
  return variants[((seed % n) + n) % n]
}

const CHAT_FALLBACK_EMPTY: readonly Dialogue[] = [
  dialogue('chat-fallback-empty-0', [
    line(
      "Pour l'instant, les transcriptions des trois tables rondes ne sont pas publiées. Elles seront déposées après la soirée, après relecture.",
      'The three panel transcripts are not published yet. They will be added after the event, once reviewed.',
      'neutral',
    ),
  ]),
  dialogue('chat-fallback-empty-1', [
    line(
      "Je n'affirme rien sur les échanges avant la publication des transcriptions. Thèmes et horaires vous attendent dans les vitrines.",
      "I can't say what was discussed before publication. Find each panel's theme and time in its display case.",
      'thinking',
    ),
  ]),
  dialogue('chat-fallback-empty-2', [
    line(
      'Les transcriptions seront déposées après la soirée, une fois relues. Repassez devant les vitrines un peu plus tard.',
      'The transcripts will be added after the event, once reviewed. Come back to the display cases a little later.',
      'neutral',
    ),
  ]),
]

const CHAT_FALLBACK_PARTIAL: readonly Dialogue[] = [
  dialogue('chat-fallback-partial-0', [
    line(
      'Quelques transcriptions sont publiées. Les autres tables rondes suivront au fil de la relecture : repassez un peu plus tard.',
      'Some transcripts are published. The other panels will follow as the review continues: come back a little later.',
      'happy',
    ),
  ]),
  dialogue('chat-fallback-partial-1', [
    line(
      "La mémoire des tables rondes s'écrit petit à petit : certaines transcriptions sont publiées, d'autres attendent leur tour.",
      "The panels' record is being written little by little: some transcripts are published, others are still waiting their turn.",
      'thinking',
    ),
  ]),
]

const CHAT_FALLBACK_FULL: readonly Dialogue[] = [
  dialogue('chat-fallback-full-0', [
    line(
      'Les trois transcriptions des tables rondes sont publiées. Belle lecture !',
      'All three panel transcripts are published. Enjoy the read!',
      'happy',
    ),
  ]),
  dialogue('chat-fallback-full-1', [
    line(
      "Les trois tables rondes ont maintenant leur transcription. Merci de les avoir parcourues avec moi.",
      "All three panels now have transcripts. Thank you for reading them with me.",
      'happy',
    ),
  ]),
]

/** `served` : replis déjà donnés ; `total` : nombre de vitrines ; `published` : transcriptions publiées reçues. */
export function archivistChatFallback({ served, total, published }: { served: number; total: number; published: number }): Dialogue {
  if (published <= 0) return pickVariant(CHAT_FALLBACK_EMPTY, served)
  if (total > 0 && published >= total) return pickVariant(CHAT_FALLBACK_FULL, served)
  return pickVariant(CHAT_FALLBACK_PARTIAL, served)
}
