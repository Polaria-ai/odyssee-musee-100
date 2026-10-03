/**
 * Préparation d'un personnage GLB pour le jeu : mise à l'échelle sur la hauteur visée, matériau mat
 * partagé, clips « sur place ». Propriétaire : agent personnages. three seul (aucun React) : testable
 * sans Canvas. Tout ce qui est calculé ici l'est UNE fois par modèle chargé (`getCharacterAssets`
 * met le résultat en cache) ; `GlbCharacter` n'y revient jamais dans `useFrame`.
 */
import {
  AnimationClip,
  AnimationMixer,
  Box3,
  MeshLambertMaterial,
  ShaderChunk,
  Sphere,
  type Material,
  type Object3D,
  type SkinnedMesh,
} from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { CharacterDef, ClipName } from './models'

/** Os racine des squelettes Meshy : sa piste de position porte le déplacement du corps entier. */
export const ROOT_BONE = 'Hips'

/**
 * Marge sur la sphère de culling. Elle est mesurée dans la pose « idle » ; un bras levé (clip
 * « wave ») sort de presque 2 × la demi-largeur de cette pose. Sans marge, un personnage en bord
 * d'écran disparaîtrait d'un coup dès que son bras sort de la sphère. Un personnage peut en demander
 * une autre (`CharacterDef.cullMargin`).
 */
export const CULLING_MARGIN = 1.6

export function findSkinnedMesh(root: Object3D): SkinnedMesh | null {
  let found: SkinnedMesh | null = null
  root.traverse((obj) => {
    if (!found && (obj as SkinnedMesh).isSkinnedMesh) found = obj as SkinnedMesh
  })
  return found
}

/**
 * Échelle et décalage vertical qui amènent une boîte englobante à `height` mètres, pieds à y = 0.
 * `box` est la boîte du personnage tel qu'il est (repère de la racine du clone) ; `scale` s'applique
 * à cette racine, `offsetY` (déjà multiplié par `scale`) est sa position y.
 */
export function fitToHeight(box: Box3, height: number): { scale: number; offsetY: number } {
  const current = box.max.y - box.min.y
  if (!(current > 1e-6) || !(height > 0)) return { scale: 1, offsetY: 0 }
  const scale = height / current
  return { scale, offsetY: -box.min.y * scale }
}

function meanComponent(values: ArrayLike<number>, component: number): number {
  let sum = 0
  let n = 0
  for (let i = component; i < values.length; i += 3) {
    sum += values[i]
    n++
  }
  return n > 0 ? sum / n : 0
}

/**
 * Copie de `clip` dont le déplacement horizontal du corps (piste `Hips.position`, axes X et Z) est
 * recalé sur celui de `reference` (le clip « idle »). Les clips Meshy sont livrés avec des décalages
 * de racine différents (mesuré : le clip « wave » de Rémi place le bassin 0,37 m à côté de celui de
 * « idle ») : sans ce recalage, chaque changement de clip ferait glisser le personnage de côté.
 * Seule la moyenne est corrigée : le balancement propre au clip est conservé. Y (rebond) est intact.
 */
export function alignRootToReference(clip: AnimationClip, reference: AnimationClip, rootBone: string = ROOT_BONE): AnimationClip {
  const trackName = `${rootBone}.position`
  const out = clip.clone()
  const own = out.tracks.find((t) => t.name === trackName)
  const ref = reference.tracks.find((t) => t.name === trackName)
  if (!own || !ref || own === ref) return out
  const dx = meanComponent(own.values, 0) - meanComponent(ref.values, 0)
  const dz = meanComponent(own.values, 2) - meanComponent(ref.values, 2)
  for (let i = 0; i < own.values.length; i += 3) {
    own.values[i] -= dx
    own.values[i + 2] -= dz
  }
  return out
}

