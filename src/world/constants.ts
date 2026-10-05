/**
 * Constantes du plan du musée, propres au module monde.
 * Complète `dims` (src/styles/tokens.ts, propriété intégration) sans le modifier.
 * Unité : mètre.
 */
import { dims } from '../styles/tokens'

/** Grand hall ≈ 22 × 18 m centré sur l'origine. */
export const HALL_HALF_WIDTH = 11
export const HALL_HALF_DEPTH = 9

/** Largeur des trois portes vers les ailes. */
export const DOOR_WIDTH = 3.6

/**
 * Largeur (perpendiculaire à son axe) d'une aile d'exposition. Doit laisser un couloir marchable
 * ≥ `MIN_WALKABLE_CORRIDOR` entre deux cimaises tout en gardant un recul confortable jusqu'au mur
 * côté caméra (voir `XWING_LANE_STEP` ci-dessous) : 14 m loge 3 cimaises espacées de 5 m avec ~2 m
 * de recul jusqu'au mur sud coupé.
 */
export const WING_WIDTH = 14

/** Hauteur des murs côté caméra (« coupés », effet maquette). */
export const CAMERA_CUT_HEIGHT = 1.0

/** Espacement minimal exigé entre deux centres de cadres sur un même mur. */
export const MIN_FRAME_SPACING = 2.0
/** Distance du point de vue devant un cadre. */
export const VIEW_DISTANCE = 1.8
/** Décalage d'un cadre par rapport à la surface du mur. */
export const FRAME_WALL_OFFSET = 0.06

/**
 * Épaisseur des cimaises intérieures (cloisons fines porteuses de cadres, à l'intérieur d'une aile).
 * La caméra du jeu est fixe et ne regarde jamais que vers -Z (voir `src/player/Player.tsx`,
 * `FIXED_CAMERA_QUATERNION`) : seul un cadre dont la face avant pointe vers +Z (rotationY = 0) est
 * jamais visible, quelle que soit la position du joueur. Une cloison perpendiculaire au mur principal
 * (« épi », face ±X) n'est donc structurellement jamais lisible : on ne construit plus que des
 * cloisons parallèles au mur principal, chacune porteuse d'une rangée de cadres face à +Z.
 *
 * Ces cimaises se placent nécessairement entre la caméra (toujours au sud du joueur) et le joueur dès
 * qu'il s'avance vers une rangée plus au nord : chacune est donc un obstacle « estompable », rendue en
 * mesh séparé (voir `Occluder` dans `layout.ts`, `occlusion.ts`, `Museum.tsx`) plutôt que fusionnée
 * dans la géométrie statique de la salle.
 */
export const CIMAISE_THICKNESS = 0.3

/** Hauteur des cimaises (cloisons porteuses de cadres) : même hauteur que les murs pleins de la salle. */
export const CIMAISE_HEIGHT = dims.wallHeight

/**
 * Couloir marchable minimal exigé entre deux rangées de cimaises (mission occultation, V2) : assez
 * large pour que le joueur ne se sente jamais coincé entre deux cloisons, même lorsque l'une d'elles
 * est estompée. Vérifié par `layout.test.ts` sur l'écart entre deux `Occluder` consécutifs d'une aile.
 */
export const MIN_WALKABLE_CORRIDOR = 4.5

/**
 * Aile est/ouest (`buildXWing`) : distance entre deux cimaises intérieures successives (repère Z).
 * `STEP - CIMAISE_THICKNESS` doit rester ≥ `MIN_WALKABLE_CORRIDOR` (voir `layout.test.ts`).
 */
export const XWING_LANE_STEP = 5.0
/** Aile est/ouest (`buildXWing`) : nombre de cimaises porteuses de cadres (mur principal inclus). */
export const XWING_LANE_COUNT = 3
/**
 * Aile est/ouest : distance (repère X, depuis le mur du hall) à partir de laquelle les cimaises
 * intérieures démarrent. Strictement supérieure à l'emprise du socle à tampon (posé à 1,2 m du mur,
 * voir `buildXWing`) : sinon le joueur, funnelé par la porte, n'a plus assez de large pour contourner
 * le socle ET franchir la première cimaise pour rejoindre le couloir du mur principal.
 */
export const XWING_LANE_ENTRY = 3.0

/** Aile nord (`buildNorthWing`) : décalages X des cadres d'une même rangée (cimaise transversale). */
export const NORTH_ROW_X = [-3, -1, 1, 3] as const
/** Aile nord : demi-largeur de la cimaise transversale d'une rangée (laisse un passage de chaque côté). */
export const NORTH_ROW_HALF_SPAN = 3.75
/**
 * Aile nord : pas entre deux rangées en profondeur (Z). Plus grand que `ROW_STEP` : chaque rangée a
 * sa propre cimaise transversale (contrairement à `buildXWing`, où les cimaises courent tout le long
 * du couloir) — il faut assez de recul entre la cimaise d'une rangée et le point de vue de la
 * suivante pour que les deux ne se chevauchent jamais, et `STEP - CIMAISE_THICKNESS` doit rester
 * ≥ `MIN_WALKABLE_CORRIDOR` (chaque rangée nord est elle-même une cimaise estompable, voir `layout.ts`).
 */
