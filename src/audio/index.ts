// STUB — propriétaire : agent audio. Signatures contractuelles à conserver.
/**
 * Sons du musée, générés en WebAudio (aucun fichier audio) : musique douce en boucle,
 * « bips » de dialogue façon jeu cosy, pas, tampon, ouverture/fermeture de fiche.
 * Son COUPÉ par défaut (soirée en salle) ; l'état est persisté localement.
 */
export type SfxId = 'blip' | 'stamp' | 'complete' | 'open' | 'close' | 'click' | 'step' | 'room'

export interface SfxOptions {
  /** Hauteur relative (1 = normale), ex. pour varier les bips par personnage. */
  pitch?: number
  /** Volume relatif 0..1. */
  volume?: number
}

/** Joue un effet sonore si le son est activé. Ne lève jamais d'exception. */
export function playSfx(_id: SfxId, _opts?: SfxOptions): void {}

/** À appeler dans un gestionnaire de geste utilisateur (clic « Entrer ») pour débloquer l'audio sur iOS. */
export function unlockAudio(): void {}

/** Hook monté une fois dans App : musique d'ambiance, pas du joueur, carillon de changement de salle. */
export function useAudioDirector(_playing: boolean): void {}
