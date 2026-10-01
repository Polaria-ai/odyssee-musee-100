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
import { Remi } from '../npc/Remi'
import { ArchivesRoom } from '../archives/ArchivesRoom'
import { RemoteVisitors } from '../features/presence/RemoteVisitors'
import { StampStations } from '../features/stamps/StampStations'
import { AttractCamera } from './AttractCamera'
import { DebugProbe } from './DebugProbe'
import { playerColliders } from './playerColliders'
import { cameraRig, charter3d } from '../styles/tokens'

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

// Charte 3D (docs/CHARTE-3D.md §1 et §3) : `flat` = pas de tone mapping. ACES Filmic, le défaut de R3F,
// fait dériver les bleus et le corail (`#1d49c1` s'afficherait `#003ec3`) ; sans lui, la charte est ce
// qu'on voit. Fond, brouillard et lumières viennent du même objet.
const sceneCharter = charter3d.scene

export function Experience() {
  const layout = useGame((s) => s.layout)
  const archivesLayout = useGame((s) => s.archivesLayout)
  const people = useGame((s) => s.people)
  const screen = useGame((s) => s.screen)
  const quality = useGame((s) => s.quality)
  // Le chat avec Rémi recouvre tout l'écran et a son propre <Canvas> (le buste) : le musée, invisible, cesse
  // d'être rendu (deux scènes WebGL en même temps épuiseraient un téléphone). Le <Canvas> reste monté, donc le
  // contexte WebGL, les textures et l'état de la scène sont intacts à la reprise.
  const chatOpen = useGame((s) => s.remiChatOpen)
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
      flat={sceneCharter.flat}
      className="game-canvas"
      data-testid="game-canvas"
      dpr={quality === 'high' ? [1, 1.75] : [1, 1.25]}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      camera={{ fov: cameraRig.fovDeg, near: 0.1, far: 120, position: [0, 9, 14] }}
      frameloop={chatOpen ? 'never' : 'always'}
      onCreated={onCreated}
    >
      <color attach="background" args={[sceneCharter.background]} />
      <fog attach="fog" args={[sceneCharter.fog.color, sceneCharter.fog.near, sceneCharter.fog.far]} />
      <hemisphereLight args={[sceneCharter.hemisphere.sky, sceneCharter.hemisphere.ground, sceneCharter.hemisphere.intensity]} />
      <directionalLight position={sceneCharter.directional.position} intensity={sceneCharter.directional.intensity} color={sceneCharter.directional.color} />
      <DebugProbe />
      <PerformanceMonitor onDecline={() => setQuality('low')} flipflops={2} />
      <Suspense fallback={null}>
        <Museum layout={layout} people={people} />
        <StampStations layout={layout} />
        <Remi placement={layout.curator} />
        {archivesLayout && <ArchivesRoom archives={archivesLayout} />}
        {playing ? <Player layout={playerLayout ?? layout} /> : <AttractCamera layout={layout} />}
        {playing && <RemoteVisitors />}
      </Suspense>
    </Canvas>
  )
}
