/**
 * Rémi Godeau, directeur de la rédaction de L'Opinion et co-organisateur de la soirée : il tient
 * l'accueil, derrière le comptoir du hall, à la place de l'ancienne chouette (décision de Baptiste du 29/09).
 * Personnage 3D généré (`GlbCharacter`, clips « idle » en boucle et « wave » joué une fois), posé pieds à
 * y = 0 à `placement.position`, orienté vers le joueur. Aucune allocation d'objet three.js dans useFrame.
 * Textes : `remiScript.ts` (à faire valider par lui). Propriétaire : agent accueil-remi.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import { GlbCharacter } from '../characters'
import type { Placement } from '../types'
import { useGame } from '../state/gameStore'
import { player as runtimePlayer } from '../state/runtime'
import { BUBBLE_GEOMETRY, getBubbleMaterial } from './bubbleMaterial'
import { BODY_TURN_RATE, approach, turnToward } from './remiBehavior'
import { useWaveGreeting } from './useWaveGreeting'

/** Hauteur du centre de la bulle : au-dessus de la tête (1,5 m) et du bras levé pendant le salut. */
const BUBBLE_BASE_Y = 2.3
const BUBBLE_BOB = 0.05

export function Remi({ placement }: { placement: Placement }) {
  const nearCurator = useGame((s) => s.nearCurator)
  const dialogueOpen = useGame((s) => s.dialogue !== null)
  const { waving, onWaveDone } = useWaveGreeting()
  const showBubble = nearCurator && !dialogueOpen
  const bubbleMaterial = useMemo(() => getBubbleMaterial(), [])

  const bodyRef = useRef<Group | null>(null)
  const bubbleRef = useRef<Mesh | null>(null)
  const turn = useRef(0)

  useFrame((state, delta) => {
    // Le buste suit le joueur (borné autour de l'orientation de repos du comptoir) ; l'orientation
    // n'est donc écrite qu'ici, jamais par une prop.
    const body = bodyRef.current
    if (body) {
      const target = turnToward(runtimePlayer.x - placement.position.x, runtimePlayer.z - placement.position.z, placement.rotationY)
      turn.current = approach(turn.current, target, BODY_TURN_RATE, delta)
      body.rotation.y = placement.rotationY + turn.current
    }
    // Bulle « … » : flotte doucement et fait toujours face à la caméra.
    const bubble = bubbleRef.current
    if (bubble) {
      bubble.position.y = BUBBLE_BASE_Y + Math.sin(state.clock.elapsedTime * 2.2) * BUBBLE_BOB
      bubble.quaternion.copy(state.camera.quaternion)
    }
  })

  return (
    <>
      <GlbCharacter
        ref={bodyRef}
        character="remi"
        clip={waving ? 'wave' : 'idle'}
        oneShot={waving}
        onDone={onWaveDone}
        position={[placement.position.x, 0, placement.position.z]}
      />
      {showBubble && (
        <mesh
          ref={bubbleRef}
          geometry={BUBBLE_GEOMETRY}
          material={bubbleMaterial}
          position={[placement.position.x, BUBBLE_BASE_Y, placement.position.z]}
        />
      )}
    </>
  )
}
