/**
 * Personnage synthétique pour les tests (aucun fichier GLB, aucun WebGL) : un parallélépipède de 2 m de
 * haut (y de 0 à 2 dans la pose de liaison) skinné sur deux os, et des clips à pistes de position.
 * Propriétaire : agent personnages. Utilisé seulement par les tests de ce dossier.
 */
import {
  AnimationClip,
  BoxGeometry,
  Bone,
  Float32BufferAttribute,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Texture,
  Uint16BufferAttribute,
  VectorKeyframeTrack,
  type Object3D,
} from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { ClipName } from './models'

export const FIXTURE_MAP = new Texture()

/** Clip dont l'os `Hips` reste à `xyz` (2 images) — ou suit `values` (3 valeurs par instant). */
export function positionClip(name: string, duration: number, values: number[]): AnimationClip {
  const frames = values.length / 3
  const times = Array.from({ length: frames }, (_, i) => (duration * i) / (frames - 1))
  return new AnimationClip(name, duration, [new VectorKeyframeTrack('Hips.position', times, values)])
}

export function makeTestRig(): { scene: Group; animations: AnimationClip[] } {
  const hips = new Bone()
  hips.name = 'Hips'
  hips.position.set(0, 0.5, 0)
  const head = new Bone()
  head.name = 'Head'
  head.position.set(0, 1, 0)
  hips.add(head)

  const geometry = new BoxGeometry(0.4, 2, 0.4)
  geometry.translate(0, 1, 0)
  const count = geometry.getAttribute('position').count
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4))
  geometry.setAttribute(
    'skinWeight',
    new Float32BufferAttribute(Float32Array.from({ length: count * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)), 4),
  )

  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial({ map: FIXTURE_MAP, metalness: 1, roughness: 0.4 }))
  mesh.name = 'body'
  mesh.add(hips)
  mesh.updateMatrixWorld(true)
  mesh.bind(new Skeleton([hips, head]))

  const scene = new Group()
  scene.name = 'Scene'
  scene.add(mesh)

  const animations = [
    // Au départ le bassin est à 0,75 (0,25 au-dessus de la liaison) : tout le corps est levé de 0,25.
    positionClip('idle', 2, [0, 0.75, 0, 0, 0.5, 0, 0, 0.75, 0]),
    // Racine décalée de (1, 1) par rapport à « idle » (comme le « wave » de Rémi).
    positionClip('wave', 1, [1, 0.5, 1, 1, 0.6, 1]),
    positionClip('walk', 1, [0, 0.5, 0, 0, 0.5, 0]),
  ]
  return { scene, animations }
}

/** Un clone de la fixture (comme en crée `GlbCharacter`) et ses clips, par nom logique. */
export function cloneRig(which: 'all' | 'idle-wave' = 'all'): { root: Object3D; clips: Partial<Record<ClipName, AnimationClip>> } {
  const { scene, animations } = makeTestRig()
  const byName = Object.fromEntries(animations.map((c) => [c.name, c])) as Record<ClipName, AnimationClip>
  const clips: Partial<Record<ClipName, AnimationClip>> = which === 'all' ? byName : { idle: byName.idle, wave: byName.wave }
  return { root: cloneSkinned(scene), clips }
}
