/**
 * Recoloration par variante : associe chaque matériau d'origine d'un modèle Kenney (voir les noms
 * relevés avec `gltf-transform inspect`, consignés dans `docs/assets/props.md`) à une couleur de la
 * charte 3D (`charter3d.props`, `src/styles/tokens.ts` ; table dans `docs/CHARTE-3D.md` §4.4 et §7.1).
 * `null` = garde la couleur/texture d'origine (jamais de teinte sur les vitres, déjà exclues dans
 * `geometry.ts`).
 *
 * Décision de Baptiste du 29/09/2026 : plus de bois, de crème, d'or ni de vert feuille. Le mobilier clair
 * est blanc bleuté (`brume`), sa quincaillerie au bleu trait, les plantes cyan, les abat-jour corail ; les
 * ailes gardent leur accent (cyan vif, corail, bleu néon). La couleur d'un matériau se MULTIPLIE à sa
 * texture éventuelle : pour les modèles à texture-palette (`colormap`), les variantes de
 * `FLAT_TINT_VARIANTS` la retirent, sinon les texels du modèle imposent leurs gris et leurs verts.
 */
import { charter3d, wingThemes } from '../../styles/tokens'

type TintFn = (materialName: string) => string | null

const { props, rooms } = charter3d

const infra = wingThemes.infrastructures.accent
const indus = wingThemes.industrialisation.accent

export const TINTS: Record<string, TintFn> = {
  // Colonnes (Building Kit, matériau `colormap`) : blanc bleuté uni (texture retirée, voir FLAT_TINT_VARIANTS).
  stone: (name) => (name === 'colormap' ? props.stone : null),

  // Mobilier clair (bancs, table d'appoint, bureau, étagère, établi) : corps blanc bleuté, pieds et
  // quincaillerie au bleu trait ; coussins (`carpet`) en corail du hall.
  wood: (name) => {
    if (name === 'woodDark' || name === 'metal') return props.wood.trim
    if (name === 'wood' || name === '_defaultMat') return props.wood.body
    if (name === 'carpet') return rooms.hall.accent
    return null
  },

  // Jardinières (pot `wood`, terre `woodDark`, feuillage `plant`) : pot blanc, terre nuit, plantes cyan.
  planter: (name) => {
    if (name === 'plant') return props.planter.plant
    if (name === 'woodDark') return props.planter.soil
    if (name === 'wood') return props.planter.pot
    return null
  },

  // Lampadaire/applique (Furniture Kit, `metal` + `lamp`) : métal blanc, abat-jour corail.
  lamp: (name) => {
    if (name === 'metal') return props.lamp.metal
    if (name === 'lamp') return props.lamp.shade
    return null
  },

  // Potelet (succédané `border-high`, Building Kit, matériau `colormap`).
  stanchion: (name) => (name === 'colormap' ? props.stanchion : null),

  // Tapis d'appoint (`carpet` + `carpetDarker`) : champ corail, bordure corail profond.
  rug: (name) => {
    if (name === 'carpet') return props.rug.field
    if (name === 'carpetDarker') return props.rug.border
    return null
  },

  // Pile de livres : chaque matériau réutilisé du kit (`carpetDarker`/`carpetWhite`/`plant`/`metal`)
  // devient une couverture d'une couleur de la charte (bleu néon, blanc, corail, cyan vif).
  books: (name) => {
    if (name === 'carpetDarker') return props.books.a
    if (name === 'carpetWhite') return props.books.b
    if (name === 'plant') return props.books.c
    if (name === 'metal') return props.books.d
    return null
  },

  // Aile Infrastructures : racks/machines/écrans (`colormap`) et antenne (`PaletteMaterial001`) vers
  // l'accent cyan vif. Ne touche jamais `material-glass` (déjà exclu, voir geometry.ts).
  teal: (name) => (name === 'colormap' || name === 'PaletteMaterial001' ? infra : null),

  // Aile Industrialisation : tapis roulant, bras robotisé (`colormap`) vers l'accent corail.
  orange: (name) => (name === 'colormap' ? indus : null),

  // Aile Culture : banquettes/bibliothèques (`wood`/`carpet`/`_defaultMat`) : velours bleu néon, bois blanc.
  violet: (name) => {
    if (name === 'wood' || name === 'grass') return props.culture.wood
    if (name === 'carpet' || name === '_defaultMat' || name === 'dirt') return props.culture.velvet
    return null
  },

  // Sculpture 1 (rocher élancé, Nature Kit) : marbre blanc sur socle bleu néon.
  gold: (name) => {
    if (name === 'dirt' || name === '_defaultMat') return props.sculpture.stone
    if (name === 'grass') return props.sculpture.base
    return null
  },

  // Fleurs : le modèle garde sa forme, mais ses couleurs passent à la charte (tige cyan, corolles corail,
  // blanche et bleu néon). Les autres modèles « originaux » (caisses, tuyaux : `colormap`) gardent leur
  // motif d'origine, assez lisible tel quel.
  original: (name) => {
    if (name === 'grass') return props.flowers.stem
    if (name === 'colorRed') return props.flowers.red
    if (name === 'colorYellow') return props.flowers.yellow
    if (name === 'colorPurple') return props.flowers.purple
    return null
  },
}

/**
 * Variantes dont la texture-palette (`colormap`) est retirée : la teinte y est la couleur exacte, pas un
 * multiplicateur des texels du modèle (voir `geometry.ts::tintedMaterial`). Vérifié à l'œil le 29/09 :
 * les colonnes gardaient un dessus gris ardoise, les machines des détails verts. Le relief vient alors de
 * la géométrie et de la lumière, comme pour l'arbre et le comptoir.
 */
export const FLAT_TINT_VARIANTS: ReadonlySet<string> = new Set(['stone', 'stanchion', 'teal', 'orange'])

export function tintFor(variant: string): TintFn {
  return TINTS[variant] ?? (() => null)
}
