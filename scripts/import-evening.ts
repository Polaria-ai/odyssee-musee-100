#!/usr/bin/env tsx
/**
 * Import de la sortie de l'agent de fin de soirée (voir `docs/EVENING-AGENT.md`) vers
 * `public/data/evening.json` et `supabase/seed/evening-archives.sql`. Toujours en brouillon
 * (`published = false`) sauf `--publish`, après relecture humaine. Ne nécessite aucune clé de
 * service : le SQL généré est appliqué séparément (SQL editor Supabase), sauf `--push`.
 * Propriétaire : workflow « Archives de 2040 ».
 *
 * Usage : pnpm exec tsx scripts/import-evening.ts --file <sortie-agent.json> [--dry-run] [--publish] [--push]
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

function sqlJson(value: unknown): string {
  return `${sqlString(JSON.stringify(value ?? []))}::jsonb`
}

export interface SeedSqlOptions {
  /**
   * `true` seulement une fois les archives relues par un humain : sinon les nouvelles archives
   * sont insérées `published = false` (invisibles des visiteurs — RLS ne sert que
   * `published = true`) et une archive déjà en base garde son statut de publication actuel, quoi
   * qu'il arrive. Défaut : `false`.
   */
  publish?: boolean
}

/**
 * SQL d'upsert idempotent (une transaction, `on conflict (session_id) do update`) — à relire puis
 * exécuter dans le SQL editor Supabase. `published` n'est dans la clause `do update` que si
 * `options.publish` est vrai : une relance sans `--publish` laisse donc le statut de publication
 * des archives déjà en base tel quel.
 */
export function buildSeedSql(archives: SessionArchive[], options: SeedSqlOptions = {}): string {
  const published = options.publish ?? false
  const updateAssignments = [
    'summary_fr = excluded.summary_fr',
    'summary_en = excluded.summary_en',
    'quotes = excluded.quotes',
    'archived_at = excluded.archived_at',
    ...(published ? ['published = true'] : []),
    'updated_at = now()',
  ]
  const statements = archives.map(
    (a) => `insert into public.session_archives (
  session_id, summary_fr, summary_en, quotes, archived_at, published
) values (
  ${sqlString(a.sessionId)}, ${sqlString(a.summary.fr)}, ${sqlString(a.summary.en)},
  ${sqlJson(a.quotes)}, ${sqlString(a.archivedAt)}, ${published}
)
on conflict (session_id) do update set
  ${updateAssignments.join(',\n  ')};`,
  )
  const note = published
    ? '-- published = true : archives relues, publiées (nouvelles et déjà en base).\n'
    : "-- published = false (brouillon) : relire les archives, puis relancer avec --publish avant la mise en ligne.\n" +
      "-- (sans --publish, le statut de publication des archives déjà en base n'est jamais modifié.)\n"
  return `-- Généré par scripts/import-evening.ts — à relire, puis exécuter dans le SQL editor Supabase.\n${note}begin;\n\n${statements.join('\n\n')}\n\ncommit;\n`
}

/** `SessionArchive` (camelCase) → ligne Supabase (snake_case), pour `--push`. */
export function toSupabaseRow(a: SessionArchive, options: SeedSqlOptions = {}): Record<string, unknown> {
  return {
    session_id: a.sessionId,
    summary_fr: a.summary.fr,
    summary_en: a.summary.en,
    quotes: a.quotes,
    archived_at: a.archivedAt,
    published: options.publish ?? false,
  }
}

/**
 * Lignes prêtes pour `--push` : comme `toSupabaseRow`, mais SANS la clé `published` du tout quand
 * `publish` est faux — jamais juste `false` (même raisonnement que `scripts/import-people.ts` :
 * un upsert qui envoie `published: false` sur une archive déjà publiée la dépublierait par erreur).
 */
export function toSupabasePushRows(archives: SessionArchive[], publish: boolean): Record<string, unknown>[] {
  return archives.map((a) => {
    const row = toSupabaseRow(a, { publish })
    if (!publish) delete row.published
    return row
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
      'Usage : tsx scripts/import-evening.ts --file <sortie-agent.json> [--dry-run] [--publish] [--push]',
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
  await writeFile('supabase/seed/evening-archives.sql', buildSeedSql(archives, { publish: args.publish }), 'utf8')
  console.log(
    `\nÉcrit : public/data/evening.json, supabase/seed/evening-archives.sql (published = ${args.publish} — ${
      args.publish ? 'relu, prêt à publier' : 'brouillon, relire avant --publish'
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
          : "\n--push : envoi direct à Supabase, en brouillon (le statut de publication des archives déjà en base est laissé tel quel).",
      )
      const { createClient } = await import('@supabase/supabase-js')
      const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
      const { error } = await admin
        .from('session_archives')
        .upsert(toSupabasePushRows(archives, args.publish), { onConflict: 'session_id' })
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
