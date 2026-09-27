import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EVENING_PROGRAM, EVENING_SPEAKERS } from '../src/data/eveningProgram'
import { parseAgentOutput } from '../src/data/eveningSchema'
import { buildEveningAgentPrompt } from './evening-agent-prompt'

describe('buildEveningAgentPrompt', () => {
  const prompt = buildEveningAgentPrompt()

  it('contient chaque séquence du programme et chaque intervenant·e annoncé·e', () => {
    for (const s of EVENING_PROGRAM) expect(prompt).toContain(`"id": "${s.id}"`)
    for (const sp of EVENING_SPEAKERS) expect(prompt).toContain(sp.name)
  })

  it('reprend les règles précisées par la répétition du 27/09', () => {
    expect(prompt).toContain('Ne déduis jamais l\'identité d\'une voix')
    expect(prompt).toContain('jamais du seul programme')
    expect(prompt).toContain('utilise "Public"')
    expect(prompt).toContain('aucun nom confirmé')
  })
})

/** Noms réels qui ne doivent JAMAIS apparaître dans les fichiers factices (programme + source du 15/09). */
const REAL_NAMES = [...EVENING_SPEAKERS.map((s) => s.name), 'Octave Klaba', 'Maya Noël', 'Anne Bouverot', 'Xavier Boilaud']

describe('données factices du dépôt (exemple et répétition du 27/09)', () => {
  const example = JSON.parse(readFileSync('data/evening-agent-output.example.json', 'utf8'))
  const rehearsal = JSON.parse(readFileSync('data/repetition/sortie-agent.json', 'utf8'))
  const transcript = readFileSync('data/repetition/transcription-factice.md', 'utf8')

  it('ne prêtent jamais une citation ni un propos à une personne réelle', () => {
    for (const text of [JSON.stringify(example), JSON.stringify(rehearsal), transcript]) {
      for (const name of REAL_NAMES) expect(text, name).not.toContain(name)
    }
  })

  it('la sortie de répétition passe l’import sans rejet, toute marquée [RÉPÉTITION]', () => {
    const { accepted, errors } = parseAgentOutput(rehearsal)
    expect(errors).toEqual([])
    expect(accepted.length).toBe(16)
    for (const a of accepted) {
      expect(a.summary.fr.startsWith('[RÉPÉTITION]')).toBe(true)
      for (const q of a.quotes) expect(q.text.fr.startsWith('[RÉPÉTITION]')).toBe(true)
    }
  })
})
