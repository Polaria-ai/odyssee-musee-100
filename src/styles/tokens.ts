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
  // Ciel / fond de la scène : bleu nuit de la charte de l'Odyssée (skill de Cyril).
  sky: '#071336',
  gold: '#e8c872',
  white: '#ffffff',
  shadow: '#3b2a1e',
} as const

/**
 * Palette de l'événement « 2026 : l'Odyssée de l'IA » (skill conference-dataviz-odyssee-ia-2026).
 * Dans le musée 3D, elle sert aux ACCENTS (ailes, bannières, panneaux, lueurs) ; les matières
 * (bois, crème, terre cuite) restent chaudes pour garder l'esprit cosy.
 */
export const eventPalette = {
  corail: '#e8785c',
  corailDeep: '#b04a33',
  bleu: '#1d49c1',
  bleuDeep: '#113198',
  bleuNuit: '#071336',
  bleuNeon: '#4d8cff',
  cyan: '#57bfd6',
  cyanVif: '#6de4e5',
  alarm: '#d6248c',
  blanc: '#ffffff',
} as const

export interface WingTheme {
  floor: string
  wall: string
  accent: string
  trim: string
}

/** Chaque aile a sa propre ambiance, comme les salles d'un musée de jeu. */
export const wingThemes: Record<WingId, WingTheme> = {
  // Grand hall : parquet chaud, murs crème, accent corail de la charte.
  hall: { floor: '#d9b48a', wall: '#f6ead2', accent: '#e8785c', trim: '#8c6a4a' },
  // Infrastructures : salle des machines, pierre bleutée et cyan vif de la charte.
  infrastructures: { floor: '#9fb8b4', wall: '#e3efec', accent: '#6de4e5', trim: '#2f6f78' },
  // Industrialisation : atelier sous verrière, briques et corail de la charte.
  industrialisation: { floor: '#d8a57c', wall: '#fbe7d3', accent: '#e8785c', trim: '#b04a33' },
  // Culture : galerie d'art, bleu néon de la charte sur murs clairs.
  culture: { floor: '#aab4d4', wall: '#eaeef9', accent: '#4d8cff', trim: '#33479a' },
  // Archives de 2040 : bleu nuit doux et lueurs holographiques, restées chaleureuses.
  archives: { floor: '#5d6b8f', wall: '#e6ecfa', accent: '#57bfd6', trim: '#113198' },
}

/**
 * Zones du hall réservées à d'autres modules : le décor du monde ne doit rien y poser.
 * `timePortal` : la Porte de 2040 (module archives), à droite du point d'apparition.
 */
export const hallReservedSpots = {
  timePortal: { x: 7.8, z: 5.6, radius: 1.4 },
} as const

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
