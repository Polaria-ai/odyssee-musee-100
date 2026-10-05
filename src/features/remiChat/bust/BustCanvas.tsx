/**
 * `<Canvas>` du buste (chargé à la demande par `RemiBust`, donc absent des tests jsdom du chat et du
 * premier chargement du jeu). Propre contexte WebGL, rempli par le conteneur ; décoratif (`aria-hidden`).
 *
 * - `flat` : pas de tone mapping (charte 3D §1, sans quoi le cyan vif vire au gris-bleu) ;
 * - fond transparent : le parent pose le fond ; `dpr` plafonné à 1,5 (téléphone, 200 joueurs) ;
 * - boucle suspendue quand l'onglet est caché (`frameloop="never"`) ;
 * - contexte perdu : `preventDefault` pour que le navigateur puisse le restaurer, et `onContextLost`
 *   laisse le parent afficher la silhouette en attendant ;
 * - démontage : R3F libère le moteur de rendu et force la perte du contexte ; le rig libère le reste.
 */
import { useCallback, useLayoutEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import type { WebGLRenderer } from 'three'
import { usePageVisible, useReducedMotion } from './env'
import { BUST_FOV } from './config'
import { BustScene, type BustSceneProps } from './BustScene'

export interface BustCanvasProps extends Omit<BustSceneProps, 'reducedMotion'> {
  onContextLost?: () => void
  onContextRestored?: () => void
}

export default function BustCanvas({ onContextLost, onContextRestored, ...sceneProps }: BustCanvasProps) {
  const visible = usePageVisible()
  const reducedMotion = useReducedMotion()

  // `onCreated` ne part qu'une fois : les rappels du parent passent par une référence à jour.
  const onRenderer = sceneProps.debug?.onRenderer
  const callbacks = useRef({ onContextLost, onContextRestored, onRenderer })
  const mounted = useRef(true)
  useLayoutEffect(() => {
    callbacks.current = { onContextLost, onContextRestored, onRenderer }
  })
  // R3F force la perte du contexte à NOTRE démontage (dans un `setTimeout`) : cet évènement tardif
  // n'est pas une panne et ne doit pas déclencher de remontage.
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const onCreated = useCallback(({ gl }: { gl: WebGLRenderer }) => {
    const canvas = gl.domElement
    canvas.setAttribute('aria-hidden', 'true')
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      if (mounted.current) callbacks.current.onContextLost?.()
    })
    canvas.addEventListener('webglcontextrestored', () => {
      if (mounted.current) callbacks.current.onContextRestored?.()
    })
    callbacks.current.onRenderer?.(gl)
  }, [])

  return (
    <Canvas
      flat
      aria-hidden="true"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: BUST_FOV, near: 0.1, far: 30, position: [0, 1.4, 3] }}
      frameloop={visible ? 'always' : 'never'}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      onCreated={onCreated}
    >
      <BustScene {...sceneProps} reducedMotion={reducedMotion} />
    </Canvas>
  )
}
