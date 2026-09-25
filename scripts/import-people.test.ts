import { describe, expect, it } from 'vitest'
import {
  buildHeaderMap,
  buildSeedSql,
  dedupePhotoCells,
  findMissingMedia,
  mapCountryToIso,
  mapWingId,
  normalizeHeader,
  normalizeRow,
  parseLinks,
  slugify,
  toSupabasePushRows,
  toSupabaseRow,
} from './import-people'
import { parsePeople } from '../src/data/schema'
import { generatePlaceholderPeople } from '../src/data/placeholder'

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

  it('reconnaît les colonnes de préparation WEL-866 (source photo, licence/crédit)', () => {
    expect(normalizeHeader('Source photo')).toBe('photoSource')
    expect(normalizeHeader('Photo source')).toBe('photoSource')
    expect(normalizeHeader('Licence/Crédit')).toBe('photoCredit')
    expect(normalizeHeader('Licence')).toBe('photoCredit')
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
    const { row, warnings, photoCell, photoSourceCell } = normalizeRow(
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
    expect(photoSourceCell).toBe('')
    expect(warnings).toEqual([])

    const { people, errors } = parsePeople([row])
    expect(errors).toEqual([])
    expect(people).toHaveLength(1)
  })

  it('capture la cellule « source photo » séparément, sans la traiter comme une photo', () => {
    const headerMapWithSource = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'bio', 'source photo'])
    const { row, photoCell, photoSourceCell } = normalizeRow(
      {
        nom: 'Ada Lovelace',
        pays: 'FR',
        aile: 'infrastructures',
        role: 'Pionnière',
        bio: 'Une accroche.',
        'source photo': 'https://exemple.org/a-propos/ada-lovelace',
      },
      headerMapWithSource,
      { index: 0, autoOrder: 1 },
    )
    expect(photoCell).toBe('')
    expect(photoSourceCell).toBe('https://exemple.org/a-propos/ada-lovelace')
    expect(row.photoUrl).toBeNull()
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

  it('insère published = false par défaut (brouillon, relecture requise avant publication)', () => {
    const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'bio'])
    const { row } = normalizeRow({ nom: 'Bob', pays: 'FR', aile: 'culture', role: 'X', bio: 'Bio courte.' }, headerMap, {
      index: 0,
      autoOrder: 1,
    })
    const { people } = parsePeople([row])
    const sql = buildSeedSql(people)
    expect(sql).toContain("'[]'::jsonb, false, false\n)")
    expect(sql).toContain('published = false')
  })

  it('insère published = true avec { publish: true }', () => {
    const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'bio'])
    const { row } = normalizeRow({ nom: 'Bob', pays: 'FR', aile: 'culture', role: 'X', bio: 'Bio courte.' }, headerMap, {
      index: 0,
      autoOrder: 1,
    })
    const { people } = parsePeople([row])
    const sql = buildSeedSql(people, { publish: true })
    expect(sql).toContain("'[]'::jsonb, false, true\n)")
  })

  it('sans --publish, ne touche jamais `published` sur une fiche déjà en base (absent de la clause `do update`)', () => {
    const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'bio'])
    const { row } = normalizeRow({ nom: 'Bob', pays: 'FR', aile: 'culture', role: 'X', bio: 'Bio courte.' }, headerMap, {
      index: 0,
      autoOrder: 1,
    })
    const { people } = parsePeople([row])
    const sql = buildSeedSql(people)
    const updateClause = sql.slice(sql.indexOf('on conflict'), sql.indexOf('commit;'))
    expect(updateClause).not.toMatch(/\bpublished\s*=/)
  })

  it('avec --publish, publie aussi les fiches déjà en base (`published = true` dans la clause `do update`)', () => {
    const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'bio'])
    const { row } = normalizeRow({ nom: 'Bob', pays: 'FR', aile: 'culture', role: 'X', bio: 'Bio courte.' }, headerMap, {
      index: 0,
      autoOrder: 1,
    })
    const { people } = parsePeople([row])
    const sql = buildSeedSql(people, { publish: true })
    const updateClause = sql.slice(sql.indexOf('on conflict'), sql.indexOf('commit;'))
    expect(updateClause).toMatch(/\bpublished = true\b/)
  })
})

describe('toSupabaseRow', () => {
  it('convertit une fiche Person en ligne snake_case prête pour upsert, published = false par défaut', () => {
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
    expect(supaRow.published).toBe(false)
    expect(toSupabaseRow(people[0], { publish: true }).published).toBe(true)
  })
})

describe('toSupabasePushRows', () => {
  it('omet entièrement la clé `published` sans --publish (jamais `false`) pour ne dépublier aucune fiche existante via --push', () => {
    const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'bio'])
    const { row } = normalizeRow({ nom: 'Bob', pays: 'FR', aile: 'culture', role: 'X', bio: 'Bio courte.' }, headerMap, {
      index: 0,
      autoOrder: 1,
    })
    const { people } = parsePeople([row])
    const rows = toSupabasePushRows(people, false)
    expect(rows).toHaveLength(1)
    expect('published' in rows[0]).toBe(false)
  })

  it('inclut `published: true` avec --publish', () => {
    const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'bio'])
    const { row } = normalizeRow({ nom: 'Bob', pays: 'FR', aile: 'culture', role: 'X', bio: 'Bio courte.' }, headerMap, {
      index: 0,
      autoOrder: 1,
    })
    const { people } = parsePeople([row])
    const rows = toSupabasePushRows(people, true)
    expect(rows[0].published).toBe(true)
  })
})

describe('findMissingMedia', () => {
  it('signale les fiches réelles sans photo ni crédit, avec la source indiquée si fournie', () => {
    const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'bio'])
    const withoutMedia = normalizeRow({ nom: 'Sans Media', pays: 'FR', aile: 'culture', role: 'X', bio: 'Bio.' }, headerMap, {
      index: 0,
      autoOrder: 1,
    })
    const withCredit = normalizeRow({ nom: 'Avec Credit', pays: 'FR', aile: 'culture', role: 'X', bio: 'Bio.' }, headerMap, {
      index: 1,
      autoOrder: 2,
    })
    withCredit.row.photoCredit = 'Photo : Officiel'
    const { people } = parsePeople([withoutMedia.row, withCredit.row])

    const photoSourceById = new Map([[people[0].id, 'https://exemple.org/officiel']])
    const missing = findMissingMedia(people, photoSourceById)

    expect(missing).toHaveLength(1)
    expect(missing[0]).toEqual({
      id: people[0].id,
      name: 'Sans Media',
      photoSource: 'https://exemple.org/officiel',
    })
  })

  it('ignore les fiches d’attente (placeholder) : elles n’ont ni photo ni crédit par nature', () => {
    const placeholder = generatePlaceholderPeople(1)
    expect(findMissingMedia(placeholder, new Map())).toEqual([])
  })

  it('n’inclut pas `photoSource` quand aucune source n’a été fournie', () => {
    const headerMap = buildHeaderMap(['nom', 'pays', 'aile', 'role', 'bio'])
    const { row } = normalizeRow({ nom: 'Sans Source', pays: 'FR', aile: 'culture', role: 'X', bio: 'Bio.' }, headerMap, {
      index: 0,
      autoOrder: 1,
    })
    const { people } = parsePeople([row])
    expect(findMissingMedia(people, new Map())).toEqual([{ id: people[0].id, name: 'Sans Source' }])
  })
})
