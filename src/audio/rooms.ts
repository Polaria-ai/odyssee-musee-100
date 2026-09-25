/**
 * Couleur musicale de chaque salle (voir `docs/DESIGN.md`) : hall chaleureux, infrastructures
 * aériennes, industrialisation façon marimba, culture façon boîte à musique. Tout est ensuite
 * synthétisé par `music.ts` — aucun fichier audio ici, juste des motifs (`melody`/`bassDegrees`)
 * et des réglages de timbre.
 */
import type { WingId } from '../types'
import { PENTATONIC_MAJOR_STEPS, PENTATONIC_MINOR_STEPS } from './scale'

/** Une note de la mélodie, exprimée en temps (1 temps = 1 noire) à l'intérieur de la boucle. */
export interface MelodyStep {
  beat: number
  /** Degré de gamme pentatonique (voir `scale.ts`) : peut sortir de [0, taille de la gamme[. */
  degree: number
  /** Durée en temps (indicative : l'enveloppe peut se prolonger un peu au-delà). */
  beats: number
}

export interface RoomTheme {
  id: WingId
  /** Fréquence (Hz) de la tonique de la mélodie ; la basse joue une octave en dessous. */
  rootHz: number
  scale: readonly number[]
  bpm: number
  /** Nombre de mesures à 4 temps dans une boucle (avant de reboucler). */
  barsPerLoop: number
  leadType: OscillatorType
  bassType: OscillatorType
  /** Fréquence de coupure (Hz) du filtre passe-bas de la mélodie ; la basse est plus filtrée encore. */
  filterHz: number
  /** Attaque/chute (secondes) de l'enveloppe de la mélodie — le timbre de la salle. */
  noteAttack: number
  noteRelease: number
  /** Ajoute une harmonique à l'octave (couleur « boîte à musique »). */
  bell: boolean
  melody: readonly MelodyStep[]
  /** Un degré par temps fort (toutes les 2 temps) sur la durée de la boucle. */
  bassDegrees: readonly number[]
}

export const roomThemes: Record<WingId, RoomTheme> = {
  // Grand hall : parquet chaud, dorures — mélodie simple et rassurante en majeur.
  hall: {
    id: 'hall',
    rootHz: 196, // sol3
    scale: PENTATONIC_MAJOR_STEPS,
    bpm: 88,
    barsPerLoop: 2,
    leadType: 'sine',
    bassType: 'triangle',
    filterHz: 1500,
    noteAttack: 0.025,
    noteRelease: 0.65,
    bell: false,
    melody: [
      { beat: 0, degree: 0, beats: 1 },
      { beat: 1, degree: 2, beats: 1 },
      { beat: 2, degree: 4, beats: 1 },
      { beat: 3.5, degree: 7, beats: 0.5 },
      { beat: 4, degree: 4, beats: 1 },
      { beat: 5, degree: 2, beats: 1 },
      { beat: 6, degree: 0, beats: 2 },
    ],
    bassDegrees: [0, -3, 0, -1],
  },
  // Salle des machines : pierre bleutée, sarcelle — nappes aériennes, notes longues, gamme mineure.
  infrastructures: {
    id: 'infrastructures',
    rootHz: 174.6, // fa3
    scale: PENTATONIC_MINOR_STEPS,
    bpm: 84,
    barsPerLoop: 2,
    leadType: 'triangle',
    bassType: 'sine',
    filterHz: 850,
    noteAttack: 0.55,
    noteRelease: 1.8,
    bell: false,
    melody: [
      { beat: 0, degree: 0, beats: 2 },
      { beat: 2, degree: 2, beats: 2 },
      { beat: 4, degree: 4, beats: 2 },
      { beat: 6, degree: 2, beats: 2 },
    ],
    bassDegrees: [0, 0, -3, 0],
  },
  // Atelier sous verrière, briques et orange — motif plus rythmique, façon marimba (notes courtes).
  industrialisation: {
    id: 'industrialisation',
    rootHz: 220, // la3
    scale: PENTATONIC_MAJOR_STEPS,
    bpm: 92,
    barsPerLoop: 2,
    leadType: 'triangle',
    bassType: 'triangle',
    filterHz: 2500,
    noteAttack: 0.004,
    noteRelease: 0.22,
    bell: false,
    melody: [
      { beat: 0, degree: 4, beats: 0.5 },
      { beat: 0.5, degree: 2, beats: 0.5 },
      { beat: 1, degree: 0, beats: 0.5 },
      { beat: 1.5, degree: 2, beats: 0.5 },
      { beat: 2, degree: 4, beats: 0.5 },
      { beat: 2.5, degree: 7, beats: 0.5 },
      { beat: 3, degree: 9, beats: 0.5 },
      { beat: 3.5, degree: 7, beats: 0.5 },
      { beat: 4, degree: 4, beats: 0.5 },
      { beat: 4.5, degree: 2, beats: 0.5 },
      { beat: 5, degree: 0, beats: 1 },
      { beat: 6, degree: 2, beats: 0.5 },
      { beat: 6.5, degree: 4, beats: 0.5 },
      { beat: 7, degree: 0, beats: 1 },
    ],
    bassDegrees: [0, -3, -1, -3],
  },
  // Galerie d'art, velours violet — boîte à musique : cristallin, harmonique à l'octave.
  culture: {
    id: 'culture',
    rootHz: 261.6, // do4
    scale: PENTATONIC_MAJOR_STEPS,
    bpm: 90,
    barsPerLoop: 2,
    leadType: 'sine',
    bassType: 'sine',
    filterHz: 1900,
    noteAttack: 0.008,
    noteRelease: 1.1,
    bell: true,
    melody: [
      { beat: 0, degree: 9, beats: 1 },
      { beat: 1, degree: 7, beats: 1 },
      { beat: 2, degree: 4, beats: 1 },
      { beat: 3, degree: 2, beats: 1 },
      { beat: 4, degree: 0, beats: 1 },
      { beat: 5, degree: 4, beats: 1 },
      { beat: 6, degree: 7, beats: 2 },
    ],
    bassDegrees: [0, -3, 0, 4],
  },
  // Archives de 2040 : même boîte à musique, plus lente et plus feutrée (le module archives peut l'affiner).
  archives: {
    id: 'archives',
    rootHz: 261.6, // do4
    scale: PENTATONIC_MAJOR_STEPS,
    bpm: 76,
    barsPerLoop: 2,
    leadType: 'sine',
    bassType: 'sine',
    filterHz: 1500,
    noteAttack: 0.008,
    noteRelease: 1.1,
    bell: true,
    melody: [
      { beat: 0, degree: 9, beats: 1 },
      { beat: 1, degree: 7, beats: 1 },
      { beat: 2, degree: 4, beats: 1 },
      { beat: 3, degree: 2, beats: 1 },
      { beat: 4, degree: 0, beats: 1 },
      { beat: 5, degree: 4, beats: 1 },
      { beat: 6, degree: 7, beats: 2 },
    ],
    bassDegrees: [0, -3, 0, 4],
  },
}
