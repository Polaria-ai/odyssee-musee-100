/** Point d'entrée du module personnages (propriétaire : agent personnages). */
export { GlbCharacter, CROSSFADE_SECONDS, type GlbCharacterProps } from './GlbCharacter'
export { CHARACTERS, CHARACTER_IDS, hasClip, type CharacterDef, type CharacterId, type ClipName, type ClipOf } from './models'
export {
  WALK_ENTER_SPEED,
  WALK_EXIT_SPEED,
  WALK_REFERENCE_SPEED,
  WALK_TIMESCALE_AT_REFERENCE,
  WALK_TIMESCALE_MAX,
  WALK_TIMESCALE_MIN,
  pickLocomotionClip,
  walkTimeScale,
  type LocomotionClip,
} from './locomotion'
