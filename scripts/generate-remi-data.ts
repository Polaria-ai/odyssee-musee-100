/**
 * Génère `api/_lib/lesCent.data.ts` (les 100 pour Rémi · IA) depuis `public/data/people.json`.
 * Usage : pnpm exec tsx scripts/generate-remi-data.ts
 * À rejouer à chaque modification de `public/data/people.json` : un test (`api/_lib/lesCent.test.ts`)
 * échoue tant que le fichier généré n'est pas à jour.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { condenseLesCent } from '../api/_lib/lesCent'
import { PersonSchema } from '../src/data/schema'

const SOURCE = new URL('../public/data/people.json', import.meta.url)
const TARGET = new URL('../api/_lib/lesCent.data.ts', import.meta.url)

const people = PersonSchema.array().parse(JSON.parse(readFileSync(SOURCE, 'utf8')))
const entries = condenseLesCent(people)

const lines = entries.map((entry) => `  ${JSON.stringify(entry)},`)
writeFileSync(
  TARGET,
  `/**
 * Généré par scripts/generate-remi-data.ts depuis public/data/people.json — ne pas éditer à la main.
 * Les 100 pour Rémi · IA : voir api/_lib/lesCent.ts.
 */
import type { LesCentEntry } from './lesCent.js'

export const LES_CENT: readonly LesCentEntry[] = [
${lines.join('\n')}
]
`,
)
console.log(`${entries.length} fiches écrites dans api/_lib/lesCent.data.ts`)
