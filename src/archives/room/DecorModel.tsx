/**
 * Instance d'un modèle CC0 (Kenney Space Kit) du décor fixe de la salle, reteintée. Clone la scène
 * chargée (jamais rechargée, voir `useModel`/ASSETS.md) et remplace le matériau de chaque maille par un
 * matériau PARTAGÉ par teinte (créé une seule fois, jamais muté) : plusieurs instances de la même
 * teinte ne coûtent donc qu'un seul matériau GPU, jamais un matériau par instance.
 */
import { useMemo } from 'react'
import type { Group, Mesh } from 'three'
import { Box3, MeshLambertMaterial, Vector3 } from 'three'
import { useModel } from '../../assets/useModel'

const tintCache = new Map<string, MeshLambertMaterial>()
function tintMaterial(color: string): MeshLambertMaterial {
  let mat = tintCache.get(color)
  if (!mat) {
    mat = new MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.18 })
    tintCache.set(color, mat)
  }
  return mat
}

export function DecorModel({
  path,
  tint,
  position,
  rotation,
  scale = 1,
}: {
  path: string
  tint: string
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}) {
  const { scene } = useModel(path)
  const instance = useMemo(() => {
    const clone = scene.clone(true) as Group
    const mat = tintMaterial(tint)
    clone.traverse((obj) => {
      const mesh = obj as Mesh
      if (mesh.isMesh) mesh.material = mat
    })
    // Les modèles bruts Kenney ne sont PAS centrés sur leur origine locale (leur bbox peut être
    // décalée de plusieurs mètres, voir docs/assets/archives.md) : sans ce recentrage, `position`
    // placerait le COIN du modèle à l'endroit voulu, pas le modèle lui-même (régression constatée à la
    // vérification visuelle — l'anneau de la Porte de 2040 sortait entièrement du cadre). On centre en
    // X/Z, mais on pose la BASE (bbox.min.y) à y = 0 plutôt que de centrer verticalement, pour que le
    // modèle reste posé au sol comme les autres éléments du décor.
    const box = new Box3().setFromObject(clone)
    const center = box.getCenter(new Vector3())
    clone.position.set(-center.x, -box.min.y, -center.z)
    return clone
  }, [scene, tint])

  // `dispose={null}` : la géométrie vient du cache partagé de `useModel` et le matériau est partagé
  // par teinte (voir `tintCache`) — jamais à libérer quand cette instance démonte (StampStations.tsx
  // applique la même règle aux géométries/matériaux de module, voir sa remarque « mobile-first »).
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={instance} dispose={null} />
    </group>
  )
}
