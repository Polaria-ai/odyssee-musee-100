/**
 * Mesures pures de la salle des Archives de 2040 : une frise chronologique en rangées, le joueur
 * remonte le temps du sud (entrée) vers le nord (l'Archiviste). Propriétaire : workflow « Archives de
 * 2040 » (module salle 3D, WEL-881). Aucune dépendance three.js.
 *
 * Chaque vitrine fait face à +Z (jamais ±X) : la caméra du jeu est fixe et ne regarde JAMAIS que vers
 * −Z (voir docs/DESIGN.md, `src/styles/tokens.ts::cameraRig`) — un écran qui ferait face à ±X serait vu
 * par la tranche depuis n'importe quel point de vue, donc illisible (régression constatée à la
 * vérification visuelle d'une première version « galerie en U » avec vitrines murales ; voir aussi
 * `src/world/layout.ts::buildXWing`, qui documente la même contrainte pour les cadres du musée). Les
 * vitrines sont donc des socles LIBRES disposés en rangées (comme `src/world/layout.ts::buildNorthWing`),
 * pas accrochées aux murs.
 */

/** Emprise intérieure (sol marchable) : ≈ 24 × 20 m, centrée sur `ARCHIVES_ORIGIN`. */
export const ROOM_HALF_WIDTH = 12
export const ROOM_HALF_DEPTH = 10

export const WALL_THICKNESS = 0.4
export const WALL_HEIGHT = 4.4
/** Hauteur du mur sud (côté caméra), coupé bas comme le hall : jamais rien de haut entre la caméra et le joueur. */
export const SOUTH_WALL_CUT_HEIGHT = 1.1

/** Décalages en X (depuis `ARCHIVES_ORIGIN.x`) des vitrines d'une même rangée, du nord au sud repris à chaque rangée. */
export const ROW_X_OFFSETS = [-10, -5, 0, 5, 10] as const
/** Pas entre deux rangées consécutives (mesuré entre leurs centres, le long de Z). */
export const ROW_DEPTH = 3.0
/** Distance entre une vitrine et le point de vue où le joueur doit se tenir pour la consulter (au sud, puisqu'elle fait face à +Z). */
export const VITRINE_VIEW_DISTANCE = 1.7
/** Dégagement gardé libre côté entrée (Porte de retour, arrivée) : aucune vitrine dedans. */
export const ENTRANCE_CLEARANCE = 2.8
/** Dégagement gardé libre côté nord (alcôve de l'Archiviste) : aucune rangée dedans. */
export const NORTH_CLEARANCE = 4.0

export const SOCLE_RADIUS = 0.46
export const SOCLE_HEIGHT = 0.85
export const CAPSULE_RADIUS = 0.56
export const CAPSULE_HEIGHT = 1.35
export const SCREEN_WIDTH = 0.86
export const SCREEN_HEIGHT = 0.58
export const SCREEN_Y = SOCLE_HEIGHT + 0.78

/** Rayon du collider (au sol) d'une vitrine : encombrement du socle, pour les tests de non-chevauchement. */
export const VITRINE_FOOTPRINT_RADIUS = 0.55

/** Anneau lumineux de la Porte de 2040 : ≈ 2,6 m de diamètre. */
export const PORTAL_RING_DIAMETER = 2.6
export const PORTAL_RING_RADIUS = PORTAL_RING_DIAMETER / 2
/** Rayon de déclenchement du passage (le joueur doit entrer dans l'anneau). */
export const PORTAL_TRIGGER_RADIUS = 0.8
/** Verrou anti-rebond après un passage : on ne redéclenche pas avant ce délai (s). */
export const PORTAL_TRIGGER_LOCK_SECONDS = 1.5

/** Fréquence de la détection de proximité (vitrine, Archiviste) : ~120 ms, pas chaque image. */
export const PROXIMITY_CHECK_INTERVAL = 0.12
