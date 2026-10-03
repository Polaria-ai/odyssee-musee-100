// @vitest-environment node
/**
 * Dilatation des îlots d'un atlas (WEL-930, `scripts/atlas-padding.mjs`) : fonction pure, jouée sur de petites images
 * synthétiques. Ce qui doit tenir : les texels d'îlots ne changent jamais, le vide prend la couleur de l'îlot le plus
 * proche, la marge a la largeur demandée (ni plus, ni moins), et rien n'est aléatoire.
 */
import { describe, expect, it } from 'vitest'
import { padIslands } from './atlas-padding.mjs'

const W = 24
const H = 16

/** Image RVB de `W`×`H` texels, noire, avec des carrés de couleur : renvoie aussi la carte des îlots (0 = vide). */
function atlas(blocks: { x0: number; x1: number; y0: number; y1: number; color: [number, number, number] }[]) {
  const pixels = new Uint8Array(W * H * 3)
  const island = new Int32Array(W * H)
  blocks.forEach((b, i) => {
    for (let y = b.y0; y < b.y1; y++) {
      for (let x = b.x0; x < b.x1; x++) {
        pixels.set(b.color, (y * W + x) * 3)
        island[y * W + x] = i + 1
      }
    }
  })
  return { pixels, island }
}
const rgb = (px: Uint8Array, x: number, y: number) => Array.from(px.slice((y * W + x) * 3, (y * W + x) * 3 + 3))
const filledCount = (padded: Uint8Array) => padded.reduce((s, v) => s + v, 0)

const RED: [number, number, number] = [200, 20, 20]
const BLUE: [number, number, number] = [20, 20, 200]

