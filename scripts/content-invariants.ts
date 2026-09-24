/**
 * Invariants de contenu (propriétaire : agent données — version de départ).
 * Vérifie la liste réellement servie (public/data/people.json si présent, sinon fiches d'attente).
 */
import { existsSync, readFileSync } from 'node:fs'
import { generatePlaceholderPeople } from '../src/data/placeholder'
import type { Person } from '../src/types'

const failures: string[] = []
const people: Person[] = existsSync('public/data/people.json')
  ? (JSON.parse(readFileSync('public/data/people.json', 'utf8')) as Person[])
  : generatePlaceholderPeople()

const ids = new Set<string>()
for (const p of people) {
  if (ids.has(p.id)) failures.push(`id en double : ${p.id}`)
  ids.add(p.id)
  if (!p.name.trim()) failures.push(`${p.id} : nom vide`)
  if (!p.bio.fr.trim()) failures.push(`${p.id} : bio FR vide`)
}
if (people.length > 120) failures.push(`${people.length} personnes : le musée est dimensionné pour ~100`)

if (failures.length) {
  console.error('Invariants de contenu en échec :\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log(`Invariants de contenu : OK (${people.length} fiches)`)
