/**
 * Décompose une scène GLTF (chargée par `useModel`, JAMAIS mutée) en géométries/matériaux prêts pour
 * `<Instances>` (drei) : une géométrie par matériau d'origine du modèle, recentrée et mise à l'échelle
 * UNE seule fois (résultat mis en cache par `(url, teinte, gabarit)`), matériau cloné et teinté une
 * seule fois (jamais par image, jamais en modifiant un matériau partagé avec un autre objet — voir
 * `docs/assets/props.md`).
 */
import { Box3, BufferAttribute, BufferGeometry, Material, Mesh, Object3D, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface PropPart {
  geometry: BufferGeometry
  material: Material
}

/** Comment mettre le modèle brut à l'échelle du musée (unité : mètre). */
export type PropFit = { mode: 'height'; target: number } | { mode: 'footprint'; target: number } | { mode: 'none' }

const materialCache = new Map<string, Material>()

/** Clone + teinte un matériau une seule fois (cache par matériau d'origine + couleur cible). Ne touche jamais `base`. */
function tintedMaterial(base: Material, hex: string | null): Material {
  if (!hex) return base
  const key = `${base.uuid}:${hex}`
  const cached = materialCache.get(key)
  if (cached) return cached
  const clone = base.clone()
  const colorable = clone as unknown as { color?: { set: (h: string) => void } }
  colorable.color?.set(hex)
  materialCache.set(key, clone)
  return clone
}

const partsCache = new Map<string, PropPart[]>()

function fitFactor(size: Vector3, fit: PropFit): number {
  if (fit.mode === 'none') return 1
  const base = fit.mode === 'height' ? size.y : Math.max(size.x, size.z)
  return base > 1e-6 ? fit.target / base : 1
}

/** Ne jamais teinter les vitres/hublots : `.color` sur un verre transparent rend le rendu terne. */
const NEVER_TINT = /glass/i

/**
 * Les modèles optimisés (`scripts/optimize-assets.mjs`, meshopt + `KHR_mesh_quantization`) stockent
 * position/normale en entiers NORMALISÉS (ex. Int16 signé, décodés ÷32767 à la lecture) : le noeud GLTF
 * porte alors une transform de « déquantification » (translation/échelle du noeud, pour ramener [-1,1]
 * à la vraie bbox du modèle — ex. colonne : translation 1,2 m, échelle ×1,2) qui n'est PAS censée être
 * réappliquée au buffer normalisé lui-même. `BufferGeometry.applyMatrix4` réécrit pourtant le résultat
 * DANS ce même buffer (`BufferAttribute.setXYZ`, qui réencode en supposant une entrée déjà dans [-1,1]) :
 * une position hors de cette plage (n'importe quel monde de coordonnées, ex. y = 2,4 m) boucle sur
 * l'espace Int16 (wrap, jamais d'erreur) — bug constaté : colonne rendue à ≈0,67 m de haut au lieu des
 * 4 m visés, silencieusement repliée. Convertir position/normale en Float32 NON normalisé avant toute
 * transformation matricielle élimine le risque, quel que soit le modèle (no-op sur un attribut déjà en
 * virgule flottante).
 */
function dequantizeGeometry(geo: BufferGeometry): void {
  for (const name of ['position', 'normal'] as const) {
    const attr = geo.getAttribute(name) as BufferAttribute | undefined
    if (!attr?.normalized) continue
    const itemSize = attr.itemSize
    const arr = new Float32Array(attr.count * itemSize)
    for (let i = 0; i < attr.count; i++) {
      for (let c = 0; c < itemSize; c++) arr[i * itemSize + c] = attr.getComponent(i, c)
    }
    geo.setAttribute(name, new BufferAttribute(arr, itemSize, false))
  }
}

/**
 * `cacheKey` : identifiant stable du modèle (son URL suffit, la scène ne change jamais pour une URL
 * donnée — cache de `useGLTF`). `tintVariant` : nom court de la teinte (juste pour la clé de cache —
 * `tintFor` n'est pas sérialisable). `tintFor(materialName)` : couleur cible pour CE matériau du
 * modèle (`null` = garde sa couleur d'origine) — un modèle a souvent plusieurs matériaux (ex. pot +
 * feuillage d'une jardinière) qui ne doivent pas tous recevoir la même teinte.
 */
export function propParts(scene: Object3D, cacheKey: string, tintVariant: string, tintFor: (materialName: string) => string | null, fit: PropFit): PropPart[] {
  const key = `${cacheKey}:${tintVariant}:${fit.mode}:${fit.mode === 'none' ? '' : fit.target}`
  const cached = partsCache.get(key)
  if (cached) return cached

  scene.updateWorldMatrix(true, true)
  const box = new Box3().setFromObject(scene)
  const size = new Vector3()
  const center = new Vector3()
  box.getSize(size)
  box.getCenter(center)
  const scale = fitFactor(size, fit)
  // Recentre XZ sur l'origine, pose la base (bboxMin.y) au sol : appliqué UNE fois à la géométrie
  // (jamais par instance), avant la mise à l'échelle finale (mêmes coordonnées locales pour tous les
  // <Instance>, quel que soit leur placement dans le monde).
  const offsetX = -center.x
  const offsetY = -box.min.y
  const offsetZ = -center.z

  const byMaterial = new Map<Material, BufferGeometry[]>()
  scene.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material
    const geo = mesh.geometry.clone()
    dequantizeGeometry(geo) // voir le commentaire de `dequantizeGeometry` : avant `applyMatrix4`, jamais après
    geo.applyMatrix4(mesh.matrixWorld)
    geo.translate(offsetX, offsetY, offsetZ)
    geo.scale(scale, scale, scale)
    const list = byMaterial.get(material) ?? []
    list.push(geo)
    byMaterial.set(material, list)
  })

  const parts: PropPart[] = []
  for (const [material, geos] of byMaterial) {
    let merged: BufferGeometry
    if (geos.length > 1) {
      try {
        merged = mergeGeometries(geos, false) ?? geos[0]
      } catch {
        merged = geos[0] // secours : garde au moins la première géométrie plutôt que de planter
      }
    } else {
      merged = geos[0]
    }
    const hex = NEVER_TINT.test(material.name) ? null : tintFor(material.name)
    parts.push({ geometry: merged, material: tintedMaterial(material, hex) })
  }
  partsCache.set(key, parts)
  return parts
}
