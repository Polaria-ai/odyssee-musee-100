#!/usr/bin/env tsx
/**
 * Lit la table `people` (lignes publiées, clé publishable — jamais la clé de service) et écrit
 * `public/data/people.json` : le repli statique utilisé par `loadPeople()` quand Supabase est
 * indisponible. Propriétaire : agent données.
 *
 * Usage : pnpm export:local
 * Si VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ne sont pas déjà dans l'environnement :
 *   node --env-file=.env.local -e "" && pnpm export:local   # ou exporter les deux variables avant
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { mapSupabaseRow, parsePeople } from '../src/data/schema'

async function main(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error(
      'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définies dans l’environnement (voir .env.local).',
    )
    process.exitCode = 1
    return
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await supabase.from('people').select('*').eq('published', true)
  if (error) {
    console.error(`Lecture Supabase échouée : ${error.message}`)
    process.exitCode = 1
    return
  }

  const { people, errors } = parsePeople((data ?? []).map(mapSupabaseRow))
  if (errors.length) {
    console.warn(`${errors.length} fiche(s) ignorée(s) (validation) :`)
    for (const e of errors) console.warn(`  - ${e}`)
  }

  await mkdir('public/data', { recursive: true })
  await writeFile('public/data/people.json', `${JSON.stringify(people, null, 2)}\n`, 'utf8')
  console.log(`Écrit public/data/people.json (${people.length} fiche(s)).`)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
