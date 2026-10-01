/**
 * État de la carte de crédits Polaria. Store à part : `src/state/gameStore.ts` appartient à l'intégration
 * et la carte n'a pas besoin d'y entrer (elle ne coupe pas le déplacement par `isOverlayOpen` : son fond
 * plein écran capte déjà les gestes, et `SignatureCard` remet l'entrée à zéro et filtre le clavier).
 */
import { create } from 'zustand'

export interface OpenCardOptions {
  /**
   * Durée (ms) pendant laquelle la carte ignore les clics de fermeture à la souris ou au doigt. La plaque
   * du hall s'ouvre sur un `pointerup` ; le `click` qui le suit peut, selon le navigateur (Safari iOS en tête),
   * viser l'élément qui vient d'apparaître sous le doigt, c'est-à-dire le fond de la carte, et la refermer
   * aussitôt. Le badge s'ouvre sur le `click` lui-même : pas de clic fantôme, pas de garde.
   */
  guardMs?: number
}

export interface SignatureState {
  /** Carte de crédits ouverte (badge du HUD ou plaque du hall). */
  cardOpen: boolean
  /** Horodatage (`performance.now()`) avant lequel les clics de fermeture sont ignorés. */
  ignoreClicksUntil: number
  openCard: (options?: OpenCardOptions) => void
  closeCard: () => void
}

export const useSignature = create<SignatureState>()((set) => ({
  cardOpen: false,
  ignoreClicksUntil: 0,
  openCard: (options) => set({ cardOpen: true, ignoreClicksUntil: options?.guardMs ? performance.now() + options.guardMs : 0 }),
  closeCard: () => set({ cardOpen: false, ignoreClicksUntil: 0 }),
}))

/** Vrai tant que la carte doit ignorer un clic de fermeture (clic fantôme qui suit l'ouverture par la plaque). */
export function isCloseClickGuarded(state: Pick<SignatureState, 'ignoreClicksUntil'>): boolean {
  return performance.now() < state.ignoreClicksUntil
}
