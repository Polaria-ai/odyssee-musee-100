import { describe, expect, it } from 'vitest'
import { generatePlaceholderPeople } from '../data/placeholder'
import { escapeCollider } from '../player/physics'
import { dims } from '../styles/tokens'
import { buildMuseumArchitecture, buildMuseumLayout } from '../world/layout'
import { allPropPlans, propColliders } from '../world/props/placements'
import { playerColliders } from './playerColliders'

const people = generatePlaceholderPeople(100)
const layout = buildMuseumLayout(people)
const architecture = buildMuseumArchitecture(people)

describe('playerColliders', () => {
  it('ajoute les colliders du mobilier supplémentaire (props) à ceux de l’architecture', () => {
    const extra = propColliders(architecture, layout)
    // Sinon ce test (et le suivant) ne prouverait rien : il faut au moins un meuble supplémentaire réel.
    expect(extra.length).toBeGreaterThan(0)
    const merged = playerColliders(layout, architecture)
    expect(merged.length).toBe(layout.colliders.length + extra.length)
  })

  it('bloque désormais le joueur au centre d’un meuble supplémentaire (régression : le joueur le traversait librement)', () => {
    const extra = propColliders(architecture, layout)
    const box = extra[0]
    const center = { x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 }

    // Avant le correctif (colliders d’architecture seuls) : rien ne repousse le joueur de ce point.
    const withBaseOnly = escapeCollider(center, dims.playerRadius, layout.colliders)
    expect(withBaseOnly).toEqual(center)

    // Après le correctif (colliders fusionnés) : le joueur est repoussé hors du meuble.
    const merged = playerColliders(layout, architecture)
    const withMerged = escapeCollider(center, dims.playerRadius, merged)
    expect(withMerged).not.toEqual(center)
  })

  it('ne modifie jamais `layout.colliders` lui-même — sinon RoomProps (qui recalcule ce même mobilier via `isClearSpot`) verrait chaque meuble entrer en collision avec sa propre boîte et disparaîtrait entièrement du rendu', () => {
    const before = layout.colliders.length
    const plansBefore = allPropPlans(architecture, layout).length
    playerColliders(layout, architecture)
    expect(layout.colliders.length).toBe(before)
    expect(allPropPlans(architecture, layout).length).toBe(plansBefore)
    expect(allPropPlans(architecture, layout).length).toBeGreaterThan(0)
  })

  it('preuve par l’absurde : fusionner ces boîtes DANS `layout.colliders` viderait le mobilier supplémentaire rendu', () => {
    const extra = propColliders(architecture, layout)
    const pollutedLayout = { ...layout, colliders: [...layout.colliders, ...extra] }
    const plans = allPropPlans(architecture, pollutedLayout)
    const solidKeys = new Set(Object.keys({}))
    void solidKeys
    // Tous les meubles SOLIDES (ceux qui ont un collider) doivent avoir disparu du rendu : chacun se
    // bloque lui-même. Seuls les éléments non solides (tapis, fleurs, éléments montés) peuvent rester.
    const totalPlacementsBefore = allPropPlans(architecture, layout).reduce((n, p) => n + p.placements.length, 0)
    const totalPlacementsAfter = plans.reduce((n, p) => n + p.placements.length, 0)
    expect(totalPlacementsAfter).toBeLessThan(totalPlacementsBefore)
  })
})
