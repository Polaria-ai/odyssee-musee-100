/**
 * Dialogues de l'Archiviste, hologramme des Archives de 2040. Contenu bilingue, déterministe
 * (aucun Math.random : les variantes se choisissent à partir des compteurs de progression).
 * Ton : une IA de 2040, bienveillante et un peu mystérieuse. N'affirme jamais rien sur ce qui a
 * été dit pendant la soirée du 6 octobre 2026 — ça, seul l'agent de fin de soirée le dépose.
 * Propriétaire : workflow « Archives de 2040 ».
 */
import type { Dialogue, DialogueLine, Localized } from '../types'

export type ArchivistEvent =
  | { kind: 'welcome' }
  | { kind: 'talk'; consulted: number; total: number; published: number }
  /** Première arrivée dans la salle, à pied par la porte sud du hall (déclenchée par `App.tsx`). */
  | { kind: 'firstVisit' }
  /** Le 4e tampon (Archives) vient d'être obtenu (voir `useStampWatcher`). */
  | { kind: 'stampAwarded' }

export const ARCHIVIST_NAME: Localized = { fr: "L'Archiviste", en: 'The Archivist' }

function line(fr: string, en: string, mood?: DialogueLine['mood']): DialogueLine {
  return { text: { fr, en }, mood }
}

function dialogue(id: string, lines: DialogueLine[]): Dialogue {
  return { id, speaker: ARCHIVIST_NAME, lines }
}

/** Choisit une variante de façon stable à partir d'un compteur (jamais aléatoire). */
function pickVariant<T>(variants: readonly T[], seed: number): T {
  const n = variants.length
  const i = ((seed % n) + n) % n
  return variants[i]
}

// --- Arrivée dans la salle (courte, avant même de parler à l'Archiviste) ---

function firstVisitDialogue(): Dialogue {
  return dialogue('firstVisit', [
    line(
      "Te voici dans les Archives de 2040. Ici, le temps a fait son œuvre : cette soirée est devenue un souvenir qu'on archive.",
      "Welcome to the 2040 Archives. Here, time has done its work: this evening has become a memory to archive.",
      'surprised',
    ),
    line(
      "Approche-toi de mon socle quand tu veux en savoir plus. Sinon, explore : chaque vitrine attend sa séquence.",
      'Come closer to my platform whenever you want to know more. Otherwise, explore: every display case is waiting for its session.',
      'neutral',
    ),
  ])
}

// --- Accueil complet (à l'hologramme) --------------------------------------

function welcomeDialogue(): Dialogue {
  return dialogue('welcome', [
    line(
      "Bonjour, voyageur ou voyageuse du présent. Je suis l'Archiviste : je veille sur la mémoire de cette soirée.",
      "Hello, traveller from the present. I'm the Archivist: I watch over the memory of this evening.",
      'happy',
    ),
    line(
      "Ici, chaque séquence de L'Odyssée de l'IA a sa vitrine : son heure, son thème, et bientôt une synthèse.",
      'Here, every session of The AI Odyssey has its own display case: its time, its theme, and soon a summary.',
      'neutral',
    ),
    line(
      "Certaines vitrines porteront aussi une citation marquante, glanée pendant la soirée.",
      'Some display cases will also carry a striking quote, gathered during the evening.',
      'neutral',
    ),
    line(
      "Mais ce soir-là n'est pas encore écrit pour moi. Les synthèses et citations n'apparaissent qu'une fois relues, à la fin de la soirée.",
      "But that evening isn't written yet, not for me. Summaries and quotes only appear once reviewed, at the end of the night.",
      'thinking',
    ),
    line(
      'Approche-toi d\'une vitrine et appuie sur "Consulter" pour la découvrir, remplie ou non.',
      'Step up to a display case and tap "Consult" to discover it, filled in or not.',
      'neutral',
    ),
    line(
      'Quand tu voudras repartir, la porte juste à côté de moi te ramène au grand hall.',
      'Whenever you want to head back, the door right next to me leads back to the great hall.',
      'neutral',
    ),
  ])
}

