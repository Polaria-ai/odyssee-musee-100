import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ARCHIVE_SESSIONS, EVENING_PROGRAM, EVENING_SPEAKERS } from '../src/data/eveningProgram'
import { parseAgentOutput } from '../src/data/eveningSchema'
import { buildEveningAgentPrompt } from './evening-agent-prompt'

describe('buildEveningAgentPrompt', () => {
  const prompt = buildEveningAgentPrompt()

  it('ne contient que les trois tables rondes et leurs intervenant·es', () => {
    for (const s of ARCHIVE_SESSIONS) expect(prompt).toContain(`"id": "${s.id}"`)
    for (const s of EVENING_PROGRAM.filter((item) => item.kind !== 'table-ronde')) {
      expect(prompt).not.toContain(`"id": "${s.id}"`)
    }
    for (const s of ARCHIVE_SESSIONS) for (const speaker of s.speakers) expect(prompt).toContain(speaker.name)
  })

  it('reprend les règles précisées par la répétition du 27/09', () => {
    expect(prompt).toContain('N\'identifie jamais une voix par déduction')
    expect(prompt).toContain('Voix non identifiée')
    expect(prompt).toContain('N\'archive aucune autre partie de la soirée')
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

  it('la sortie de répétition contient uniquement les trois transcriptions factices', () => {
    const { accepted, errors } = parseAgentOutput(rehearsal)
    expect(errors).toEqual([])
    expect(accepted.length).toBe(3)
    for (const a of accepted) {
      expect(a.transcript.fr.startsWith('[RÉPÉTITION]')).toBe(true)
    }
  })
})
