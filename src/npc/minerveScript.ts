/**
 * Dialogues de Minerve, la chouette conservatrice. Contenu bilingue, déterministe
 * (aucun Math.random : les variantes sont choisies à partir des compteurs de progression).
 * Propriétaire : agent npc.
 */
import type { Dialogue, DialogueLine, ExhibitWingId, Localized } from '../types'
import { EXHIBIT_WINGS } from '../types'

export type MinerveEvent =
  | { kind: 'welcome' }
  /**
   * `archivesToVisit` (optionnel) : vrai si le programme de la soirée est chargé et qu'aucune
   * archive n'a encore été consultée — ajoute un conseil sur la porte des Archives (sud du hall). Absent ou faux :
   * comportement inchangé (voir `docs/ARCHITECTURE.md`, contrat de `gameStore.interact()`).
   */
  | { kind: 'talk'; visitedCount: number; stampsCount: number; total: number; archivesToVisit?: boolean }
  | { kind: 'stamp'; wing: ExhibitWingId }
  | { kind: 'complete' }

export const MINERVE_NAME: Localized = { fr: 'Minerve', en: 'Minerva' }

function line(fr: string, en: string, mood?: DialogueLine['mood']): DialogueLine {
  return { text: { fr, en }, mood }
}

function dialogue(id: string, lines: DialogueLine[]): Dialogue {
  return { id, speaker: MINERVE_NAME, lines }
}

/** Choisit une variante de façon stable à partir d'un compteur (jamais aléatoire). */
function pickVariant<T>(variants: readonly T[], seed: number): T {
  const n = variants.length
  const i = ((seed % n) + n) % n
  return variants[i]
}

// --- Accueil -------------------------------------------------------------

function welcomeDialogue(): Dialogue {
  return dialogue('welcome', [
    line(
      "Bienvenue au Musée des 100 ! Moi, c'est Minerve, la conservatrice de ces lieux.",
      "Welcome to the Museum of the 100! I'm Minerva, keeper of this place.",
      'happy',
    ),
    line(
      "Tu es à L'Odyssée de l'IA : ici sont exposés les 100 qui font l'IA en Europe.",
      "You're at The AI Odyssey: here we exhibit the 100 people shaping AI in Europe.",
      'neutral',
    ),
    line(
      "Trois ailes suivent les tables rondes du soir : Infrastructures à l'ouest, Industrialisation au nord, Culture à l'est.",
      "Three wings follow tonight's round tables: Infrastructures to the west, Industrialisation to the north, Culture to the east.",
      'thinking',
    ),
    line(
      "Pour avancer, glisse le pouce sur l'écran, ou touche le sol là où tu veux aller.",
      "To move, slide your thumb on the screen, or tap the floor where you'd like to go.",
      'neutral',
    ),
    line(
      'Approche-toi d\'un portrait et appuie sur "Regarder" pour découvrir son histoire.',
      'Step up to a portrait and tap "Look" to discover their story.',
      'neutral',
    ),
    line(
      "Astuce : lis quelques portraits dans une même aile, et hop, un tampon apparaît dans ton carnet !",
      'Tip: read a few portraits in the same wing, and — surprise — a stamp appears in your notebook!',
      'surprised',
    ),
    line(
      "Tu croiseras d'autres visiteurs par ici. Reviens me voir quand tu veux, je suis toujours là !",
      "You'll cross paths with other visitors along the way. Come back and see me anytime, I'm always here!",
      'happy',
    ),
    line(
      "Autre chose : juste derrière toi, en bas du hall, une porte mène aux Archives de 2040. Curieux·se ? Vas-y jeter un œil !",
      "One more thing: right behind you, at the bottom of the hall, a door leads to the 2040 Archives. Curious? Go take a peek!",
      'surprised',
    ),
  ])
}

// --- Discussion (varie selon la progression) ------------------------------

