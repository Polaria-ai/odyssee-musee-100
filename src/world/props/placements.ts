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
 *
 * ## Mobilier supplémentaire (reprise de mission, WEL-872/873)
 *
 * `architecture.decorPlacements` reste clairsemé (contrat WEL-874, pas encore étendu côté architecture) :
 * les salles rendues avec CE SEUL décor paraissent vides (constat de la mission — hall presque nu,
 * ailes presque nues). Plutôt que d'attendre une extension du contrat (ou de modifier `layout.ts`, hors
 * périmètre de ce module), ce fichier calcule son PROPRE mobilier supplémentaire à partir des bounds de
 * salle et du décor déjà exposés (`architecture.rooms`, `architecture.decor`, `layout.frames`,
 * `layout.colliders`) : voir `hallExtras`/`infraExtras`/`indusExtras`/`cultureExtras` et `allPropPlans`
 * (fonction consommée par `RoomProps.tsx`, remplace `propPlansFromArchitecture` seule). Chaque position
 * choisie à la main (géométrie des salles, jamais aléatoire) est vérifiée par `isClearSpot` (murs/meubles/
 * cimaises déjà connus via `layout.colliders`, corridor de vue d'un cadre,
 * les quatre portes du hall, dont la porte sud des Archives) — un candidat qui échoue est simplement filtré (jamais de crash), voir
 * `placements.test.ts` pour la vérification que TOUS les candidats ci-dessous passent réellement ce test,
 * sur plusieurs répartitions de personnes (le nombre de rangées d'une aile ne change ni l'ancrage sur
 * `farWallX`, ni la zone d'entrée avant la 1ère rangée — voir le commentaire de chaque fonction).
 *
 * Chaque objet SOLIDE ajouté ici (pas les tapis/fleurs/éléments montés en hauteur) a une entrée dans
 * `EXTRA_FOOTPRINT` (rayon approximatif) : `propColliders` en dérive une boîte de collision. Cette boîte
 * n'est PAS branchée dans `MuseumLayout.colliders` (propriété du module architecture) — signalé en
 * knownGaps du rapport de mission, à câbler par l'intégration.
 */
import { farWallX, type DecorPlacement, type DecorPlacementType, type MuseumArchitecture } from '../layout'
import { aabb, circleIntersectsAabb } from '../collision'
import { archivesDoor } from '../../styles/tokens'
import { DOOR_WIDTH, HALL_HALF_DEPTH, HALL_HALF_WIDTH } from '../constants'
import type { AABB, MuseumLayout, Vec2, WingId } from '../../types'
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

// --- Mobilier supplémentaire (voir le commentaire de contrat en tête de fichier) -------------------

interface ExtraItem {
  wing: WingId
  key: PropModelKey
  tint: string
  fit: PropFit
  position: Vec2
  rotationY: number
  mountY: number
}

/**
 * Rayon approximatif (mètres) des objets SOLIDES ajoutés par ce fichier — sert à `isClearSpot` (garde
 * une distance aux obstacles déjà connus) ET à `propColliders` (boîte de collision, non branchée dans
 * `layout.ts`). Un modèle absent d'ici est considéré non solide (tapis, fleurs, élément monté en
 * hauteur) : pas de collider, clearance minimale dans `isClearSpot` (voir son appel par défaut).
 * Exporté pour `placements.test.ts` : le test réutilise ce même rayon, jamais une valeur dupliquée.
 */
export const EXTRA_FOOTPRINT: Partial<Record<PropModelKey, number>> = {
  hallBench: 0.85,
  hallPlanterSmall1: 0.28,
  hallPlanterSmall2: 0.28,
  hallSideTable: 0.3,
  infraMachineBed: 0.55,
  infraScreenPanel: 0.35,
  indusDesk: 0.55,
  indusShelf: 0.3,
  indusBoxLarge: 0.45,
  cultureSofa: 0.65,
  cultureBench: 0.35,
  cultureBookcaseOpen: 0.3,
}

const DOOR_HALF = DOOR_WIDTH / 2

/** Vrai si `p` est à moins de `margin` d'une des trois portes du hall (repère monde, valable pour un
 * point côté hall OU côté aile : c'est la même porte des deux côtés). */
function nearAnyHallDoor(p: Vec2, margin: number): boolean {
  const half = DOOR_HALF + margin
  if (Math.abs(p.z - -HALL_HALF_DEPTH) < margin && Math.abs(p.x) < half) return true // porte nord (industrialisation)
  if (Math.abs(p.x - -HALL_HALF_WIDTH) < margin && Math.abs(p.z) < half) return true // porte ouest (infrastructures)
  if (Math.abs(p.x - HALL_HALF_WIDTH) < margin && Math.abs(p.z) < half) return true // porte est (culture)
  // Porte sud (Archives de 2040) : l'embrasure et son passage vers le point d'arrivée restent libres.
  if (Math.abs(p.z - HALL_HALF_DEPTH) < margin + 1.5 && Math.abs(p.x - archivesDoor.x) < archivesDoor.width / 2 + margin) return true
  return false
}

/** Vrai si un objet de rayon `radius` posé en `p` s'intercalerait entre le `viewPoint` d'un cadre de
 * `wing` et ce cadre (couloir de vue, jamais obstrué — voir la mission). Les deux bornes viennent de
 * `layout.frames` (positions RÉELLES, valable quel que soit le nombre de personnes/rangées de l'aile). */
function blocksAFrame(p: Vec2, radius: number, layout: MuseumLayout, wing: WingId): boolean {
  if (wing === 'hall') return false
  for (const f of layout.frames) {
    if (f.wing !== wing) continue
    const fx = f.position[0]
    const fz = f.position[2]
    const zMin = Math.min(fz, f.viewPoint.z) - 0.3
    const zMax = Math.max(fz, f.viewPoint.z) + 0.3
    if (Math.abs(p.x - fx) < radius + 1.0 && p.z > zMin - radius && p.z < zMax + radius) return true
  }
  return false
}

/**
 * Vrai si un objet de rayon `radius` posé en `p` (salle `wing`) ne recoupe aucun obstacle déjà connu :
 * `layout.colliders` (murs, meubles cachés, cimaises, comptoir, socles à tampon), le couloir de vue d'un
 * cadre (`blocksAFrame`), une des quatre portes du
 * hall. Pure (aucun rendu) — sert à VALIDER les positions choisies à la main ci-dessous (jamais à en
 * déduire une par recherche), voir `placements.test.ts`.
 */
export function isClearSpot(p: Vec2, radius: number, layout: MuseumLayout, wing: WingId): boolean {
  for (const box of layout.colliders) {
    if (circleIntersectsAabb(p, radius + 0.15, box)) return false
  }
  if (blocksAFrame(p, radius, layout, wing)) return false
  if (nearAnyHallDoor(p, radius + 0.3)) return false
  return true
}

/**
 * Hall : bancs/jardinières supplémentaires (mission — « 4 à 6 bancs », « 6 à 10 plantes »), pupitre +
 * livres + tapis d'appoint au comptoir, touches de fleurs. Positions à la main à partir de
 * `architecture.decor` (mêmes structures que `hallDecorPlacements`, jamais recalculées côté architecture).
 */
function hallExtras(architecture: MuseumArchitecture): ExtraItem[] {
  const { pillars, counter } = architecture.decor
  const items: ExtraItem[] = []

  // Deux bancs de plus (4 au total avec les 2 déjà posés par l'architecture), le long des murs est/ouest,
  // à l'écart des piliers/jardinières d'angle et de la porte sud des Archives.
  items.push({ wing: 'hall', key: 'hallBench', tint: 'wood', fit: { mode: 'height', target: 0.5 }, position: { x: -9.0, z: 1.0 }, rotationY: Math.PI / 2, mountY: 0 })
  items.push({ wing: 'hall', key: 'hallBench', tint: 'wood', fit: { mode: 'height', target: 0.5 }, position: { x: 9.0, z: 1.0 }, rotationY: -Math.PI / 2, mountY: 0 })

  // Une jardinière basse à côté de chaque pilier (variantes 1/2 en alternance) : « grandes près des
  // colonnes » (les 4 grandes jardinières d'angle existent déjà, `architecture.decor.planters`).
  // Décalages choisis à la main par pilier (pas de formule générique : le pilier `pillars[3]`
  // s'écarte vers le hall, jamais vers une porte — voir `isClearSpot`).
  const nearPillars: Array<{ p: Vec2; dx: number; dz: number; key: PropModelKey }> = [
    { p: pillars[0], dx: -0.85, dz: -0.55, key: 'hallPlanterSmall1' },
    { p: pillars[1], dx: 0.85, dz: -0.55, key: 'hallPlanterSmall2' },
    { p: pillars[2], dx: -0.85, dz: 0.55, key: 'hallPlanterSmall1' },
    { p: pillars[3], dx: 0.85, dz: -0.6, key: 'hallPlanterSmall2' },
  ]
  for (const { p, dx, dz, key } of nearPillars) {
    items.push({ wing: 'hall', key, tint: 'planter', fit: { mode: 'height', target: key === 'hallPlanterSmall1' ? 0.42 : 0.46 }, position: { x: p.x + dx, z: p.z + dz }, rotationY: 0, mountY: 0 })
  }

  // Pupitre secondaire + pile de livres, au flanc du comptoir de Minerve (même côté que le premier
  // lampadaire, en retrait — voir `hallDecorPlacements`).
  const tableX = counter.center.x - counter.halfWidth - 1.6
  const tableZ = counter.center.z
  items.push({ wing: 'hall', key: 'hallSideTable', tint: 'wood', fit: { mode: 'height', target: 0.42 }, position: { x: tableX, z: tableZ }, rotationY: Math.PI / 2, mountY: 0 })
  items.push({ wing: 'hall', key: 'hallBooks', tint: 'books', fit: { mode: 'height', target: 0.12 }, position: { x: tableX, z: tableZ }, rotationY: 0.4, mountY: 0.42 })

  // Petit tapis devant le comptoir, entre les potelets du cordon (procédural, `roomGeometry.ts`) et
  // l'espace ouvert où se tient le joueur.
  items.push({
    wing: 'hall',
    key: 'hallRug',
    tint: 'rug',
    fit: { mode: 'footprint', target: 1.6 },
    position: { x: counter.center.x, z: counter.center.z + counter.halfDepth + 1.6 },
    rotationY: 0,
    mountY: 0,
  })

  // Touches de fleurs (3 teintes) au pied des deux jardinières d'angle côté ouest — jamais dans un
  // couloir de vue (le hall n'a pas de cadre). Décalages fixes (pas un angle qui tourne) : `dx` reste
  // TOUJOURS positif (vers l'intérieur du hall, jamais vers le mur ouest — les jardinières d'angle n'ont
  // qu'≈1,0 m de jeu jusqu'à ce mur) ; `dz` (±0,8 m max) reste dans la marge des murs nord/sud (≈1,6 m
  // de jeu depuis une jardinière d'angle). Vérifié par `isClearSpot` (placements.test.ts).
  const flowerKeys: PropModelKey[] = ['hallFlowerRed', 'hallFlowerYellow', 'hallFlowerPurple']
  const flowerOffsets: Array<[number, number]> = [
    [0.9, 0.25],
    [0.55, 0.8],
    [0.35, -0.8],
  ]
  const westPlanters = architecture.decor.planters.filter((p) => p.x < 0)
  for (const p of westPlanters) {
    flowerKeys.forEach((key, i) => {
      const [dx, dz] = flowerOffsets[i]
      items.push({
        wing: 'hall',
        key,
        tint: 'original',
        fit: { mode: 'height', target: 0.16 + i * 0.02 },
        position: { x: p.x + dx, z: p.z + dz },
        rotationY: 0,
        mountY: 0,
      })
    })
  }

  return items
}

/**
 * Aile Infrastructures : machine compacte + écran sur pied au sol (flancs du cluster de racks
 * existant), écran suspendu + antenne montés en hauteur contre le mur du fond (aucun collider, comme
 * une applique — voir `EXTRA_FOOTPRINT`). Ancré sur `farWallX` (zone TOUJOURS au-delà de la dernière
 * rangée de cadres, quel que soit le nombre de personnes — voir le commentaire de contrat en tête de
 * fichier), jamais sur une position de rangée (qui dépend, elle, du nombre de personnes).
 *
 * Z choisis dans la bande SANS cimaise entre les lanes 1 et 2 (`XWING_LANE_STEP` = 5 m, cimaise en
 * `cz-2`/`cz+3`, épaisseur `CIMAISE_THICKNESS` = 0,3 m — voir `buildXWing`) : z ∈ (cz-1.85, cz+2.85)
 * une fois la demi-épaisseur retirée, marge du rayon de l'objet en plus (voir `isClearSpot`). Objets
 * montés en hauteur décalés d'au moins 0,3 m au-delà de `wallX` (pas exactement dessus) : `wallX` n'est
 * qu'à ~0,12 m de la face du mur du fond (`farWallX(room, 0.32)`), trop près pour passer la marge de
 * `isClearSpot` même pour un petit rayon par défaut.
 */
function infraExtras(architecture: MuseumArchitecture): ExtraItem[] {
  const roomEntry = architecture.rooms.find((r) => r.room.id === 'infrastructures')
  if (!roomEntry) return []
  const room = roomEntry.room
  const wallX = farWallX(room, 0.32)
  const cz = (room.bounds.minZ + room.bounds.maxZ) / 2
  const intoRoom = wallX < 0 ? 1 : -1
  const facing = intoRoom > 0 ? Math.PI / 2 : -Math.PI / 2

  return [
    { wing: 'infrastructures', key: 'infraMachineBed', tint: 'teal', fit: { mode: 'height', target: 0.6 }, position: { x: wallX + intoRoom * 0.7, z: cz - 0.95 }, rotationY: facing, mountY: 0 },
    { wing: 'infrastructures', key: 'infraScreenPanel', tint: 'teal', fit: { mode: 'height', target: 0.9 }, position: { x: wallX + intoRoom * 0.5, z: cz + 1.3 }, rotationY: facing, mountY: 0 },
    { wing: 'infrastructures', key: 'infraScreenHanging', tint: 'teal', fit: { mode: 'footprint', target: 0.6 }, position: { x: wallX + intoRoom * 0.3, z: cz }, rotationY: facing, mountY: 2.5 },
    { wing: 'infrastructures', key: 'infraAntenna', tint: 'teal', fit: { mode: 'footprint', target: 0.55 }, position: { x: wallX + intoRoom * 0.3, z: cz - 0.9 }, rotationY: 0, mountY: 2.1 },
  ]
}

/**
 * Aile Industrialisation (aile nord) : établi + étagère dans la zone d'entrée (avant la 1ère rangée de
 * cadres — toujours libre en Z, voir `NEAR_MARGIN`), caisses empilées à côté du tapis roulant existant.
 *
 * `x` choisi loin de `NORTH_ROW_X` (= [-3,-1,1,3], voir `constants.ts`) : `blocksAFrame` ne regarde le Z
 * (couloir de vue) QUE si `x` est déjà proche d'une colonne de cadres (`|Δx| < radius + 1.0`) — un `x`
 * assez à l'écart (ici ≤ -5, à plus de 2 m de la colonne la plus proche, -3) rend le Z sans importance,
 * quel que soit le nombre de rangées (donc quel que soit le nombre de personnes de l'aile).
 */
function indusExtras(architecture: MuseumArchitecture): ExtraItem[] {
  const roomEntry = architecture.rooms.find((r) => r.room.id === 'industrialisation')
  if (!roomEntry) return []
  const room = roomEntry.room
  const hallZ = room.bounds.maxZ // toujours -HALL_HALF_DEPTH, voir `buildNorthWing`
  const halfW = (room.bounds.maxX - room.bounds.minX) / 2
  const halfD = (room.bounds.maxZ - room.bounds.minZ) / 2
  const cz = (room.bounds.minZ + room.bounds.maxZ) / 2
  const decorZ = cz - halfD + 1.6 // même formule que `wingDecorPlacements`
  const beltX = -halfW * 0.55

  return [
    { wing: 'industrialisation', key: 'indusDesk', tint: 'wood', fit: { mode: 'height', target: 0.75 }, position: { x: -5.2, z: hallZ - 1.6 }, rotationY: 0, mountY: 0 },
    { wing: 'industrialisation', key: 'indusShelf', tint: 'wood', fit: { mode: 'height', target: 1.8 }, position: { x: -6.2, z: hallZ - 1.8 }, rotationY: 0, mountY: 0 },
    { wing: 'industrialisation', key: 'indusBoxLarge', tint: 'orange', fit: { mode: 'height', target: 0.6 }, position: { x: beltX - 1.2, z: decorZ - 0.2 }, rotationY: 0.3, mountY: 0 },
    { wing: 'industrialisation', key: 'indusBoxSmall', tint: 'orange', fit: { mode: 'height', target: 0.35 }, position: { x: beltX - 1.2, z: decorZ - 0.2 }, rotationY: -0.2, mountY: 0.6 },
  ]
}

/** Aile Culture : banquette (velours) + banquette compacte plus « centrales » que les sculptures/
 * bibliothèque existantes (mission : « banquettes centrales »), bibliothèque ouverte en complément de la
 * fermée. Même ancrage `farWallX` qu'`infraExtras` (voir son commentaire). */
function cultureExtras(architecture: MuseumArchitecture): ExtraItem[] {
  const roomEntry = architecture.rooms.find((r) => r.room.id === 'culture')
  if (!roomEntry) return []
  const room = roomEntry.room
  const wallX = farWallX(room, 0.4)
  const cz = (room.bounds.minZ + room.bounds.maxZ) / 2
  const intoRoom = wallX < 0 ? 1 : -1
  const facing = intoRoom > 0 ? Math.PI / 2 : -Math.PI / 2

  // Mêmes bornes de Z « sans cimaise » qu'`infraExtras` (voir son commentaire) : (cz-1.85, cz+2.85)
  // moins le rayon de l'objet.
  return [
    { wing: 'culture', key: 'cultureSofa', tint: 'violet', fit: { mode: 'height', target: 0.8 }, position: { x: wallX + intoRoom * 1.3, z: cz + 1.9 }, rotationY: facing, mountY: 0 },
    { wing: 'culture', key: 'cultureBench', tint: 'violet', fit: { mode: 'height', target: 0.45 }, position: { x: wallX + intoRoom * 1.3, z: cz - 0.9 }, rotationY: facing, mountY: 0 },
    { wing: 'culture', key: 'cultureBookcaseOpen', tint: 'violet', fit: { mode: 'height', target: 1.8 }, position: { x: wallX + intoRoom * 1.1, z: cz + 0.7 }, rotationY: facing, mountY: 0 },
  ]
}

/** Tous les candidats bruts (avant filtre `isClearSpot`) — exporté pour `placements.test.ts` : vérifie
 * qu'aucun candidat n'est silencieusement filtré (voir `extraPropPlans`/`propColliders`). */
export function allExtraItems(architecture: MuseumArchitecture): ExtraItem[] {
  return [...hallExtras(architecture), ...infraExtras(architecture), ...indusExtras(architecture), ...cultureExtras(architecture)]
}

/**
 * Mobilier supplémentaire (voir le commentaire de contrat en tête de fichier), regroupé par modèle comme
 * `propPlansFromArchitecture` — un candidat qui échoue `isClearSpot` est filtré, jamais rendu (défensif :
 * ne doit jamais dépendre d'une répartition de personnes précise pour rester correct).
 */
export function extraPropPlans(architecture: MuseumArchitecture, layout: MuseumLayout): PropKindPlan[] {
  const items = allExtraItems(architecture).filter((it) => isClearSpot(it.position, EXTRA_FOOTPRINT[it.key] ?? 0.05, layout, it.wing))
  const byKey = new Map<PropModelKey, PropKindPlan>()
  for (const it of items) {
    const plan = byKey.get(it.key) ?? { key: it.key, tint: it.tint, fit: it.fit, placements: [] }
    plan.placements.push({ position: it.position, rotationY: it.rotationY, mountY: it.mountY })
    byKey.set(it.key, plan)
  }
  return [...byKey.values()]
}

/** Fusionne deux listes de `PropKindPlan` par `key` (jamais deux plans pour le même modèle — React `key`
 * unique côté `RoomProps.tsx`). */
function mergePropKindPlans(a: PropKindPlan[], b: PropKindPlan[]): PropKindPlan[] {
  const byKey = new Map<PropModelKey, PropKindPlan>()
  for (const plan of [...a, ...b]) {
    const existing = byKey.get(plan.key)
    if (existing) existing.placements.push(...plan.placements)
    else byKey.set(plan.key, { key: plan.key, tint: plan.tint, fit: plan.fit, placements: [...plan.placements] })
  }
  return [...byKey.values()]
}

/** Tout le mobilier à rendre (`RoomProps.tsx`) : décor `architecture.decorPlacements` (WEL-874) + mobilier
 * supplémentaire de ce module (voir le commentaire de contrat en tête de fichier). */
export function allPropPlans(architecture: MuseumArchitecture, layout: MuseumLayout): PropKindPlan[] {
  return mergePropKindPlans(propPlansFromArchitecture(architecture), extraPropPlans(architecture, layout))
}

/**
 * Boîtes de collision (AABB) des objets SOLIDES ajoutés par `extraPropPlans` (voir `EXTRA_FOOTPRINT`) —
 * PAS branchées dans `MuseumLayout.colliders` (propriété du module architecture, jamais modifié ici) :
 * à consommer par l'intégration pour que le joueur ne les traverse plus (knownGaps du rapport de mission).
 */
export function propColliders(architecture: MuseumArchitecture, layout: MuseumLayout): AABB[] {
  const items = allExtraItems(architecture).filter((it) => isClearSpot(it.position, EXTRA_FOOTPRINT[it.key] ?? 0.05, layout, it.wing))
  const boxes: AABB[] = []
  for (const it of items) {
    const r = EXTRA_FOOTPRINT[it.key]
    if (r === undefined) continue // décor non solide (tapis, fleurs, élément monté en hauteur…)
    boxes.push(aabb(it.position.x - r, it.position.x + r, it.position.z - r, it.position.z + r))
  }
  return boxes
}
