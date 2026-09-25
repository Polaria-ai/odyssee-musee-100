/**
 * Traduit les `DecorPlacement` exposés par le module architecture (`MuseumArchitecture.decorPlacements`,
 * contrat WEL-874 en tête de `src/world/layout.ts`) en plans de rendu pour `RoomProps.tsx` : un modèle
 * CC0 (`PropModelKey`), une teinte (`tints.ts`) et un gabarit (`PropFit`, `geometry.ts`) par
 * `DecorPlacementType`. Fonctions PURES (aucune dépendance three.js) — testables sans WebGL, voir
 * `placements.test.ts`.
 *
 * Architecture est la source de vérité des POSITIONS (x, z, rotationY) : ce module ne recalcule jamais
 * une position, il se contente de les regrouper par type et d'y associer un modèle. Seule la hauteur de
 * montage (`mountY`, ex. une applique murale) est une décision du module props, puisqu'elle dépend du
 * modèle réellement choisi — `DecorPlacement.position` reste une position AU SOL (voir le contrat).
 */
import type { DecorPlacement, DecorPlacementType, MuseumArchitecture } from '../layout'
import type { Vec2 } from '../../types'
import type { PropModelKey } from './models'
import type { PropFit } from './geometry'

export interface PropPlacement {
  position: Vec2
  rotationY: number
  /** Hauteur du socle au-dessus du sol (mètres) — 0 par défaut (objet posé au sol). */
  mountY: number
}

export interface PropKindPlan {
  key: PropModelKey
  /** Identifiant de la teinte à appliquer (voir `tints.ts`) — sert aussi de clé de cache géométrie. */
  tint: string
  fit: PropFit
  placements: PropPlacement[]
}

interface DecorTypeSpec {
  key: PropModelKey
  tint: string
  fit: PropFit
  /** Hauteur de montage (mètres) — seules les appliques murales ne sont pas posées au sol. */
  mountY?: number
}

/**
 * Un modèle CC0 par `DecorPlacementType` (voir `docs/assets/props.md` pour la provenance de chaque
 * fichier : pack, modèle d'origine, retouches). Les gabarits (`fit`) visent les constantes déjà
 * utilisées par l'architecture pour ce même rôle (`COLUMN_HEIGHT`, `BENCH_HEIGHT`, `JARDINIERE_HEIGHT`,
 * `src/world/constants.ts`) quand elles existent, sinon une hauteur réaliste mesurée sur le modèle brut
 * (`gltf-transform inspect`, voir le rapport de mission).
 */
const DECOR_TYPE: Record<DecorPlacementType, DecorTypeSpec> = {
  column: { key: 'hallColumn', tint: 'stone', fit: { mode: 'height', target: 4.0 } }, // COLUMN_HEIGHT
  bench: { key: 'hallBench', tint: 'wood', fit: { mode: 'height', target: 0.5 } }, // BENCH_HEIGHT
  planter: { key: 'hallPlanterLarge', tint: 'planter', fit: { mode: 'height', target: 1.2 } }, // ≈ JARDINIERE_HEIGHT
  'wall-lamp': { key: 'hallLampWall', tint: 'lamp', fit: { mode: 'footprint', target: 0.3 }, mountY: 2.1 },
  'floor-lamp': { key: 'hallLampFloor', tint: 'lamp', fit: { mode: 'height', target: 1.5 } },
  'rack-server-primary': { key: 'infraRackWindow', tint: 'teal', fit: { mode: 'height', target: 1.8 } },
  'rack-server-variant': { key: 'infraRackFortified', tint: 'teal', fit: { mode: 'height', target: 1.8 } },
  'conveyor-segment': { key: 'indusConveyor', tint: 'orange', fit: { mode: 'height', target: 0.45 } },
  'robot-arm': { key: 'indusRobotArm', tint: 'orange', fit: { mode: 'height', target: 1.3 } },
  'sculpture-primary': { key: 'cultureSculpture1', tint: 'gold', fit: { mode: 'height', target: 0.9 } },
  'sculpture-variant': { key: 'cultureSculpture2', tint: 'violet', fit: { mode: 'height', target: 0.85 } },
  bookcase: { key: 'cultureBookcaseClosed', tint: 'violet', fit: { mode: 'height', target: 1.8 } },
}

/** Tous les `DecorPlacementType` connus de ce module (vérifié par `placements.test.ts` : un par membre du type). */
export function decorTypeKeys(): DecorPlacementType[] {
  return Object.keys(DECOR_TYPE) as DecorPlacementType[]
}

/**
 * Modèles réellement posés par ce module (un par `DecorPlacementType` mappé) — à précharger, PAS tout
 * `PROP_MODELS` : `models.ts` référence aussi des modèles optimisés pour un rôle du catalogue
 * (`docs/assets/catalogue.md`) sans `DecorPlacement` correspondant côté architecture pour l'instant
 * (voir le rapport de mission), qu'il serait inutile — et coûteux en bande passante mobile — de
 * précharger.
 */
export function usedModelKeys(): PropModelKey[] {
  return [...new Set(Object.values(DECOR_TYPE).map((s) => s.key))]
}

/**
 * Regroupe `architecture.decorPlacements` par type : un `PropKindPlan` par type présent (donc par
 * modèle), quel que soit le nombre de placements — c'est ce regroupement qui permet à `RoomProps.tsx`
 * de n'ouvrir qu'une seule `<Instances>` (un appel de dessin) par modèle.
 */
export function propPlansFromArchitecture(architecture: MuseumArchitecture): PropKindPlan[] {
  const byType = new Map<DecorPlacementType, DecorPlacement[]>()
  for (const d of architecture.decorPlacements) {
    const list = byType.get(d.type) ?? []
    list.push(d)
    byType.set(d.type, list)
  }

  const plans: PropKindPlan[] = []
  for (const [type, items] of byType) {
    const spec = DECOR_TYPE[type]
    if (!spec) continue // type inconnu (contrat étendu côté architecture, pas encore mappé ici) : voir le rapport de mission
    plans.push({
      key: spec.key,
      tint: spec.tint,
      fit: spec.fit,
      placements: items.map((d) => ({ position: d.position, rotationY: d.rotationY, mountY: spec.mountY ?? 0 })),
    })
  }
  return plans
}
