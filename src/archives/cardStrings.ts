/**
 * Textes des Archives de 2040 (fiche d'archive, plan, libellés du HUD).
 * Propriétaire : workflow « Archives de 2040 » (module interface).
 *
 * Nommé `cardStrings.ts` (pas `strings.ts`) : `src/i18n/strings.test.ts` ne vérifie que les fichiers
 * `strings.ts` — les tests de ce module (`ArchiveCard.test.tsx`) couvrent donc
 * eux-mêmes la présence FR/EN des clés ci-dessous.
 */
import { defineStrings } from '../i18n'

export const cardStrings = defineStrings({
  // Bandeau et tampon de la fiche
  archiveStamp: { fr: 'ARCHIVE · 2040', en: 'ARCHIVE · 2040' },
  archiveClose: { fr: "Fermer l'archive", en: 'Close the archive' },
  archivePrev: { fr: '‹ Précédente', en: '‹ Previous' },
  archiveNext: { fr: 'Suivante ›', en: 'Next ›' },
  archivePrevLabel: { fr: 'Séquence précédente', en: 'Previous sequence' },
  archiveNextLabel: { fr: 'Séquence suivante', en: 'Next sequence' },

  // Programme
  archiveProvisional: {
    fr: "Programme provisoire, susceptible d'évoluer.",
    en: 'Provisional program, subject to change.',
  },
  archiveTime: { fr: '{time} · {duration} min', en: '{time} · {duration} min' },
  archiveSpeakersTitle: { fr: 'Intervenant·es annoncé·es', en: 'Announced speakers' },
  archiveModerator: { fr: '(modération)', en: '(moderator)' },

  // Séquences déposées par l'Archiviste
  archiveSummaryTitle: { fr: "Synthèse de l'Archiviste", en: "The Archivist's summary" },
  archiveQuotesTitle: { fr: 'Citations', en: 'Quotes' },
  archiveQuoteVerified: { fr: 'vérifiée', en: 'verified' },
  archivePendingTitle: { fr: 'Archive en cours de rédaction', en: 'Archive being written' },
  archivePendingBody: {
    fr: "L'Archiviste la déposera à la fin de la soirée.",
    en: 'The Archivist will deposit it at the end of the evening.',
  },

  // Type de séquence (pictogramme + libellé)
  archiveKindOuverture: { fr: 'Ouverture', en: 'Opening' },
  archiveKindFilm: { fr: 'Film', en: 'Film' },
  archiveKindPresentation: { fr: 'Présentation', en: 'Presentation' },
  archiveKindKeynote: { fr: 'Keynote', en: 'Keynote' },
  archiveKindLes100: { fr: 'Les 100', en: 'The 100' },
  archiveKindMagneto: { fr: 'Vidéo dataviz', en: 'Data video' },
  archiveKindTableRonde: { fr: 'Table ronde', en: 'Panel discussion' },
  archiveKindFaceAFace: { fr: 'Face à face', en: 'One-on-one' },
  archiveKindFinal: { fr: 'Final', en: 'Finale' },
  archiveKindCloture: { fr: 'Clôture', en: 'Closing' },

  // Libellés du bouton d'action du HUD (contrat : voir contractRequests, à câbler dans Hud.tsx)
  hudConsultArchive: { fr: "Consulter l'archive", en: 'Consult the archive' },
  hudTalkArchivist: { fr: "Parler à l'Archiviste", en: 'Talk to the Archivist' },

  // Rafraîchissement pendant la visite : de nouvelles archives viennent d'être publiées.
  archivesNewToast: { fr: "Nouvelles archives déposées par l'Archiviste", en: 'New archives left by the Archivist' },

  // Plan du musée : compteur de la salle des Archives (étiquette et légende)
  archivesMapCount: { fr: '{seen}/{total} archives consultées', en: '{seen}/{total} archives visited' },
})
