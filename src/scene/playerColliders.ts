/**
 * Propriétaire : intégration (`src/scene/**`). Colliders utilisés par la physique du joueur
 * (`Player.tsx`, via `Experience.tsx`) : les colliders de base du plan (`layout.colliders`,
 * murs/meubles cachés/cimaises/socles — module architecture) PLUS les boîtes de collision du mobilier
 * supplémentaire du module props (`propColliders`, WEL-872/873, `src/world/props/placements.ts`).
 *
 * ## Pourquoi une fonction séparée plutôt qu'une fusion dans `MuseumLayout.colliders` lui-même
 *
 * `docs/assets/props.md` documentait ce knownGap (« propColliders(...) calcule des boîtes de collision
 * ... mais elles ne sont PAS branchées dans MuseumLayout.colliders ») en suggérant de les fusionner dans
 * `layout.colliders`. C'est PIÉGÉ : `RoomProps.tsx` recalcule ce même mobilier supplémentaire à CHAQUE
 * rendu via `allPropPlans(architecture, layout)` → `extraPropPlans` → `isClearSpot(candidat, ..., layout,
 * ...)`, qui rejette un candidat dont le CENTRE tombe dans un collider de `layout.colliders`. Le centre
 * d'un meuble tombe TOUJOURS dans sa propre boîte de collision (`propColliders` la construit à partir de
 * cette même position) : si cette boîte figurait déjà dans `layout.colliders`, chaque meuble se
 * bloquerait lui-même et `allPropPlans` ne rendrait plus AUCUN mobilier supplémentaire (régression pire
 * que le bug de collision d'origine). Voir `playerColliders.test.ts` pour la preuve par l'absurde
 * (`layout.colliders` fusionné → `allPropPlans` vide) et la non-régression (fonction séparée → mobilier
 * intact ET joueur bloqué).
 *
 * Cette fonction merge donc les deux listes uniquement au point de CONSOMMATION par la physique
 * (`Experience.tsx` construit un `MuseumLayout` dérivé, colliders fusionnés, passé UNIQUEMENT à
 * `<Player>` — `<Museum>`/`<RoomProps>` continuent de recevoir le `layout` de base, inchangé).
 */
import type { AABB, MuseumLayout } from '../types'
import type { MuseumArchitecture } from '../world/layout'
import { propColliders } from '../world/props/placements'

export function playerColliders(layout: MuseumLayout, architecture: MuseumArchitecture): AABB[] {
  return [...layout.colliders, ...propColliders(architecture, layout)]
}
