/**
 * Signature Polaria en jeu : badge (logo seul, en bas à gauche) et carte de crédits. Une seule ligne dans
 * `App.tsx`, dans le groupe « en jeu ». Le badge disparaît quand une surimpression plein écran est ouverte
 * (fiche, dialogue, carnet, plan : `isOverlayOpen`) — la bulle de dialogue, pleine largeur en bas, le
 * recouvrirait de toute façon.
 */
import { isOverlayOpen, useGame } from '../../state/gameStore'
import { SignatureBadge } from './SignatureBadge'
import { SignatureCard } from './SignatureCard'

export function Signature() {
  const overlay = useGame(isOverlayOpen)
  return (
    <>
      {!overlay && <SignatureBadge />}
      <SignatureCard />
    </>
  )
}
