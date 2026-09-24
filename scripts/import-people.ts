#!/usr/bin/env tsx
/**
 * Import de la vraie liste des 100 (CSV, TSV ou JSON) vers `public/data/people.json`
 * et `supabase/seed/people.sql`. Lancé en local par l'orchestrateur (`pnpm import:people <fichier>`).
 * Ne nécessite aucune clé de service : le SQL généré est appliqué séparément (SQL editor Supabase).
 * Propriétaire : agent données. Voir `docs/IMPORT.md` pour le mode d'emploi non-développeur.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import Papa from 'papaparse'
import sharp from 'sharp'
import type { ParseConfig } from 'papaparse'
import type { ExhibitWingId, Person, PersonLink } from '../src/types'
import { parsePeople } from '../src/data/schema'

// ---------------------------------------------------------------------------
// En-têtes tolérés (FR ou EN) → champ canonique.
// ---------------------------------------------------------------------------

type CanonicalField =
  | 'id'
  | 'order'
  | 'name'
  | 'organization'
  | 'country'
  | 'wing'
  | 'roleFr'
  | 'roleEn'
  | 'bioFr'
  | 'bioEn'
  | 'storyFr'
  | 'storyEn'
  | 'quoteFr'
  | 'quoteEn'
  | 'photo'
  | 'photoCredit'
  | 'links'

const HEADER_ALIASES: Record<string, CanonicalField> = {
  id: 'id',
  identifiant: 'id',
  ordre: 'order',
  order: 'order',
  rang: 'order',
  nom: 'name',
  name: 'name',
  organisation: 'organization',
  organization: 'organization',
  entreprise: 'organization',
  societe: 'organization',
  company: 'organization',
  pays: 'country',
  country: 'country',
  aile: 'wing',
  wing: 'wing',
  role: 'roleFr',
  poste: 'roleFr',
  'role fr': 'roleFr',
  'role en': 'roleEn',
  'english role': 'roleEn',
  bio: 'bioFr',
  accroche: 'bioFr',
  'bio fr': 'bioFr',
  'bio en': 'bioEn',
  histoire: 'storyFr',
  story: 'storyFr',
  'histoire fr': 'storyFr',
  'story fr': 'storyFr',
  'histoire en': 'storyEn',
  'story en': 'storyEn',
  citation: 'quoteFr',
  quote: 'quoteFr',
  'citation fr': 'quoteFr',
  'quote fr': 'quoteFr',
  'citation en': 'quoteEn',
  'quote en': 'quoteEn',
  photo: 'photo',
  'photo url': 'photo',
  image: 'photo',
  'credit photo': 'photoCredit',
  'photo credit': 'photoCredit',
  liens: 'links',
  links: 'links',
}

/** Lettres sans accent, minuscules, séparateurs uniformisés en un seul espace. */
function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeHeader(header: string): CanonicalField | null {
  return HEADER_ALIASES[normalizeKey(header)] ?? null
}

/** En-tête d'origine (respecte la casse du fichier) associé à chaque champ canonique reconnu. */
export function buildHeaderMap(headers: string[]): Partial<Record<CanonicalField, string>> {
  const map: Partial<Record<CanonicalField, string>> = {}
  for (const header of headers) {
    const field = normalizeHeader(header)
    if (field && !map[field]) map[field] = header
  }
  return map
}

// ---------------------------------------------------------------------------
// Normalisations (id, pays, aile, liens).
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

