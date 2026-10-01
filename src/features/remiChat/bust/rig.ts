/**
 * Rémi prêt pour le buste : clone de la scène chargée par `useModel`, animateur « idle », pilotage
 * procédural des os et mesures de cadrage. three seul (aucun React) : le cycle de vie est dans `dispose`.
 *
 * Pourquoi des copies plutôt que le matériau et la géométrie partagés avec le Rémi du musée :
 * le buste vit dans son PROPRE contexte WebGL, et le chat s'ouvre et se ferme souvent. three accroche
 * à chaque géométrie et texture un écouteur `dispose` qui retient le moteur de rendu qui les a envoyées
 * au GPU. Sur des ressources partagées (jamais libérées, puisque le musée s'en sert), chaque ouverture
 * du chat laisserait un moteur de rendu mort en mémoire. Ici le buste possède sa géométrie (copie),
 * sa texture (copie de l'objet, image partagée) et son matériau, et libère tout à la fermeture ; la
 * géométrie et la texture du musée ne sont jamais touchées.
 */
import {
  BufferAttribute,
  Vector3,
  type AnimationClip,
  type BufferGeometry,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
  type Texture,
} from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { CharacterAnimator } from '../../../characters/animator'
import { findSkinnedMesh, getCharacterAssets } from '../../../characters/characterRig'
import { CHARACTERS } from '../../../characters/models'
import { BonePoseDriver } from './bonePose'
import { createBustMaterial } from './material'
import type { BustMetrics } from './framing'

export interface BustRig {
  /** Racine du clone (échelle et pied à y = 0 déjà posés) : à monter dans la scène. */
  readonly root: Object3D
  readonly mesh: SkinnedMesh
  readonly animator: CharacterAnimator
  readonly driver: BonePoseDriver
  readonly metrics: BustMetrics
  /** Lance le clip « idle » (à appeler au montage ; rappelable après `dispose`). */
  start(): void
  /** Libère géométrie, texture, matériau, os et mixeur propres au buste. Le rig reste réutilisable. */
  dispose(): void
}

const _v = new Vector3()

function worldY(root: Object3D, name: string): number | null {
  const bone = root.getObjectByName(name)
  return bone ? bone.getWorldPosition(_v).y : null
}

function worldPoint(root: Object3D, name: string): Vector3 | null {
  const bone = root.getObjectByName(name)
  return bone ? bone.getWorldPosition(new Vector3()) : null
}

/**
 * Mesures du cadrage prises sur les os dans l'instant 0 du clip « idle » :
 *  - sommet du crâne : bout de l'os de tête (`head_end`) ;
 *  - ligne de coupe : milieu du torse = os `Spine01`, entre le bassin et les épaules ;
 *  - demi-largeur d'épaules : moitié de la distance entre les deux os de bras.
 * Repli (os absents) : proportions de la hauteur du modèle, jamais une valeur factice silencieuse.
 */
export function measureBust(root: Object3D, height: number): BustMetrics {
  root.updateMatrixWorld(true)
  const headEnd = worldY(root, 'head_end')
  const head = worldY(root, 'Head')
  const spine01 = worldY(root, 'Spine01')
  const left = worldPoint(root, 'LeftArm')
  const right = worldPoint(root, 'RightArm')
  const headTopY = headEnd ?? (head !== null ? head + height * 0.12 : height)
  const headBaseY = head ?? headTopY - height * 0.14
  return {
    headTopY,
    headCenterY: (headTopY + headBaseY) / 2,
    cutY: spine01 ?? headTopY - height * 0.33,
    shoulderHalfWidth: left && right ? left.distanceTo(right) / 2 : height * 0.12,
  }
}

/**
 * Normales lissées sur la copie de la géométrie. Celles du fichier (entiers 8 bits normalisés, héritées de
 * la génération Meshy) laissent voir les facettes du maillage dès que le visage remplit l'écran. Le tampon
 * est créé en flottants AVANT `computeVertexNormals` : sur l'attribut entier d'origine, les produits
 * vectoriels des faces (~1e-4, positions normalisées) s'arrondiraient à 0 et le modèle deviendrait noir.
 */
export function smoothNormals(geometry: BufferGeometry): void {
  const position = geometry.getAttribute('position')
  if (!position) return
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(position.count * 3), 3))
  geometry.computeVertexNormals()
}

export function createBustRig(scene: Object3D, animations: AnimationClip[]): BustRig {
  const def = CHARACTERS.remi
  const assets = getCharacterAssets(scene, animations, def)

  const root = cloneSkinned(scene)
  const mesh = findSkinnedMesh(root)
  if (!mesh) throw new Error(`Aucun SkinnedMesh dans ${def.path}`)

  // Ressources propres au buste (voir l'en-tête).
  const source = mesh.material as MeshStandardMaterial
  const geometry: BufferGeometry = mesh.geometry.clone()
  smoothNormals(geometry)
  const map: Texture | null = source.map ? source.map.clone() : null
  if (map) map.needsUpdate = true
  const material = createBustMaterial(map, source.color)
  mesh.geometry = geometry
  mesh.material = material
  mesh.frustumCulled = false // toujours dans le cadre : pas de sphère de culling à maintenir

  root.scale.setScalar(assets.scale)
  root.position.set(0, assets.offsetY, 0)

  const animator = new CharacterAnimator(root, { idle: assets.clips.idle })
  const driver = new BonePoseDriver(root)
  animator.play('idle') // pose le squelette dans l'instant 0 : les mesures ci-dessous sont celles du rendu
  const metrics = measureBust(root, def.height)

  return {
    root,
    mesh,
    animator,
    driver,
    metrics,
    start() {
      animator.play('idle')
    },
    dispose() {
      driver.restore()
      animator.dispose()
      mesh.skeleton.dispose() // texture d'os propre à ce clone
      geometry.dispose()
      material.dispose()
      map?.dispose() // la copie seulement : l'image reste à la texture du musée
    },
  }
}
