import { describe, expect, it } from 'vitest'
import {
  buildHeaderMap,
  buildSeedSql,
  dedupePhotoCells,
  mapCountryToIso,
  mapWingId,
  normalizeHeader,
  normalizeRow,
  parseLinks,
  slugify,
  toSupabaseRow,
} from './import-people'
import { parsePeople } from '../src/data/schema'

describe('normalizeHeader / buildHeaderMap', () => {
  it('reconnaît les en-têtes FR et EN, insensibles aux accents, à la casse et aux séparateurs', () => {
    expect(normalizeHeader('Nom')).toBe('name')
    expect(normalizeHeader('Name')).toBe('name')
    expect(normalizeHeader('Rôle')).toBe('roleFr')
    expect(normalizeHeader('Role (EN)')).toBe('roleEn')
    expect(normalizeHeader('Crédit Photo')).toBe('photoCredit')
    expect(normalizeHeader('photo_credit')).toBe('photoCredit')
    expect(normalizeHeader('Aile')).toBe('wing')
    expect(normalizeHeader('wing')).toBe('wing')
  })

  it('renvoie null pour un en-tête inconnu', () => {
    expect(normalizeHeader('colonne mystère')).toBeNull()
  })

  it('associe chaque champ canonique reconnu à son en-tête d’origine', () => {
    expect(buildHeaderMap(['Nom', 'Pays', 'Aile', 'bio_en'])).toEqual({
      name: 'Nom',
      country: 'Pays',
      wing: 'Aile',
      bioEn: 'bio_en',
    })
  })
})

describe('slugify', () => {
  it('produit un id kebab-case, sans accents ni majuscules', () => {
    expect(slugify('Ada Lovelace')).toBe('ada-lovelace')
    expect(slugify('Éléonore Ç. Über-Test')).toBe('eleonore-c-uber-test')
  })
})

describe('mapCountryToIso', () => {
  it('accepte un code à 2 lettres tel quel (mis en majuscules)', () => {
    expect(mapCountryToIso('fr')).toBe('FR')
    expect(mapCountryToIso('DE')).toBe('DE')
  })
  it('convertit les noms de pays européens courants, en FR ou EN', () => {
    expect(mapCountryToIso('France')).toBe('FR')
    expect(mapCountryToIso('Germany')).toBe('DE')
    expect(mapCountryToIso('Pays-Bas')).toBe('NL')
    expect(mapCountryToIso('Netherlands')).toBe('NL')
  })
  it('renvoie null pour un pays non reconnu', () => {
    expect(mapCountryToIso('Narnia')).toBeNull()
    expect(mapCountryToIso('')).toBeNull()
  })
})

describe('mapWingId', () => {
  it('reconnaît les ids et les libellés FR/EN courants', () => {
    expect(mapWingId('infrastructures')).toBe('infrastructures')
    expect(mapWingId('Industrialization')).toBe('industrialisation')
    expect(mapWingId('Culture')).toBe('culture')
  })
  it('renvoie null si non reconnu ou vide', () => {
    expect(mapWingId('mystère')).toBeNull()
    expect(mapWingId('')).toBeNull()
  })
})

describe('parseLinks', () => {
  it('parse « Libellé|URL » séparés par `;`', () => {
    expect(parseLinks('LinkedIn|https://linkedin.com/in/x; Site|https://x.dev')).toEqual([
      { label: 'LinkedIn', url: 'https://linkedin.com/in/x' },
      { label: 'Site', url: 'https://x.dev' },
    ])
  })
  it('dérive un libellé depuis une URL nue', () => {
    expect(parseLinks('https://www.example.org/page')).toEqual([{ label: 'example.org', url: 'https://www.example.org/page' }])
  })
  it('renvoie un tableau vide pour une cellule vide', () => {
    expect(parseLinks('   ')).toEqual([])
  })
})

