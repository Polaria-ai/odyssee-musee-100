import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildEveningJson, buildSeedSql, toSupabasePushRows, toSupabaseRow } from './import-evening'
import { parseAgentOutput, toSessionArchives } from '../src/data/eveningSchema'
import type { SessionArchive } from '../src/types'

const archive: SessionArchive = {
  sessionId: 'table-ronde-1',
  transcript: { fr: "Muriel Motte — Une transcription complète de test.", en: '' },
  archivedAt: '2026-10-06T22:50:00.000Z',
  published: false,
}

describe('buildEveningJson', () => {
  it('enveloppe les archives dans { archives }', () => {
    expect(buildEveningJson([archive])).toEqual({ archives: [archive] })
  })
  it('produit { archives: [] } pour une liste vide (forme livrée par défaut)', () => {
    expect(buildEveningJson([])).toEqual({ archives: [] })
  })
})

describe('buildSeedSql', () => {
  it('génère un upsert par archive, published = false par défaut', () => {
    const sql = buildSeedSql([archive])
    expect(sql).toContain('on conflict (session_id) do update set')
    expect(sql).toContain("'table-ronde-1'")
    expect(sql).not.toMatch(/published = true/)
  })

  it('sans --publish : une mise à jour repasse en brouillon et efface le relecteur précédent', () => {
    const sql = buildSeedSql([archive], { reviewer: 'Relecteur Test' })
    expect(sql).not.toContain('Relecteur Test')
    expect(sql).toContain('published = excluded.published')
    expect(sql).toContain('reviewed_by = excluded.reviewed_by')
  })

  it('avec --publish et --reviewer : trace la relecture dans reviewed_by', () => {
    const sql = buildSeedSql([archive], { publish: true, reviewer: "Relect'eur Test" })
    expect(sql).toContain("'Relect''eur Test'")
    expect(sql).toContain('reviewed_by = excluded.reviewed_by')
  })

  it('avec --publish : ajoute published = true à la clause de mise à jour', () => {
    const sql = buildSeedSql([archive], { publish: true })
    expect(sql).toContain('published = true')
    expect(sql).toContain('sans relecture préalable')
    expect(sql).toContain('true, NULL')
  })

  it('échappe les apostrophes dans le SQL', () => {
    const sql = buildSeedSql([{ ...archive, transcript: { fr: "L'Archiviste lit le texte.", en: '' } }])
    expect(sql).toContain("L''Archiviste lit le texte.")
  })

  it('est enveloppé dans une transaction', () => {
    const sql = buildSeedSql([archive])
    expect(sql.trim().startsWith('-- Généré par')).toBe(true)
    expect(sql).toContain('begin;')
    expect(sql).toContain('commit;')
  })
})

describe('toSupabaseRow / toSupabasePushRows', () => {
  it('convertit en snake_case', () => {
    expect(toSupabaseRow(archive)).toMatchObject({
      session_id: 'table-ronde-1',
      transcript_fr: 'Muriel Motte — Une transcription complète de test.',
      transcript_en: '',
      published: false,
    })
  })

  it('toSupabasePushRows garde `published=false` pour dépublier une ancienne version modifiée', () => {
    const rows = toSupabasePushRows([archive], false)
    expect(rows[0].published).toBe(false)
  })

  it('toSupabasePushRows efface l’ancienne relecture en brouillon et la trace à la publication', () => {
    expect(toSupabasePushRows([archive], false, 'Ancien relecteur')[0].reviewed_by).toBeNull()
    expect(toSupabasePushRows([archive], true, 'Relecteur Test')[0].reviewed_by).toBe('Relecteur Test')
  })

  it('toSupabasePushRows inclut published=true quand publish=true', () => {
    const rows = toSupabasePushRows([archive], true)
    expect(rows[0].published).toBe(true)
    expect(rows[0].reviewed_by).toBeNull()
  })
})

describe('publication CLI sans relecteur', () => {
  it('accepte --publish --dry-run sans inventer un relecteur', () => {
    const directory = mkdtempSync(join(tmpdir(), 'musee-import-test-'))
    try {
      const file = join(directory, 'transcripts.json')
      writeFileSync(file, JSON.stringify({
        version: 2,
        event: 'odyssee-ia-2026',
        generatedAt: archive.archivedAt,
        archives: [{ sessionId: archive.sessionId, transcript: archive.transcript }],
      }))
      const result = spawnSync(resolve('node_modules/.bin/tsx'), [
        resolve('scripts/import-evening.ts'), '--file', file, '--publish', '--dry-run',
      ], { cwd: directory, encoding: 'utf8' })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain('1 / 1 archive(s) acceptée(s)')
      expect(result.stdout).toContain('aucun fichier écrit, aucun envoi Supabase')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})

describe('bout en bout : parseAgentOutput → toSessionArchives → buildEveningJson / buildSeedSql', () => {
  it('produit un fichier JSON et un SQL exploitables à partir d’une sortie d’agent valide', () => {
    const output = {
      version: 2,
      event: 'odyssee-ia-2026',
      generatedAt: '2026-10-06T22:50:00+02:00',
      archives: [
        {
          sessionId: 'table-ronde-1',
          transcript: { fr: 'Muriel Motte — Transcription de test.', en: '' },
        },
      ],
    }
    const { accepted, errors, generatedAt } = parseAgentOutput(output)
    expect(errors).toEqual([])
    const archives = toSessionArchives(accepted, generatedAt ?? '2026-10-06T22:50:00Z', false)
    const json = buildEveningJson(archives)
    expect(json.archives).toHaveLength(1)
    expect(json.archives[0].published).toBe(false)
    const sql = buildSeedSql(archives)
    expect(sql).toContain("'table-ronde-1'")
  })
})
