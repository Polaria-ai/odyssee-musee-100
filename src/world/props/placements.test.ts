import { describe, expect, it } from 'vitest'
import type { ExhibitWingId, Person } from '../../types'
import { EXHIBIT_WINGS } from '../../types'
import { buildMuseumArchitecture, buildMuseumLayout } from '../layout'
import { generatePlaceholderPeople } from '../../data/placeholder'
import { EXTRA_FOOTPRINT, allExtraItems, allPropPlans, extraPropPlans, isClearSpot, propColliders, propPlansFromArchitecture, usedModelKeys } from './placements'
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
  '2 personnes par aile': makePeople({ infrastructures: 2, industrialisation: 2, culture: 2 }),
  '60 en culture uniquement': makePeople({ infrastructures: 0, industrialisation: 0, culture: 60 }),
  '60 en infrastructures uniquement': makePeople({ infrastructures: 60, industrialisation: 0, culture: 0 }),
  '60 en industrialisation uniquement': makePeople({ infrastructures: 0, industrialisation: 60, culture: 0 }),
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

// --- Mobilier supplémentaire (reprise de mission WEL-872/873) --------------------------------------

describe('extraPropPlans / propColliders', () => {
  for (const [label, people] of Object.entries(distributions)) {
    it(`aucun candidat n'est silencieusement filtré par isClearSpot (${label})`, () => {
      const architecture = buildMuseumArchitecture(people)
      const layout = buildMuseumLayout(people)
      const candidates = allExtraItems(architecture)
      const plans = extraPropPlans(architecture, layout)
      const totalPlaced = plans.reduce((sum, p) => sum + p.placements.length, 0)
      if (totalPlaced !== candidates.length) {
        const rejected = candidates.filter((c) => !isClearSpot(c.position, EXTRA_FOOTPRINT[c.key] ?? 0.05, layout, c.wing))
        expect(rejected, `candidats rejetés par isClearSpot (${label}): ${JSON.stringify(rejected)}`).toEqual([])
      }
      expect(totalPlaced).toBe(candidates.length)
      expect(totalPlaced).toBeGreaterThan(0) // au moins le décor du hall, toujours peuplé
    })

    it(`ne pose que des modèles connus de PROP_MODELS (extras — ${label})`, () => {
      const architecture = buildMuseumArchitecture(people)
      const layout = buildMuseumLayout(people)
      const plans = extraPropPlans(architecture, layout)
      for (const plan of plans) expect(PROP_MODELS[plan.key]).toBeDefined()
    })
  }

  it("le nombre de candidats ajoutés ne dépend PAS du nombre de rangées d'une aile (ancrage farWallX/zone d'entrée constant)", () => {
    const few = extraPropPlans(buildMuseumArchitecture(distributions['1 personne par aile']), buildMuseumLayout(distributions['1 personne par aile']))
    const many = extraPropPlans(buildMuseumArchitecture(distributions['100 fiches par défaut']), buildMuseumLayout(distributions['100 fiches par défaut']))
    const countFor = (plans: ReturnType<typeof extraPropPlans>, key: string) => plans.find((p) => p.key === key)?.placements.length ?? 0
    for (const key of ['infraMachineBed', 'infraScreenPanel', 'indusDesk', 'indusShelf', 'cultureSofa', 'cultureBench']) {
      expect(countFor(few, key)).toBe(countFor(many, key))
      expect(countFor(few, key)).toBeGreaterThan(0)
    }
  })

  it('aucun extra dans une aile sans personne (comingSoonWings)', () => {
    const architecture = buildMuseumArchitecture(distributions['aucune aile peuplée'])
    const layout = buildMuseumLayout(distributions['aucune aile peuplée'])
    const plans = extraPropPlans(architecture, layout)
    const keys = plans.map((p) => p.key)
    for (const wingKey of ['infraMachineBed', 'infraScreenPanel', 'indusDesk', 'cultureSofa']) expect(keys).not.toContain(wingKey)
    // Le hall, lui, reste toujours meublé.
    expect(keys).toContain('hallBench')
  })

  it("propColliders ne couvre que les objets solides (jamais tapis/fleurs/éléments montés en hauteur)", () => {
    const people = distributions['100 fiches par défaut']
    const boxes = propColliders(buildMuseumArchitecture(people), buildMuseumLayout(people))
    expect(boxes.length).toBeGreaterThan(0)
    // Une boîte par objet solide, jamais une boîte dégénérée (largeur/profondeur nulles).
    for (const box of boxes) {
      expect(box.maxX).toBeGreaterThan(box.minX)
      expect(box.maxZ).toBeGreaterThan(box.minZ)
    }
  })

  it('réduit tous les noyaux solides ajoutés de moitié en X/Z, sans déplacer les objets ni créer de collider décoratif', () => {
    const people = distributions['100 fiches par défaut']
    const architecture = buildMuseumArchitecture(people)
    const layout = buildMuseumLayout(people)
    const objectsBefore = JSON.stringify(allPropPlans(architecture, layout))
    const solidItems = allExtraItems(architecture).filter((it) => {
      const r = EXTRA_FOOTPRINT[it.key]
      return r !== undefined && isClearSpot(it.position, r, layout, it.wing)
    })
    const boxes = propColliders(architecture, layout)
    expect(boxes).toHaveLength(solidItems.length)
    for (const [i, item] of solidItems.entries()) {
      const originalRadius = EXTRA_FOOTPRINT[item.key]!
      const box = boxes[i]
      // La boîte d'origine faisait 2r × 2r : le noyau fait r × r, soit 25 % de sa surface.
      expect(box.maxX - box.minX).toBeCloseTo(originalRadius)
      expect(box.maxZ - box.minZ).toBeCloseTo(originalRadius)
      expect((box.maxX - box.minX) * (box.maxZ - box.minZ)).toBeCloseTo(originalRadius ** 2)
      expect((box.minX + box.maxX) / 2).toBeCloseTo(item.position.x)
      expect((box.minZ + box.maxZ) / 2).toBeCloseTo(item.position.z)
    }
    expect(JSON.stringify(allPropPlans(architecture, layout))).toBe(objectsBefore)
  })

  it('allPropPlans ne perd ni le décor `architecture.decorPlacements` ni les extras', () => {
    const people = distributions['100 fiches par défaut']
    const architecture = buildMuseumArchitecture(people)
    const layout = buildMuseumLayout(people)
    const base = propPlansFromArchitecture(architecture)
    const extra = extraPropPlans(architecture, layout)
    const combined = allPropPlans(architecture, layout)
    const totalBase = base.reduce((sum, p) => sum + p.placements.length, 0)
    const totalExtra = extra.reduce((sum, p) => sum + p.placements.length, 0)
    const totalCombined = combined.reduce((sum, p) => sum + p.placements.length, 0)
    expect(totalCombined).toBe(totalBase + totalExtra) // pas de clé partagée entre base et extra ici
    expect(new Set(combined.map((p) => p.key)).size).toBe(combined.length) // une seule plan par clé (React key)
  })
})