/** Noms de pays européens courants (FR/EN) → code ISO 3166-1 alpha-2. Liste non exhaustive. */
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  france: 'FR',
  allemagne: 'DE',
  germany: 'DE',
  espagne: 'ES',
  spain: 'ES',
  italie: 'IT',
  italy: 'IT',
  'pays bas': 'NL',
  netherlands: 'NL',
  holland: 'NL',
  belgique: 'BE',
  belgium: 'BE',
  suisse: 'CH',
  switzerland: 'CH',
  portugal: 'PT',
  irlande: 'IE',
  ireland: 'IE',
  autriche: 'AT',
  austria: 'AT',
  suede: 'SE',
  sweden: 'SE',
  norvege: 'NO',
  norway: 'NO',
  danemark: 'DK',
  denmark: 'DK',
  finlande: 'FI',
  finland: 'FI',
  pologne: 'PL',
  poland: 'PL',
  'republique tcheque': 'CZ',
  czechia: 'CZ',
  'czech republic': 'CZ',
  hongrie: 'HU',
  hungary: 'HU',
  roumanie: 'RO',
  romania: 'RO',
  grece: 'GR',
  greece: 'GR',
  luxembourg: 'LU',
  'royaume uni': 'GB',
  'united kingdom': 'GB',
  uk: 'GB',
  islande: 'IS',
  iceland: 'IS',
  estonie: 'EE',
  estonia: 'EE',
  lettonie: 'LV',
  latvia: 'LV',
  lituanie: 'LT',
  lithuania: 'LT',
  slovenie: 'SI',
  slovenia: 'SI',
  slovaquie: 'SK',
  slovakia: 'SK',
  croatie: 'HR',
  croatia: 'HR',
  bulgarie: 'BG',
  bulgaria: 'BG',
  chypre: 'CY',
  cyprus: 'CY',
  malte: 'MT',
  malta: 'MT',
  europe: 'EU',
  'union europeenne': 'EU',
  'european union': 'EU',
}

/** Code à 2 lettres tel quel, sinon nom de pays FR/EN courant → ISO. `null` si non reconnu. */
export function mapCountryToIso(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase()
  return COUNTRY_NAME_TO_ISO[normalizeKey(trimmed)] ?? null
}

const WING_NAME_TO_ID: Record<string, ExhibitWingId> = {
  infrastructure: 'infrastructures',
  infrastructures: 'infrastructures',
  infra: 'infrastructures',
  industrialisation: 'industrialisation',
  industrialization: 'industrialisation',
  culture: 'culture',
}

/** Libellé d'aile (FR/EN, id déjà valide, ou variante courante) → id d'aile. `null` si non reconnu. */
export function mapWingId(input: string): ExhibitWingId | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  return WING_NAME_TO_ID[normalizeKey(trimmed)] ?? null
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** `Label|https://url` (un lien par ligne ou séparé par `;`), ou une URL nue (libellé = domaine). */
export function parseLinks(cell: string): PersonLink[] {
  if (!cell.trim()) return []
  return cell
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [first, second] = part.split('|').map((s) => s.trim())
      if (second) return { label: first, url: second }
      try {
        return { label: new URL(first).hostname.replace(/^www\./, ''), url: first }
      } catch {
        return { label: first, url: first }
      }
    })
}

// ---------------------------------------------------------------------------
// Une ligne de fichier (déjà à plat, valeurs en `string`) → fiche brute (avant validation zod).
// ---------------------------------------------------------------------------

export type RawPersonInput = Record<string, unknown>

export interface NormalizeRowContext {
  index: number
  autoOrder: number
  wingDefault?: ExhibitWingId
}

export interface NormalizeRowResult {
  row: RawPersonInput
  /** Cellule photo brute (chemin local ou URL), traitée séparément (I/O). */
  photoCell: string
  warnings: string[]
}

