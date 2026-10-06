// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildEveningJson, buildSeedSql, toSupabasePushRows } from './import-evening'
import { parseAgentOutput, SessionArchiveSchema, toSessionArchives } from '../src/data/eveningSchema'
import { MAX_ARCHIVE_TRANSCRIPT_CHARS, type SessionArchive } from '../src/types'

interface RecordingSequence {
  id: string
  kind: string
  startChar: number
  endChar: number
  characters: number
  startAnchor: string
  endAnchor: string
  sha256Utf8: string
  includedInGameArchives: boolean
}

interface RecordingSequenceMap {
  version: number
  source: {
    recordingTitle: string
    file: string
    characters: number
    bytes: number
    sha256: string
    timestampsAvailable: boolean
    startsMidOpening: boolean
    closingThanksPresent: boolean
    lastSentenceComplete: boolean
    lastRecordedText: string
    publishedTranscriptExtraction: string
  }
  coverage: {
    sequenceCount: number
    coveredCharacters: number
    exactContiguousPartition: boolean
  }
  sequences: RecordingSequence[]
  editorialPolicy: {
    rawTranscriptsUnmodified: boolean
    speakerAttributionsAdded: boolean
    timestampsInvented: boolean
    highlightClaims: string
  }
}

// Resolve from the test file so these checks also work in a clean Linux CI checkout.
const recordingBytes = readFileSync(new URL('../data/recording/nouvel-enregistrement-36.txt', import.meta.url))
const recordingText = recordingBytes.toString('utf8')
const sequenceMap: RecordingSequenceMap = JSON.parse(readFileSync(new URL('../data/recording/sequence-map.json', import.meta.url), 'utf8'))
const agentOutput: unknown = JSON.parse(readFileSync(new URL('../data/recording/tables-rondes.json', import.meta.url), 'utf8'))
const staticFile = readFileSync(new URL('../public/data/evening.json', import.meta.url), 'utf8')
const staticArchives: { archives: SessionArchive[] } = JSON.parse(staticFile)
const seedFile = readFileSync(new URL('../supabase/seed/evening-archives.sql', import.meta.url), 'utf8')
const parsed = parseAgentOutput(agentOutput)
const sessionIds = ['table-ronde-1', 'table-ronde-2', 'table-ronde-3']
const expectedHighlightCounts = [7, 8, 7]

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function sequenceFor(sessionId: string): RecordingSequence {
  const sequence = sequenceMap.sequences.find((entry) => entry.id === sessionId)
  if (!sequence) throw new Error(`Séquence source absente : ${sessionId}`)
  return sequence
}

