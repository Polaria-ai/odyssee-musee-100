import { describe, expect, it } from 'vitest'
import { buildEveningJson, buildSeedSql, toSupabasePushRows, toSupabaseRow } from './import-evening'
import { parseAgentOutput, toSessionArchives } from '../src/data/eveningSchema'
import type { SessionArchive } from '../src/types'

const archive: SessionArchive = {
  sessionId: 'table-ronde-1',
  summary: { fr: 'Une synthèse.', en: 'A summary.' },
  quotes: [{ text: { fr: 'Une citation.', en: '' }, author: 'Muriel Motte', verified: true }],
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

  it('avec --publish : ajoute published = true à la clause de mise à jour', () => {
    const sql = buildSeedSql([archive], { publish: true })
    expect(sql).toContain('published = true')
  })

  it('échappe les apostrophes dans le SQL', () => {
    const sql = buildSeedSql([{ ...archive, summary: { fr: "L'Archiviste s'exprime.", en: '' } }])
    expect(sql).toContain("L''Archiviste s''exprime.")
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
      summary_fr: 'Une synthèse.',
      summary_en: 'A summary.',
      published: false,
    })
  })

  it('toSupabasePushRows omet complètement `published` quand publish=false (jamais juste false)', () => {
    const rows = toSupabasePushRows([archive], false)
    expect('published' in rows[0]).toBe(false)
  })

  it('toSupabasePushRows inclut published=true quand publish=true', () => {
    const rows = toSupabasePushRows([archive], true)
    expect(rows[0].published).toBe(true)
  })
})

describe('bout en bout : parseAgentOutput → toSessionArchives → buildEveningJson / buildSeedSql', () => {
  it('produit un fichier JSON et un SQL exploitables à partir d’une sortie d’agent valide', () => {
    const output = {
      version: 1,
      event: 'odyssee-ia-2026',
      generatedAt: '2026-10-06T22:50:00+02:00',
      archives: [
        {
          sessionId: 'table-ronde-1',
          summary: { fr: 'Synthèse.', en: '' },
          quotes: [{ text: { fr: 'Citation.', en: '' }, author: 'Muriel Motte', verified: true }],
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
