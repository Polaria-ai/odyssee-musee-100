/**
 * Personnage GLB animé (Cyril, Rémi, l'Archiviste) : un clone indépendant par instance, donc plusieurs à l'écran
 * (visiteurs distants), sur des ressources partagées (géométrie, texture, matériau mat, clips).
 * Propriétaire : agent personnages.
 *
 * - Échelle : la hauteur de jeu (`CHARACTERS[…].height`) est atteinte exactement, pieds à y = 0
 *   (`getCharacterAssets`, calculé une fois par modèle). L'origine du composant est donc « sous les pieds ».
 * - Matériau : `MeshLambertMaterial` mat partagé (même texture de couleur que l'original, trop brillant).
 *   Seule exception : `opacity < 1` donne à CETTE instance un clone transparent (les autres ne bougent pas).
 * - Animation : un `AnimationMixer` par instance (`CharacterAnimator`), fondu enchaîné de 0,2 s entre
 *   clips, aucune allocation par image (`useFrame` n'appelle que `update`).
 * - À monter sous <Suspense> (chargement via `useModel`). Les trois GLB sont préchargés au chargement du module.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import type { MeshLambertMaterial } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { preloadModel, useModel } from '../assets/useModel'
import { CharacterAnimator } from './animator'
import { findSkinnedMesh, getCharacterAssets } from './characterRig'
import { CHARACTERS, type CharacterId, type ClipName } from './models'

export { pickLocomotionClip, walkTimeScale } from './locomotion'
export { CROSSFADE_SECONDS } from './animator'

/** Plafond du pas de temps transmis au mixeur (onglet en arrière-plan → pas de saut d'animation). */
const MAX_FRAME_DELTA = 0.1
/** En dessous de cette opacité l'instance utilise son matériau transparent ; au-dessus, le matériau partagé. */
const OPAQUE_THRESHOLD = 0.999

for (const def of Object.values(CHARACTERS)) preloadModel(def.path)

export interface GlbCharacterProps extends Omit<ThreeElements['group'], 'children'> {
  character: CharacterId
  /** Clip logique à jouer, `idle` par défaut. Un clip que le personnage n'a pas retombe sur `idle`. */
  clip?: ClipName
  /** Vitesse de lecture du clip courant (1 = normale). Ex. `walkTimeScale(vitesse)` pour la marche. */
  timeScale?: number
  /**
   * Joue `clip` une seule fois, puis fond vers `idle` et appelle `onDone`. Se déclenche quand `clip`
   * (ou `oneShot`) change ; pour rejouer le même clip, changer la `key` du composant ou passer par `idle`.
   */
  oneShot?: boolean
  onDone?: () => void
  /** 0..1. Différent de 1 : matériau transparent propre à l'instance (fondu d'entrée/sortie). */
  opacity?: number
}

export function GlbCharacter({ character, clip = 'idle', timeScale = 1, oneShot = false, onDone, opacity = 1, ...groupProps }: GlbCharacterProps) {
  const def = CHARACTERS[character]
  const { scene, animations } = useModel(def.path)
  const assets = useMemo(() => getCharacterAssets(scene, animations, def), [scene, animations, def])

  // Clone indépendant : squelette, os et maillage propres à l'instance ; géométrie et matériau partagés.
  const { root, mesh } = useMemo(() => {
    const cloned = cloneSkinned(scene)
    const skinned = findSkinnedMesh(cloned)
    if (skinned) {
      skinned.material = assets.material
      skinned.boundingSphere = assets.boundingSphere.clone()
    }
    cloned.scale.setScalar(assets.scale)
    cloned.position.set(0, assets.offsetY, 0)
    return { root: cloned, mesh: skinned }
  }, [scene, assets])

  const animator = useMemo(() => new CharacterAnimator(root, assets.clips), [root, assets])
  const onDoneRef = useRef(onDone)
  const timeScaleRef = useRef(timeScale)

  // Ordre voulu (effets de mise en page, exécutés dans l'ordre de déclaration) : libération à la fin,
  // puis références à jour, puis changement de clip, puis cadence.
  useLayoutEffect(
    () => () => {
      animator.dispose()
      mesh?.skeleton.dispose() // texture d'os propre à l'instance (le renderer la recrée si l'instance est remontée)
    },
    [animator, mesh],
  )
  useLayoutEffect(() => {
    onDoneRef.current = onDone
    timeScaleRef.current = timeScale
  })
  useLayoutEffect(() => {
    // Le premier lancement part d'une phase aléatoire : des visiteurs voisins ne respirent pas au même instant.
    animator.play(clip, { once: oneShot, timeScale: timeScaleRef.current, onDone: () => onDoneRef.current?.(), startPhase: Math.random() })
  }, [animator, clip, oneShot])
  useLayoutEffect(() => {
    animator.setTimeScale(timeScale)
  }, [animator, timeScale])

  // Opacité : matériau partagé tant que l'instance est opaque ; sinon un clone transparent créé une fois.
  const fadedRef = useRef<MeshLambertMaterial | null>(null)
  useLayoutEffect(() => {
    if (!mesh) return
    if (opacity >= OPAQUE_THRESHOLD) {
      mesh.material = assets.material
      return
    }
    let faded = fadedRef.current
    if (!faded || faded.map !== assets.material.map) {
      faded?.dispose()
      faded = assets.material.clone()
      faded.transparent = true
      fadedRef.current = faded
    }
    faded.opacity = Math.max(0, opacity)
    mesh.material = faded
  }, [mesh, assets, opacity])
  useLayoutEffect(
    () => () => {
      fadedRef.current?.dispose()
      fadedRef.current = null
    },
    [],
  )

  useFrame((_state, delta) => {
    animator.update(delta < MAX_FRAME_DELTA ? delta : MAX_FRAME_DELTA)
  })

  // `dispose={null}` : géométrie, texture et matériau viennent de caches partagés, jamais à libérer ici.
  return (
    <group {...groupProps}>
      <primitive object={root} dispose={null} />
    </group>
  )
}
