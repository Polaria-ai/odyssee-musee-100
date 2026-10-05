/**
 * Dilatation des îlots d'un atlas de texture (« edge padding », WEL-930) : fonction pure sur des tableaux typés.
 *
 * Le vide d'un atlas (les texels qu'aucun triangle n'affiche) reçoit la couleur de l'îlot le plus proche, couche par
 * couche sur `radius` texels. Faite sur la texture pleine taille, AVANT sa réduction et la génération des mipmaps, elle
 * empêche le filtrage (bilinéaire au bord d'un îlot, mipmaps de loin) de mélanger la couleur d'un îlot avec celle du
 * vide — du noir, ou un fond clair — qui l'entoure.
 *
 * Ce que la mesure a montré (banc d'essai du 03/10/2026, voir `docs/ASSETS.md`) : sur les atlas Meshy de Cyril, de
 * Rémi et de l'Archiviste, cette dilatation ne change PAS les « veines » claires vues sur les vêtements : Meshy remplit
 * déjà le vide de ses atlas, et les veines viennent du mélange entre îlots VOISINS (voir `CHARACTER_LOD_BIAS` dans
 * `src/characters/characterRig.ts`, qui les corrige). Elle reste utile : un vide lisse se compresse mieux (WebP de
 * l'Archiviste : − 12 Ko quand le vide était noir) et le filtrage ne lit plus jamais du noir.
 *
 * Garanties (testées dans `atlas-padding.test.ts`) : un texel d'îlot n'est jamais modifié ; seul le vide change, et
 * seulement à moins de `radius` texels (distance en damier, 8 voisins) d'un texel d'îlot ; un texel de vide prend la
 * couleur de l'îlot le plus proche (à égalité : celui qui compte le plus de voisins, puis le plus petit numéro) ;
 * aucun hasard : deux exécutions donnent les mêmes octets.
 */

/**
 * Étend la couleur des îlots dans le vide qui les entoure.
 *
 * @param {Uint8Array} pixels   image à `channels` octets par texel (ligne par ligne, origine en haut à gauche)
 * @param {number} channels     3 ou 4 (le canal alpha est étendu comme les autres)
 * @param {number} width
 * @param {number} height
 * @param {Int32Array} island   numéro de l'îlot de chaque texel (≥ 1), 0 = vide (texel qu'aucun triangle n'affiche)
 * @param {number} [radius]     marge maximale en texels (`Infinity` : tout le vide)
 * @returns {{ pixels: Uint8Array, padded: Uint8Array, territory: Int32Array }}
 *   `pixels` : COPIE de l'image dilatée ; `padded` : 1 = texel de vide rempli ; `territory` : l'îlot auquel appartient
 *   chaque texel une fois dilaté (0 = vide resté vide, au-delà de `radius`).
 */
export function padIslands(pixels, channels, width, height, island, radius = Infinity) {
  const n = width * height
  const out = Uint8Array.from(pixels)
  const territory = Int32Array.from(island)
  const padded = new Uint8Array(n)
  if (!(radius >= 1)) return { pixels: out, padded, territory }

  // Voisins (8) d'un texel, dans un ordre fixe (haut-gauche → bas-droite) : le résultat ne dépend d'aucun hasard.
  const NEIGHBOURS = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].filter((dx) => dx || dy).map((dx) => [dx, dy]))
  const around = (p, visit) => {
    const x = p % width
    const y = (p - x) / width
    for (const [dx, dy] of NEIGHBOURS) {
      const xx = x + dx
      const yy = y + dy
      if (xx >= 0 && xx < width && yy >= 0 && yy < height) visit(yy * width + xx)
    }
  }

  // Front initial : les texels de vide qui touchent un texel d'îlot.
  const queued = new Uint8Array(n)
  let frontier = []
  for (let p = 0; p < n; p++) {
    if (!territory[p]) continue
    around(p, (q) => {
      if (!territory[q] && !queued[q]) {
        queued[q] = 1
        frontier.push(q)
      }
    })
  }

  const labels = new Int32Array(8)
  const counts = new Int32Array(8)
  const sums = new Float64Array(channels)
  for (let layer = 1; layer <= radius && frontier.length; layer++) {
    // Toute la couche est décidée sur l'état de la couche précédente, puis écrite : l'ordre des texels n'a aucun effet.
    const assigned = []
    for (const p of frontier) {
      let kinds = 0
      around(p, (q) => {
        const label = territory[q]
        if (!label) return
        let k = 0
        while (k < kinds && labels[k] !== label) k++
        if (k === kinds) {
          labels[kinds] = label
          counts[kinds] = 0
          kinds++
        }
        counts[k]++
      })
      // L'îlot qui compte le plus de voisins ; à égalité, le plus petit numéro.
      let best = 0
      for (let k = 1; k < kinds; k++) if (counts[k] > counts[best] || (counts[k] === counts[best] && labels[k] < labels[best])) best = k
      const winner = labels[best]
      sums.fill(0)
      let taken = 0
      around(p, (q) => {
        if (territory[q] !== winner) return
        for (let c = 0; c < channels; c++) sums[c] += out[q * channels + c]
        taken++
      })
      assigned.push(p, winner, ...Array.from(sums, (v) => Math.round(v / taken)))
    }
    const stride = 2 + channels
    const next = []
    for (let i = 0; i < assigned.length; i += stride) {
      const p = assigned[i]
      territory[p] = assigned[i + 1]
      padded[p] = 1
      for (let c = 0; c < channels; c++) out[p * channels + c] = assigned[i + 2 + c]
    }
    for (let i = 0; i < assigned.length; i += stride) {
      around(assigned[i], (q) => {
        if (!territory[q] && !queued[q]) {
          queued[q] = 1
          next.push(q)
        }
      })
    }
    frontier = next
  }
  return { pixels: out, padded, territory }
}
