// Propriétaire : agent joueur. Fonctions pures, testées (pas de dépendance three.js ici).
import type { AABB, Vec2 } from '../types'

const EPSILON = 1e-6
const EPSILON_SQ = EPSILON * EPSILON
const TAU = Math.PI * 2

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

/** Le centre du cercle est déjà dans le rectangle (ou pile sur son bord) : pousse vers le bord le plus proche. */
function pushFromInside(pos: Vec2, box: AABB, radius: number): Vec2 {
  const toLeft = pos.x - box.minX
  const toRight = box.maxX - pos.x
  const toNear = pos.z - box.minZ
  const toFar = box.maxZ - pos.z
  const min = Math.min(toLeft, toRight, toNear, toFar)
  if (min === toLeft) return { x: box.minX - radius, z: pos.z }
  if (min === toRight) return { x: box.maxX + radius, z: pos.z }
  if (min === toNear) return { x: pos.x, z: box.minZ - radius }
  return { x: pos.x, z: box.maxZ + radius }
}

/**
 * Repousse un cercle (centre `pos`, rayon `radius`) hors de tous les obstacles qui le pénètrent.
 * Plusieurs passes : un coin formé par deux obstacles peut demander plus d'une correction.
 */
function depenetrate(pos: Vec2, radius: number, colliders: readonly AABB[], iterations: number): Vec2 {
  let x = pos.x
  let z = pos.z
  for (let iter = 0; iter < iterations; iter++) {
    let corrected = false
    for (const box of colliders) {
      const closestX = clamp(x, box.minX, box.maxX)
      const closestZ = clamp(z, box.minZ, box.maxZ)
      const dx = x - closestX
      const dz = z - closestZ
      const distSq = dx * dx + dz * dz
      if (distSq >= radius * radius) continue
      if (distSq > EPSILON_SQ) {
        const dist = Math.sqrt(distSq)
        const push = (radius - dist) / dist
        x += dx * push
        z += dz * push
      } else {
        const out = pushFromInside({ x, z }, box, radius)
        x = out.x
        z = out.z
      }
      corrected = true
    }
    if (!corrected) break
  }
  return { x, z }
}

/**
 * Déplace un cercle (position `pos`, rayon `radius`) de `delta`, en glissant le long des obstacles
 * (`colliders`, des AABB) sans jamais les traverser. Le déplacement est découpé en sous-pas d'au plus
 * `radius / 2` pour rester correct même à grande vitesse (ex. 60 m/s à 60 i/s ≈ 1 m par image).
 */
export function resolveMovement(pos: Vec2, delta: Vec2, radius: number, colliders: readonly AABB[]): Vec2 {
  const distance = Math.hypot(delta.x, delta.z)
  if (distance <= EPSILON) return { x: pos.x, z: pos.z }
  if (colliders.length === 0) return { x: pos.x + delta.x, z: pos.z + delta.z }

  const maxStep = Math.max(radius / 2, EPSILON)
  const steps = Math.max(1, Math.ceil(distance / maxStep))
  const stepX = delta.x / steps
  const stepZ = delta.z / steps

  let x = pos.x
  let z = pos.z
  for (let i = 0; i < steps; i++) {
    x += stepX
    z += stepZ
    ;({ x, z } = depenetrate({ x, z }, radius, colliders, 2))
  }
  return { x, z }
}

/**
 * Si le joueur est téléporté (apparition, remise en jeu) et se retrouve dans un obstacle,
 * le repousse jusqu'à son bord. Sans effet si `pos` n'est dans aucun collider.
 */
export function escapeCollider(pos: Vec2, radius: number, colliders: readonly AABB[]): Vec2 {
  if (colliders.length === 0) return { x: pos.x, z: pos.z }
  return depenetrate(pos, radius, colliders, 4)
}

/**
 * Convertit une entrée normalisée (joystick ou clavier, repère écran) en direction monde unitaire.
 * La caméra du musée est fixe et regarde toujours vers -Z : moveX → +x, moveY → +z.
 * Retourne le vecteur nul si l'entrée est nulle (pas de division par zéro).
 */
export function inputToWorldDirection(moveX: number, moveY: number): Vec2 {
  const length = Math.hypot(moveX, moveY)
  if (length <= EPSILON) return { x: 0, z: 0 }
  return { x: moveX / length, z: moveY / length }
}

function wrapAngle(angle: number): number {
  let a = angle % TAU
  if (a > Math.PI) a -= TAU
  if (a < -Math.PI) a += TAU
  return a
}

/** Différence angulaire signée de `from` vers `to`, par le plus court chemin, dans [-π, π]. */
export function shortestAngleDelta(from: number, to: number): number {
  return wrapAngle(to - from)
}

/**
 * Interpole un angle de `current` vers `target` par le plus court chemin (jamais par le grand tour).
 * `t` ∈ [0, 1], typiquement `1 - Math.exp(-rate * delta)` pour un amortissement indépendant du framerate.
 */
export function smoothAngle(current: number, target: number, t: number): number {
  return wrapAngle(current + shortestAngleDelta(current, target) * clamp01(t))
}
