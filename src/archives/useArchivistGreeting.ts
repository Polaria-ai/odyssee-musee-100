/**
 * Salut de l'Archiviste quand le joueur arrive à sa portée : `nearArchivist` passe de faux à vrai,
 * un salut « wave » est joué une fois (`waving` vrai jusqu'à `onWaveDone`), au plus toutes les
 * `WAVE_COOLDOWN_MS`. Même mécanique que `useWaveGreeting` (Rémi, `nearCurator`), la règle du délai
 * étant la même (`createWaveGate`). Propriétaire : workflow « Archives de 2040 ».
 */
import { useCallback, useEffect, useState } from 'react'
import { useGame } from '../state/gameStore'
import { createWaveGate } from '../npc/remiBehavior'

export function useArchivistGreeting(): { waving: boolean; onWaveDone: () => void } {
  const [waving, setWaving] = useState(false)

  useEffect(() => {
    const canWave = createWaveGate()
    // Abonnement plutôt qu'un effet sur `nearArchivist` : seul le front montant compte, et rien n'est
    // rejoué si le composant se remonte alors que le joueur est déjà à portée de l'Archiviste.
    return useGame.subscribe((state, previous) => {
      if (state.nearArchivist && !previous.nearArchivist && canWave(performance.now())) setWaving(true)
    })
  }, [])

  const onWaveDone = useCallback(() => setWaving(false), [])
  return { waving, onWaveDone }
}
