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

/** Largeur (perpendiculaire à son axe) d'une aile d'exposition. */
export const WING_WIDTH = 10
/** Longueur minimale d'une aile (y compris une aile vide « bientôt »). */
export const WING_MIN_LENGTH = 4.2

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
 */
export const CIMAISE_THICKNESS = 0.3

/** Aile est/ouest (`buildXWing`) : distance entre deux cimaises intérieures successives (repère Z). */
export const XWING_LANE_STEP = 3.2
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
 * suivante pour que les deux ne se chevauchent jamais.
 */
export const NORTH_ROW_DEPTH = 3.0

/** Pas entre deux rangées successives dans une aile (mur principal / épi / cimaise). */
export const ROW_STEP = 2.4
/** Marge avant la première rangée (protège la porte) et après la dernière (protège le fond). */
export const NEAR_MARGIN = 2.4
export const END_MARGIN = 2.4

/** Décalage sud du comptoir de Minerve par rapport à sa position. */
export const CURATOR_COUNTER_OFFSET_Z = 1.3
export const COUNTER_HALF_WIDTH = 1.5
export const COUNTER_HALF_DEPTH = 0.5

export const STAMP_STATION_SIZE = 0.9

/** Rayon en-deçà duquel la photo d'un portrait commence à charger. */
export const PORTRAIT_LOAD_DISTANCE = 14
/** Nombre de vérifications de proximité par seconde (chargement paresseux des photos). */
export const PORTRAIT_CHECK_RATE_HZ = 3

export { dims }
