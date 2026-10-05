/**
 * Dialogues de l'Archiviste, gardienne des Archives de 2040. Contenu bilingue, déterministe
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
      "Approche-toi de mon socle quand tu veux en savoir plus. Les trois vitrines attendent chacune la transcription d'une table ronde.",
      'Come closer to my platform whenever you want to know more. Each of the three display cases is waiting for a panel transcript.',
      'neutral',
    ),
  ])
}

// --- Accueil complet (à l'Archiviste) --------------------------------------

function welcomeDialogue(): Dialogue {
  return dialogue('welcome', [
    line(
      "Bonjour, voyageur ou voyageuse du présent. Je suis l'Archiviste : je veille sur la mémoire de cette soirée.",
      "Hello, traveller from the present. I'm the Archivist: I watch over the memory of this evening.",
      'happy',
    ),
    line(
      "Seules les trois tables rondes de L'Odyssée de l'IA ont leur vitrine.",
      'Only the three panel discussions from The AI Odyssey have a display case.',
      'neutral',
    ),
    line(
      'Chacune affichera son horaire, son thème et sa transcription intégrale.',
      'Each case will show its time, theme and full transcript.',
      'neutral',
    ),
    line(
      "Les transcriptions seront déposées après la soirée et publiées après relecture.",
      'The transcripts will be added after the event and published after review.',
      'thinking',
    ),
    line(
      'Approche-toi d\'une vitrine et appuie sur « Ouvrir la vitrine » pour la découvrir, remplie ou non.',
      'Step up to a display case and tap “Open the display case” to discover it, filled in or not.',
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
      "Pour l'instant, les trois vitrines attendent les transcriptions des tables rondes. Rien n'est encore publié.",
      'For now, the three display cases are waiting for the panel transcripts. Nothing has been published yet.',
      'neutral',
    ),
  ]),
  dialogue('talk-empty-1', [
    line(
      'Les transcriptions seront déposées après la soirée, une fois relues. Reviens un peu plus tard !',
      'The transcripts will be added after the event, once reviewed. Come back a little later!',
      'thinking',
    ),
  ]),
  dialogue('talk-empty-2', [
    line(
      "Patience : je ne peux rien affirmer sur les échanges tant que leur transcription n'est pas publiée. Consulte les vitrines en attendant.",
      "Patience: I can't say what was discussed until its transcript is published. Have a look at the display cases meanwhile.",
      'neutral',
    ),
  ]),
]

const TALK_PARTIAL: readonly Dialogue[] = [
  dialogue('talk-partial-0', [
    line(
      'Quelques transcriptions sont publiées. Les autres tables rondes suivront au fil de la relecture, sois patient·e.',
      'Some transcripts are published. The other panels will follow as the review continues — bear with me.',
      'happy',
    ),
  ]),
  dialogue('talk-partial-1', [
    line(
      "La mémoire des tables rondes s'écrit petit à petit. Repasse par les vitrines encore vides un peu plus tard.",
      "The panels' record is being written little by little. Swing back by the still-empty cases a bit later.",
      'thinking',
    ),
  ]),
  dialogue('talk-partial-2', [
    line(
      "Certaines tables rondes ont déjà leur transcription, d'autres attendent encore leur tour. Continue d'explorer !",
      'Some panels already have transcripts, others are still waiting their turn. Keep exploring!',
      'neutral',
    ),
  ]),
]

const TALK_FULL: readonly Dialogue[] = [
  dialogue('talk-full-0', [
    line(
      'Les trois transcriptions des tables rondes sont publiées. Belle lecture !',
      'All three panel transcripts are published. Enjoy the read!',
      'happy',
    ),
  ]),
  dialogue('talk-full-1', [
    line(
      'Les trois tables rondes ont maintenant leur transcription. Merci de les avoir parcourues avec moi.',
      'All three panels now have transcripts. Thank you for reading them with me.',
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
      'Tu peux relire les transcriptions des tables rondes quand tu le souhaites.',
      'You can revisit the panel transcripts whenever you like.',
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