/** Convertit une ligne de fichier (en-têtes tolérants) en fiche brute prête pour `PersonSchema`. */
export function normalizeRow(
  record: Record<string, string>,
  headerMap: Partial<Record<CanonicalField, string>>,
  context: NormalizeRowContext,
): NormalizeRowResult {
  const warnings: string[] = []
  const get = (field: CanonicalField): string => {
    const header = headerMap[field]
    const value = header ? record[header] : undefined
    return typeof value === 'string' ? value.trim() : ''
  }

  const label = () => (id || `ligne ${context.index + 2}`)

  const name = get('name')
  const idCell = get('id')
  const id = slugify(idCell || name)

  const orderCell = get('order')
  const parsedOrder = orderCell ? Number.parseInt(orderCell, 10) : NaN
  const order = Number.isFinite(parsedOrder) && parsedOrder > 0 ? parsedOrder : context.autoOrder

  const countryCell = get('country')
  const isoCountry = mapCountryToIso(countryCell)
  if (countryCell && !isoCountry) warnings.push(`${label()} : pays « ${countryCell} » non reconnu`)

  const wingCell = get('wing')
  let wing = mapWingId(wingCell)
  if (!wing && context.wingDefault) {
    wing = context.wingDefault
    warnings.push(`${label()} : aile absente ou non reconnue (« ${wingCell || '—'} »), défaut « ${context.wingDefault} »`)
  } else if (!wing) {
    warnings.push(`${label()} : aile absente ou non reconnue (« ${wingCell || '—'} »)`)
  }

  const quoteFr = get('quoteFr')
  const quoteEn = get('quoteEn')

  const row: RawPersonInput = {
    id,
    order,
    name,
    role: { fr: get('roleFr'), en: get('roleEn') },
    organization: get('organization'),
    country: isoCountry ?? countryCell.toUpperCase(),
    wing: wing ?? wingCell,
    bio: { fr: get('bioFr'), en: get('bioEn') },
    story: { fr: get('storyFr'), en: get('storyEn') },
    quote: quoteFr || quoteEn ? { fr: quoteFr, en: quoteEn } : undefined,
    photoUrl: null,
    photoCredit: get('photoCredit') || undefined,
    links: parseLinks(get('links')),
    placeholder: false,
  }

  return { row, photoCell: get('photo'), warnings }
}

// ---------------------------------------------------------------------------
// Photos : chemin local ou URL → carré 512px recadré en haut, WebP q80, public/portraits/<id>.webp
// ---------------------------------------------------------------------------

export interface PhotoResult {
  photoUrl: string | null
  warning?: string
}

/**
 * Ne garde que la première cellule photo par `id`, dans l'ordre du fichier — cohérent avec
 * `parsePeople` qui garde la première occurrence d'un `id` en double. Sans ça, deux lignes
 * partageant le même `id` (ex. même nom) écraseraient tour à tour `public/portraits/<id>.webp`
 * et la fiche conservée récupérerait la photo de la ligne ignorée plutôt que la sienne.
 */
export function dedupePhotoCells(cells: { id: string; cell: string }[]): { id: string; cell: string }[] {
  const seen = new Set<string>()
  const result: { id: string; cell: string }[] = []
  for (const entry of cells) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    result.push(entry)
  }
  return result
}

async function resolvePhoto(id: string, photoCell: string, options: { noPhotos: boolean }): Promise<PhotoResult> {
  if (!photoCell) return { photoUrl: null }
  if (options.noPhotos) {
    if (isHttpUrl(photoCell) && photoCell.startsWith('https://')) return { photoUrl: photoCell }
    return { photoUrl: null, warning: `${id} : photo non traitée (traitement des images désactivé)` }
  }
  try {
    const buffer = isHttpUrl(photoCell)
      ? Buffer.from(await (await fetch(photoCell)).arrayBuffer())
      : await readFile(resolve(photoCell))
    const outDir = resolve('public/portraits')
    await mkdir(outDir, { recursive: true })
    await sharp(buffer)
      .resize(512, 512, { fit: 'cover', position: 'top' })
      .webp({ quality: 80 })
      .toFile(resolve(outDir, `${id}.webp`))
    return { photoUrl: `/portraits/${id}.webp` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { photoUrl: null, warning: `${id} : photo manquante ou illisible (${message})` }
  }
}

// ---------------------------------------------------------------------------
// Lecture du fichier source (CSV, TSV, JSON).
// ---------------------------------------------------------------------------

function parseDelimited(text: string, ext: string): Record<string, string>[] {
  const config: ParseConfig<Record<string, string>> = { header: true, skipEmptyLines: true }
  if (ext === '.tsv') config.delimiter = '\t'
  // Sinon : auto-détection du séparateur par papaparse (utile pour les exports Excel en `;`).
  const result = Papa.parse<Record<string, string>>(text, config)
  return result.data
}

function normalizeJsonRecords(data: unknown): Record<string, string>[] {
  if (!Array.isArray(data)) throw new Error('le fichier JSON doit contenir un tableau de fiches')
  return data.map((entry) => {
    const record: Record<string, string> = {}
    if (!entry || typeof entry !== 'object') return record
    for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
      if (value === null || value === undefined) record[key] = ''
      else if (typeof value === 'string') record[key] = value
      else if (typeof value === 'number' || typeof value === 'boolean') record[key] = String(value)
      else record[key] = JSON.stringify(value)
    }
    return record
  })
}

