/**
 * Schémas de validation (zod) du programme de la soirée et des transcriptions déposées par l'agent
 * de transcription. Fidèle aux types `EveningSession` / `SessionArchive`
 * (`src/types`). Utilisé par `evening.ts` (repli Supabase/JSON) et `scripts/import-evening.ts`.
 * Propriétaire : workflow « Archives de 2040 ».
 */
import { z } from 'zod'
import { MAX_ARCHIVE_TRANSCRIPT_CHARS, type EveningSession, type Localized, type SessionArchive, type SessionSpeaker } from '../types'
import { ARCHIVE_SESSIONS, EVENING_PROGRAM } from './eveningProgram'

const KEBAB_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

/** Texte bilingue : `en` peut être vide (repli FR côté UI). */
const localized = z.object({ fr: z.string(), en: z.string() })

/** Texte bilingue dont le FR est obligatoire, l'un et l'autre bornés en longueur si fournie. */
function boundedLocalized(maxLen?: number) {
  const fr = maxLen ? z.string().trim().min(1).max(maxLen) : z.string().trim().min(1)
  const en = maxLen ? z.string().max(maxLen) : z.string()
  return z.object({ fr, en })
}

export const SessionSpeakerSchema = z.object({
  name: z.string().trim().min(1, 'nom requis'),
  organization: z.string().trim().min(1).optional(),
  role: localized.optional(),
  moderator: z.boolean().optional(),
}) satisfies z.ZodType<SessionSpeaker>

const SESSION_KINDS = [
  'ouverture',
  'film',
  'presentation',
  'keynote',
  'les100',
  'magneto',
  'table-ronde',
  'face-a-face',
  'final',
  'cloture',
] as const

export const EveningSessionSchema = z.object({
  id: z.string().regex(KEBAB_ID_RE, 'id : kebab-case (ex. table-ronde-1)'),
  order: z.number().int('order : entier').min(1, 'order : ≥ 1'),
  startTime: z.string().regex(TIME_RE, 'startTime : format HH:MM'),
  durationMin: z.number().int('durationMin : entier').min(1, 'durationMin : ≥ 1'),
  kind: z.enum(SESSION_KINDS),
  title: boundedLocalized(200),
  theme: localized.optional(),
  speakers: z.array(SessionSpeakerSchema).max(12, '12 intervenant·es maximum par séquence'),
  provisional: z.boolean(),
}) satisfies z.ZodType<EveningSession>

/** Transcription intégrale : FR obligatoire, EN facultatif, jusqu'à 40 000 caractères par langue. */
export const ArchiveTranscriptSchema = z.object({
  fr: z.string().trim().min(1, 'transcription FR requise').max(MAX_ARCHIVE_TRANSCRIPT_CHARS),
  en: z.string().max(MAX_ARCHIVE_TRANSCRIPT_CHARS),
})

export const SessionArchiveSchema = z.object({
  sessionId: z.string().regex(KEBAB_ID_RE, 'sessionId : kebab-case'),
  transcript: ArchiveTranscriptSchema,
  archivedAt: z.string().regex(ISO_DATETIME_RE, 'archivedAt : date ISO 8601'),
  published: z.boolean(),
}) satisfies z.ZodType<SessionArchive>

/** Ce que l'agent de transcription dépose pour une table ronde : sans horodatage ni statut de publication (ajoutés à l'import). */
export const AgentArchiveEntrySchema = SessionArchiveSchema.omit({ archivedAt: true, published: true })
export type AgentArchiveEntry = z.infer<typeof AgentArchiveEntrySchema>

/** Sortie attendue de l'agent de transcription. Voir `docs/EVENING-AGENT.md`. */
export const EveningAgentOutputSchema = z.object({
  version: z.literal(2),
  event: z.literal('odyssee-ia-2026'),
  generatedAt: z.string().regex(ISO_DATETIME_RE, 'generatedAt : date ISO 8601'),
  archives: z.array(AgentArchiveEntrySchema).max(EVENING_PROGRAM.length, 'plus d’archives que de séquences au programme'),
})
export type EveningAgentOutput = z.infer<typeof EveningAgentOutputSchema>

function describeZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`).join(' ; ')
}

export interface ParseAgentOutputResult {
  /** Transcriptions acceptées pour les trois tables rondes. */
  accepted: AgentArchiveEntry[]
  /** Rejets lisibles, un par ligne : séquence hors tables rondes ou doublon. */
  errors: string[]
  /** Horodatage de dépôt annoncé par l'agent, `null` si le fichier n'a pas passé la validation de forme. */
  generatedAt: string | null
}

/**
 * Valide la sortie brute de l'agent : seules les trois tables rondes sont acceptées, les autres
 * séquences sont explicitement rejetées. Ne rejette jamais : renvoie toujours un rapport.
 */
export function parseAgentOutput(input: unknown): ParseAgentOutputResult {
  const result = EveningAgentOutputSchema.safeParse(input)
  if (!result.success) {
    return { accepted: [], errors: [describeZodError(result.error)], generatedAt: null }
  }

  const knownSessions = new Map(ARCHIVE_SESSIONS.map((s) => [s.id, s]))
  const errors: string[] = []
  const seenSessionIds = new Set<string>()
  const accepted: AgentArchiveEntry[] = []

  for (const entry of result.data.archives) {
    const session = knownSessions.get(entry.sessionId)
    if (!session) {
      errors.push(`${entry.sessionId} : seules les tables rondes sont archivées, entrée ignorée`)
      continue
    }
    if (seenSessionIds.has(entry.sessionId)) {
      errors.push(`${entry.sessionId} : séquence en double dans le fichier, archive ignorée (garde la première)`)
      continue
    }
    seenSessionIds.add(entry.sessionId)

    accepted.push(entry)
  }

  return { accepted, errors, generatedAt: result.data.generatedAt }
}

/** Archives acceptées → `SessionArchive[]` complets, prêts pour le JSON statique / le seed SQL. */
export function toSessionArchives(accepted: AgentArchiveEntry[], archivedAt: string, published: boolean): SessionArchive[] {
  return accepted.map((entry) => ({ ...entry, archivedAt, published }))
}

/** Vrai si `title`/`theme` valent la peine d'être affichés (FR non vide). */
export function hasText(value: Localized | undefined): value is Localized {
  return Boolean(value && value.fr.trim())
}
