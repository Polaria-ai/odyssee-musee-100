/**
 * Contenu du `<Canvas>` du buste : lumières « contre-jour cyan », Rémi, caméra de cadrage.
 * Une seule boucle (`useFrame` à la priorité par défaut) : mixeur → moteur de gestes → pose des os,
 * dans cet ordre, donc la couche procédurale passe TOUJOURS après le clip « idle ». Aucune priorité
 * positive (elle désactiverait le rendu automatique de R3F). Aucune allocation three.js dans `useFrame`.
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Vector3, type AnimationClip, type Object3D, type WebGLRenderer } from 'three'
import { useModel } from '../../../assets/useModel'
import { CHARACTERS } from '../../../characters/models'
import { charter3d } from '../../../styles/tokens'
import type { RemiBustVariant, RemiMood } from '../contract'
import { computeFraming, type BustMetrics, type Framing } from './framing'
import { MAX_DT, createGestureEngine, type GestureId } from './gestures'
import { createBustRig } from './rig'
import { ATTENTION, BODY_YAW, BUST_FOV, DEFAULT_SEED } from './config'

/** Réglages de mise au point (page de démonstration `dev/bust-demo.html`), jamais utilisés en production. */
export interface BustDebug {
  seed?: number
  /** Avance la chorégraphie de `startAt` secondes avant la première image (captures reproductibles). */
  startAt?: number
  /** Multiplicateur de temps (rendu logiciel lent : 1 image/s sous SwiftShader). */
  speed?: number
  forceGesture?: GestureId
  mirrored?: boolean
  /** Recule la caméra (×) et la baisse vers la poitrine : voir tout le haut du corps pendant la mise au point des gestes. */
  zoomOut?: number
  /** Chemin du modèle (test du repli quand le chargement échoue). */
  modelPath?: string
  /** Reçoit une fonction qui projette un os à l'écran (NDC, −1 à 1) : vérification des mains dans le cadre. */
  onProbe?: (project: (boneName: string) => { x: number; y: number } | null) => void
  /** Reçoit les mesures du modèle et le cadre calculé (mise au point du cadrage). */
  onMetrics?: (metrics: BustMetrics, framing: Framing) => void
  /** Reçoit le moteur de rendu à sa création (vérification des fuites : `gl.info.memory`). */
  onRenderer?: (gl: WebGLRenderer) => void
}

export interface BustSceneProps {
  mood: RemiMood
  variant: RemiBustVariant
  reducedMotion: boolean
  /** Cadre calculé (pour le masque de fondu et le halo posés en CSS par le parent). */
  onFraming?: (framing: Framing) => void
  /** Rémi est monté : le parent peut retirer la silhouette d'attente. */
  onReady?: () => void
  /** Le modèle n'a pas pu être chargé : le parent affiche sa silhouette de repli. */
  onError?: (error: unknown) => void
  debug?: BustDebug
}

const rim = charter3d.base.cyanVif

function Lights() {
  const { hemisphere, directional } = charter3d.scene
  // Hémisphère + une directionnelle de face (clés de la charte, un peu plus douces pour un portrait)
  // + le contre-jour cyan : deux directionnelles de même teinte derrière Rémi, de part et d'autre.
  return (
    <>
      <hemisphereLight args={[hemisphere.sky, hemisphere.ground, hemisphere.intensity * 0.7]} />
      <directionalLight color={directional.color} intensity={directional.intensity * 0.7} position={[2.2, 3, 5]} />
      <directionalLight color={rim} intensity={2} position={[-3, 2.4, -2.2]} />
      <directionalLight color={rim} intensity={1.4} position={[3, 2.2, -2.2]} />
    </>
  )
}

interface LoadedModel {
  scene: Object3D
  animations: AnimationClip[]
}

/**
 * Charge le modèle sans laisser l'exception remonter à React : un échec lancé dans le rendu d'un `<Canvas>`
 * est signalé par R3F à `reportError` (évènement `error` de la fenêtre, donc « erreur non gérée » dans la
 * console) même quand il est attrapé. Ici l'échec devient une valeur, et le parent affiche son repli.
 * (`useModel` n'est qu'un `suspend` : rien ne change dans l'ordre des hooks quand il lève.)
 */
