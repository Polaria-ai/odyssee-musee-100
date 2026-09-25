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
  /** Panneau sur le mur d'une aile sans aucune personne (porte fermée, cordon décoratif devant). */
  wingComingSoon: { fr: 'Bientôt', en: 'Coming soon' },
  waitingPortraitNumber: { fr: 'N° {order}', en: 'No. {order}' },
  /** Légende sous le numéro, sur la toile d'attente elle-même (silhouette + numéro). */
  waitingPortraitCaption: { fr: 'Portrait à venir', en: 'Portrait coming soon' },
  cartelUnknownOrg: { fr: 'Organisation à confirmer', en: 'Organization to be confirmed' },
  /** Cartel d'une fiche d'attente dont l'organisation a été volontairement vidée (voir `textures.ts`). */
  revealOctober6: { fr: 'À dévoiler le 6 octobre', en: 'Revealed on October 6' },
  /** Plaque du comptoir de Minerve (texture canvas, FR/EN). */
  minerveName: { fr: 'Minerve', en: 'Minerva' },
  minerveTitle: { fr: 'Conservatrice', en: 'Curator' },
})