async function readRecords(path: string): Promise<Record<string, string>[]> {
  const text = await readFile(path, 'utf8')
  const ext = extname(path).toLowerCase()
  return ext === '.json' ? normalizeJsonRecords(JSON.parse(text)) : parseDelimited(text, ext)
}

// ---------------------------------------------------------------------------
// Sortie : supabase/seed/people.sql (upsert idempotent, published = true).
// ---------------------------------------------------------------------------

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}

function sqlJson(value: unknown): string {
  return `${sqlString(JSON.stringify(value ?? []))}::jsonb`
}

/** SQL d'upsert idempotent (une transaction, `on conflict (id) do update`) — à relire puis exécuter. */
export function buildSeedSql(people: Person[]): string {
  const statements = people.map(
    (p) => `insert into public.people (
  id, ord, name, role_fr, role_en, organization, country, wing,
  bio_fr, bio_en, story_fr, story_en, quote_fr, quote_en,
  photo_url, photo_credit, links, placeholder, published
) values (
  ${sqlString(p.id)}, ${p.order}, ${sqlString(p.name)}, ${sqlString(p.role.fr)}, ${sqlString(p.role.en)},
  ${sqlString(p.organization)}, ${sqlString(p.country)}, ${sqlString(p.wing)},
  ${sqlString(p.bio.fr)}, ${sqlString(p.bio.en)}, ${sqlString(p.story.fr)}, ${sqlString(p.story.en)},
  ${sqlString(p.quote?.fr ?? null)}, ${sqlString(p.quote?.en ?? null)},
  ${sqlString(p.photoUrl)}, ${sqlString(p.photoCredit ?? null)}, ${sqlJson(p.links ?? [])}, ${p.placeholder}, true
)
on conflict (id) do update set
  ord = excluded.ord, name = excluded.name,
  role_fr = excluded.role_fr, role_en = excluded.role_en,
  organization = excluded.organization, country = excluded.country, wing = excluded.wing,
  bio_fr = excluded.bio_fr, bio_en = excluded.bio_en,
  story_fr = excluded.story_fr, story_en = excluded.story_en,
  quote_fr = excluded.quote_fr, quote_en = excluded.quote_en,
  photo_url = excluded.photo_url, photo_credit = excluded.photo_credit,
  links = excluded.links, placeholder = excluded.placeholder,
  published = true, updated_at = now();`,
  )
  return `-- Généré par scripts/import-people.ts — à relire, puis exécuter dans le SQL editor Supabase.\nbegin;\n\n${statements.join('\n\n')}\n\ncommit;\n`
}

/** Person (camelCase) → ligne Supabase (snake_case), pour `--push`. Inverse de `mapSupabaseRow`. */
export function toSupabaseRow(p: Person): Record<string, unknown> {
  return {
    id: p.id,
    ord: p.order,
    name: p.name,
    role_fr: p.role.fr,
    role_en: p.role.en,
    organization: p.organization,
    country: p.country,
    wing: p.wing,
    bio_fr: p.bio.fr,
    bio_en: p.bio.en,
    story_fr: p.story.fr,
    story_en: p.story.en,
    quote_fr: p.quote?.fr ?? null,
    quote_en: p.quote?.en ?? null,
    photo_url: p.photoUrl,
    photo_credit: p.photoCredit ?? null,
    links: p.links ?? [],
    placeholder: p.placeholder,
    published: true,
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  input?: string
  dryRun: boolean
  noPhotos: boolean
  push: boolean
  wingDefault?: ExhibitWingId
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, noPhotos: false, push: false }
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--no-photos') args.noPhotos = true
    else if (arg === '--push') args.push = true
    else if (arg.startsWith('--wing-default=')) {
      const value = mapWingId(arg.slice('--wing-default='.length))
      if (value) args.wingDefault = value
      else console.warn(`--wing-default : « ${arg.slice('--wing-default='.length)} » non reconnu, ignoré`)
    } else if (!arg.startsWith('--')) args.input = arg
  }
  return args
}

