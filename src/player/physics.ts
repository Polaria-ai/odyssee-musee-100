// STUB — propriétaire : agent joueur. Fonctions pures, testées.
import type { AABB, Vec2 } from '../types'

/** Déplace un cercle de rayon `radius` de `delta`, en glissant le long des obstacles. */
export function resolveMovement(pos: Vec2, delta: Vec2, _radius: number, _colliders: AABB[]): Vec2 {
  return { x: pos.x + delta.x, z: pos.z + delta.z }
}
