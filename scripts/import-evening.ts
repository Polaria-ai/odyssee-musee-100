#!/usr/bin/env tsx
/**
 * Import de la sortie de l'agent de transcription (voir `docs/EVENING-AGENT.md`) vers
 * `public/data/evening.json` et `supabase/seed/evening-archives.sql`. Toujours en brouillon
 * (`published = false`) sauf `--publish`, sur demande de publication. Ne nécessite aucune clé de
 * service : le SQL généré est appliqué séparément (SQL editor Supabase), sauf `--push`.
 * Propriétaire : workflow « Archives de 2040 ».
 *
 * Usage : pnpm exec tsx scripts/import-evening.ts --file <sortie-agent.json> [--dry-run] [--publish] [--reviewer "<nom>"] [--push]
 * `--reviewer` est facultatif et ne sert que si une relecture a réellement eu lieu.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { SessionArchive } from '../src/types'
import { type AgentArchiveEntry, parseAgentOutput, toSessionArchives } from '../src/data/eveningSchema'

// ---------------------------------------------------------------------------
// SQL (upsert idempotent), même style que `scripts/import-people.ts`.
// ---------------------------------------------------------------------------

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}

export interface SeedSqlOptions {
  /**
   * `true` sur demande explicite de publication. Toute mise à jour non publiée remet l'archive
   * en brouillon et efface sa précédente trace de relecture.
   */
  publish?: boolean
  /**
   * Nom de la personne qui a relu (colonne `reviewed_by`). Un brouillon efface cette trace;
   * elle reste vide pour une publication sans relecture.
   */
  reviewer?: string
}

/**
 * SQL d'upsert idempotent (une transaction, `on conflict (session_id) do update`) — à relire puis
 * exécuter dans le SQL editor Supabase. Un upsert sans `--publish` dépublie une ancienne version :
 * une transcription modifiée doit faire l'objet d'une nouvelle demande de publication.
 */
export function buildSeedSql(archives: SessionArchive[], options: SeedSqlOptions = {}): string {
  const published = options.publish ?? false
  const reviewer = published ? (options.reviewer ?? null) : null
  const updateAssignments = [
    'transcript_fr = excluded.transcript_fr',
    'transcript_en = excluded.transcript_en',
    'archived_at = excluded.archived_at',
    'published = excluded.published',
    'reviewed_by = excluded.reviewed_by',
    'updated_at = now()',
  ]
  const statements = archives.map(
    (a) => `insert into public.session_archives (
  session_id, transcript_fr, transcript_en, archived_at, published, reviewed_by
) values (
  ${sqlString(a.sessionId)}, ${sqlString(a.transcript.fr)}, ${sqlString(a.transcript.en)},
  ${sqlString(a.archivedAt)}, ${published}, ${sqlString(reviewer)}
)
on conflict (session_id) do update set
  ${updateAssignments.join(',\n  ')};`,
  )
  const note = published
    ? reviewer
      ? '-- published = true : transcriptions publiées avec une relecture renseignée.\n'
      : '-- published = true : transcriptions publiées sans relecture préalable.\n'
    : '-- published = false : brouillon; toute ancienne version est dépubliée jusqu’à nouvelle publication.\n'
  return `-- Généré par scripts/import-evening.ts — exécuter dans Supabase.\n${note}begin;\n\n${statements.join('\n\n')}\n\ncommit;\n`
}

/** `SessionArchive` (camelCase) → ligne Supabase (snake_case), pour `--push`. */
export function toSupabaseRow(a: SessionArchive, options: SeedSqlOptions = {}): Record<string, unknown> {
  const row: Record<string, unknown> = {
    session_id: a.sessionId,
    transcript_fr: a.transcript.fr,
    transcript_en: a.transcript.en,
    archived_at: a.archivedAt,
    published: options.publish ?? false,
    reviewed_by: options.publish ? (options.reviewer ?? null) : null,
  }
  return row
}

/**
 * Lignes prêtes pour `--push`. Une transcription modifiée en brouillon dépublie toujours l'ancienne
 * version jusqu'à une nouvelle publication explicite du contenu.
 */
