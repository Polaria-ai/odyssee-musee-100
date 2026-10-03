/**
 * État « chaud » mis à jour à chaque image (60 fois par seconde).
 * Volontairement hors de React/zustand : aucune re-render. Lire/écrire directement.
 */
import type { Vec2 } from '../types'

/** Entrée de déplacement normalisée, écrite par le joystick tactile et le clavier. */
export const input = {
  /** -1 (gauche) … 1 (droite), repère écran. */
  moveX: 0,
  /** -1 (haut de l'écran = s'éloigner de la caméra) … 1 (bas). */
  moveY: 0,
  /** Course (clavier Shift ou joystick poussé à fond). */
  run: false,
  /** Point cible posé par un tap au sol (déplacement automatique), ou null. */
  tapTarget: null as Vec2 | null,
}

/** Transformation courante du joueur, écrite par `Player`, lue par la caméra et la présence. */
export const player = {
  x: 0,
  z: 0,
  rotY: 0,
  moving: false,
  /** Vitesse courante (m/s), pour l'animation. */
  speed: 0,
}

/**
 * État de l'Archiviste 3D, écrit par `archives/Archivist.tsx` (quelques nombres, aucun objet) et lu par la sonde
 * de test `window.__musee.archivist()` (`scene/debugApi.ts`). `loaded` : le GLB est arrivé et le personnage monté ;
 * `triangles` : ceux de son maillage ; `clip` : le clip demandé ; `yaw` : sa rotation vers le joueur (radians,
 * relative à son orientation de repos).
 */
export const archivistProbe = {
  loaded: false,
  triangles: 0,
  clip: 'idle' as 'idle' | 'wave' | 'talk',
  yaw: 0,
}

/** Remet l'entrée à zéro (changement d'écran, ouverture d'une fiche). */
export function resetInput(): void {
  input.moveX = 0
  input.moveY = 0
  input.run = false
  input.tapTarget = null
}

/** Téléporte le joueur (spawn, tests E2E). */
export function placePlayer(x: number, z: number, rotY = 0): void {
  player.x = x
  player.z = z
  player.rotY = rotY
  player.moving = false
  player.speed = 0
}

/**
 * Ponts entre le DOM et le Canvas, enregistrés par les composants 3D.
 * `screenToFloor` : convertit un tap écran (clientX/Y) en point au sol, ou null (enregistré par `Player`).
 */
export const bridges = {
  screenToFloor: null as null | ((clientX: number, clientY: number) => Vec2 | null),
}
