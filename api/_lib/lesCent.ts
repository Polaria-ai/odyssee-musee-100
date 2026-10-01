/**
 * Les 100 tels que Rémi · IA les connaît : une ligne courte par personne (nom, rôle, organisation,
 * pays, aile, accroche d'environ 200 caractères). Rien d'autre : ni l'histoire longue, ni la citation,
 * ni les liens. Rémi ne doit parler d'une personne que dans la limite de ces lignes.
 *
 * `condenseLesCent` est pure. Les données embarquées dans la fonction (`lesCent.data.ts`) en sont la
 * sortie pour `public/data/people.json`, produite par `scripts/generate-remi-data.ts` : un import
 * TypeScript statique est embarqué par Vercel dans la fonction, alors qu'une lecture de fichier ou un
 * import JSON en ESM dépendraient de la façon dont la plateforme empaquette les fichiers. Un test
 * échoue si `lesCent.data.ts` n'est plus à jour.
 */
import type { ExhibitWingId } from '../../src/types/index.js'

export const BIO_MAX_CHARS = 200

export interface LesCentEntry {
  name: string
  role: string
  organization: string
  /** Code pays ISO 3166-1 alpha-2. */
  country: string
  wing: ExhibitWingId
  /** Accroche en français, tronquée à `BIO_MAX_CHARS` caractères au plus (ellipse comprise). */
  bio: string
}

/** Ce que `condenseLesCent` lit d'une fiche de `public/data/people.json` (le reste est ignoré). */
export interface PersonSource {
  order: number
  name: string
  role: { fr: string }
  organization: string
  country: string
  wing: ExhibitWingId
  bio: { fr: string }
  placeholder: boolean
}

/** Ordre des ailes dans le prompt : celui des tables rondes. */
export const WING_ORDER: readonly ExhibitWingId[] = ['infrastructures', 'industrialisation', 'culture']

/** Tronque à la limite de mot, avec une ellipse, sans dépasser `max` caractères. */
export function truncateBio(text: string, max = BIO_MAX_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${base.replace(/[\s,;:.\-–—]+$/, '')}…`
}

/**
 * Fiches réelles uniquement : une fiche d'attente (`placeholder: true`) n'a ni vrai nom ni vraie
 * organisation, Rémi ne doit jamais la citer. Tri : aile (ordre des tables rondes), puis rang d'affichage.
 */
export function condenseLesCent(people: readonly PersonSource[]): LesCentEntry[] {
  return people
    .filter((p) => !p.placeholder)
    .slice()
    .sort((a, b) => WING_ORDER.indexOf(a.wing) - WING_ORDER.indexOf(b.wing) || a.order - b.order)
    .map((p) => ({
      name: p.name.trim(),
      role: p.role.fr.trim(),
      organization: p.organization.trim(),
      country: p.country,
      wing: p.wing,
      bio: truncateBio(p.bio.fr),
    }))
}