export interface CharacterAssets {
  /** Racine de la scène source (jamais mutée) : sert de clé de cache. */
  readonly source: Object3D
  /** Matériau Lambert mat, PARTAGÉ par toutes les instances de ce personnage (jamais muté). */
  readonly material: MeshLambertMaterial
  /** Clips recalés, par nom logique (`idle`, `walk`, `wave`…). Partagés : les actions les lisent seulement. */
  readonly clips: Partial<Record<ClipName, AnimationClip>>
  /** Échelle et position y à donner à la racine d'un clone pour atteindre la hauteur visée, pieds à 0. */
  readonly scale: number
  readonly offsetY: number
  /** Sphère de culling (repère local du maillage), à cloner sur chaque instance. */
  readonly boundingSphere: Sphere
}

/** Part de la texture ajoutée en émissif : détache le personnage du décor sans le rendre fluo. */
export const CHARACTER_SELF_LIGHT = 0.35

/**
 * Biais de LOD (en niveaux de mipmap) appliqué à la texture des personnages : le GPU lit un niveau 2 fois plus
 * fin que celui que sa distance demande (WEL-930).
 *
 * Pourquoi : l'atlas Meshy d'un personnage est un patchwork de 1 100 à 2 300 îlots, de 15 à 22 texels de large en
 * moyenne sur la texture livrée (1024²). À la distance de la caméra du jeu (un personnage de ~75 px de haut sur un
 * téléphone), le GPU lit le niveau 2,2 à 2,7 de la chaîne en médiane (1,6 à 3,5 pour 80 % des pixels, mesuré) : un texel
 * de ces niveaux couvre 4 à 8 texels de l'atlas, presque la largeur d'un îlot. Il mélange la couleur du vêtement et celle
 * des îlots VOISINS DANS L'ATLAS (peau, cheveux, chemise), qui ne le sont pas sur le corps. Résultat : des « veines »
 * claires sur le manteau, le pantalon et la veste, le long des coutures.
 * Mesuré au banc d'essai (rendu du jeu comparé à la même image suréchantillonnée, qui est lisse) : la dilatation des marges
 * d'îlots ne change rien (Meshy remplit déjà le vide), le biais ramène la part de pixels éclaircis de plus de 25 niveaux de
 * 9-20 % à 2-5 %, sans scintillement de plus d'une image à l'autre. Au-delà de −2 le gain est marginal ; à moins, des veines
 * restent. Le biais ne rend jamais la texture plus floue (il ne fait que choisir un niveau plus fin) : le visage reste net.
 * Le buste de Rémi du chat a son propre matériau (`remiChat/bust/material.ts`), sans biais.
 */
export const CHARACTER_LOD_BIAS = -2

const MAP_CHUNK = '#include <map_fragment>'
const EMISSIVE_CHUNK = '#include <emissivemap_fragment>'

/** Écrit un biais de LOD à un échantillonnage `texture2D( <sampler>, <uv> )` du morceau de shader de three. */
function withBias(chunk: string, sampler: string, uv: string, bias: number): string {
  return chunk.replace(`texture2D( ${sampler}, ${uv} )`, `texture2D( ${sampler}, ${uv}, ${bias.toFixed(2)} )`)
}

/**
 * Fragment shader d'un `MeshLambertMaterial` dont les lectures de la texture de couleur (`map`) et de l'émissif
 * (`emissiveMap`) portent un biais de LOD. Sans effet (et sans erreur) si three change ses morceaux de shader : les
 * tests le détectent. Pure : testable sans WebGL.
 */
export function injectLodBias(fragmentShader: string, bias: number = CHARACTER_LOD_BIAS): string {
  return fragmentShader
    .replace(MAP_CHUNK, withBias(ShaderChunk.map_fragment, 'map', 'vMapUv', bias))
    .replace(EMISSIVE_CHUNK, withBias(ShaderChunk.emissivemap_fragment, 'emissiveMap', 'vEmissiveMapUv', bias))
}

/**
 * Donne à `material` le biais de LOD des personnages. `Material.clone()` ne copie pas `onBeforeCompile` : tout clone
 * (fondu d'opacité de `GlbCharacter`) doit repasser par ici.
 */
