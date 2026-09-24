/**
 * Canvas unique du jeu. Propriétaire : intégration.
 * Les modules y branchent leurs composants 3D ; ne pas créer d'autre Canvas plein écran.
 */
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useGame } from '../state/gameStore'
import { Museum } from '../world/Museum'
import { Player } from '../player/Player'
import { Minerve } from '../npc/Minerve'
import { RemoteVisitors } from '../features/presence/RemoteVisitors'
import { StampStations } from '../features/stamps/StampStations'
import { AttractCamera } from './AttractCamera'
import { palette } from '../styles/tokens'

export function Experience() {
  const layout = useGame((s) => s.layout)
  const people = useGame((s) => s.people)
  const screen = useGame((s) => s.screen)
  const quality = useGame((s) => s.quality)
  const setQuality = useGame((s) => s.setQuality)
  if (!layout) return null

  const playing = screen === 'play'
  return (
    <Canvas
      className="game-canvas"
      data-testid="game-canvas"
      dpr={quality === 'high' ? [1, 1.75] : [1, 1.25]}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      camera={{ fov: 42, near: 0.1, far: 120, position: [0, 9, 14] }}
      frameloop={screen === 'customize' ? 'never' : 'always'}
    >
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, 28, 70]} />
      <hemisphereLight args={['#fff6e0', '#c8a27a', 1.1]} />
      <directionalLight position={[8, 14, 6]} intensity={1.3} color="#fff1d6" />
      <PerformanceMonitor onDecline={() => setQuality('low')} flipflops={2} />
      <Suspense fallback={null}>
        <Museum layout={layout} people={people} />
        <StampStations layout={layout} />
        <Minerve placement={layout.curator} />
        {playing ? <Player layout={layout} /> : <AttractCamera layout={layout} />}
        {playing && <RemoteVisitors />}
      </Suspense>
    </Canvas>
  )
}
