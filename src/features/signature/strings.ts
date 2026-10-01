/** Textes de la signature Polaria (titre, badge, carte de crédits, plaque 3D). Bilingue. */
import { defineStrings } from '../../i18n'

export const strings = defineStrings({
  // Mention sous le pied de l'écran titre, et kicker de la plaque du hall
  creation: { fr: 'Une création', en: 'Created by' },
  logoAlt: { fr: 'Polaria', en: 'Polaria' },
  newTab: { fr: '(nouvel onglet)', en: '(opens in a new tab)' },
  copyright: { fr: '© 2026 Polaria', en: '© 2026 Polaria' },

  // Badge en jeu
  badgeLabel: { fr: 'Crédits : une création Polaria', en: 'Credits: a Polaria creation' },

  // Carte de crédits
  cardTitle: { fr: 'Le Musée des 100 — une création Polaria', en: 'The Museum of the 100 — a Polaria creation' },
  cardCredit: {
    // Espaces insécables : la date (« 6 / octobre 2026 ») et « L'Opinion × Polaria » ne se coupent jamais sur deux lignes.
    fr: "Conçu et développé par Polaria pour L'Odyssée de l'IA (L'Opinion\u00A0×\u00A0Polaria), 6\u00A0octobre\u00A02026",
    en: "Designed and developed by Polaria for The AI Odyssey (L'Opinion\u00A0×\u00A0Polaria), October\u00A06,\u00A02026",
  },
  cardRights: { fr: '© 2026 Polaria. Tous droits réservés.', en: '© 2026 Polaria. All rights reserved.' },
  cardLink: { fr: 'polaria.ai', en: 'polaria.ai' },
  cardClose: { fr: 'Fermer', en: 'Close' },

  // Plaque du hall (texture 3D) : petit texte de site sous le logo
  plateSite: { fr: 'polaria.ai', en: 'polaria.ai' },
})
