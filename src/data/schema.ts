/**
 * Schéma de validation d'une fiche (zod) — fidèle à `Person` (src/types).
 * Propriétaire : agent données. Utilisé par le dépôt (Supabase / JSON statique) et par l'import CSV/TSV/JSON.
 */
import { z } from 'zod'
import type { ExhibitWingId, Person, PersonLink } from '../types'
import { EXHIBIT_WINGS } from '../types'

const KEBAB_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COUNTRY_CODE_RE = /^[A-Z]{2}$/
const PORTRAIT_PATH_RE = /^\/portraits\/[a-zA-Z0-9._-]+\.(?:webp|jpg|jpeg|png)$/i

const WING_VALUES = EXHIBIT_WINGS as unknown as [ExhibitWingId, ...ExhibitWingId[]]

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/** Texte bilingue : `en` peut être vide (repli FR côté UI). */
const localized = z.object({ fr: z.string(), en: z.string() })

/** Texte bilingue dont le FR est obligatoire (et borné en longueur si `maxFr` est fourni). */
function requiredLocalized(maxFr?: number) {
  const fr = maxFr ? z.string().trim().min(1).max(maxFr) : z.string().trim().min(1)
  return z.object({ fr, en: z.string() })
}

const linkSchema = z.object({
  label: z.string().trim().min(1, 'libellé de lien requis'),
  url: z.string().refine(isHttpUrl, 'lien : URL http(s) uniquement'),
}) satisfies z.ZodType<PersonLink>

/** URL de photo : `null`, une URL https, ou un chemin local `/portraits/…`. */
const photoUrlSchema = z
  .string()
  .refine((v) => isHttpsUrl(v) || PORTRAIT_PATH_RE.test(v), 'photo : URL https ou chemin /portraits/…')
  .nullable()

export const PersonSchema = z.object({
  id: z.string().regex(KEBAB_ID_RE, 'id : kebab-case (ex. arthur-mensch)'),
  order: z.number().int('order : entier').min(1, 'order : ≥ 1'),
  name: z.string().trim().min(1, 'nom requis').max(80, 'nom : 80 caractères maximum'),
  role: requiredLocalized(),
  organization: z.string().trim(),
  /** ISO 3166-1 alpha-2 en majuscules ; `EU` accepté pour les fiches d'attente. */
  country: z.string().regex(COUNTRY_CODE_RE, 'country : code ISO 3166-1 alpha-2 (ex. FR)'),
  wing: z.enum(WING_VALUES),
  bio: requiredLocalized(220),
  story: localized,
  quote: localized.optional(),
  photoUrl: photoUrlSchema,
  photoCredit: z.string().trim().min(1).optional(),
  links: z.array(linkSchema).max(8, '8 liens maximum').optional(),
  placeholder: z.boolean(),
}) satisfies z.ZodType<Person>

export type PersonParseError = { index: number; id: string | null; message: string }

export interface ParsePeopleResult {
  people: Person[]
  errors: string[]
}

const WING_ORDER: Record<ExhibitWingId, number> = Object.fromEntries(
  EXHIBIT_WINGS.map((wing, i) => [wing, i]),
) as Record<ExhibitWingId, number>

function describeZodError(error: z.ZodError, index: number, id: unknown): string {
  const label = typeof id === 'string' && id ? id : `ligne ${index + 1}`
  const detail = error.issues
    .map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`)
    .join(' ; ')
  return `${label} : ${detail}`
}

/**
 * Valide une liste brute (Supabase, JSON statique ou import) : garde les fiches valides,
 * signale les invalides, dédoublonne les `id` (garde la première occurrence) et trie par aile puis `order`.
 */
export function parsePeople(input: unknown): ParsePeopleResult {
  const errors: string[] = []
  if (!Array.isArray(input)) {
    return { people: [], errors: ['la liste des personnes doit être un tableau'] }
  }

  const seenIds = new Set<string>()
  const valid: Person[] = []

  input.forEach((raw, index) => {
    const result = PersonSchema.safeParse(raw)
    if (!result.success) {
      const rawId = raw && typeof raw === 'object' && 'id' in raw ? (raw as { id?: unknown }).id : undefined
      errors.push(describeZodError(result.error, index, rawId))
      return
    }
    const person = result.data
    if (seenIds.has(person.id)) {
      errors.push(`${person.id} : id en double, fiche ignorée`)
      return
    }
    seenIds.add(person.id)
    valid.push(person)
  })

  valid.sort((a, b) => WING_ORDER[a.wing] - WING_ORDER[b.wing] || a.order - b.order || a.id.localeCompare(b.id))

  return { people: valid, errors }
}

/**
 * Convertit une ligne Supabase (colonnes `snake_case`) en objet brut de la forme `Person`
 * (à valider ensuite avec `PersonSchema` / `parsePeople`). Ne valide rien elle-même.
 */
export function mapSupabaseRow(row: unknown): unknown {
  if (!row || typeof row !== 'object') return row
  const r = row as Record<string, unknown>
  const hasQuote = (r.quote_fr ?? '') !== '' || (r.quote_en ?? '') !== ''
  return {
    id: r.id,
    order: r.ord,
    name: r.name,
    role: { fr: r.role_fr ?? '', en: r.role_en ?? '' },
    organization: r.organization ?? '',
    country: r.country,
    wing: r.wing,
    bio: { fr: r.bio_fr ?? '', en: r.bio_en ?? '' },
    story: { fr: r.story_fr ?? '', en: r.story_en ?? '' },
    quote: hasQuote ? { fr: r.quote_fr ?? '', en: r.quote_en ?? '' } : undefined,
    photoUrl: r.photo_url ?? null,
    photoCredit: r.photo_credit ?? undefined,
    links: Array.isArray(r.links) ? r.links : [],
    placeholder: r.placeholder ?? false,
  }
}
