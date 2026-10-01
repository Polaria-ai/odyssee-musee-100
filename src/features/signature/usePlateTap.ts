/**
 * Ouvre la carte de crédits quand le joueur tape la plaque Polaria du hall (voir `plateTap.ts` pour le
 * pourquoi d'une détection par projection plutôt que par `onClick` de react-three-fiber).
 *
 * Écoute `window` en phase de BULLE : le joystick (au-dessus du canvas) a déjà traité son `pointerup` et posé
 * une cible de marche au sol ; on la retire (`resetInput`) avant d'ouvrir la carte, pour que le tap sur la
 * plaque ne fasse pas aussi marcher le joueur. Un tap qui tombe sur un bouton du HUD (cible ≠ joystick /
 * canvas) n'est jamais pris pour un tap sur la plaque, même s'il la recouvre à l'écran.
 */
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { isOverlayOpen, useGame } from '../../state/gameStore'
import { resetInput } from '../../state/runtime'
import { playSfx } from '../../audio'
import { SIGNATURE_PLATE } from './plateLayout'
import { MIN_TAP_TARGET_PX, createTapTracker, expandRect, projectPlateRect, rectContains } from './plateTap'
import { useSignature } from './signatureStore'

/** Délai (ms) pendant lequel la carte ignore les clics de fermeture après une ouverture par la plaque. */
const OPEN_GUARD_MS = 350

/** Le geste vise le jeu (joystick ou canvas), pas un bouton du HUD ni une surimpression. */
function targetsGame(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.joystick-zone, .game-canvas') !== null
}

export function usePlateTap(): void {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const tracker = createTapTracker()

    function onPointerDown(e: PointerEvent) {
      tracker.down(e.pointerId, e.clientX, e.clientY, e.timeStamp)
    }

    function onPointerCancel(e: PointerEvent) {
      tracker.cancel(e.pointerId)
    }

    function onPointerUp(e: PointerEvent) {
      if (!tracker.up(e.pointerId, e.clientX, e.clientY, e.timeStamp)) return
      if (!targetsGame(e.target)) return
      const game = useGame.getState()
      if (game.screen !== 'play' || isOverlayOpen(game) || useSignature.getState().cardOpen) return
      const rect = projectPlateRect(camera, gl.domElement.getBoundingClientRect(), SIGNATURE_PLATE)
      if (!rect || !rectContains(expandRect(rect, MIN_TAP_TARGET_PX), e.clientX, e.clientY)) return
      resetInput()
      playSfx('click')
      useSignature.getState().openCard({ guardMs: OPEN_GUARD_MS })
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [camera, gl])
}