export function applyLodBias<M extends MeshLambertMaterial>(material: M, bias: number = CHARACTER_LOD_BIAS): M {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = injectLodBias(shader.fragmentShader, bias)
  }
  // Clé explicite : sans elle, three déduit la clé du texte de la fonction, identique pour deux biais différents.
  material.customProgramCacheKey = () => `character-lod-bias:${bias}`
  return material
}

/** Matériau mat (Lambert) portant la texture de couleur du matériau d'origine (souvent PBR brillant). */
export function makeMatteMaterial(source: Material | null | undefined): MeshLambertMaterial {
  const src = source as (Material & { map?: MeshLambertMaterial['map']; color?: MeshLambertMaterial['color'] }) | null | undefined
  // Lueur propre légère (la texture elle-même en émissif) : sur les sols bleus de la charte, la veste
  // bleue de Cyril se confondait avec le décor (contraste 1,26:1 mesuré à la revue du 29/09).
  const material = new MeshLambertMaterial({ map: src?.map ?? null, emissive: 0xffffff, emissiveMap: src?.map ?? null, emissiveIntensity: CHARACTER_SELF_LIGHT })
  if (src?.color && !src.map) material.color.copy(src.color)
  // Sans texture, rien à biaiser : le matériau garde son programme d'origine.
  return src?.map ? applyLodBias(material) : material
}

const cache = new WeakMap<Object3D, CharacterAssets>()

/**
 * Prépare (une fois par scène chargée) tout ce que les instances partagent.
 *
 * La hauteur est mesurée sur le personnage posé dans le premier instant du clip « idle », pas dans
 * la pose de liaison du fichier : les animations Meshy portent leurs propres proportions et le
 * personnage animé est ~12 % plus haut que sa pose de liaison (mesuré : 1,90 m contre 1,70 m).
 * Mesurer la pose de liaison le ferait dépasser la hauteur visée dès qu'il bouge.
 */
export function getCharacterAssets(scene: Object3D, animations: AnimationClip[], def: CharacterDef): CharacterAssets {
  const hit = cache.get(scene)
  if (hit) return hit

  const idle = AnimationClip.findByName(animations, def.clips.idle)
  if (!idle) throw new Error(`Clip « ${def.clips.idle} » introuvable dans ${def.path}`)

  const clips: Partial<Record<ClipName, AnimationClip>> = {}
  for (const [logical, fileName] of Object.entries(def.clips) as [ClipName, string][]) {
    const found = AnimationClip.findByName(animations, fileName)
    if (!found) throw new Error(`Clip « ${fileName} » introuvable dans ${def.path}`)
    clips[logical] = logical === 'idle' ? found : alignRootToReference(found, idle)
  }

  // Mesure sur un clone jetable, posé dans l'instant 0 du clip « idle ».
  const probe = cloneSkinned(scene)
  const skinned = findSkinnedMesh(probe)
  if (!skinned) throw new Error(`Aucun SkinnedMesh dans ${def.path}`)
  const mixer = new AnimationMixer(probe)
  mixer.clipAction(clips.idle!).play()
  mixer.setTime(0)
  probe.updateMatrixWorld(true)
  skinned.skeleton.update()
  skinned.computeBoundingBox()
  skinned.computeBoundingSphere()
  const box = new Box3().setFromObject(probe)
  const { scale, offsetY } = fitToHeight(box, def.height)
  const boundingSphere = skinned.boundingSphere.clone()
  boundingSphere.radius *= def.cullMargin ?? CULLING_MARGIN
  mixer.stopAllAction()
  mixer.uncacheRoot(probe)

  const assets: CharacterAssets = {
    source: scene,
    material: makeMatteMaterial(findSkinnedMesh(scene)?.material as Material | undefined),
    clips,
    scale,
    offsetY,
    boundingSphere,
  }
  cache.set(scene, assets)
  return assets
}
