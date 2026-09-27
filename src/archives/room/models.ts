/**
 * Modèles CC0 (Kenney Space Kit) de la salle des Archives : décor fixe uniquement (quelques
 * accents). Les éléments répétés par séquence
 * (socle, capsule, écran de chaque vitrine) restent des géométries procédurales partagées — comme le
 * reste du jeu (`PortraitFrame.tsx`, `StampStations.tsx`) — pour tenir le budget mobile (≤ 150 appels
 * de dessin visibles) quel que soit le nombre de séquences (jusqu'à 24). Voir docs/assets/archives.md.
 */
export const ARCHIVES_MODELS = {
  /** Antenne décorative (quelques exemplaires fixes dans la salle). */
  antenna: '/models/archives/satelliteDish.glb',
  /** Cristaux décoratifs (tiennent lieu de « plantes futuristes » : Space Kit n'a pas de flore). */
  crystals: '/models/archives/rock_crystals.glb',
} as const

export type ArchivesModelKey = keyof typeof ARCHIVES_MODELS
