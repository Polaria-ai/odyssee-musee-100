/**
 * Planification par anticipation (« look-ahead ») : fonction pure, sans horloge ni `AudioContext`.
 * Étant donné un motif qui boucle toutes les `loopDuration` secondes, renvoie les notes qui tombent
 * dans la fenêtre de temps absolue [from, to), avec leur `time` recalculé pour chaque répétition.
 *
 * Le vrai planificateur (`music.ts`) l'appelle toutes les ~25 ms avec une petite fenêtre à venir,
 * plutôt que de poser un `setTimeout` par note : robuste aux à-coups de l'onglet (verrouillage
 * d'écran, tâche lourde) sans notes qui s'accumulent ni dérive audible.
 */
export interface LoopPattern<N extends { time: number }> {
  /** Durée d'une boucle, en secondes. */
  loopDuration: number
  /** Notes relatives au début d'une boucle (n'importe quel ordre), `time` en secondes. */
  notes: readonly N[]
}

export function notesInWindow<N extends { time: number }>(pattern: LoopPattern<N>, from: number, to: number): N[] {
  if (!(to > from) || pattern.loopDuration <= 0) return []
  const out: N[] = []
  const firstLoop = Math.floor(from / pattern.loopDuration)
  const lastLoop = Math.floor((to - Number.EPSILON) / pattern.loopDuration)
  for (let loop = firstLoop; loop <= lastLoop; loop++) {
    const base = loop * pattern.loopDuration
    for (const note of pattern.notes) {
      const time = base + note.time
      if (time >= from && time < to) out.push({ ...note, time })
    }
  }
  return out
}
