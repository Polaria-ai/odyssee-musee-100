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

/** Emprise intérieure (sol marchable) : ≈ 20 × 20 m, centrée sur `ARCHIVES_ORIGIN`. Resserrée par
 * rapport à la première version (24 × 20 m, colonnes tous les 5 m) : à la vérification visuelle, la
 * salle laissait un grand aplat de sol vide sur les côtés sans se sentir plus spacieuse pour autant —
 * voir aussi `ROW_X_OFFSETS`. */
export const ROOM_HALF_WIDTH = 10
export const ROOM_HALF_DEPTH = 10

export const WALL_THICKNESS = 0.4
/** Hauteur des piliers d'angle décoratifs (`CornerPillars`) uniquement — PAS celle des murs (voir
 * `SIDE_WALL_HEIGHT` / `NORTH_WALL_HEIGHT`, nettement plus hauts). Des piliers d'accent modestes
 * devant un mur-fond plus haut, comme un lampadaire devant un immeuble : volontairement pas mis à
 * l'échelle du mur, sous peine de piliers filiformes (rayon 0,24–0,28 m) sur plus de 10 m. */
export const WALL_HEIGHT = 4.4
/** Hauteur du mur sud (côté caméra), coupé bas comme le hall : jamais rien de haut entre la caméra et le joueur. */
export const SOUTH_WALL_CUT_HEIGHT = 1.1
/**
 * Hauteur des murs latéraux (est/ouest) réellement rendus (`RoomShell::Walls`, mesh `sideGeo`) — PAS
 * la même chose que `WALL_HEIGHT` (piliers décoratifs uniquement, voir plus haut). Calculée pour
 * fermer le champ de vision au pire cas : une vitrine à seulement 2 m du mur (`ROW_X_OFFSETS` = ±8,
 * `ROOM_HALF_WIDTH` = 10), avec la caméra fixe — à la même position X que le joueur, donc elle aussi à
 * 2 m du mur — qui recule à `cameraRig.maxDistance` en portrait pour garder `targetVisibleWidth`
 * malgré un champ de vision étroit, et grimpe d'autant en hauteur (~13,6 m). Un rayon tiré vers le bord
 * HAUT de l'écran (le moins incliné vers le bas du frustum, ~17° sous l'horizontale) traverse encore
 * le plan du mur à ~10,8 m de haut (iPhone 13 portrait ; ~10,2 m sur Pixel 7 portrait) : un mur à
 * `WALL_HEIGHT` (4,4 m) laisse donc passer un grand triangle de ciel au-dessus, quel que soit l'appareil
 * (constaté aussi en paysage, ~6,9 m requis). Fixé à 12 m (marge ≈ 1,2 m sur le pire cas mesuré).
 */
export const SIDE_WALL_HEIGHT = 12
/**
 * Hauteur du mur nord (derrière l'Archiviste) : même calcul que `SIDE_WALL_HEIGHT` mais pour le rayon
 * qui traverse le plan du mur NORD (pas latéral), au point exact où le joueur s'arrête pour parler à
 * l'Archiviste (1,8 m au sud de `archivist.position`, donc ~3,4 m du mur nord). Un premier correctif
 * avait relevé cette hauteur à 6,6 m (voir historique), mais le calcul montre qu'il fallait ~9,0 m en
 * portrait (le cas le plus fréquent, caméra reculée à `cameraRig.maxDistance`) — d'où la bande de ciel
 * réapparue à la vérification visuelle malgré ce premier correctif. Fixé à 10,5 m (marge ≈ 1,5 m).
 */
export const NORTH_WALL_HEIGHT = 10.5
/** Plafond (`RoomShell::Ceiling`) : au moins aussi haut que le plus haut des deux murs ci-dessus, sinon
 * ce mur le dépasserait visuellement (silhouette qui perce le plafond depuis certains points de vue). */
export const CEILING_HEIGHT = Math.max(SIDE_WALL_HEIGHT, NORTH_WALL_HEIGHT)

/** Décalages en X (depuis `ARCHIVES_ORIGIN.x`) des vitrines d'une même rangée, du nord au sud repris à chaque rangée. */
export const ROW_X_OFFSETS = [-8, -4, 0, 4, 8] as const
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
