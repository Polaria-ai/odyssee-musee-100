/**
 * Types internes du module audio. Ré-exportés (types) par `index.ts`, qui reste le contrat
 * public : ne pas renommer `SfxId` / `SfxOptions` sans mettre à jour `index.ts`.
 */

/** Identifiants des effets sonores synthétisés (aucun fichier audio, tout est généré). */
export type SfxId = 'blip' | 'stamp' | 'complete' | 'open' | 'close' | 'click' | 'step' | 'room'

export interface SfxOptions {
  /** Hauteur relative (1 = normale), ex. pour varier les bips par personnage. */
  pitch?: number
  /** Volume relatif 0..1. */
  volume?: number
}