function printReport(opts: {
  total: number
  imported: number
  validationErrors: string[]
  warnings: string[]
  photoWarnings: string[]
}): void {
  console.log(`\nImport : ${opts.imported} / ${opts.total} fiche(s) valide(s).`)
  if (opts.warnings.length) {
    console.log(`\nAvertissements (${opts.warnings.length}) :`)
    for (const w of opts.warnings) console.log(`  - ${w}`)
  }
  if (opts.photoWarnings.length) {
    console.log(`\nPhotos manquantes ou ignorées (${opts.photoWarnings.length}) :`)
    for (const w of opts.photoWarnings) console.log(`  - ${w}`)
  }
  if (opts.validationErrors.length) {
    console.log(`\nLignes invalides, ignorées (${opts.validationErrors.length}) :`)
    for (const e of opts.validationErrors) console.log(`  - ${e}`)
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!args.input) {
    console.error(
      'Usage : tsx scripts/import-people.ts <fichier.csv|.tsv|.json> [--dry-run] [--wing-default=infrastructures|industrialisation|culture] [--no-photos] [--push]',
    )
    process.exitCode = 1
    return
  }

  const records = await readRecords(args.input)
  if (records.length === 0) {
    console.error('Aucune ligne trouvée dans le fichier.')
    process.exitCode = 1
    return
  }

  const headerMap = buildHeaderMap(Object.keys(records[0]))
  const warnings: string[] = []
  const photoCells: { id: string; cell: string }[] = []
  const rawRows: RawPersonInput[] = []

  records.forEach((record, index) => {
    const { row, photoCell, warnings: rowWarnings } = normalizeRow(record, headerMap, {
      index,
      autoOrder: index + 1,
      wingDefault: args.wingDefault,
    })
    rawRows.push(row)
    warnings.push(...rowWarnings)
    if (photoCell) photoCells.push({ id: String(row.id), cell: photoCell })
  })

  const photoWarnings: string[] = []
  if (photoCells.length > 0) {
    const photoById = new Map<string, string | null>()
    for (const { id, cell } of dedupePhotoCells(photoCells)) {
      const result = await resolvePhoto(id, cell, { noPhotos: args.noPhotos || args.dryRun })
      photoById.set(id, result.photoUrl)
      if (result.warning) photoWarnings.push(result.warning)
    }
    for (const row of rawRows) {
      const id = String(row.id)
      if (photoById.has(id)) row.photoUrl = photoById.get(id) ?? null
    }
  }

  const { people, errors } = parsePeople(rawRows)

  printReport({ total: records.length, imported: people.length, validationErrors: errors, warnings, photoWarnings })

  if (args.dryRun) {
    console.log('\n(--dry-run : aucun fichier écrit, aucune photo traitée.)')
    return
  }

  await mkdir('public/data', { recursive: true })
  await writeFile('public/data/people.json', `${JSON.stringify(people, null, 2)}\n`, 'utf8')
  await mkdir('supabase/seed', { recursive: true })
  await writeFile('supabase/seed/people.sql', buildSeedSql(people), 'utf8')
  console.log('\nÉcrit : public/data/people.json, supabase/seed/people.sql')

  if (args.push) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.VITE_SUPABASE_URL
    if (!serviceKey || !url) {
      console.warn('\n--push demandé mais SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_URL absent : ignoré.')
    } else {
      const { createClient } = await import('@supabase/supabase-js')
      const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
      const { error } = await admin.from('people').upsert(people.map(toSupabaseRow), { onConflict: 'id' })
      if (error) console.error(`\nPush Supabase échoué : ${error.message}`)
      else console.log(`\nPush Supabase : ${people.length} fiche(s) upsertée(s).`)
    }
  }
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false
if (isMain) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
}
