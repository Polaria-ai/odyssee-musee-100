/**
 * Modèles CC0 (Kenney Space Kit) de la salle des Archives : décor fixe uniquement (podium de
 * l'Archiviste, anneaux de la Porte de 2040, quelques accents). Les éléments répétés par séquence
 * (socle, capsule, écran de chaque vitrine) restent des géométries procédurales partagées — comme le
 * reste du jeu (`PortraitFrame.tsx`, `StampStations.tsx`) — pour tenir le budget mobile (≤ 150 appels
 * de dessin visibles) quel que soit le nombre de séquences (jusqu'à 24). Voir docs/assets/archives.md.
 */
export const ARCHIVES_MODELS = {
  /** Anneau lumineux de la Porte de 2040 (aller et retour). */
  portalRing: '/models/archives/pipe_ringHighEnd.glb',
  /** Antenne décorative (quelques exemplaires fixes dans la salle). */
  antenna: '/models/archives/satelliteDish.glb',
  /** Cristaux décoratifs (tiennent lieu de « plantes futuristes » : Space Kit n'a pas de flore). */
  crystals: '/models/archives/rock_crystals.glb',
} as const

export type ArchivesModelKey = keyof typeof ARCHIVES_MODELS
