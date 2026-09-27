/**
 * Mesures pures de la salle des Archives de 2040 : une frise chronologique en rangées, le joueur
 * entre par la porte nord (depuis le hall) et descend le temps vers le sud. Propriétaire : workflow « Archives de
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

/**
 * Emprise de la salle (plan en croix, décision de Baptiste du 27/09) : accrochée au SUD du hall,
 * derrière le point d'arrivée, et rejointe à pied par la porte `tokens.archivesDoor` percée dans le
 * mur sud du hall (qui sert aussi de mur nord à la salle). ≈ 20 m de large × 21 m de profondeur.
 */
export const ROOM_HALF_WIDTH = 10
export const ROOM_DEPTH = 21

export const WALL_THICKNESS = 0.4
/**
 * Hauteur des murs est/ouest et des piliers d'angle : celle d'une aile du musée. La salle fait
 * désormais partie du plan : on voit le hall par-dessus son mur nord coupé bas, comme on voit le
 * musée depuis les ailes. L'ancienne salle isolée (loin du musée, rejointe par un portail) montait
 * ses murs à 12 m sous un plafond pour cacher le ciel ; accrochés au hall, ces murs et ce plafond se
 * retrouveraient entre la caméra (toujours au sud du joueur) et le joueur resté dans le hall.
 */
export const WALL_HEIGHT = 4.4
/** Hauteur du mur sud (côté caméra), coupé bas comme le hall : jamais rien de haut entre la caméra et le joueur. */
export const SOUTH_WALL_CUT_HEIGHT = 1.1

/** Décalages en X (depuis l'axe de la porte, `tokens.archivesDoor.x`) des vitrines d'une même rangée. */
export const ROW_X_OFFSETS = [-8, -4, 0, 4, 8] as const
/** Pas entre deux rangées consécutives (mesuré entre leurs centres, le long de Z). */
export const ROW_DEPTH = 3.0
/** Distance entre une vitrine et le point de vue où le joueur doit se tenir pour la consulter (au sud, puisqu'elle fait face à +Z). */
export const VITRINE_VIEW_DISTANCE = 1.7
/**
 * Dégagement gardé libre côté porte (nord) : arrivée, Archiviste, pupitre d'entrée. Aucune vitrine
 * dedans. La première rangée (18 h 30) commence juste après, la frise descend ensuite vers le sud.
 */
export const DOOR_CLEARANCE = 5.5
/** Dégagement gardé libre contre le mur sud (point de vue de la dernière rangée compris). */
export const SOUTH_CLEARANCE = 2.8

export const SOCLE_RADIUS = 0.46
export const SOCLE_HEIGHT = 0.85
export const CAPSULE_RADIUS = 0.56
export const CAPSULE_HEIGHT = 1.35
export const SCREEN_WIDTH = 0.86
export const SCREEN_HEIGHT = 0.58
export const SCREEN_Y = SOCLE_HEIGHT + 0.78

/** Rayon du collider (au sol) d'une vitrine : encombrement du socle, pour les tests de non-chevauchement. */
export const VITRINE_FOOTPRINT_RADIUS = 0.55

/** Portée de conversation avec l'Archiviste (contrat de `Archivist.tsx` et du plan : jamais atteinte depuis le hall). */
export const ARCHIVIST_TALK_RADIUS = 2.6

/** Fréquence de la détection de proximité (vitrine, Archiviste) : ~120 ms, pas chaque image. */
export const PROXIMITY_CHECK_INTERVAL = 0.12
