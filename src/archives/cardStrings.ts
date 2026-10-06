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
  archivePrevLabel: { fr: 'Table ronde précédente', en: 'Previous panel discussion' },
  archiveNextLabel: { fr: 'Table ronde suivante', en: 'Next panel discussion' },

  // Programme
  archiveProvisional: {
    fr: "Programme provisoire, susceptible d'évoluer.",
    en: 'Provisional program, subject to change.',
  },
  archiveTime: { fr: '{time} · {duration} min', en: '{time} · {duration} min' },
  archiveSpeakersTitle: { fr: 'Intervenant·es annoncé·es', en: 'Announced speakers' },
  archiveModerator: { fr: '(modération)', en: '(moderator)' },

  // Transcriptions déposées par l'Archiviste
  archiveTranscriptTitle: { fr: 'Transcription intégrale', en: 'Full transcript' },
  archivePendingTitle: { fr: 'Transcription en attente', en: 'Transcript pending' },
  archivePendingBody: {
    fr: 'La transcription de cette table ronde sera disponible après son import.',
    en: 'The transcript of this panel will be available after it is imported.',
  },

  // Bulles thématiques : l'extrait source reste celui de la transcription française.
  archiveHighlightsTitle: { fr: 'À retenir', en: 'Key takeaways' },
  archiveHighlightShowSource: { fr: 'Voir le passage source', en: 'Show the source passage' },
  archiveHighlightHideSource: { fr: 'Masquer le passage source', en: 'Hide the source passage' },
  archiveHighlightSourceTime: { fr: 'Dans l’enregistrement · {time}', en: 'In the recording · {time}' },

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
  hudConsultArchive: { fr: 'Ouvrir la vitrine', en: 'Open the display case' },
  hudTalkArchivist: { fr: "Parler à l'Archiviste", en: 'Talk to the Archivist' },

  // Rafraîchissement pendant la visite : de nouvelles transcriptions viennent d'être publiées.
  archivesNewToast: { fr: "Nouvelles transcriptions publiées par l'Archiviste", en: 'New transcripts published by the Archivist' },

  // Plan du musée : compteur de la salle des Archives (étiquette et légende)
  archivesMapCount: { fr: '{seen}/{total} archives consultées', en: '{seen}/{total} archives visited' },
})