describe('enregistrement 36 : source intégrale et découpage', () => {
  it('conserve la source Apple approuvée et son empreinte sans réécriture', () => {
    expect(sequenceMap.version).toBe(1)
    expect(sequenceMap.source.recordingTitle).toBe('Nouvel enregistrement 36')
    expect(sequenceMap.source.file).toBe('data/recording/nouvel-enregistrement-36.txt')
    expect(recordingText).toHaveLength(111162)
    expect(recordingBytes).toHaveLength(114661)
    expect(sha256(recordingBytes)).toBe('9a7177cab47987a575536d56a026de95a02f6df428595eebabae967744349dc3')
    expect(sequenceMap.source.characters).toBe(recordingText.length)
    expect(sequenceMap.source.bytes).toBe(recordingBytes.length)
    expect(sequenceMap.source.sha256).toBe(sha256(recordingBytes))
  })

  it('décrit les limites réelles du début et de la dernière phrase enregistrée', () => {
    expect(sequenceMap.source.startsMidOpening).toBe(true)
    expect(recordingText.startsWith("Et la soirée va nous montrer qu'il va falloir faire des choix.")).toBe(true)
    expect(sequenceMap.source.closingThanksPresent).toBe(true)
    expect(recordingText).toContain("Merci d'avoir terminé cette soirée.")
    expect(sequenceMap.source.lastSentenceComplete).toBe(false)
    expect(recordingText).toMatch(/Merci beaucoup de votre attention et je vais\u2029\s*$/u)
    expect(sequenceMap.source.lastRecordedText).toBe(recordingText.slice(-250))
  })

  it('partitionne les 11 séquences sans trou, chevauchement ou perte de texte', () => {
    expect(sequenceMap.sequences).toHaveLength(11)
    expect(new Set(sequenceMap.sequences.map((sequence) => sequence.id)).size).toBe(11)
    let cursor = 0
    const parts = sequenceMap.sequences.map((sequence) => {
      expect(Number.isInteger(sequence.startChar)).toBe(true)
      expect(Number.isInteger(sequence.endChar)).toBe(true)
      expect(sequence.startChar).toBe(cursor)
      expect(sequence.endChar).toBeGreaterThan(sequence.startChar)
      expect(sequence.endChar).toBeLessThanOrEqual(recordingText.length)
      expect(sequence.characters).toBe(sequence.endChar - sequence.startChar)
      cursor = sequence.endChar
      return recordingText.slice(sequence.startChar, sequence.endChar)
    })
    expect(cursor).toBe(recordingText.length)
    expect(parts.join('')).toBe(recordingText)
    expect(sequenceMap.coverage).toEqual({
      sequenceCount: 11,
      coveredCharacters: recordingText.length,
      exactContiguousPartition: true,
    })
  })

  it('retrouve les ancres et empreintes de chaque séquence directement dans la source', () => {
    for (const sequence of sequenceMap.sequences) {
      const part = recordingText.slice(sequence.startChar, sequence.endChar)
      expect(sha256(part), sequence.id).toBe(sequence.sha256Utf8)
      expect(part.slice(0, 120), sequence.id).toBe(sequence.startAnchor)
      expect(part.slice(-120), sequence.id).toBe(sequence.endAnchor)
    }
  })

  it('sélectionne uniquement les trois tables rondes pour les archives du jeu', () => {
    const selected = sequenceMap.sequences.filter((sequence) => sequence.includedInGameArchives)
    expect(selected.map((sequence) => sequence.id)).toEqual(sessionIds)
    expect(selected.every((sequence) => sequence.kind === 'roundtable')).toBe(true)
    expect(sequenceMap.sequences.filter((sequence) => sequence.kind === 'roundtable')).toEqual(selected)
    expect(parsed.accepted.map((archive) => archive.sessionId)).toEqual(sessionIds)
    expect(staticArchives.archives.map((archive) => archive.sessionId)).toEqual(sessionIds)
  })
})

