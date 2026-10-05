/**
 * Géométrie 2D pure (plan XZ) partagée par le plan du musée, ses tests et le joueur.
 * Propriétaire : agent monde.
 */
import type { AABB, Vec2 } from '../types'

export function aabb(minX: number, maxX: number, minZ: number, maxZ: number): AABB {
  return { minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX), minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ) }
}

/** Mur orienté est-ouest (plan XZ), centré sur `z`, entre `x0` et `x1`. */
export function xWall(z: number, x0: number, x1: number, thickness: number): AABB {
  return aabb(x0, x1, z - thickness / 2, z + thickness / 2)
}

/** Mur orienté nord-sud (plan XZ), centré sur `x`, entre `z0` et `z1`. */
export function zWall(x: number, z0: number, z1: number, thickness: number): AABB {
  return aabb(x - thickness / 2, x + thickness / 2, z0, z1)
}

export function pointInAabb(p: Vec2, box: AABB, margin = 0): boolean {
  return p.x >= box.minX - margin && p.x <= box.maxX + margin && p.z >= box.minZ - margin && p.z <= box.maxZ + margin
}

/** Vrai si un cercle (centre `p`, rayon `radius`) recoupe `box`. */
export function circleIntersectsAabb(p: Vec2, radius: number, box: AABB): boolean {
  const closestX = Math.max(box.minX, Math.min(p.x, box.maxX))
  const closestZ = Math.max(box.minZ, Math.min(p.z, box.maxZ))
  const dx = p.x - closestX
  const dz = p.z - closestZ
  return dx * dx + dz * dz < radius * radius
}

export function aabbUnion(boxes: AABB[]): AABB {
  return boxes.reduce(
    (acc, b) => aabb(Math.min(acc.minX, b.minX), Math.max(acc.maxX, b.maxX), Math.min(acc.minZ, b.minZ), Math.max(acc.maxZ, b.maxZ)),
    boxes[0] ?? aabb(0, 0, 0, 0),
  )
}

/** Vecteur unité (dans le plan XZ) vers lequel un objet tourné de `rotationY` regarde (convention : 0 = +Z). */
export function facingFromRotationY(rotationY: number): Vec2 {
  return { x: Math.sin(rotationY), z: Math.cos(rotationY) }
}
