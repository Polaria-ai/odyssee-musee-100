/**
 * Clip et cadence de Cyril d'après l'état de marche et la vitesse. Propriétaire : module joueur-cyril.
 * Logique pure (ni three ni React), donc testable seule ; n'importe que `characters/locomotion`, jamais le
 * barrel `characters/index.ts` (lui précharge les GLB dès son import).
 */
import { WALK_REFERENCE_SPEED, pickLocomotionClip, walkTimeScale, type LocomotionClip } from '../characters/locomotion'

/**
 * Vitesse supposée (m/s) d'un visiteur distant qui bouge : la marche du joueur. Le réseau n'envoie que le
 * drapeau « bouge / ne bouge pas » (voir `features/presence/protocol.ts`), pas la vitesse.
 */
export const REMOTE_WALK_SPEED = WALK_REFERENCE_SPEED

/** Vitesse à transmettre à `AvatarMesh` pour un visiteur distant. */
export function remoteSpeed(moving: boolean): number {
  return moving ? REMOTE_WALK_SPEED : 0
}

/**
 * Clip et cadence de Cyril d'après `moving` et `speed` (m/s).
 *
 * `moving` prime sur `speed` : la vitesse affichée par le joueur n'est rafraîchie que lorsqu'elle bouge de
 * plus de 0,12 m/s, elle peut donc rester à 0,1 alors que le joueur est arrêté. `current` (le clip en cours)
 * active l'hystérésis de `pickLocomotionClip` : pas de clignotement idle ↔ walk autour du seuil.
 */
export function cyrilLocomotion(moving: boolean, speed: number, current: LocomotionClip): { clip: LocomotionClip; timeScale: number } {
  const effectiveSpeed = moving ? speed : 0
  const clip = pickLocomotionClip(effectiveSpeed, current)
  return { clip, timeScale: clip === 'walk' ? walkTimeScale(effectiveSpeed) : 1 }
}
