/**
 * Salut de Rémi quand le joueur arrive à portée du comptoir : `nearCurator` passe de faux à vrai,
 * un salut « wave » est joué une fois (`waving` vrai jusqu'à `onWaveDone`), au plus toutes les
 * `WAVE_COOLDOWN_MS`. Propriétaire : agent accueil-remi.
 */
import { useCallback, useEffect, useState } from 'react'
import { useGame } from '../state/gameStore'
import { createWaveGate } from './remiBehavior'

export function useWaveGreeting(): { waving: boolean; onWaveDone: () => void } {
  const [waving, setWaving] = useState(false)

  useEffect(() => {
    const canWave = createWaveGate()
    // Abonnement plutôt qu'un effet sur `nearCurator` : seul le front montant compte, et rien n'est
    // rejoué si le composant se remonte alors que le joueur est déjà au comptoir.
    return useGame.subscribe((state, previous) => {
      if (state.nearCurator && !previous.nearCurator && canWave(performance.now())) setWaving(true)
    })
  }, [])

  const onWaveDone = useCallback(() => setWaving(false), [])
  return { waving, onWaveDone }
}
