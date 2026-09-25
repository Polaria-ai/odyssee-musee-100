/**
 * Registre des modèles 3D CC0 du module mobilier & décor (WEL-872/873).
 * Chemins publiés par `scripts/optimize-assets.mjs` (voir `docs/assets/props.md` pour la provenance
 * de chaque fichier : pack, modèle d'origine, retouches).
 */

export const PROP_MODELS = {
  // --- Hall -------------------------------------------------------------
  hallColumn: '/models/props/hall/column.glb',
  hallBench: '/models/props/hall/bench.glb',
  hallBenchTree: '/models/props/hall/bench-tree.glb',
  hallPlanterLarge: '/models/props/hall/planter-large.glb',
  hallPlanterSmall1: '/models/props/hall/planter-small-1.glb',
  hallPlanterSmall2: '/models/props/hall/planter-small-2.glb',
  hallLampFloor: '/models/props/hall/lamp-floor.glb',
  hallLampWall: '/models/props/hall/lamp-wall.glb',
  hallRug: '/models/props/hall/rug.glb',
  hallSideTable: '/models/props/hall/side-table.glb',
  hallBooks: '/models/props/hall/books.glb',
  hallFlowerRed: '/models/props/hall/flower-red.glb',
  hallFlowerYellow: '/models/props/hall/flower-yellow.glb',
  hallFlowerPurple: '/models/props/hall/flower-purple.glb',
  hallStanchion: '/models/props/hall/stanchion.glb',

  // --- Aile Infrastructures (salle des machines) ------------------------
  infraRackWindow: '/models/props/infra/rack-window.glb',
  infraRackFortified: '/models/props/infra/rack-fortified.glb',
  infraMachineBed: '/models/props/infra/machine-bed.glb',
  infraAntenna: '/models/props/infra/antenna.glb',
  infraScreenPanel: '/models/props/infra/screen-panel.glb',
  infraScreenHanging: '/models/props/infra/screen-hanging.glb',
  infraPipe: '/models/props/infra/pipe.glb',
  infraPipeBend: '/models/props/infra/pipe-bend.glb',

  // --- Aile Industrialisation (atelier) ----------------------------------
  indusConveyor: '/models/props/indus/conveyor.glb',
  indusBoxLarge: '/models/props/indus/box-large.glb',
  indusBoxSmall: '/models/props/indus/box-small.glb',
  indusRobotArm: '/models/props/indus/robot-arm.glb',
  indusDesk: '/models/props/indus/desk.glb',
  indusShelf: '/models/props/indus/shelf.glb',

  // --- Aile Culture (galerie) ---------------------------------------------
  cultureSofa: '/models/props/culture/sofa.glb',
  cultureBench: '/models/props/culture/bench.glb',
  cultureBookcaseClosed: '/models/props/culture/bookcase-closed.glb',
  cultureBookcaseOpen: '/models/props/culture/bookcase-open.glb',
  cultureSculpture1: '/models/props/culture/sculpture-1.glb',
  cultureSculpture2: '/models/props/culture/sculpture-2.glb',
} as const

export type PropModelKey = keyof typeof PROP_MODELS
