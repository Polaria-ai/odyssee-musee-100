/** Textes du carnet de tampons et de la carte partageable. Propriétaire : agent avatar+tampons. */
import { defineStrings } from '../../i18n'

export const strings = defineStrings({
  title: { fr: 'Carnet de tampons', en: 'Stamp book' },
  close: { fr: 'Fermer le carnet', en: 'Close the stamp book' },
  obtained: { fr: 'Obtenu', en: 'Earned' },
  progress: { fr: '{seen}/{total} portraits', en: '{seen}/{total} portraits' },
  /** Progression du tampon Archives : unité différente (archives, pas portraits). */
  progressArchives: { fr: '{seen}/{total} archives', en: '{seen}/{total} archives' },
  /** Programme de la soirée pas encore chargé : le 4e tampon n'est pas encore jouable. */
  archivesPending: { fr: 'Bientôt', en: 'Coming soon' },
  share: { fr: 'Partager ma carte', en: 'Share my card' },
  stampToast: { fr: 'Tampon {wing} obtenu !', en: '{wing} stamp earned!' },
  shareTitle: { fr: 'Le Musée des 100', en: 'The Museum of the 100' },
  /** Ligne de la carte partageable sous les tampons (plus de pseudo : tout le monde joue Cyril). */
  shareCount: { fr: '{count}/4 tampons', en: '{count}/4 stamps' },
  shareEvent: {
    fr: 'L’Odyssée de l’IA · 6 octobre 2026 · Théâtre de la Tour Eiffel',
    en: 'The AI Odyssey · October 6, 2026 · Théâtre de la Tour Eiffel',
  },
})

/** Nom affiché de chaque aile, utilisé dans le carnet, le toast et la carte partageable. */
export const wingNames = defineStrings({
  infrastructures: { fr: 'Infrastructures', en: 'Infrastructure' },
  industrialisation: { fr: 'Industrialisation', en: 'Industrialization' },
  culture: { fr: 'Culture', en: 'Culture' },
  /** 4e tampon : pas une aile d'exposition, mais partage le même carnet et la même carte partageable. */
  archives: { fr: 'Archives de 2040', en: '2040 Archives' },
})
