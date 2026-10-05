/**
 * Comportement de Rémi Godeau au comptoir : règles pures (nombres uniquement, aucun three/React),
 * testables seules. Propriétaire : agent accueil-remi.
 */

/** Délai minimal entre deux saluts (début à début), en millisecondes. */
export const WAVE_COOLDOWN_MS = 20_000

/**
 * Garde du salut : renvoie vrai (et mémorise l'instant) si le dernier salut remonte à au moins
 * `cooldownMs`, faux sinon. Le premier appel est toujours accepté. L'horloge est fournie par l'appelant
 * (`performance.now()`), jamais lue ici.
 */
export function createWaveGate(cooldownMs: number = WAVE_COOLDOWN_MS): (nowMs: number) => boolean {
  let lastWaveAt = -Infinity
  return (nowMs) => {
    if (nowMs - lastWaveAt < cooldownMs) return false
    lastWaveAt = nowMs
    return true
  }
}

/** Rotation maximale du buste vers le joueur, de part et d'autre de l'orientation de repos (radians). */
export const BODY_MAX_TURN = (40 * Math.PI) / 180
/** Vivacité du suivi du regard (par seconde) : le buste rejoint sa cible sans à-coup. */
export const BODY_TURN_RATE = 3

/** Ramène un angle dans ]-π, π]. */
export function wrapAngle(angle: number): number {
  let a = angle % (2 * Math.PI)
  if (a > Math.PI) a -= 2 * Math.PI
  else if (a <= -Math.PI) a += 2 * Math.PI
  return a
}

/**
 * Rotation (relative à `restYaw`) qui oriente un personnage vers un point, bornée à ±`maxTurn`.
 * `dx`/`dz` : vecteur du personnage vers le point, dans le repère du monde. Yaw nul = regarde vers +Z.
 * Un point confondu avec le personnage (dx = dz = 0) ne tourne pas.
 */
export function turnToward(dx: number, dz: number, restYaw: number, maxTurn: number = BODY_MAX_TURN): number {
  if (dx === 0 && dz === 0) return 0
  const turn = wrapAngle(Math.atan2(dx, dz) - restYaw)
  return turn > maxTurn ? maxTurn : turn < -maxTurn ? -maxTurn : turn
}

/** Un pas de lissage exponentiel de `current` vers `target` (`rate` par seconde, `delta` en secondes). */
export function approach(current: number, target: number, rate: number, delta: number): number {
  return current + (target - current) * Math.min(1, Math.max(0, delta) * rate)
}
