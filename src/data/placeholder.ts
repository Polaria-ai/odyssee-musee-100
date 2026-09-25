/**
 * Fiches d'attente : la vraie liste des 100 (étude Oliver Wyman) n'est pas encore reçue.
 * Ces fiches sont clairement fictives (nom « Portrait n°N », `placeholder: true`, aucune photo,
 * aucun vrai nom) et expliquent au visiteur que la liste officielle sera dévoilée à L'Odyssée de l'IA.
 * Propriétaire : agent données.
 */
import type { ExhibitWingId, Localized, Person } from '../types'
import { EXHIBIT_WINGS } from '../types'

/**
 * Rôles génériques bilingues, piochés en boucle (déterministe) pour varier les cartels
 * sans jamais suggérer une identité réelle.
 */
const PLACEHOLDER_ROLES: Localized[] = [
  { fr: 'Chercheuse ou chercheur', en: 'Researcher' },
  { fr: 'Fondatrice ou fondateur', en: 'Founder' },
  { fr: 'Investisseuse ou investisseur', en: 'Investor' },
  { fr: 'Décideuse ou décideur public', en: 'Public policymaker' },
  { fr: 'Dirigeante ou dirigeant', en: 'Executive' },
  { fr: 'Professeure ou professeur', en: 'Professor' },
  { fr: 'Ingénieure ou ingénieur', en: 'Engineer' },
  { fr: 'Entrepreneuse ou entrepreneur', en: 'Entrepreneur' },
]

/**
 * `organization` est vide sur une fiche d'attente : il n'y a pas d'organisation à afficher tant
 * que la vraie liste n'est pas reçue. L'UI (`src/ui/format.ts`) et le monde (`src/world/textures.ts`)
 * savent déjà afficher un texte localisé (FR/EN) à la place d'une organisation vide sur une fiche
 * `placeholder` — ne pas réintroduire de texte ici, ce serait dupliqué et non traduit correctement.
 */
const PLACEHOLDER_ORGANIZATION = ''

const BIO: Localized = {
  fr: "Cette fiche est un espace réservé. La liste officielle des 100 qui font l'IA en Europe (étude Oliver Wyman) sera dévoilée le 6 octobre 2026, à L'Odyssée de l'IA.",
  en: "This card is a placeholder. The official list of the 100 shaping AI in Europe (Oliver Wyman study) will be revealed on 6 October 2026, at L'Odyssée de l'IA.",
}

function story(n: number, total: number): Localized {
  return {
    fr: `Numéro ${n} sur ${total}.\n\nEn attendant la liste officielle, ce musée expose ${total} fiches d'attente : une pour chacune des ${total} personnalités qui feront l'IA en Europe, selon l'étude Oliver Wyman. Le 6 octobre 2026, à L'Odyssée de l'IA, chaque cadre retrouvera son vrai visage, son vrai nom et sa vraie histoire.`,
    en: `Number ${n} of ${total}.\n\nWhile the official list is being finalised, this museum displays ${total} placeholder cards — one for each of the ${total} people shaping AI in Europe, according to the Oliver Wyman study. On 6 October 2026, at L'Odyssée de l'IA, every frame will reveal its real face, name and story.`,
  }
}

/**
 * `count` fiches d'attente clairement fictives, réparties ~34/33/33 sur les trois ailes.
 * Purement déterministe : mêmes entrées à chaque appel, aucun aléa, aucun vrai nom.
 */
export function generatePlaceholderPeople(count = 100): Person[] {
  return Array.from({ length: count }, (_, i) => {
    const wing: ExhibitWingId = EXHIBIT_WINGS[i % EXHIBIT_WINGS.length]
    const n = i + 1
    return {
      id: `portrait-${String(n).padStart(3, '0')}`,
      order: n,
      name: `Portrait n°${n}`,
      role: PLACEHOLDER_ROLES[i % PLACEHOLDER_ROLES.length],
      organization: PLACEHOLDER_ORGANIZATION,
      country: 'EU',
      wing,
      bio: BIO,
      story: story(n, count),
      photoUrl: null,
      placeholder: true,
    }
  })
}
