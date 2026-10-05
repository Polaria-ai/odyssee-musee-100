/**
 * Réponse de repli du chat de l'Archiviste · IA quand le service est indisponible (WEL-929) : son état des archives
 * (rien de publié, quelques archives, tout), au VOUVOIEMENT comme le reste du chat (les dialogues scriptés de
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
      "Pour l'instant, ces vitrines sont vides : les archives seront déposées après la soirée, une fois tout relu.",
      'For now, these display cases are empty: the archives will be deposited after the evening, once everything has been reviewed.',
      'neutral',
    ),
  ]),
  dialogue('chat-fallback-empty-1', [
    line(
      "Je ne peux rien affirmer sur ce qui se dit ce soir tant que ce n'est pas publié. Le programme est à votre disposition d'ici là.",
      "I can't state anything about tonight until it's published. The programme is there for you until then.",
      'thinking',
    ),
  ]),
  dialogue('chat-fallback-empty-2', [
    line(
      'Les archives se remplissent à la fin de la soirée. Repassez devant les vitrines un peu plus tard.',
      'The archives fill up at the end of the evening. Come back to the display cases a little later.',
      'neutral',
    ),
  ]),
]

const CHAT_FALLBACK_PARTIAL: readonly Dialogue[] = [
  dialogue('chat-fallback-partial-0', [
    line(
      'Quelques vitrines se sont déjà remplies. Les autres suivront au fil de la relecture : repassez un peu plus tard.',
      'A few display cases have already filled in. The others will follow as the review continues: come back a little later.',
      'happy',
    ),
  ]),
  dialogue('chat-fallback-partial-1', [
    line(
      "La mémoire de cette soirée s'écrit petit à petit : certaines séquences sont archivées, d'autres attendent leur tour.",
      "This evening's memory is being written little by little: some sessions are archived, others are still waiting their turn.",
      'thinking',
    ),
  ]),
]

const CHAT_FALLBACK_FULL: readonly Dialogue[] = [
  dialogue('chat-fallback-full-0', [
    line(
      'Toutes les vitrines sont remplies : la soirée est désormais intégralement archivée. Belle lecture !',
      'All the display cases are filled in: the evening is now fully archived. Enjoy the read!',
      'happy',
    ),
  ]),
  dialogue('chat-fallback-full-1', [
    line(
      "La mémoire de cette soirée est complète, de la première à la dernière séquence. Merci de l'avoir traversée avec moi.",
      "This evening's memory is complete, from the first session to the last. Thank you for walking through it with me.",
      'happy',
    ),
  ]),
]

/** `served` : replis déjà donnés ; `total` : nombre de vitrines ; `published` : archives publiées reçues. */
export function archivistChatFallback({ served, total, published }: { served: number; total: number; published: number }): Dialogue {
  if (published <= 0) return pickVariant(CHAT_FALLBACK_EMPTY, served)
  if (total > 0 && published >= total) return pickVariant(CHAT_FALLBACK_FULL, served)
  return pickVariant(CHAT_FALLBACK_PARTIAL, served)
}
