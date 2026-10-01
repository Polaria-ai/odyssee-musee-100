/**
 * Chargement et matériaux des sols texturés (WEL-923). Propriétaire : agent monde.
 *
 * - Les cartes (détail + normales, voir `floorSpec.ts`) sont chargées UNE seule fois par matière
 *   (`acquireFloorTextures`, compté par références) et libérées quand plus personne ne s'en sert.
 * - Le chargement ne bloque jamais l'entrée au musée : le sol commence uni (couleurs de sommet de la charte,
 *   exactement l'ancien rendu), puis la matière apparaît quand les cartes sont là. Si une carte échoue
 *   (réseau, fichier absent, décodage), le sol reste uni, sans erreur.
 * - Le matériau reste un `MeshLambertMaterial` à couleurs de sommet : le modèle de couleur de la charte
 *   (docs/CHARTE-3D.md §1) repose sur lui. La carte de détail multiplie la couleur de sommet ; le gain
 *   `1 / detailMean` du matériau garde la couleur MOYENNE du sol égale à celle de la charte.
 */
import { LinearFilter, LinearMipmapLinearFilter, MeshLambertMaterial, NoColorSpace, RepeatWrapping, Texture, TextureLoader } from 'three'
import type { WebGLProgramParametersWithUniforms } from 'three'
import { FLOOR_SPECS, type FloorKind } from './floorSpec'

export interface FloorTextureSet {
  detail: Texture
  normal: Texture
}

interface CacheEntry {
  refs: number
  promise: Promise<FloorTextureSet | null>
  value: FloorTextureSet | null
}

const cache = new Map<FloorKind, CacheEntry>()

/** Nombre de matières actuellement en cache (tests). */
export function floorTextureCacheSize(): number {
  return cache.size
}

/**
 * Anisotropie à demander : la caméra voit le sol en rasant (48° de plongée), sans elle les motifs fins se
 * délavent au loin. Plafonnée à 4 sur écran tactile (téléphone : coût mémoire/bande passante), à 8 ailleurs.
 */
export function floorAnisotropy(maxSupported: number, coarsePointer: boolean): number {
  return Math.max(1, Math.min(maxSupported, coarsePointer ? 4 : 8))
}

export function isCoarsePointer(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

function configure(texture: Texture, anisotropy: number): Texture {
  // Données, pas couleurs : le détail est un coefficient de réflectance linéaire, la normale un vecteur.
  texture.colorSpace = NoColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.generateMipmaps = true
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = anisotropy
  return texture
}

async function loadSet(kind: FloorKind, anisotropy: number): Promise<FloorTextureSet | null> {
  const spec = FLOOR_SPECS[kind]
  const loader = new TextureLoader()
  try {
    const [detail, normal] = await Promise.all([loader.loadAsync(spec.detailUrl), loader.loadAsync(spec.normalUrl)])
    return { detail: configure(detail, anisotropy), normal: configure(normal, anisotropy) }
  } catch {
    return null // sol uni : pas d'erreur
  }
}

function disposeSet(set: FloorTextureSet | null): void {
  set?.detail.dispose()
  set?.normal.dispose()
}

/** Charge (ou réutilise) les cartes d'une matière. Chaque appel DOIT être suivi d'un `releaseFloorTextures(kind)`. */
export function acquireFloorTextures(kind: FloorKind, anisotropy: number): Promise<FloorTextureSet | null> {
  let entry = cache.get(kind)
  if (!entry) {
    const created: CacheEntry = { refs: 0, value: null, promise: Promise.resolve(null) }
    created.promise = loadSet(kind, anisotropy).then((set) => {
      if (cache.get(kind) !== created) {
        // Tout le monde est parti pendant le chargement : on libère aussitôt.
        disposeSet(set)
        return null
      }
      created.value = set
      return set
    })
    cache.set(kind, created)
    entry = created
  }
  entry.refs++
  return entry.promise
}

export function releaseFloorTextures(kind: FloorKind): void {
  const entry = cache.get(kind)
  if (!entry) return
  entry.refs--
  if (entry.refs > 0) return
  cache.delete(kind)
  disposeSet(entry.value)
}

/** Sol uni : couleurs de sommet seules, éclairage Lambert (l'ancien rendu, et le repli si une carte manque). */
export function createFloorMaterial(vertexColors = true): MeshLambertMaterial {
  return new MeshLambertMaterial({ vertexColors })
}

const DETAIL_VERTEX_HEAD = 'varying vec2 vDetailUv;'
const DETAIL_FRAGMENT_HEAD = 'varying vec2 vDetailUv;\nuniform sampler2D detailMap;'

/**
 * Pour un sol qui porte déjà sa propre `map` (la frise peinte des Archives) : la carte de détail ne peut pas
 * prendre la place de `map`, on la multiplie donc dans le fragment, avec les UV monde de la géométrie. N'est
 * installé qu'une fois la carte chargée (un échantillonneur sans texture lirait du noir).
 */
function installDetailMultiply(material: MeshLambertMaterial, detail: Texture): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.detailMap = { value: detail }
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${DETAIL_VERTEX_HEAD}`).replace('#include <begin_vertex>', '#include <begin_vertex>\nvDetailUv = uv;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${DETAIL_FRAGMENT_HEAD}`).replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= texture2D(detailMap, vDetailUv).rgb;')
  }
  material.customProgramCacheKey = () => 'floor-detail-multiply'
}

function applySet(material: MeshLambertMaterial, kind: FloorKind, set: FloorTextureSet, keepMap: boolean): void {
  const spec = FLOOR_SPECS[kind]
  if (keepMap) installDetailMultiply(material, set.detail)
  else material.map = set.detail
  material.normalMap = set.normal
  material.normalScale.set(spec.normalScale, spec.normalScale)
  material.color.setScalar(1 / spec.detailMean)
  material.needsUpdate = true
}

function resetMaterial(material: MeshLambertMaterial, keepMap: boolean): void {
  if (!keepMap) material.map = null
  material.normalMap = null
  material.color.setScalar(1)
  if (keepMap) {
    // Retire les surcharges posées par `installDetailMultiply` : on retrouve les méthodes du prototype.
    Reflect.deleteProperty(material, 'onBeforeCompile')
    Reflect.deleteProperty(material, 'customProgramCacheKey')
  }
  material.needsUpdate = true
}

/**
 * Branche les cartes de `kind` sur `material` dès qu'elles sont chargées. Renvoie la fonction de nettoyage
 * (à appeler au démontage) : annule un chargement en cours, remet le sol uni et libère les cartes.
 * `keepMap` : le matériau a déjà une `map` (frise des Archives), le détail se multiplie par-dessus.
 */
export function bindFloorTextures(material: MeshLambertMaterial, kind: FloorKind, anisotropy: number, keepMap = false): () => void {
  let cancelled = false
  void acquireFloorTextures(kind, anisotropy).then((set) => {
    if (!cancelled && set) applySet(material, kind, set, keepMap)
  })
  return () => {
    cancelled = true
    resetMaterial(material, keepMap)
    releaseFloorTextures(kind)
  }
}