function useBustModel(path: string): { model: LoadedModel | null; error: unknown } {
  try {
    return { model: useModel(path), error: null }
  } catch (error) {
    if (typeof (error as PromiseLike<unknown> | null)?.then === 'function') throw error // chargement en cours : Suspense
    return { model: null, error }
  }
}

function BustLoader(props: BustSceneProps) {
  const path = props.debug?.modelPath ?? CHARACTERS.remi.path
  const { model, error } = useBustModel(path)
  const { onError } = props
  useEffect(() => {
    if (error === null) return
    useGLTF.clear(path) // le prochain essai (réouverture du chat) recharge au lieu de resservir l'échec mémorisé
    onError?.(error)
  }, [error, path, onError])
  return model ? <BustModel {...props} scene={model.scene} animations={model.animations} /> : null
}

function BustModel({ mood, variant, reducedMotion, onFraming, onReady, debug, scene, animations }: BustSceneProps & LoadedModel) {
  const rig = useMemo(() => createBustRig(scene, animations), [scene, animations])
  const engine = useMemo(() => createGestureEngine(debug?.seed ?? DEFAULT_SEED), [debug?.seed])
  const moodRef = useRef(mood)
  const speed = debug?.speed ?? 1

  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const framing = useMemo(
    () => computeFraming({ metrics: rig.metrics, variant, aspect: height > 0 ? width / height : 1, fovDeg: BUST_FOV }),
    [rig, variant, width, height],
  )

  // Effets de mise en page, dans l'ordre de déclaration : libération du rig au démontage, humeur à jour,
  // réglages du moteur, caméra, puis démarrage du clip (et avance de la chorégraphie en mise au point).
  useLayoutEffect(
    () => () => {
      rig.dispose()
    },
    [rig],
  )
  useLayoutEffect(() => {
    moodRef.current = mood
  })
  useLayoutEffect(() => {
    engine.configure({ reducedMotion, ...ATTENTION[variant], bodyYaw: BODY_YAW[variant], reach: framing.reach })
  }, [engine, reducedMotion, variant, framing.reach])
  useLayoutEffect(() => {
    const zoom = debug?.zoomOut ?? 1
    const y = zoom === 1 ? framing.cameraY : framing.cameraY - 0.28 * (zoom - 1)
    camera.position.set(0, y, framing.distance * zoom)
    camera.lookAt(0, y, 0)
    camera.updateProjectionMatrix()
  }, [camera, framing, debug?.zoomOut])
  useLayoutEffect(() => {
    rig.start()
    const startAt = debug?.startAt ?? 0
    if (startAt > 0) {
      // Mise au point : avance le clip, et la chorégraphie une seule fois (StrictMode rejoue les effets).
      const advanceEngine = engine.time === 0
      for (let t = 0; t < startAt; t += 1 / 60) {
        rig.animator.update(1 / 60)
        if (advanceEngine) engine.update(1 / 60, moodRef.current)
      }
    }
    engine.forceGesture(debug?.forceGesture ?? null, debug?.mirrored)
  }, [rig, engine, debug?.startAt, debug?.forceGesture, debug?.mirrored])

  useEffect(() => {
    onFraming?.(framing)
    debug?.onMetrics?.(rig.metrics, framing)
  }, [framing, onFraming, rig, debug])
  useEffect(() => {
    onReady?.()
  }, [rig, onReady])
  useEffect(() => {
    if (!debug?.onProbe) return
    const v = new Vector3()
    debug.onProbe((name) => {
      const bone = rig.root.getObjectByName(name)
      if (!bone) return null
      camera.updateMatrixWorld(true)
      rig.root.updateMatrixWorld(true)
      bone.getWorldPosition(v).project(camera)
      return { x: v.x, y: v.y }
    })
  }, [rig, camera, debug])

  useFrame((_state, delta) => {
    const dt = (delta < MAX_DT ? delta : MAX_DT) * speed
    rig.animator.update(dt)
    engine.update(dt, moodRef.current)
    rig.driver.apply(engine.pose, engine.aim)
  })

  // `dispose={null}` : géométrie, texture et matériau appartiennent au rig, qui les libère lui-même.
  return (
    <group rotation-y={BODY_YAW[variant]}>
      <primitive object={rig.root} dispose={null} />
    </group>
  )
}

export function BustScene(props: BustSceneProps) {
  return (
    <>
      <Lights />
      <Suspense fallback={null}>
        <BustLoader {...props} />
      </Suspense>
    </>
  )
}