describe('padIslands : dilatation des îlots d’un atlas', () => {
  it('ne modifie aucun texel d’îlot ni l’image d’origine, et ne remplit que du vide', () => {
    const { pixels, island } = atlas([{ x0: 8, x1: 12, y0: 6, y1: 10, color: RED }])
    const before = Uint8Array.from(pixels)
    const out = padIslands(pixels, 3, W, H, island, 3)
    expect(Array.from(pixels)).toEqual(Array.from(before)) // l'entrée n'est pas mutée
    for (let i = 0; i < W * H; i++) {
      if (island[i]) {
        expect(Array.from(out.pixels.slice(i * 3, i * 3 + 3)), `texel d'îlot ${i}`).toEqual(Array.from(before.slice(i * 3, i * 3 + 3)))
        expect(out.padded[i]).toBe(0)
      }
    }
  })

  it('remplit le vide avec la couleur de l’îlot, sur la largeur de marge demandée seulement', () => {
    const { pixels, island } = atlas([{ x0: 8, x1: 12, y0: 6, y1: 10, color: RED }])
    const out = padIslands(pixels, 3, W, H, island, 3)
    // Couronne de 3 texels autour du carré 4×4 : 10×10 − 4×4.
    expect(filledCount(out.padded)).toBe(10 * 10 - 4 * 4)
    expect(rgb(out.pixels, 7, 6)).toEqual(RED) // 1 texel à gauche
    expect(rgb(out.pixels, 5, 6)).toEqual(RED) // 3 texels : dernier texel de la marge
    expect(rgb(out.pixels, 4, 6)).toEqual([0, 0, 0]) // 4 texels : hors marge, resté vide
    expect(out.padded[6 * W + 4]).toBe(0)
    expect(rgb(out.pixels, 5, 3)).toEqual(RED) // coin : la distance se mesure en damier (8 voisins)
    expect(rgb(out.pixels, 4, 3)).toEqual([0, 0, 0])
    expect(out.territory[6 * W + 5]).toBe(1)
    expect(out.territory[6 * W + 4]).toBe(0)
  })

  it('donne à chaque texel de vide la couleur de l’îlot le plus proche', () => {
    // Deux îlots séparés par 5 texels de vide (x = 8 à 12) : rouge à gauche (x 4 à 7), bleu à droite (x 13 à 16).
    const { pixels, island } = atlas([
      { x0: 4, x1: 8, y0: 6, y1: 10, color: RED },
      { x0: 13, x1: 17, y0: 6, y1: 10, color: BLUE },
    ])
    const out = padIslands(pixels, 3, W, H, island)
    expect(rgb(out.pixels, 8, 7)).toEqual(RED) // à 1 du rouge, 5 du bleu
    expect(rgb(out.pixels, 9, 7)).toEqual(RED)
    expect(rgb(out.pixels, 11, 7)).toEqual(BLUE) // à 2 du bleu, 4 du rouge
    expect(rgb(out.pixels, 12, 7)).toEqual(BLUE)
    // Aucun texel ne prend un mélange des deux : chaque couleur du résultat est l'une des deux (ou le noir hors îlot).
    for (let i = 0; i < W * H; i++) {
      const c = Array.from(out.pixels.slice(i * 3, i * 3 + 3)).join()
      if (out.padded[i]) expect([RED.join(), BLUE.join()], `texel ${i}`).toContain(c)
    }
    // Sans limite (`radius` omis), tout le vide est rempli.
    expect(out.territory.every((t) => t > 0)).toBe(true)
  })

  it('à égalité de voisins le plus petit numéro d’îlot l’emporte, sinon la majorité', () => {
    // Trois texels de vide (x = 6 à 8) entre deux îlots : le texel du milieu (7, 7) est à égale distance, avec 3 voisins
    // de chaque côté. Le numéro décide, pas la position : on le vérifie dans les deux sens.
    const blocks = [
      { x0: 2, x1: 6, y0: 6, y1: 10, color: RED },
      { x0: 9, x1: 13, y0: 6, y1: 10, color: BLUE },
    ]
    const redFirst = atlas(blocks)
    expect(rgb(padIslands(redFirst.pixels, 3, W, H, redFirst.island, 2).pixels, 7, 7)).toEqual(RED)
    const blueFirst = atlas(blocks)
    for (let i = 0; i < W * H; i++) if (blueFirst.island[i]) blueFirst.island[i] = 3 - blueFirst.island[i] // rouge = 2, bleu = 1
    expect(rgb(padIslands(blueFirst.pixels, 3, W, H, blueFirst.island, 2).pixels, 7, 7)).toEqual(BLUE)

    // Un texel de vide voisin de 3 texels rouges (îlot n° 2) et d'1 texel bleu (îlot n° 1, le plus petit numéro) :
    // la majorité l'emporte sur le numéro.
    const odd = atlas([
      { x0: 8, x1: 9, y0: 4, y1: 5, color: BLUE },
      { x0: 4, x1: 7, y0: 4, y1: 8, color: RED },
    ])
    expect(rgb(padIslands(odd.pixels, 3, W, H, odd.island, 1).pixels, 7, 5)).toEqual(RED)
  })

  it('moyenne les voisins de l’îlot gagnant : un texel de bord isolé ne tache pas la marge', () => {
    // Bord d'îlot : trois texels voisins du vide valent 100, un seul vaut 200. Le vide prend leur moyenne.
    const { pixels, island } = atlas([{ x0: 8, x1: 9, y0: 5, y1: 8, color: [100, 100, 100] }])
    pixels.set([200, 200, 200], (6 * W + 8) * 3)
    const out = padIslands(pixels, 3, W, H, island, 1)
    expect(rgb(out.pixels, 9, 6)).toEqual([133, 133, 133]) // (100 + 200 + 100) / 3
  })

  it('traite aussi les images à quatre canaux (alpha étendu comme le reste)', () => {
    const px = new Uint8Array(4 * 4 * 4)
    const island = new Int32Array(16)
    px.set([10, 20, 30, 255], (1 * 4 + 1) * 4)
    island[1 * 4 + 1] = 1
    const out = padIslands(px, 4, 4, 4, island, 1)
    expect(Array.from(out.pixels.slice(0, 4))).toEqual([10, 20, 30, 255]) // (0, 0) voisin en diagonale
    expect(filledCount(out.padded)).toBe(8)
  })

  it('est déterministe : deux exécutions donnent les mêmes octets', () => {
    const { pixels, island } = atlas([
      { x0: 3, x1: 7, y0: 3, y1: 9, color: RED },
      { x0: 9, x1: 14, y0: 5, y1: 12, color: BLUE },
      { x0: 16, x1: 20, y0: 2, y1: 6, color: [60, 200, 60] },
    ])
    const a = padIslands(pixels, 3, W, H, island, 6)
    const b = padIslands(pixels, 3, W, H, island, 6)
    expect(Buffer.compare(Buffer.from(a.pixels), Buffer.from(b.pixels))).toBe(0)
    expect(Buffer.compare(Buffer.from(a.padded), Buffer.from(b.padded))).toBe(0)
  })

  it('sans îlot ou avec une marge nulle, rend une copie intacte', () => {
    const { pixels, island } = atlas([{ x0: 8, x1: 12, y0: 6, y1: 10, color: RED }])
    const none = padIslands(pixels, 3, W, H, island, 0)
    expect(Array.from(none.pixels)).toEqual(Array.from(pixels))
    expect(filledCount(none.padded)).toBe(0)
    const empty = padIslands(new Uint8Array(W * H * 3), 3, W, H, new Int32Array(W * H))
    expect(filledCount(empty.padded)).toBe(0)
  })
})
