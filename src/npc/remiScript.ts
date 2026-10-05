/**
 * Textes à faire valider par Rémi Godeau / L'Opinion avant le 6 octobre.
 *
 * Dialogues de Rémi Godeau, directeur de la rédaction de L'Opinion et co-organisateur de la soirée,
 * qui accueille les visiteurs au comptoir du hall (décision de Baptiste du 29/09). C'est une PERSONNE
 * RÉELLE : ces phrases sont écrites en son nom, tant qu'il ne les a pas relues elles restent des
 * propositions. Règles d'écriture (à garder à chaque modification) :
 *  - vouvoiement partout, ton sobre, factuel et chaleureux ;
 *  - aucune opinion, aucune prise de position, aucune promesse, aucun chiffre qu'il n'aurait pas validé
 *    (les seuls nombres admis sont les noms propres « 100 », « 2026 », « 2040 » et le nombre de tampons
 *    déjà obtenus, qui est un fait de la partie) ;
 *  - il présente le musée, les trois ailes (les trois tables rondes), le rallye des tampons et les
 *    Archives de 2040 ; il ne juge ni les personnes exposées ni le contenu des tables rondes.
 * Liste complète des répliques FR/EN, pour la relecture : `docs/TEXTES-REMI.md` (un test vérifie
 * qu'elle contient chaque réplique de ce fichier).
 *
 * Contenu bilingue, déterministe (aucun Math.random : les variantes sont choisies à partir des
 * compteurs de progression). Pas d'humeur (`mood`) : le personnage 3D n'a pas d'expression à animer.
 * Propriétaire : agent accueil-remi.
 */
import type { Dialogue, DialogueLine, ExhibitWingId, Localized } from '../types'
import { EXHIBIT_WINGS } from '../types'

export type RemiEvent =
  | { kind: 'welcome' }
  /**
   * `archivesToVisit` (optionnel) : vrai si le programme de la soirée est chargé et qu'aucune
   * archive n'a encore été consultée — ajoute un conseil sur la porte des Archives (sud du hall). Absent ou faux :
   * comportement inchangé (voir `docs/ARCHITECTURE.md`, contrat de `gameStore.interact()`).
   */
  | { kind: 'talk'; visitedCount: number; stampsCount: number; total: number; archivesToVisit?: boolean }
  | { kind: 'stamp'; wing: ExhibitWingId }
  | { kind: 'complete' }

export const REMI_NAME: Localized = { fr: 'Rémi Godeau', en: 'Rémi Godeau' }

function line(fr: string, en: string): DialogueLine {
  return { text: { fr, en } }
}

function dialogue(id: string, lines: DialogueLine[]): Dialogue {
  return { id, speaker: REMI_NAME, lines }
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
      'Bienvenue au Musée des 100. Explorez les portraits, collectionnez les tampons et découvrez les Archives de 2040.',
      'Welcome to the Museum of the 100. Explore the portraits, collect stamps and discover the 2040 Archives.',
    ),
  ])
}

// --- Discussion (varie selon la progression) ------------------------------

/**
 * Aucun portrait ouvert (`visitedCount` = 0) : le compteur ne varie pas, donc une seule conversation,
 * qui dit comment commencer (une variante de plus ne serait jamais atteinte).
 */
const TALK_NONE: Dialogue = dialogue('talk-none-0', [
  line(
    "Vous n'avez pas encore ouvert de portrait. Choisissez une porte : l'aile Infrastructures est à l'ouest.",
    "You haven't opened a portrait yet. Pick a door: the Infrastructures wing is to the west.",
  ),
  line(
    'Devant un cadre, touchez « Regarder » pour ouvrir la fiche du portrait.',
    'In front of a frame, tap “Look” to open the portrait card.',
  ),
])

const TALK_SOME: readonly Dialogue[] = [
  dialogue('talk-some-0', [
    line(
      "Votre visite est bien engagée. Avez-vous parcouru l'aile Infrastructures, à l'ouest ?",
      'Your visit is well under way. Have you been through the Infrastructures wing, to the west?',
    ),
  ]),
  dialogue('talk-some-1', [
    line(
      "L'aile Industrialisation, au nord, est ouverte si vous souhaitez la parcourir.",
      'The Industrialisation wing, to the north, is open if you wish to explore it.',
    ),
  ]),
  dialogue('talk-some-2', [
    line(
      "N'oubliez pas l'aile Culture, à l'est, si vous ne l'avez pas encore parcourue.",
      "Don't forget the Culture wing, to the east, if you haven't explored it yet.",
    ),
  ]),
]

