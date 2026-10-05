/**
 * Textes de la salle des Archives de 2040 (galerie, vitrines, panneau d'entrée). Propriétaire : workflow
 * « Archives de 2040 » (module salle 3D, WEL-881). Section « salle » : d'autres phases (fiche
 * d'archive, dialogue de l'Archiviste) ajoutent leurs propres tables dans ce même fichier plus tard —
 * ne pas retirer les clés ci-dessous, en ajouter au besoin.
 */
import { defineStrings } from '../i18n'

export const archivesRoomStrings = defineStrings({
  roomLabel: { fr: 'Les Archives de 2040', en: 'The 2040 Archives' },
  /** Version courte pour la pastille du HUD et le plan (390 px de large en portrait). */
  roomShortLabel: { fr: 'Archives de 2040', en: '2040 Archives' },
  // Sous-titre du grand panneau d'entrée (room/textures.ts::drawEntranceSign) : date de la soirée,
  // pas une donnée personnelle — voir docs/DESIGN.md pour le nom de l'événement.
  eveningDate: { fr: 'Soirée du 6 octobre 2026', en: 'Evening of October 6, 2026' },
  // Bandeau rappelant que le programme n'est pas confirmé (sur le panneau d'entrée, juste après la porte).
  provisionalBanner: { fr: 'Programme au 24 septembre, susceptible d’évoluer', en: 'Programme as of 24 September, subject to change' },
})

/** Libellé bilingue de chaque type de séquence, sous le pictogramme d'une vitrine. */
export const sessionKindLabels = defineStrings({
  ouverture: { fr: 'Ouverture', en: 'Opening' },
  film: { fr: 'Film', en: 'Film' },
  presentation: { fr: 'Présentation', en: 'Presentation' },
  keynote: { fr: 'Keynote', en: 'Keynote' },
  les100: { fr: 'Les 100', en: 'The 100' },
  magneto: { fr: 'Dataviz', en: 'Data viz' },
  'table-ronde': { fr: 'Table ronde', en: 'Panel' },
  'face-a-face': { fr: 'Face à face', en: 'Face to face' },
  final: { fr: 'Final', en: 'Finale' },
  cloture: { fr: 'Clôture', en: 'Closing' },
})