// --- Discussion (varie selon consulted / total / published) ----------------

const TALK_EMPTY: readonly Dialogue[] = [
  dialogue('talk-empty-0', [
    line(
      "Pour l'instant, ces vitrines sont vides : rien n'est encore déposé. Tout se joue ce soir, dans la salle voisine.",
      "For now, these display cases are empty: nothing has been deposited yet. Everything is happening tonight, in the next room.",
      'neutral',
    ),
  ]),
  dialogue('talk-empty-1', [
    line(
      'Les archives se remplissent à la fin de la soirée, une fois que tout a été relu. Reviens un peu plus tard !',
      'The archives fill up at the end of the evening, once everything has been reviewed. Come back a little later!',
      'thinking',
    ),
  ]),
  dialogue('talk-empty-2', [
    line(
      "Patience : je ne peux rien affirmer sur ce qui se dit ce soir tant que ce n'est pas confirmé. Regarde le programme en attendant.",
      "Patience: I can't state anything about tonight until it's confirmed. Have a look at the programme meanwhile.",
      'neutral',
    ),
  ]),
]

const TALK_PARTIAL: readonly Dialogue[] = [
  dialogue('talk-partial-0', [
    line(
      "Quelques vitrines se sont déjà remplies. Les autres suivront au fil de la relecture, sois patient·e.",
      'A few display cases have already filled in. The others will follow as the review continues — bear with me.',
      'happy',
    ),
  ]),
  dialogue('talk-partial-1', [
    line(
      "La mémoire de ce soir s'écrit petit à petit. Repasse par les vitrines encore vides un peu plus tard.",
      "Tonight's memory is being written little by little. Swing back by the still-empty cases a bit later.",
      'thinking',
    ),
  ]),
  dialogue('talk-partial-2', [
    line(
      "Certaines séquences sont déjà archivées, d'autres attendent encore leur tour. Continue d'explorer !",
      "Some sessions are already archived, others are still waiting their turn. Keep exploring!",
      'neutral',
    ),
  ]),
]

const TALK_FULL: readonly Dialogue[] = [
  dialogue('talk-full-0', [
    line(
      'Toutes les vitrines sont remplies : la soirée est désormais intégralement archivée. Belle lecture !',
      "All the display cases are filled in: the evening is now fully archived. Enjoy the read!",
      'happy',
    ),
  ]),
  dialogue('talk-full-1', [
    line(
      'La mémoire de ce soir est complète, de la première à la dernière séquence. Merci de l\'avoir traversée avec moi.',
      "Tonight's memory is complete, from the first session to the last. Thank you for walking through it with me.",
      'happy',
    ),
  ]),
]

function talkDialogue(consulted: number, total: number, published: number): Dialogue {
  const seed = consulted
  if (published <= 0) return pickVariant(TALK_EMPTY, seed)
  if (total > 0 && published >= total) return pickVariant(TALK_FULL, seed)
  return pickVariant(TALK_PARTIAL, seed)
}

// --- Tampon Archives obtenu --------------------------------------------------

function stampAwardedDialogue(): Dialogue {
  return dialogue('stampAwarded', [
    line(
      'Un tampon Archives dans ton carnet : tu as pris le temps de remonter jusqu\'ici, bravo.',
      "An Archives stamp in your notebook: you took the time to journey all the way here, well done.",
      'happy',
    ),
    line(
      "Continue de revenir : d'autres vitrines se rempliront peut-être avant la fin de la soirée.",
      'Keep coming back: more display cases might fill in before the evening is over.',
      'neutral',
    ),
  ])
}

export function archivistDialogue(event: ArchivistEvent): Dialogue {
  switch (event.kind) {
    case 'welcome':
      return welcomeDialogue()
    case 'talk':
      return talkDialogue(event.consulted, event.total, event.published)
    case 'firstVisit':
      return firstVisitDialogue()
    case 'stampAwarded':
      return stampAwardedDialogue()
  }
}