export function toSupabasePushRows(archives: SessionArchive[], publish: boolean, reviewer?: string): Record<string, unknown>[] {
  return archives.map((a) => {
    return toSupabaseRow(a, { publish, reviewer })
  })
}

/** Contenu de `public/data/evening.json` (repli statique de `loadEvening`). */
export function buildEveningJson(archives: SessionArchive[]): { archives: SessionArchive[] } {
  return { archives }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  file?: string
  dryRun: boolean
  publish: boolean
  push: boolean
  reviewer?: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, publish: false, push: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--file') args.file = argv[++i]
    else if (arg.startsWith('--file=')) args.file = arg.slice('--file='.length)
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--publish') args.publish = true
    else if (arg === '--push') args.push = true
    else if (arg === '--reviewer') args.reviewer = argv[++i]?.trim() || undefined
    else if (arg.startsWith('--reviewer=')) args.reviewer = arg.slice('--reviewer='.length).trim() || undefined
  }
  return args
}

function printReport(opts: { total: number; accepted: number; errors: string[] }): void {
  console.log(`\nImport : ${opts.accepted} / ${opts.total} archive(s) acceptée(s).`)
  if (opts.errors.length) {
    console.log(`\nRejets (${opts.errors.length}) :`)
    for (const e of opts.errors) console.log(`  - ${e}`)
  } else {
    console.log('\nAucun rejet.')
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!args.file) {
    console.error(
      'Usage : tsx scripts/import-evening.ts --file <sortie-agent.json> [--dry-run] [--publish] [--reviewer "<nom>"] [--push]',
    )
    process.exitCode = 1
    return
  }
  let raw: unknown
  try {
    const text = await readFile(resolve(args.file), 'utf8')
    raw = JSON.parse(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Fichier illisible ou JSON invalide (${args.file}) : ${message}`)
    process.exitCode = 1
    return
  }

  const { accepted, errors, generatedAt }: { accepted: AgentArchiveEntry[]; errors: string[]; generatedAt: string | null } =
    parseAgentOutput(raw)

  const total = Array.isArray((raw as { archives?: unknown[] })?.archives) ? (raw as { archives: unknown[] }).archives.length : 0
  printReport({ total, accepted: accepted.length, errors })

  if (accepted.length === 0) {
    console.log('\nAucune archive valide : rien à écrire.')
    return
  }

  const archivedAt = generatedAt ?? new Date().toISOString()
  const archives = toSessionArchives(accepted, archivedAt, args.publish)

  if (args.dryRun) {
    console.log('\n(--dry-run : aucun fichier écrit, aucun envoi Supabase.)')
    return
  }

  await mkdir('public/data', { recursive: true })
  await writeFile('public/data/evening.json', `${JSON.stringify(buildEveningJson(archives), null, 2)}\n`, 'utf8')
  await mkdir('supabase/seed', { recursive: true })
  await writeFile('supabase/seed/evening-archives.sql', buildSeedSql(archives, { publish: args.publish, reviewer: args.reviewer }), 'utf8')
  console.log(
    `\nÉcrit : public/data/evening.json, supabase/seed/evening-archives.sql (published = ${args.publish} — ${
      args.publish ? (args.reviewer ? 'relecture renseignée' : 'sans relecture préalable') : 'brouillon'
    }).`,
  )

  if (args.push) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.VITE_SUPABASE_URL
    if (!serviceKey || !url) {
      console.warn('\n--push demandé mais SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_URL absent : ignoré.')
    } else {
      console.log(
        args.publish
          ? '\n--push : envoi direct à Supabase, published = true.'
          : "\n--push : envoi direct à Supabase, en brouillon (l'ancienne version est dépubliée jusqu'à nouvelle publication).",
      )
      const { createClient } = await import('@supabase/supabase-js')
      const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
      const { error } = await admin
        .from('session_archives')
        .upsert(toSupabasePushRows(archives, args.publish, args.reviewer), { onConflict: 'session_id' })
      if (error) console.error(`\nPush Supabase échoué : ${error.message}`)
      else console.log(`\nPush Supabase : ${archives.length} archive(s) upsertée(s).`)
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