const TALK_NONE: readonly Dialogue[] = [
  dialogue('talk-none-0', [
    line(
      "Pas encore de portrait vu ? Choisis une porte et lance-toi, l'aile Infrastructures est à l'ouest.",
      'No portraits seen yet? Pick a door and dive in — the Infrastructures wing is to the west.',
      'neutral',
    ),
  ]),
  dialogue('talk-none-1', [
    line(
      'Le musée n\'attend que toi ! Appuie sur "Regarder" devant un cadre pour découvrir une histoire.',
      'The museum is waiting for you! Tap "Look" in front of a frame to discover a story.',
      'happy',
    ),
  ]),
  dialogue('talk-none-2', [
    line(
      "Envie d'un point de départ ? L'aile Culture, à l'est, a de très belles histoires.",
      'Need a starting point? The Culture wing, to the east, has some lovely stories.',
      'thinking',
    ),
  ]),
]

const TALK_SOME: readonly Dialogue[] = [
  dialogue('talk-some-0', [
    line(
      "Tu avances bien ! As-tu déjà visité l'aile Infrastructures, à l'ouest ?",
      "You're making good progress! Have you visited the Infrastructures wing yet, to the west?",
      'neutral',
    ),
  ]),
  dialogue('talk-some-1', [
    line(
      "Continue comme ça ! Un tour par l'aile Industrialisation, au nord, te tente ?",
      'Keep it up! Fancy a stroll through the Industrialisation wing, to the north?',
      'happy',
    ),
  ]),
  dialogue('talk-some-2', [
    line(
      "Belle lancée ! N'oublie pas l'aile Culture, à l'est : les récits y sont touchants.",
      "Nice pace! Don't miss the Culture wing, to the east: the stories there are moving.",
      'neutral',
    ),
  ]),
]

const TALK_COMPLETE: readonly Dialogue[] = [
  dialogue('talk-complete-0', [
    line(
      'Ta carte est complète, quelle belle visite ! Repasse voir tes portraits préférés quand tu veux.',
      'Your card is complete, what a lovely visit! Feel free to revisit your favourite portraits anytime.',
      'happy',
    ),
  ]),
  dialogue('talk-complete-1', [
    line(
      "Les 100 n'ont plus de secret pour toi. Partage ta carte si le cœur t'en dit !",
      'The 100 hold no more secrets for you. Share your card if you feel like it!',
      'happy',
    ),
  ]),
  dialogue('talk-complete-2', [
    line(
      "Merci d'avoir exploré tout le musée. Reviens quand tu veux, la porte est toujours ouverte.",
      'Thank you for exploring the whole museum. Come back anytime, the door is always open.',
      'neutral',
    ),
  ]),
]

function talkStampsVariants(stampsCount: number): readonly Dialogue[] {
  const plural = stampsCount > 1
  return [
    dialogue('talk-stamps-0', [
      line(
        `Déjà ${stampsCount} ${plural ? 'tampons' : 'tampon'} dans ton carnet, bravo ! File vers une aile que tu n'as pas encore explorée.`,
        `Already ${stampsCount} stamp${plural ? 's' : ''} in your notebook, well done! Head off to a wing you haven't explored yet.`,
        'happy',
      ),
    ]),
    dialogue('talk-stamps-1', [
      line(
        'Ton carnet progresse bien. Pense à revenir me voir après ta prochaine aile !',
        'Your notebook is coming along nicely. Come tell me about it after your next wing!',
        'neutral',
      ),
    ]),
    dialogue('talk-stamps-2', [
      line(
        "Plus qu'un effort ou deux et ta carte sera complète. Courage, l'exploration continue !",
        'Just one or two more, and your card will be complete. Keep going, the adventure continues!',
        'thinking',
      ),
    ]),
  ]
}

