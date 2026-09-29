/**
 * Teintes des modèles Kenney (`tints.ts`) : elles lisent `charter3d.props` (docs/CHARTE-3D.md §4.4 et §7.1).
 * Pur (aucun three.js) : on interroge chaque variante avec les noms de matériaux relevés dans les modèles.
 */
import { describe, expect, it } from 'vitest'
import { charter3d, palette, wingThemes } from '../../styles/tokens'
import { FLAT_TINT_VARIANTS, TINTS, tintFor } from './tints'

/** Noms de matériaux d'origine rencontrés dans les modèles (`docs/assets/props.md`), plus quelques inconnus. */
const MATERIALS = ['colormap', 'wood', 'woodDark', 'metal', '_defaultMat', 'carpet', 'carpetDarker', 'carpetWhite', 'plant', 'lamp', 'dirt', 'grass', 'colorRed', 'colorYellow', 'colorPurple', 'PaletteMaterial001', 'material-glass', 'inconnu']

/** Toutes les couleurs `#rrggbb` de la charte. */
function charterHexes(node: unknown = charter3d, out = new Set<string>()): Set<string> {
  if (typeof node === 'string') {
    if (/^#[0-9a-f]{6}$/i.test(node)) out.add(node.toLowerCase())
  } else if (node && typeof node === 'object') {
    for (const v of Object.values(node)) charterHexes(v, out)
  }
  return out
}

describe('teintes des modèles — charte 3D', () => {
  const allowed = charterHexes()
  const legacy = [palette.cream, palette.ink, palette.wood, palette.woodDark, palette.gold, palette.shadow].map((h) => h.toLowerCase())

  it('chaque teinte de chaque variante est une couleur de la charte, jamais un reste bois / crème / or / brun', () => {
    for (const [variant, fn] of Object.entries(TINTS)) {
      for (const material of MATERIALS) {
        const tint = fn(material)
        if (tint === null) continue
        expect(allowed.has(tint.toLowerCase()), `${variant}/${material} → ${tint}`).toBe(true)
        expect(legacy, `${variant}/${material} reprend une matière chaude`).not.toContain(tint.toLowerCase())
      }
    }
  })

  it('colonnes, potelets : blanc bleuté (canaux ≥ 90 %), texture-palette retirée pour que la couleur soit exacte', () => {
    expect(tintFor('stone')('colormap')).toBe(charter3d.props.stone)
    expect(tintFor('stanchion')('colormap')).toBe(charter3d.props.stanchion)
    for (const hex of [charter3d.props.stone, charter3d.props.stanchion]) {
      const n = parseInt(hex.slice(1), 16)
      for (const channel of [(n >> 16) & 255, (n >> 8) & 255, n & 255]) expect(channel / 255).toBeGreaterThanOrEqual(0.9)
    }
    expect(FLAT_TINT_VARIANTS.has('stone')).toBe(true)
    expect(FLAT_TINT_VARIANTS.has('stanchion')).toBe(true)
  })

  it('machines et convoyeurs à texture-palette (`colormap`) : aussi en aplat, sinon les texels verts et gris ressortent', () => {
    for (const variant of ['teal', 'orange']) expect(FLAT_TINT_VARIANTS.has(variant), variant).toBe(true)
  })

  it('chaque variante en aplat a bien une teinte pour `colormap` (sinon la texture serait retirée sans couleur de remplacement)', () => {
    for (const variant of FLAT_TINT_VARIANTS) expect(tintFor(variant)('colormap'), variant).not.toBeNull()
  })

  it('mobilier : corps blanc bleuté, quincaillerie au bleu trait, coussins corail du hall', () => {
    const wood = tintFor('wood')
    expect(wood('wood')).toBe(charter3d.props.wood.body)
    expect(wood('_defaultMat')).toBe(charter3d.props.wood.body)
    expect(wood('woodDark')).toBe(charter3d.props.wood.trim)
    expect(wood('metal')).toBe(charter3d.props.wood.trim)
    expect(wood('carpet')).toBe(charter3d.rooms.hall.accent)
  })

  it('jardinières : pot blanc, terre nuit, plantes cyan (plus de vert feuille)', () => {
    const planter = tintFor('planter')
    expect(planter('wood')).toBe(charter3d.props.planter.pot)
    expect(planter('woodDark')).toBe(charter3d.props.planter.soil)
    expect(planter('plant')).toBe(charter3d.props.planter.plant)
    expect(planter('plant')).toBe(charter3d.base.cyan)
  })

  it('lampes : métal blanc, abat-jour corail ; tapis d’appoint corail à bordure corail profond', () => {
    expect(tintFor('lamp')('metal')).toBe(charter3d.props.lamp.metal)
    expect(tintFor('lamp')('lamp')).toBe(charter3d.props.lamp.shade)
    expect(tintFor('rug')('carpet')).toBe(charter3d.props.rug.field)
    expect(tintFor('rug')('carpetDarker')).toBe(charter3d.props.rug.border)
  })

  it('livres : les quatre couleurs de la charte', () => {
    const books = tintFor('books')
    expect([books('carpetDarker'), books('carpetWhite'), books('plant'), books('metal')]).toEqual([charter3d.props.books.a, charter3d.props.books.b, charter3d.props.books.c, charter3d.props.books.d])
  })

  it('ailes : racks cyan vif, convoyeur et bras corail, canapé bleu néon à bois blanc, sculptures blanches sur socle néon', () => {
    expect(tintFor('teal')('colormap')).toBe(wingThemes.infrastructures.accent)
    expect(tintFor('teal')('PaletteMaterial001')).toBe(wingThemes.infrastructures.accent)
    expect(tintFor('orange')('colormap')).toBe(wingThemes.industrialisation.accent)
    expect(tintFor('violet')('carpet')).toBe(charter3d.props.culture.velvet)
    expect(tintFor('violet')('dirt')).toBe(charter3d.props.culture.velvet)
    expect(tintFor('violet')('wood')).toBe(charter3d.props.culture.wood)
    expect(tintFor('violet')('grass')).toBe(charter3d.props.culture.wood)
    expect(tintFor('gold')('dirt')).toBe(charter3d.props.sculpture.stone)
    expect(tintFor('gold')('grass')).toBe(charter3d.props.sculpture.base)
  })

  it('fleurs : tige cyan, corolles corail, blanche et bleu néon ; les autres modèles « originaux » ne bougent pas', () => {
    const original = tintFor('original')
    expect(original('grass')).toBe(charter3d.props.flowers.stem)
    expect(original('colorRed')).toBe(charter3d.props.flowers.red)
    expect(original('colorYellow')).toBe(charter3d.props.flowers.yellow)
    expect(original('colorPurple')).toBe(charter3d.props.flowers.purple)
    expect(original('colormap')).toBeNull()
  })

  it('variante inconnue : aucune teinte', () => {
    expect(tintFor('nexiste-pas')('colormap')).toBeNull()
  })
})
