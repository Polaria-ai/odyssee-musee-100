/**
 * Recoloration par variante : associe chaque matériau d'origine d'un modèle Kenney (voir les noms
 * relevés avec `gltf-transform inspect`, consignés dans `docs/assets/props.md`) à une couleur de la
 * palette du musée (`src/styles/tokens.ts`). `null` = garde la couleur/texture d'origine (jamais de
 * teinte sur les vitres, déjà exclues dans `geometry.ts`).
 */
import { palette, wingThemes } from '../../styles/tokens'

type TintFn = (materialName: string) => string | null

const infra = wingThemes.infrastructures.accent
const indus = wingThemes.industrialisation.accent
const culture = wingThemes.culture.accent

export const TINTS: Record<string, TintFn> = {
  // Colonnes (Building Kit, matériau `colormap`) : pierre chaude, cohérente avec le bois du hall.
  stone: (name) => (name === 'colormap' ? palette.wood : null),

  // Mobilier bois (bancs, table d'appoint, bibliothèques, établi…) : matériaux `wood`/`woodDark`
  // d'origine déjà cohérents, `metal` (quincaillerie) rabattu vers le bois foncé.
  wood: (name) => {
    if (name === 'woodDark' || name === 'metal') return palette.woodDark
    if (name === 'wood' || name === '_defaultMat') return palette.wood
    return null
  },

  // Jardinières (pot `wood`/`woodDark` + feuillage `plant`).
  planter: (name) => {
    if (name === 'plant') return palette.leaf
    if (name === 'woodDark') return palette.woodDark
    if (name === 'wood') return palette.wood
    return null
  },

  // Lampadaire/applique (Furniture Kit, `metal` + `lamp`).
  lamp: (name) => {
    if (name === 'metal') return palette.woodDark
    if (name === 'lamp') return palette.gold
    return null
  },

  // Potelet (succédané `border-high`, Building Kit, matériau `colormap`).
  stanchion: (name) => (name === 'colormap' ? palette.woodDark : null),

  // Tapis d'appoint (`carpet` + `carpetDarker`).
  rug: (name) => {
    if (name === 'carpet') return palette.gold
    if (name === 'carpetDarker') return palette.woodDark
    return null
  },

  // Pile de livres : chaque matériau réutilisé du kit (`carpetDarker`/`carpetWhite`/`plant`/`metal`)
  // devient une couverture de couleur différente — cohérent avec « pile de livres colorée » (DESIGN.md).
  books: (name) => {
    if (name === 'carpetDarker') return palette.leafDark
    if (name === 'carpetWhite') return palette.cream
    if (name === 'plant') return palette.gold
    if (name === 'metal') return palette.woodDark
    return null
  },

  // Aile Infrastructures : racks/machines/écrans (`colormap`) et antenne (`PaletteMaterial001`) vers
  // l'accent sarcelle. Ne touche jamais `material-glass` (déjà exclu, voir geometry.ts).
  teal: (name) => (name === 'colormap' || name === 'PaletteMaterial001' ? infra : null),

  // Aile Industrialisation : tapis roulant, bras robotisé (`colormap`) vers l'accent orange.
  orange: (name) => (name === 'colormap' ? indus : null),

  // Aile Culture : banquettes/bibliothèques (`wood`/`carpet`/`_defaultMat`) vers le velours violet.
  violet: (name) => {
    if (name === 'wood') return palette.woodDark
    if (name === 'carpet' || name === '_defaultMat' || name === 'dirt') return culture
    if (name === 'grass') return palette.woodDark
    return null
  },

  // Sculpture 1 (rocher élancé, Nature Kit) : socle doré plutôt que violet, pour varier avec sculpture-2.
  gold: (name) => {
    if (name === 'dirt' || name === '_defaultMat') return palette.gold
    if (name === 'grass') return palette.woodDark
    return null
  },

  // Garde la couleur/texture d'origine du pack (fleurs — déjà rouge/jaune/violet par le CHOIX du
  // modèle, pas par teinte ; caisses/tuyaux — motif `colormap` d'origine assez lisible tel quel).
  original: () => null,
}

export function tintFor(variant: string): TintFn {
  return TINTS[variant] ?? (() => null)
}