describe('enregistrement 36 : fidélité des transcriptions et bulles', () => {
  it('accepte les trois entrées version 2 sans rejet et avec leur date de dépôt', () => {
    expect(parsed.errors).toEqual([])
    expect(parsed.accepted).toHaveLength(3)
    expect(parsed.generatedAt).toMatch(/^2026-10-06T/)
    // Also inspect the unparsed document: schema stripping must not hide extra source labels.
    expect(agentOutput).toEqual({
      version: 2,
      event: 'odyssee-ia-2026',
      generatedAt: parsed.generatedAt,
      archives: parsed.accepted,
    })
  })

  it('extrait chaque transcription par slice et trim sans changer les mots ou paragraphes', () => {
    expect(sequenceMap.source.publishedTranscriptExtraction).toBe('source.slice(startChar,endChar).trim(); words and paragraph separators are unchanged.')
    for (const archive of parsed.accepted) {
      const sequence = sequenceFor(archive.sessionId)
      const extracted = recordingText.slice(sequence.startChar, sequence.endChar).trim()
      expect(archive.transcript.fr, archive.sessionId).toBe(extracted)
      expect(archive.transcript.en, archive.sessionId).toBe('')
      expect(archive.transcript.fr.length).toBeGreaterThan(0)
      expect(archive.transcript.fr.length).toBeLessThanOrEqual(MAX_ARCHIVE_TRANSCRIPT_CHARS)
    }
  })

  it('conserve les 22 bulles avec des identifiants uniques et une traduction complète', () => {
    const highlights = parsed.accepted.flatMap((archive) => archive.highlights ?? [])
    expect(parsed.accepted.map((archive) => archive.highlights?.length)).toEqual(expectedHighlightCounts)
    expect(highlights).toHaveLength(22)
    expect(new Set(highlights.map((highlight) => highlight.id)).size).toBe(highlights.length)
    for (const highlight of highlights) {
      expect(highlight.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      for (const language of ['fr', 'en'] as const) {
        expect(highlight.title[language].trim().length).toBeGreaterThan(0)
        expect(highlight.title[language].length).toBeLessThanOrEqual(100)
        expect(highlight.body[language].trim().length).toBeGreaterThan(0)
        expect(highlight.body[language].length).toBeLessThanOrEqual(800)
      }
    }
  })

  it('source chaque bulle dans un passage français exact de sa propre table ronde', () => {
    for (const archive of parsed.accepted) {
      const sequence = sequenceFor(archive.sessionId)
      const rawSequence = recordingText.slice(sequence.startChar, sequence.endChar)
      for (const highlight of archive.highlights ?? []) {
        expect(highlight.source.excerpt.trim().length, highlight.id).toBeGreaterThan(0)
        expect(highlight.source.excerpt.length, highlight.id).toBeLessThanOrEqual(2000)
        expect(archive.transcript.fr.includes(highlight.source.excerpt), highlight.id).toBe(true)
        expect(rawSequence.includes(highlight.source.excerpt), highlight.id).toBe(true)
      }
    }
  })

  it('n’ajoute aucun horodatage ou attribution à la source Apple non alignée', () => {
    expect(sequenceMap.source.timestampsAvailable).toBe(false)
    expect(sequenceMap.editorialPolicy).toMatchObject({
      rawTranscriptsUnmodified: true,
      speakerAttributionsAdded: false,
      timestampsInvented: false,
      highlightClaims: 'Faithful summaries of statements made during the discussion, not independently verified external facts.',
    })
    for (const archive of parsed.accepted) {
      for (const highlight of archive.highlights ?? []) {
        expect(Object.keys(highlight.source), highlight.id).toEqual(['excerpt'])
        expect(highlight.source.startSec, highlight.id).toBeUndefined()
        expect(highlight.source.endSec, highlight.id).toBeUndefined()
      }
    }
  })

  it('garde les mêmes transcriptions et extraits dans le repli public', () => {
    for (const archive of parsed.accepted) {
      const published = staticArchives.archives.find((entry) => entry.sessionId === archive.sessionId)
      expect(published?.transcript, archive.sessionId).toEqual(archive.transcript)
      expect(published?.highlights, archive.sessionId).toEqual(archive.highlights)
      expect(published?.published, archive.sessionId).toBe(true)
      expect(published?.archivedAt, archive.sessionId).toBe(parsed.generatedAt)
    }
  })

  it('valide les trois archives publiées avec leur schéma réel', () => {
    for (const archive of staticArchives.archives) {
      const result = SessionArchiveSchema.safeParse(archive)
      expect(result.success, archive.sessionId).toBe(true)
      if (result.success) expect(result.data).toEqual(archive)
    }
  })
})

describe('enregistrement 36 : génération reproductible sans fausse relecture', () => {
  it('reproduit exactement le fichier statique à partir de la sortie version 2', () => {
    expect(parsed.generatedAt).not.toBeNull()
    const archives = toSessionArchives(parsed.accepted, parsed.generatedAt!, true)
    const generated = `${JSON.stringify(buildEveningJson(archives), null, 2)}\n`
    expect(generated).toBe(staticFile)
  })

  it('reproduit exactement la transaction SQL publiée sans relecteur', () => {
    expect(parsed.generatedAt).not.toBeNull()
    const archives = toSessionArchives(parsed.accepted, parsed.generatedAt!, true)
    const generated = buildSeedSql(archives, { publish: true })
    expect(generated).toBe(seedFile)
    expect(generated.match(/insert into public\.session_archives/g)).toHaveLength(3)
    expect(generated.match(/, true, NULL\n\)/g)).toHaveLength(3)
    expect(generated).toContain('-- published = true : transcriptions publiées sans relecture préalable.\n')
    expect(generated).not.toContain('-- published = true : transcriptions publiées avec une relecture renseignée.')
    expect(generated).toContain('begin;\n')
    expect(generated).toMatch(/commit;\n$/)
  })

  it('garde reviewed_by à NULL dans les trois lignes Supabase publiables', () => {
    expect(parsed.generatedAt).not.toBeNull()
    const archives = toSessionArchives(parsed.accepted, parsed.generatedAt!, true)
    const rows = toSupabasePushRows(archives, true)
    expect(rows).toHaveLength(3)
    for (const [index, row] of rows.entries()) {
      expect(row.session_id).toBe(sessionIds[index])
      expect(row.published).toBe(true)
      expect(row.reviewed_by).toBeNull()
      expect(row.transcript_fr).toBe(archives[index].transcript.fr)
      expect(row.highlights).toEqual(archives[index].highlights)
    }
  })
})
