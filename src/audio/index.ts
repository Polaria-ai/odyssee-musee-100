/**
 * Sons du musée, générés en WebAudio (aucun fichier audio) : musique douce en boucle,
 * « bips » de dialogue façon jeu cosy, pas, tampon, ouverture/fermeture de fiche.
 * Son COUPÉ par défaut (soirée en salle) ; l'état est persisté localement.
 *
 * Contrat (signatures figées) : `SfxId`, `SfxOptions`, `playSfx`, `unlockAudio`, `useAudioDirector`.
 * `SoundToggle` vit dans son propre fichier (`./SoundToggle`), ré-exporté ici par confort.
 */
export type { SfxId, SfxOptions } from './types'
export { playSfx } from './sfx'
export { unlockAudio } from './engine'
export { useAudioDirector } from './director'
export { SoundToggle } from './SoundToggle'
