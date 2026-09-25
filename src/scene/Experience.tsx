/**
 * Canvas unique du jeu. Propriétaire : intégration.
 * Les modules y branchent leurs composants 3D ; ne pas créer d'autre Canvas plein écran.
 */
import { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useGame } from '../state/gameStore'
import { Museum } from '../world/Museum'
import { buildMuseumArchitecture } from '../world/layout'
import { Player } from '../player/Player'
import { Minerve } from '../npc/Minerve'
import { ArchivesRoom } from '../archives/ArchivesRoom'
import { RemoteVisitors } from '../features/presence/RemoteVisitors'
import { StampStations } from '../features/stamps/StampStations'
import { AttractCamera } from './AttractCamera'
import { DebugProbe } from './DebugProbe'
import { playerColliders } from './playerColliders'
import { cameraRig, palette } from '../styles/tokens'

// Le rendu logiciel (SwiftShader, utilisé en CI et sur certains appareils sans GPU) peut parfois
// perdre le contexte WebGL (`THREE.WebGLRenderer: Context Lost.`), avec ou sans restauration native
// du navigateur. Sans filet, la scène resterait vide indéfiniment. On force un remontage complet du
// <Canvas> (nouvel élément, nouveau contexte) dès la perte : plus fiable que d'attendre une
// éventuelle restauration native, et un seul Canvas reste monté à la fois (pas de doublon).
function useCanvasRecovery() {
  const [canvasKey, setCanvasKey] = useState(0)
  const remountedRef = useRef(false)
  const onCreated = useCallback(({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
    remountedRef.current = false
    gl.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      if (remountedRef.current) return
      remountedRef.current = true
      setCanvasKey((k) => k + 1)
    })
  }, [])
  return { canvasKey, onCreated }
}

export function Experience() {
  const layout = useGame((s) => s.layout)
  const archivesLayout = useGame((s) => s.archivesLayout)
  const people = useGame((s) => s.people)
  const screen = useGame((s) => s.screen)
  const quality = useGame((s) => s.quality)
  const setQuality = useGame((s) => s.setQuality)
  const { canvasKey, onCreated } = useCanvasRecovery()
  // Colliders du joueur = ceux de l'architecture (murs, meubles cachés, cimaises…) + ceux du mobilier
  // supplémentaire posé par le module props (WEL-872/873, jamais branchés dans `layout.colliders`
  // lui-même — voir le commentaire de `playerColliders.ts` : ce dernier reste intact pour que
  // `<Museum>`/`<RoomProps>` continuent d'y calculer ce même mobilier sans s'auto-bloquer).
  const architecture = useMemo(() => buildMuseumArchitecture(people), [people])
  const playerLayout = useMemo(() => (layout ? { ...layout, colliders: playerColliders(layout, architecture) } : null), [layout, architecture])
  if (!layout) return null

  const playing = screen === 'play'
  return (
    <Canvas
      key={canvasKey}
      className="game-canvas"
      data-testid="game-canvas"
      dpr={quality === 'high' ? [1, 1.75] : [1, 1.25]}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      camera={{ fov: cameraRig.fovDeg, near: 0.1, far: 120, position: [0, 9, 14] }}
      frameloop={screen === 'customize' ? 'never' : 'always'}
      onCreated={onCreated}
    >
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, 28, 70]} />
      <hemisphereLight args={['#fff6e0', '#c8a27a', 1.1]} />
      <directionalLight position={[8, 14, 6]} intensity={1.3} color="#fff1d6" />
      <DebugProbe />
      <PerformanceMonitor onDecline={() => setQuality('low')} flipflops={2} />
      <Suspense fallback={null}>
        <Museum layout={layout} people={people} />
        <StampStations layout={layout} />
        <Minerve placement={layout.curator} />
        {archivesLayout && <ArchivesRoom archives={archivesLayout} />}
        {playing ? <Player layout={playerLayout ?? layout} /> : <AttractCamera layout={layout} />}
        {playing && <RemoteVisitors />}
      </Suspense>
    </Canvas>
  )
}