export const NORTH_ROW_DEPTH = 5.0

/** Pas entre deux rangées successives dans une aile (mur principal / épi / cimaise). */
export const ROW_STEP = 2.4
/** Marge avant la première rangée (protège la porte) et après la dernière (protège le fond). */
export const NEAR_MARGIN = 2.4
export const END_MARGIN = 2.4

/** Décalage sud du comptoir d'accueil par rapport à sa position. */
export const CURATOR_COUNTER_OFFSET_Z = 1.3
export const COUNTER_HALF_WIDTH = 1.5
export const COUNTER_HALF_DEPTH = 0.5

export const STAMP_STATION_SIZE = 0.9

/** Rayon en-deçà duquel la photo d'un portrait commence à charger. */
export const PORTRAIT_LOAD_DISTANCE = 14
/** Nombre de vérifications de proximité par seconde (chargement paresseux des photos). */
export const PORTRAIT_CHECK_RATE_HZ = 3

/** Hauteur par défaut du socle des meubles fusionnés dans la géométrie d'une salle (piliers, bancs…). */
export const FURNITURE_HEIGHT = 0.85

/** Colonnes rondes du hall (base + fût + chapiteau) : hautes, presque jusqu'au plafond (`dims.wallHeight`). */
export const COLUMN_HEIGHT = 4.0
export const COLUMN_RADIUS = 0.42

/** Bancs en bois (hall et ailes) : hauteur d'assise réaliste, jamais un pavé plein. */
export const BENCH_HEIGHT = 0.5

/** Jardinières rondes (pot + plantes) : assez hautes pour compter comme un obstacle « ≥ 1,2 m ». */
export const JARDINIERE_HEIGHT = 1.3
export const JARDINIERE_RADIUS = 0.42

/**
 * Arbre des 100 (hall) : tronc + feuillage, banc circulaire autour (voir `HallDecor.tree`).
 * Assez bas (sommet ≈ 3,3 m) pour ne jamais masquer Rémi Godeau depuis le point d'apparition,
 * même avec la caméra la plus proche (paysage, 9 m) : la ligne de visée y passe à ≈ 4 m.
 */
export const TREE_TRUNK_HEIGHT = 1.5
export const TREE_TOTAL_HEIGHT = 2.7
export const TREE_BENCH_HEIGHT = 0.48

/**
 * Fondu d'un obstacle occultant (cimaise) quand il se place entre la caméra et le joueur : opacité
 * cible et durée approximative de la transition (voir `occlusion.ts`, `Museum.tsx`).
 */
export const CIMAISE_FADE_OPACITY = 0.18
export const CIMAISE_FADE_SECONDS = 0.15

/**
 * Embellissement de l'architecture (WEL-874, item 4 de la mission) : lambris bas + corniche haute sur
 * les murs pleins (jamais les murs « coupés » côté caméra, voir `buildRoomGeometry`), légère
 * protubérance pour rester lisibles malgré `flatShading`, sans jamais recouper la bande du linteau des
 * portes (`ARCH_BOTTOM_Y`, `roomGeometry.ts`) ni dépasser `dims.wallHeight`.
 */
export const WAINSCOT_HEIGHT = 0.95
export const CORNICE_HEIGHT = 0.16
/** Espace entre le haut de la corniche et le plafond (`dims.wallHeight`). */
export const CORNICE_TOP_GAP = 0.1
export const TRIM_PROTRUSION = 0.05
/** Listel blanc posé sur le haut du lambris (charte 3D, `docs/CHARTE-3D.md` §4.2). */
export const LISTEL_HEIGHT = 0.04
/** Bande d'accent posée sur le dessus des murs coupés côté caméra (charte 3D, §4.2). */
export const CAP_HEIGHT = 0.06

/**
 * Demi-cercle décoratif au-dessus du linteau d'une porte ouverte (« arche arrondie »). Rayon assez petit
 * pour que le sommet (`ARCH_BOTTOM_Y + DOOR_ARCH_RADIUS`, voir `roomGeometry.ts`) reste sous
 * `dims.wallHeight` (4,2 m) avec de la marge.
 */
export const DOOR_ARCH_RADIUS = 0.4
export const DOOR_ARCH_TUBE = 0.07

/** Longueur d'une lame du parquet à chevrons du hall (« point de Hongrie », voir `roomGeometry.ts`). */
export const HERRINGBONE_LEN = 0.55

/**
 * Adoucit le contraste du damier/carrelage des ailes vers un ton moyen (0 = inchangé, 1 = ton unique).
 * Charte 3D : les deux tons A/B sont déjà rapprochés dans `charter3d.rooms` (sol `#113198`, second ton
 * teinté de la couleur de l'aile) ; un lissage supplémentaire effacerait le motif.
 */
export const SOFTEN_CHECKER = 0

export { dims }
