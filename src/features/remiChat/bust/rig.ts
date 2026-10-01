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

/** Résolution de la soudure des positions : 1e-4 unité de géométrie, très en deçà de la taille d'une face du maillage. */
const WELD_SCALE = 1e4

/**
 * Normales lissées PAR POSITION sur la copie de la géométrie.
 *
 * Celles du fichier (entiers 8 bits normalisés, héritées de la génération Meshy) laissent voir les facettes
 * du maillage dès que le visage remplit l'écran. Et `computeVertexNormals` ne suffit pas : le maillage est
 * éclaté par îlots UV (13 519 sommets pour 6 208 positions distinctes), donc il ne lisse qu'à l'intérieur de
 * chaque îlot et laisse une rupture de normale à chaque couture, que le terme de Fresnel du matériau
 * souligne en filets cyan sur le front et les joues. On soude donc par position : les sommets confondus
 * (même position quantifiée, UV différentes) reçoivent la MÊME normale, somme des normales de face de tous
 * leurs triangles pondérées par l'aire (produit vectoriel non normalisé), normalisée.
 *
 * Les sommes se font en double précision puis s'écrivent dans un NOUVEAU tampon Float32 : les produits
 * vectoriels des faces (~1e-4, positions entières normalisées) s'arrondiraient à 0 dans l'attribut entier
 * d'origine et le modèle deviendrait noir. Le fichier GLB n'est jamais modifié ; l'attribut `normal`
 * remplacé est celui de la copie.
 */
export function smoothNormals(geometry: BufferGeometry): void {
  const position = geometry.getAttribute('position')
  if (!position) return
  const count = position.count
  const index = geometry.getIndex()

  // Groupe de sommets confondus : un indice de groupe par sommet.
  const groupOf = new Uint32Array(count)
  const groupByKey = new Map<string, number>()
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(position.getX(i) * WELD_SCALE)},${Math.round(position.getY(i) * WELD_SCALE)},${Math.round(position.getZ(i) * WELD_SCALE)}`
    let group = groupByKey.get(key)
    if (group === undefined) {
      group = groupByKey.size
      groupByKey.set(key, group)
    }
    groupOf[i] = group
  }

  // Somme, par groupe, des normales de face non normalisées (donc pondérées par l'aire).
  const sums = new Float64Array(groupByKey.size * 3)
  const triangleCount = Math.floor((index ? index.count : count) / 3)
  for (let t = 0; t < triangleCount; t++) {
    const a = index ? index.getX(t * 3) : t * 3
    const b = index ? index.getX(t * 3 + 1) : t * 3 + 1
    const c = index ? index.getX(t * 3 + 2) : t * 3 + 2
    const ax = position.getX(a)
    const ay = position.getY(a)
    const az = position.getZ(a)
    const e1x = position.getX(b) - ax
    const e1y = position.getY(b) - ay
    const e1z = position.getZ(b) - az
    const e2x = position.getX(c) - ax
    const e2y = position.getY(c) - ay
    const e2z = position.getZ(c) - az
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    const ga = groupOf[a] * 3
    const gb = groupOf[b] * 3
    const gc = groupOf[c] * 3
    sums[ga] += nx
    sums[ga + 1] += ny
    sums[ga + 2] += nz
    sums[gb] += nx
    sums[gb + 1] += ny
    sums[gb + 2] += nz
    sums[gc] += nx
    sums[gc + 1] += ny
    sums[gc + 2] += nz
  }

  // Normalisation par groupe, puis écriture identique sur chacun des sommets du groupe.
  const normals = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const base = groupOf[i] * 3
    const x = sums[base]
    const y = sums[base + 1]
    const z = sums[base + 2]
    const length = Math.hypot(x, y, z)
    if (length > 0) {
      normals[i * 3] = x / length
      normals[i * 3 + 1] = y / length
      normals[i * 3 + 2] = z / length
    } else {
      normals[i * 3 + 2] = 1 // sommet sans triangle (ou faces dégénérées) : une normale valide, jamais NaN
    }
  }
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
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