/** Conseil ajouté en fin de dialogue quand le programme est chargé et qu'aucune archive n'est visitée. */
function archivesHintLine(): DialogueLine {
  return line(
    "Au fait : la porte en bas du hall, derrière l'entrée, mène aux Archives de 2040. À voir si ce n'est pas déjà fait !",
    "By the way: the door at the bottom of the hall, behind the entrance, leads to the 2040 Archives. Worth a look if you haven't yet!",
    'thinking',
  )
}

function talkDialogue(visitedCount: number, stampsCount: number, archivesToVisit?: boolean): Dialogue {
  const base =
    stampsCount >= EXHIBIT_WINGS.length
      ? pickVariant(TALK_COMPLETE, visitedCount)
      : stampsCount >= 1
        ? pickVariant(talkStampsVariants(stampsCount), visitedCount)
        : visitedCount > 0
          ? pickVariant(TALK_SOME, visitedCount)
          : pickVariant(TALK_NONE, visitedCount)
  if (!archivesToVisit) return base
  return { ...base, id: `${base.id}-archives-hint`, lines: [...base.lines, archivesHintLine()] }
}

// --- Tampon obtenu ---------------------------------------------------------

const STAMP_DIALOGUES: Record<ExhibitWingId, Dialogue> = {
  infrastructures: dialogue('stamp-infrastructures', [
    line('Un tampon Infrastructures dans ton carnet, bravo !', 'An Infrastructures stamp in your notebook, well done!', 'happy'),
    line(
      "Cette aile raconte tout ce qu'on ne voit pas : puces, câbles, centres de données, énergie.",
      'This wing tells the story of what stays hidden: chips, cables, data centres, energy.',
      'thinking',
    ),
    line(
      "Il te reste peut-être d'autres ailes à explorer. Bonne suite de visite !",
      'You might have other wings left to explore. Enjoy the rest of your visit!',
      'neutral',
    ),
  ]),
  industrialisation: dialogue('stamp-industrialisation', [
    line('Un tampon Industrialisation, félicitations !', 'An Industrialisation stamp, congratulations!', 'happy'),
    line(
      "Ici, on passe de l'idée à l'objet : des ateliers où une invention devient un usage courant.",
      'Here, ideas become objects: workshops where an invention turns into everyday use.',
      'thinking',
    ),
    line(
      "Continue ta visite, une autre aile t'attend peut-être encore.",
      'Carry on with your visit, another wing might still be waiting for you.',
      'neutral',
    ),
  ]),
  culture: dialogue('stamp-culture', [
    line('Un tampon Culture, quelle jolie étape !', 'A Culture stamp, what a lovely milestone!', 'happy'),
    line(
      'Cette aile parle de nous : comment nos habitudes et nos regards changent, doucement.',
      'This wing speaks of us: how our habits and outlook are quietly shifting.',
      'thinking',
    ),
    line(
      'Il te reste peut-être encore un peu de musée à découvrir. À très vite !',
      'There might still be a bit more museum to discover. See you soon!',
      'neutral',
    ),
  ]),
}

// --- Carte complète (première fois) ----------------------------------------

function completeDialogue(): Dialogue {
  return dialogue('complete', [
    line(
      "Ta carte est complète ! Tu as découvert les 100 qui font l'IA en Europe, bravo.",
      "Your card is complete! You've discovered the 100 people shaping AI in Europe, well done.",
      'happy',
    ),
    line(
      'Partage-la si tu veux, et continue de flâner dans le musée aussi longtemps que tu veux.',
      'Share it if you like, and feel free to keep wandering the museum for as long as you want.',
      'happy',
    ),
  ])
}

export function minerveDialogue(event: MinerveEvent): Dialogue {
  switch (event.kind) {
    case 'welcome':
      return welcomeDialogue()
    case 'talk':
      return talkDialogue(event.visitedCount, event.stampsCount, event.archivesToVisit)
    case 'stamp':
      return STAMP_DIALOGUES[event.wing]
    case 'complete':
      return completeDialogue()
  }
}
