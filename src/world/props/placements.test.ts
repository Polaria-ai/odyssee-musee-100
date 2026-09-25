import { describe, expect, it } from 'vitest'
import type { ExhibitWingId, Person } from '../../types'
import { EXHIBIT_WINGS } from '../../types'
import { buildMuseumArchitecture } from '../layout'
import { generatePlaceholderPeople } from '../../data/placeholder'
import { propPlansFromArchitecture, usedModelKeys } from './placements'
import { PROP_MODELS } from './models'

function makePeople(counts: Record<ExhibitWingId, number>): Person[] {
  const people: Person[] = []
  let order = 1
  for (const wing of EXHIBIT_WINGS) {
    for (let i = 0; i < counts[wing]; i++, order++) {
      people.push({
        id: `p-${wing}-${String(i).padStart(3, '0')}`,
        order,
        name: `Test ${order}`,
        role: { fr: 'Rôle', en: 'Role' },
        organization: 'Org',
        country: 'EU',
        wing,
        bio: { fr: 'Bio', en: 'Bio' },
        story: { fr: '', en: '' },
        photoUrl: null,
        placeholder: true,
      })
    }
  }
  return people
}

const distributions: Record<string, Person[]> = {
  '100 fiches par défaut': generatePlaceholderPeople(100),
  '100/0/0': makePeople({ infrastructures: 100, industrialisation: 0, culture: 0 }),
  'aucune aile peuplée': makePeople({ infrastructures: 0, industrialisation: 0, culture: 0 }),
  '1 personne par aile': makePeople({ infrastructures: 1, industrialisation: 1, culture: 1 }),
}

describe('usedModelKeys', () => {
  it('ne référence que des clés connues de PROP_MODELS', () => {
    for (const key of usedModelKeys()) expect(PROP_MODELS[key]).toBeDefined()
  })

  it("n'est jamais vide (au moins le décor du hall)", () => {
    expect(usedModelKeys().length).toBeGreaterThan(0)
  })
})

describe('propPlansFromArchitecture', () => {
  for (const [label, people] of Object.entries(distributions)) {
    it(`ne perd aucun DecorPlacement (${label})`, () => {
      const architecture = buildMuseumArchitecture(people)
      const plans = propPlansFromArchitecture(architecture)
      const totalPlaced = plans.reduce((sum, p) => sum + p.placements.length, 0)
      // Si un DecorPlacementType n'a pas de modèle associé dans placements.ts, il est silencieusement
      // ignoré (voir le commentaire `if (!spec) continue`) : ce test l'attraperait comme un total plus
      // petit que `decorPlacements.length`, gardant les deux fichiers en phase sans dupliquer la liste
      // des types ici.
      expect(totalPlaced).toBe(architecture.decorPlacements.length)
    })

    it(`ne pose que des modèles connus de PROP_MODELS (${label})`, () => {
      const architecture = buildMuseumArchitecture(people)
      const plans = propPlansFromArchitecture(architecture)
      for (const plan of plans) expect(PROP_MODELS[plan.key]).toBeDefined()
    })
  }

  it('salle vide : que du décor de hall, aucun rôle de rack/tapis roulant/sculpture', () => {
    const architecture = buildMuseumArchitecture(distributions['aucune aile peuplée'])
    const plans = propPlansFromArchitecture(architecture)
    const keys = plans.map((p) => p.key)
    expect(keys).not.toContain('infraRackWindow')
    expect(keys).not.toContain('indusConveyor')
    expect(keys).not.toContain('cultureSculpture1')
    expect(keys).toContain('hallColumn')
  })

  it('une seule aile peuplée (infrastructures) : pas de décor industrialisation/culture', () => {
    const architecture = buildMuseumArchitecture(makePeople({ infrastructures: 5, industrialisation: 0, culture: 0 }))
    const plans = propPlansFromArchitecture(architecture)
    const keys = plans.map((p) => p.key)
    expect(keys).toContain('infraRackWindow')
    expect(keys).not.toContain('indusConveyor')
    expect(keys).not.toContain('indusRobotArm')
    expect(keys).not.toContain('cultureBookcaseClosed')
  })

  it('chaque placement garde la position (x, z) et rotationY donnés par architecture (aucun recalcul)', () => {
    const architecture = buildMuseumArchitecture(distributions['100 fiches par défaut'])
    const plans = propPlansFromArchitecture(architecture)
    const rendered = new Set(plans.flatMap((p) => p.placements.map((pl) => `${pl.position.x},${pl.position.z},${pl.rotationY}`)))
    for (const d of architecture.decorPlacements) {
      expect(rendered.has(`${d.position.x},${d.position.z},${d.rotationY}`)).toBe(true)
    }
  })

  it('applique/lampadaire (hall) : mountY nul au sol, non nul au mur (montage)', () => {
    const architecture = buildMuseumArchitecture(distributions['100 fiches par défaut'])
    const plans = propPlansFromArchitecture(architecture)
    const wallLamp = plans.find((p) => p.key === 'hallLampWall')
    const floorLamp = plans.find((p) => p.key === 'hallLampFloor')
    expect(wallLamp?.placements.every((p) => p.mountY > 1)).toBe(true)
    expect(floorLamp?.placements.every((p) => p.mountY === 0)).toBe(true)
  })
})
