/**
 * Textes visibles du musée (salles, bannière, portraits d'attente, cartels).
 * `layout.ts` reste pur : il pioche directement dans ces tables bilingues sans choisir de langue.
 * Les textures canvas choisissent la langue courante via `pick`/`usePick` (src/i18n).
 */
import { defineStrings } from '../i18n'

export const roomLabels = defineStrings({
  hall: { fr: 'Grand hall', en: 'Great hall' },
  infrastructures: { fr: 'Infrastructures', en: 'Infrastructures' },
  industrialisation: { fr: 'Industrialisation', en: 'Industrialization' },
  culture: { fr: 'Culture', en: 'Culture' },
})

export const worldStrings = defineStrings({
  bannerTitle: { fr: 'Le Musée des 100', en: 'The Museum of the 100' },
  bannerSubtitle: { fr: "L'Odyssée de l'IA", en: 'The AI Odyssey' },
  wingComingSoon: { fr: 'Bientôt', en: 'Coming soon' },
  waitingPortraitNumber: { fr: 'N° {order}', en: 'No. {order}' },
  waitingPortraitCaption: { fr: 'Portrait à venir', en: 'Portrait coming soon' },
  cartelUnknownOrg: { fr: 'Organisation à confirmer', en: 'Organization to be confirmed' },
})
