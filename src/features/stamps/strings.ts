/** Textes du carnet de tampons et de la carte partageable. Propriétaire : agent avatar+tampons. */
import { defineStrings } from '../../i18n'

export const strings = defineStrings({
  title: { fr: 'Carnet de tampons', en: 'Stamp book' },
  close: { fr: 'Fermer le carnet', en: 'Close the stamp book' },
  obtained: { fr: 'Obtenu', en: 'Earned' },
  progress: { fr: '{seen}/{total} portraits', en: '{seen}/{total} portraits' },
  share: { fr: 'Partager ma carte', en: 'Share my card' },
  stampToast: { fr: 'Tampon {wing} obtenu !', en: '{wing} stamp earned!' },
  shareTitle: { fr: 'Le Musée des 100', en: 'The Museum of the 100' },
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
})
