/** Textes de l'interface (surimpressions DOM). Propriétaire : agent interface. */
import { defineStrings } from '../i18n'

export const strings = defineStrings({
  // Écran titre
  titleEyebrow: { fr: "L'Odyssée de l'IA · 2026", en: 'The AI Odyssey · 2026' },
  titleHeading: { fr: 'Le Musée des 100', en: 'The Museum of the 100' },
  titleSubtitle: { fr: "Les 100 qui font l'IA en Europe", en: 'The 100 people shaping AI in Europe' },
  titleEnter: { fr: 'Entrer au musée', en: 'Enter the museum' },
  titleFooter: {
    fr: "L'Opinion × Polaria · d'après l'étude Oliver Wyman",
    en: 'L’Opinion × Polaria · based on the Oliver Wyman study',
  },
  titlePlaceholderBanner: {
    fr: 'Aperçu : la liste officielle sera dévoilée le 6 octobre',
    en: 'Preview: the official list will be revealed on October 6',
  },
  langSwitch: { fr: 'Changer de langue', en: 'Switch language' },

  // Écran de chargement
  loadingText: { fr: 'Ouverture du musée…', en: 'Opening the museum…' },

  // HUD
  hudLook: { fr: 'Regarder {name}', en: 'Look at {name}' },
  hudTalkCurator: { fr: 'Parler à Minerve', en: 'Talk to Minerva' },
  hudStamps: { fr: 'Carnet de tampons', en: 'Stamp card' },
  hudStampsCount: { fr: '{n}/{total}', en: '{n}/{total}' },
  hudPeers: { fr: '{n} visiteurs en ligne', en: '{n} visitors online' },
  hudPeersOne: { fr: '1 autre visiteur en ligne', en: '1 other visitor online' },

  // Fiche portrait
  portraitClose: { fr: 'Fermer la fiche', en: 'Close the card' },
  portraitPrev: { fr: '‹ Précédent', en: '‹ Previous' },
  portraitNext: { fr: 'Suivant ›', en: 'Next ›' },
  portraitWaiting: { fr: "Fiche d'attente", en: 'Placeholder card' },
  portraitCredit: { fr: 'Photo : {credit}', en: 'Photo: {credit}' },
  /** Organisation d'une fiche d'attente (`person.placeholder && !person.organization`) : voir `organizationLabel` (format.ts). */
  portraitOrgPending: { fr: 'À dévoiler le 6 octobre', en: 'Revealed on October 6' },

  // Dialogue
  dialogueSkip: { fr: 'Passer', en: 'Skip' },

  // Plan du musée
  mapButton: { fr: 'Plan', en: 'Map' },
  mapTitle: { fr: 'Plan du musée', en: 'Museum map' },
  mapClose: { fr: 'Fermer le plan', en: 'Close the map' },
  mapWingCount: { fr: '{seen}/{total} vus', en: '{seen}/{total} seen' },
  mapYou: { fr: 'Toi', en: 'You' },

  // Aide au premier pas
  coachTouch: { fr: 'Glisse ton pouce pour marcher', en: 'Slide your thumb to walk' },
  coachKeys: { fr: 'Flèches ou ZQSD pour marcher', en: 'Arrows or WASD to walk' },
})
