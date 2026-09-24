// STUB — propriétaire : agent interface.
import { useGame } from '../state/gameStore'

/** Écran titre : « L'Odyssée de l'IA — Le Musée des 100 ». */
export function TitleScreen() {
  const setScreen = useGame((s) => s.setScreen)
  return (
    <div className="screen" data-testid="title-screen">
      <h1>Le Musée des 100</h1>
      <button type="button" data-testid="enter-button" onClick={() => setScreen('customize')}>Entrer</button>
    </div>
  )
}
