/**
 * Palette et mesures du musée. Univers doux inspiré des musées de jeux « cosy » :
 * bois clair, crème, verts feuille, couleurs pastel saturées, formes arrondies.
 * Les mêmes valeurs existent en variables CSS dans `src/styles/global.css`.
 */
import type { ExhibitWingId, WingId } from '../types'

export const palette = {
  cream: '#fff8e7',
  paper: '#fdf1d6',
  ink: '#4a3728',
  inkSoft: '#7a6250',
  wood: '#c8a27a',
  woodDark: '#8c6a4a',
  leaf: '#7bc47f',
  leafDark: '#4f9a5a',
  sky: '#9ed9f0',
  gold: '#e8c872',
  white: '#ffffff',
  shadow: '#3b2a1e',
} as const

export interface WingTheme {
  floor: string
  wall: string
  accent: string
  trim: string
}

/** Chaque aile a sa propre ambiance, comme les salles d'un musée de jeu. */
export const wingThemes: Record<WingId, WingTheme> = {
  // Grand hall : parquet chaud, murs crème, dorures.
  hall: { floor: '#d9b48a', wall: '#f6ead2', accent: '#e8c872', trim: '#8c6a4a' },
  // Infrastructures : salle des machines, pierre bleutée et sarcelle.
  infrastructures: { floor: '#9fb8b4', wall: '#e3efec', accent: '#4fb3a9', trim: '#3f7f78' },
  // Industrialisation : atelier sous verrière, briques et orange.
  industrialisation: { floor: '#d8a57c', wall: '#fbe7d3', accent: '#f2a65a', trim: '#b86a35' },
  // Culture : galerie d'art, velours violet.
  culture: { floor: '#b9a3c9', wall: '#f1e8f7', accent: '#b48cd9', trim: '#7a5a9e' },
}

export const exhibitWingOrder: readonly ExhibitWingId[] = ['infrastructures', 'industrialisation', 'culture']

/** Échelle : 1 unité = 1 mètre. */
export const dims = {
  wallHeight: 4.2,
  wallThickness: 0.4,
  frameWidth: 1.3,
  frameHeight: 1.6,
  frameCenterY: 1.9,
  playerRadius: 0.35,
  playerHeight: 1.15,
  interactRadius: 2.2,
} as const

/**
 * Caméra 3e personne à orientation fixe (regarde vers −Z), partagée par le joueur
 * (qui la pilote) et le monde (qui estompe les cloisons situées entre elle et le joueur).
 * `pitchDeg` : plongée ; la distance réelle s'adapte au format d'écran entre min et max.
 */
export const cameraRig = {
  pitchDeg: 48,
  fovDeg: 42,
  /** Largeur de sol visible visée à la profondeur du joueur, en mètres. */
  targetVisibleWidth: 11,
  minDistance: 9,
  maxDistance: 17,
  /** Hauteur du point visé au-dessus des pieds du joueur. */
  lookHeight: 1,
} as const

/** Position de caméra pour un joueur en (x, z) et une distance donnée (fonction pure). */
export function cameraPositionFor(x: number, z: number, distance: number): { x: number; y: number; z: number } {
  const pitch = (cameraRig.pitchDeg * Math.PI) / 180
  return {
    x,
    y: cameraRig.lookHeight + Math.sin(pitch) * distance,
    z: z + Math.cos(pitch) * distance,
  }
}
