// STUB — propriétaire : agent avatar+tampons.
import { useGame } from '../../state/gameStore'

/** Écran « Choisis ton personnage » avant d'entrer dans le musée. */
export function AvatarCustomizer() {
  const setScreen = useGame((s) => s.setScreen)
  return (
    <div className="screen" data-testid="customizer">
      <button type="button" data-testid="customizer-done" onClick={() => setScreen('play')}>OK</button>
    </div>
  )
}
