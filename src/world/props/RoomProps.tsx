/**
 * Mobilier & décor 3D du hall et des trois ailes (WEL-872 hall, WEL-873 ailes) : modèles CC0 optimisés
 * (packs Kenney, voir `docs/assets/props.md`), recolorés vers la palette du musée, chargés sous
 * `<Suspense>`. Les positions viennent de `architecture.decorPlacements` (contrat WEL-874, voir
 * `src/world/layout.ts`) : ce module ne recalcule jamais une position, il pose juste un modèle à
 * chacune. Chaque modèle répété = une seule géométrie partagée (`<Instances>` de drei → un appel de
 * dessin par (modèle, matériau), quel que soit le nombre de placements) — voir `geometry.ts`.
 *
 * Propriétaire : module mobilier & décor (`src/world/props/**`). Ne rend QUE le mobilier ; murs, sol,
 * cadres et positions restent la responsabilité du module architecture (`layout.ts`/`Museum.tsx`).
 */
import { Suspense, useMemo } from 'react'
import { Instance, Instances } from '@react-three/drei'
import type { MuseumArchitecture } from '../layout'
import type { MuseumLayout } from '../../types'
import { useModel, preloadModel } from '../../assets/useModel'
import { PROP_MODELS } from './models'
import { propParts } from './geometry'
import { allPropPlans, usedModelKeys, type PropKindPlan } from './placements'
import { FLAT_TINT_VARIANTS, tintFor } from './tints'

// Précharge les modèles RÉELLEMENT posés (pas tout `PROP_MODELS`, voir `usedModelKeys`) au niveau
// module (hors rendu) : évite un pop-in visible au premier plan large du hall ou d'une aile, sans
// gaspiller de bande passante mobile sur des modèles optimisés mais pas encore branchés à un
// `DecorPlacement` (contrat `preloadModel`, voir `src/assets/useModel.ts`).
for (const key of usedModelKeys()) preloadModel(PROP_MODELS[key])

/** Rend un modèle CC0 répété à ses placements : une `<Instances>` par matériau du modèle. */
function PropKind({ plan }: { plan: PropKindPlan }) {
  const url = PROP_MODELS[plan.key]
  const { scene } = useModel(url)
  const parts = useMemo(() => propParts(scene, url, plan.tint, tintFor(plan.tint), plan.fit, FLAT_TINT_VARIANTS.has(plan.tint)), [scene, url, plan.tint, plan.fit])
  if (plan.placements.length === 0) return null
  return (
    <>
      {parts.map((part, pi) => (
        <Instances key={pi} geometry={part.geometry} material={part.material} limit={Math.max(1, plan.placements.length)} castShadow={false} receiveShadow={false}>
          {plan.placements.map((p, i) => (
            <Instance key={i} position={[p.position.x, p.mountY, p.position.z]} rotation={[0, p.rotationY, 0]} />
          ))}
        </Instances>
      ))}
    </>
  )
}

function RoomPropsContent({ architecture, layout }: { architecture: MuseumArchitecture; layout: MuseumLayout }) {
  const plans = useMemo(() => allPropPlans(architecture, layout), [architecture, layout])
  return (
    <group>
      {plans.map((plan) => (
        <PropKind key={plan.key} plan={plan} />
      ))}
    </group>
  )
}

/**
 * Mobilier & décor du hall et des ailes peuplées : positions `architecture.decorPlacements` (contrat
 * WEL-874) COMPLÉTÉES par le mobilier supplémentaire calculé par ce module (`placements.ts::allPropPlans`,
 * reprise de mission WEL-872/873 — hall/ailes trop clairsemés) à partir des bounds de salle et de
 * `layout.frames`/`layout.colliders` (jamais un `DecorPlacement` recalculé, voir le contrat).
 */
export function RoomProps({ architecture, layout }: { architecture: MuseumArchitecture; layout: MuseumLayout }) {
  return (
    <Suspense fallback={null}>
      <RoomPropsContent architecture={architecture} layout={layout} />
    </Suspense>
  )
}