const TALK_COMPLETE: readonly Dialogue[] = [
  dialogue('talk-complete-0', [
    line(
      'Vous avez obtenu le tampon de chacune des trois ailes. Vous pouvez repasser voir les portraits qui vous ont intéressé.',
      'You have earned the stamp of each of the three wings. You can go back to the portraits that interested you.',
    ),
  ]),
  dialogue('talk-complete-1', [
    line(
      'Votre carnet est bien rempli. Vous pouvez le partager si vous le souhaitez.',
      'Your stamp card is well filled. You can share it if you wish.',
    ),
  ]),
  dialogue('talk-complete-2', [
    line(
      'Merci d\'avoir parcouru le musée. Vous pouvez y flâner aussi longtemps que vous le souhaitez.',
      'Thank you for exploring the museum. You are welcome to wander here for as long as you like.',
    ),
  ]),
]

function talkStampsVariants(stampsCount: number): readonly Dialogue[] {
  const plural = stampsCount > 1
  return [
    dialogue('talk-stamps-0', [
      line(
        `Déjà ${stampsCount} ${plural ? 'tampons' : 'tampon'} dans votre carnet. Vous pouvez poursuivre avec une aile que vous n'avez pas encore explorée.`,
        `Already ${stampsCount} stamp${plural ? 's' : ''} in your stamp card. You can continue with a wing you haven't explored yet.`,
      ),
    ]),
    dialogue('talk-stamps-1', [
      line(
        'Votre carnet avance. N\'hésitez pas à repasser me voir après votre prochaine aile.',
        'Your stamp card is filling up. Feel free to come back and see me after your next wing.',
      ),
    ]),
    dialogue('talk-stamps-2', [
      line(
        'Il reste des ailes à parcourir pour compléter votre carnet. Prenez votre temps.',
        'There are wings left to explore to complete your stamp card. Take your time.',
      ),
    ]),
  ]
}

/** Conseil ajouté en fin de dialogue quand le programme est chargé et qu'aucune archive n'est visitée. */
function archivesHintLine(): DialogueLine {
  return line(
    "Un conseil : au sud du hall, une porte mène aux Archives de 2040, si vous ne les avez pas encore visitées.",
    "A suggestion: to the south of the hall, a door leads to the 2040 Archives, if you haven't visited them yet.",
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
          : TALK_NONE
  if (!archivesToVisit) return base
  return { ...base, id: `${base.id}-archives-hint`, lines: [...base.lines, archivesHintLine()] }
}

// --- Tampon obtenu ---------------------------------------------------------

const STAMP_DIALOGUES: Record<ExhibitWingId, Dialogue> = {
  infrastructures: dialogue('stamp-infrastructures', [
    line('Vous venez d\'obtenir le tampon Infrastructures. Félicitations !', 'You have just earned the Infrastructures stamp. Congratulations!'),
    line(
      'Votre visite peut se poursuivre avec les autres ailes, quand vous le souhaitez.',
      'Your visit can continue with the other wings whenever you like.',
    ),
  ]),
  industrialisation: dialogue('stamp-industrialisation', [
    line('Vous venez d\'obtenir le tampon Industrialisation. Félicitations !', 'You have just earned the Industrialisation stamp. Congratulations!'),
    line(
      'Votre visite peut se poursuivre avec les autres ailes, quand vous le souhaitez.',
      'Your visit can continue with the other wings whenever you like.',
    ),
  ]),
  culture: dialogue('stamp-culture', [
    line('Vous venez d\'obtenir le tampon Culture. Félicitations !', 'You have just earned the Culture stamp. Congratulations!'),
    line(
      'Votre visite peut se poursuivre avec les autres ailes, quand vous le souhaitez.',
      'Your visit can continue with the other wings whenever you like.',
    ),
  ]),
}

// --- Carnet complet (première fois) ----------------------------------------

function completeDialogue(): Dialogue {
  return dialogue('complete', [
    line(
      'Votre carnet est complet. Merci d\'avoir parcouru le musée.',
      'Your stamp card is complete. Thank you for exploring the museum.',
    ),
    line(
      'Vous pouvez le partager si vous le souhaitez, et continuer à flâner ici aussi longtemps que vous le voudrez.',
      'You can share it if you wish, and keep wandering here for as long as you like.',
    ),
  ])
}

export function remiDialogue(event: RemiEvent): Dialogue {
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
