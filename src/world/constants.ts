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

/** Profondeur et épaisseur des épis (cloisons courtes nord-sud) des ailes est/ouest. */
export const EPI_DEPTH = 1.7
export const EPI_THICKNESS = 0.3
/** Épaisseur de la cimaise centrale double-face de l'aile nord. */
export const CIMAISE_THICKNESS = 0.3

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
