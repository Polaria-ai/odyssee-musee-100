/**
 * Hooks React des sols texturés (WEL-923) : fabriquent les matériaux, y branchent les cartes quand elles sont
 * chargées (jamais bloquant, voir `floorTextures.ts`) et libèrent tout au démontage.
 */
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { MeshLambertMaterial, Texture } from 'three'
import { FLOOR_KINDS, type FloorKind } from './floorSpec'
import { bindFloorTextures, createFloorMaterial, floorAnisotropy, isCoarsePointer } from './floorTextures'

function useAnisotropy(): number {
  const gl = useThree((s) => s.gl)
  return useMemo(() => floorAnisotropy(gl.capabilities.getMaxAnisotropy(), isCoarsePointer()), [gl])
}

/** Un matériau par matière (partagé par toutes les salles de cette matière : un seul programme, aucune texture en double). */
export function useFloorMaterials(): Record<FloorKind, MeshLambertMaterial> {
  const anisotropy = useAnisotropy()
  const materials = useMemo(() => Object.fromEntries(FLOOR_KINDS.map((kind) => [kind, createFloorMaterial()])) as Record<FloorKind, MeshLambertMaterial>, [])
  useEffect(() => {
    const unbind = FLOOR_KINDS.map((kind) => bindFloorTextures(materials[kind], kind, anisotropy))
    return () => {
      unbind.forEach((fn) => fn())
      FLOOR_KINDS.forEach((kind) => materials[kind].dispose())
    }
  }, [materials, anisotropy])
  return materials
}

/**
 * Matériau d'un sol qui a déjà sa propre texture (la frise peinte des Archives, `baseMap`) : la matière se
 * multiplie par-dessus, avec les UV monde de la géométrie.
 */
export function useFloorMaterialOver(kind: FloorKind, baseMap: Texture): MeshLambertMaterial {
  const anisotropy = useAnisotropy()
  const material = useMemo(() => {
    const m = createFloorMaterial(false) // la couleur vient de la frise peinte, pas des sommets
    m.map = baseMap
    return m
  }, [baseMap])
  useEffect(() => {
    const unbind = bindFloorTextures(material, kind, anisotropy, true)
    return () => {
      unbind()
      material.dispose()
    }
  }, [material, kind, anisotropy])
  return material
}
