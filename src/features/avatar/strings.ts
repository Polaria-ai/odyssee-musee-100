/** Textes de l'écran « Qui es-tu ? » et libellés des tenues/accessoires. Propriétaire : agent avatar+tampons. */
import { defineStrings } from '../../i18n'

export const strings = defineStrings({
  title: { fr: 'Qui es-tu ?', en: 'Who are you?' },
  nameLabel: { fr: 'Pseudo', en: 'Nickname' },
  namePlaceholder: { fr: 'Ton pseudo (facultatif)', en: 'Your nickname (optional)' },
  skinToneLabel: { fr: 'Teint', en: 'Skin tone' },
  hairColorLabel: { fr: 'Cheveux', en: 'Hair' },
  outfitLabel: { fr: 'Tenue', en: 'Outfit' },
  outfitColorLabel: { fr: 'Couleur de la tenue', en: 'Outfit color' },
  accessoryLabel: { fr: 'Accessoire', en: 'Accessory' },
  random: { fr: 'Au hasard', en: 'Randomize' },
  done: { fr: 'C’est parti !', en: 'Let’s go!' },
  defaultVisitor: { fr: 'Visiteur {n}', en: 'Visitor {n}' },
})

/** Libellés bilingues des tenues, clés = `OutfitId`. */
export const outfitLabels = defineStrings({
  tee: { fr: 'T-shirt', en: 'T-shirt' },
  hoodie: { fr: 'Sweat à capuche', en: 'Hoodie' },
  dress: { fr: 'Robe', en: 'Dress' },
  suit: { fr: 'Costume', en: 'Suit' },
  overalls: { fr: 'Salopette', en: 'Overalls' },
})

/** Libellés bilingues des accessoires, clés = `AccessoryId`. */
export const accessoryLabels = defineStrings({
  none: { fr: 'Aucun', en: 'None' },
  glasses: { fr: 'Lunettes', en: 'Glasses' },
  beret: { fr: 'Béret', en: 'Beret' },
  headphones: { fr: 'Casque audio', en: 'Headphones' },
  flower: { fr: 'Fleur', en: 'Flower' },
  cap: { fr: 'Casquette', en: 'Cap' },
})