describe('normalizeRow', () => {
  const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'role_en', 'bio', 'bio_en'])

  it('construit une fiche brute valide (id dérivé du nom, pays et aile normalisés)', () => {
    const { row, warnings, photoCell } = normalizeRow(
      {
        nom: 'Ada Lovelace',
        pays: 'France',
        aile: 'infrastructures',
        role: 'Pionnière',
        role_en: 'Pioneer',
        bio: 'Une accroche.',
        bio_en: 'A hook.',
      },
      headerMap,
      { index: 0, autoOrder: 1 },
    )
    expect(row.id).toBe('ada-lovelace')
    expect(row.country).toBe('FR')
    expect(row.wing).toBe('infrastructures')
    expect(row.order).toBe(1)
    expect(photoCell).toBe('')
    expect(warnings).toEqual([])

    const { people, errors } = parsePeople([row])
    expect(errors).toEqual([])
    expect(people).toHaveLength(1)
  })

  it('signale une aile manquante et applique la valeur par défaut si fournie', () => {
    const { row, warnings } = normalizeRow(
      { nom: 'Bob', pays: 'FR', aile: '', role: 'X', role_en: 'X', bio: 'Bio courte.', bio_en: 'Short bio.' },
      headerMap,
      { index: 0, autoOrder: 1, wingDefault: 'culture' },
    )
    expect(row.wing).toBe('culture')
    expect(warnings.some((w) => w.includes('défaut'))).toBe(true)
  })

  it('signale une aile manquante sans valeur par défaut (la ligne sera invalide)', () => {
    const { row, warnings } = normalizeRow(
      { nom: 'Bob', pays: 'FR', aile: '', role: 'X', role_en: 'X', bio: 'Bio courte.', bio_en: 'Short bio.' },
      headerMap,
      { index: 0, autoOrder: 1 },
    )
    expect(warnings.length).toBeGreaterThan(0)
    expect(parsePeople([row]).errors).toHaveLength(1)
  })
})

describe('import de bout en bout : validité et doublons', () => {
  it('garde les lignes valides, ignore les invalides et dédoublonne les id', () => {
    const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'bio'])
    const records = [
      { nom: 'Ada Lovelace', pays: 'FR', aile: 'infrastructures', role: 'Pionnière', bio: 'Bio valide, courte.' },
      { nom: 'Ada Lovelace', pays: 'FR', aile: 'infrastructures', role: 'Pionnière', bio: 'Même personne, doublon.' },
      { nom: '', pays: 'FR', aile: 'infrastructures', role: 'Pionnière', bio: 'Nom manquant.' },
    ]
    const rows = records.map((record, index) => normalizeRow(record, headerMap, { index, autoOrder: index + 1 }).row)

    const { people, errors } = parsePeople(rows)
    expect(people.map((p) => p.id)).toEqual(['ada-lovelace'])
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })
})

describe('dedupePhotoCells', () => {
  it('garde uniquement la première cellule photo par id, dans l’ordre du fichier', () => {
    const result = dedupePhotoCells([
      { id: 'ada-lovelace', cell: 'premiere-photo.jpg' },
      { id: 'grace-hopper', cell: 'grace.jpg' },
      { id: 'ada-lovelace', cell: 'seconde-photo-qui-ecraserait-la-bonne.jpg' },
    ])
    expect(result).toEqual([
      { id: 'ada-lovelace', cell: 'premiere-photo.jpg' },
      { id: 'grace-hopper', cell: 'grace.jpg' },
    ])
  })

  it('ne modifie pas l’ordre ni le contenu quand il n’y a pas de doublon', () => {
    const cells = [
      { id: 'a', cell: 'a.jpg' },
      { id: 'b', cell: 'b.jpg' },
    ]
    expect(dedupePhotoCells(cells)).toEqual(cells)
  })

  it('renvoie un tableau vide pour une entrée vide', () => {
    expect(dedupePhotoCells([])).toEqual([])
  })
})

describe('buildSeedSql', () => {
  it('génère un upsert idempotent avec les apostrophes échappées', () => {
    const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'bio'])
    const { row } = normalizeRow(
      { nom: "L'École d'Ada", pays: 'FR', aile: 'culture', role: 'Fondatrice', bio: 'Bio courte.' },
      headerMap,
      { index: 0, autoOrder: 1 },
    )
    const { people } = parsePeople([row])
    const sql = buildSeedSql(people)
    expect(sql).toContain('on conflict (id) do update')
    expect(sql).toContain(`'${people[0].id}'`)
    expect(sql).toContain("L''École d''Ada")
  })
})

describe('toSupabaseRow', () => {
  it('convertit une fiche Person en ligne snake_case prête pour upsert', () => {
    const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'role_en', 'bio', 'bio_en'])
    const { row } = normalizeRow(
      {
        nom: 'Test Personne',
        pays: 'FR',
        aile: 'culture',
        role: 'Fondatrice',
        role_en: 'Founder',
        bio: 'Bio courte.',
        bio_en: 'Short bio.',
      },
      headerMap,
      { index: 0, autoOrder: 1 },
    )
    const { people } = parsePeople([row])
    const supaRow = toSupabaseRow(people[0])
    expect(supaRow.role_fr).toBe('Fondatrice')
    expect(supaRow.role_en).toBe('Founder')
    expect(supaRow.published).toBe(true)
  })
})
