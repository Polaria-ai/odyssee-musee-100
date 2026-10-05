/**
 * Gamme pentatonique et calcul de fréquences. Fonctions pures, sans dépendance à `AudioContext` :
 * testées isolément.
 */

const SEMITONE = Math.pow(2, 1 / 12)

/** Intervalles (demi-tons depuis la tonique) d'une pentatonique majeure — couleur chaleureuse. */
export const PENTATONIC_MAJOR_STEPS = [0, 2, 4, 7, 9] as const

/** Intervalles d'une pentatonique mineure — couleur plus aérienne/grave. */
export const PENTATONIC_MINOR_STEPS = [0, 3, 5, 7, 10] as const

/**
 * Fréquence (Hz) d'un degré de gamme. `degree` peut dépasser la taille de `steps` (on enroule sur
 * les octaves suivantes) et être négatif (octaves en dessous) : `degree` est un indice continu,
 * pas borné à une seule octave.
 */
export function pentatonicFrequency(
  rootHz: number,
  degree: number,
  steps: readonly number[] = PENTATONIC_MAJOR_STEPS,
): number {
  const size = steps.length
  const octave = Math.floor(degree / size)
  const index = ((degree % size) + size) % size
  const semitones = steps[index] + octave * 12
  return rootHz * Math.pow(SEMITONE, semitones)
}
