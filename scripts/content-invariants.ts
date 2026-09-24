/**
 * Invariants de contenu (propriétaire : agent données).
 * Vérifie la liste réellement servie : `public/data/people.json` si présent, sinon fiches d'attente.
 */
import { existsSync, readFileSync } from 'node:fs'
import { parsePeople } from '../src/data/schema'
import { generatePlaceholderPeople } from '../src/data/placeholder'
import { EXHIBIT_WINGS } from '../src/types'
import type { ExhibitWingId } from '../src/types'

const failures: string[] = []
const warnings: string[] = []

const rawSource: unknown = existsSync('public/data/people.json')
  ? (JSON.parse(readFileSync('public/data/people.json', 'utf8')) as unknown)
  : generatePlaceholderPeople()

const { people, errors } = parsePeople(rawSource)
for (const e of errors) failures.push(`validation : ${e}`)

if (people.length > 120) failures.push(`${people.length} personnes : le musée est dimensionné pour ~100`)

const counts: Record<ExhibitWingId, number> = { infrastructures: 0, industrialisation: 0, culture: 0 }
const genericName = /^Portrait n°\d+$/

for (const p of people) {
  counts[p.wing] += 1

  if (!p.placeholder && genericName.test(p.name)) {
    failures.push(`${p.id} : nom générique « ${p.name} » sur une fiche non-placeholder`)
  }

  if (p.photoUrl && p.photoUrl.startsWith('/portraits/') && !existsSync(`public${p.photoUrl}`)) {
    failures.push(`${p.id} : photo locale manquante (public${p.photoUrl})`)
  }

  if (!p.placeholder) {
    if (!p.role.en.trim()) warnings.push(`${p.id} : traduction EN manquante (rôle)`)
    if (!p.bio.en.trim()) warnings.push(`${p.id} : traduction EN manquante (bio)`)
    if (!p.story.en.trim()) warnings.push(`${p.id} : traduction EN manquante (histoire)`)
    if (p.quote && !p.quote.en.trim()) warnings.push(`${p.id} : traduction EN manquante (citation)`)
  }
}

console.log(`Répartition par aile : ${EXHIBIT_WINGS.map((w) => `${w} ${counts[w]}`).join(', ')} (total ${people.length}).`)

if (warnings.length) {
  console.warn(`\nAvertissements non bloquants (${warnings.length}) :`)
  for (const w of warnings) console.warn(`  - ${w}`)
}

if (failures.length) {
  console.error(`\nInvariants de contenu en échec :\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nInvariants de contenu : OK (${people.length} fiches)`)
