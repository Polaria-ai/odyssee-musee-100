#!/usr/bin/env node
/**
 * Textures de sol du musée (WEL-923) : transforme les sources Magnific (albédos neutres et clairs, cartes de
 * normales) en cartes prêtes pour le temps réel mobile, dans `public/textures/floors/`.
 *
 * Principe (docs/CHARTE-3D.md §4.1) : la texture ne porte PAS la couleur, seulement la matière (veines du
 * marbre, éclats du terrazzo, grain du microciment, fibres de la moquette). Chaque sol a donc :
 *  - une carte de DÉTAIL, en niveaux de gris LINÉAIRES (donnée, pas une couleur : `NoColorSpace` côté three),
 *    dont les valeurs sont dans [1 − profondeur ; 1] et la moyenne proche de 1. Elle MULTIPLIE les couleurs de
 *    sommet de la charte : les bleus restent les couleurs de référence, la texture ne fait que les piquer de
 *    matière. Le blanc (1) laisse la couleur de la charte intacte ;
 *  - une carte de NORMALES (convention OpenGL, la même que celle de three) pour le relief sous la lumière.
 *
 * Pipeline : luminance linéaire de l'albédo → raccord tuilable si besoin (fondu avec une copie décalée, ou retrait
 * de la dérive lente de la source) → réduction à 512 px (règle mobile, AGENTS.md) → grossissement des marques trop
 * fines pour l'écran (flou léger, renfort des marques moyennes) → aplanissement partiel des grandes taches (un motif
 * de 1 m qui se répète en 6 m ne doit pas faire apparaître un quadrillage de plages claires/sombres) → normalisation
 * par percentiles → profondeur réglable par matière → webp. Sorties déterministes (mêmes sources, mêmes réglages,
 * mêmes octets).
 *
 * Lisibilité à l'écran (docs/CHARTE-3D.md §4.1) : la caméra montre le sol à 60-80 px par mètre, le motif doit donc
 * être posé à une taille de jeu (`tileMeters` de `src/world/floorSpec.ts`) et garder du contraste une fois moyenné :
 * `screenContrast` le mesure, et le test l'exige.
 *
 * Sources : `assets-src/floors/` (hors Git, voir docs/ASSETS.md), ou `FLOORS_SRC=…`, ou à défaut le dossier
 * d'origine `~/Dev/odyssee-musee-100-assets/sols-v5/magnific/`.
 * Usage : node scripts/build-floor-textures.mjs [--debug dossier]   (--debug : mosaïques 2×2 de contrôle)
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/** Taille de sortie maximale (règle mobile : textures ≤ 512 px). */
export const OUT_SIZE = 512
/** Dossier de sortie, servi tel quel (`/textures/floors/…`). */
export const OUT_DIR = 'public/textures/floors'
/** Budget total des fichiers produits (octets). */
export const BUDGET_BYTES = 450 * 1024

/**
 * Réglages par sol. Clés = identifiants de matière de `src/world/floorTextures.ts`.
 *  - `src` : préfixe des fichiers sources ;
 *  - `seamless` : largeur de la bande de fondu (fraction de la tuile) si la source n'est pas déjà tuilable ;
 *  - `flatten` : part (0-1) des grandes variations de luminance retirée (σ = `flattenSigma` px à 512) ; `flattenOpen` :
 *    estimer ces variations sans bouclage (source dont le haut et le bas ne se raccordent pas) ;
 *  - `boostMid` : renfort (facteur) des marques de 3 à 30 px, avant la normalisation ;
 *  - `blur` : flou (σ en px à 512) appliqué avant la normalisation, pour grossir les marques trop fines pour l'écran ;
 *  - `lo` / `hi` : percentiles de la luminance qui deviennent respectivement « le plus marqué » et « la matière » ;
 *  - `depth` : profondeur du motif ; les valeurs de la carte sont dans [1 − depth ; 1] ;
 *  - `gamma` : > 1 resserre les marques vers la matière (peu de marques fortes), < 1 les étale ;
 *  - `normalSize` / `normalStrength` : taille de la carte de normales (≤ 512) et gain de relief.
 */
export const FLOORS = {
  marble: { src: 'marbre-2', seamless: 0.25, flatten: 0.65, flattenSigma: 48, blur: 0, lo: 0.002, hi: 0.97, depth: 0.42, gamma: 0.8, normalSize: 512, normalStrength: 1 },
  terrazzo: { src: 'terrazzo-2', seamless: 0, flatten: 1, flattenSigma: 32, flattenOpen: true, blur: 1.2, lo: 0.003, hi: 0.96, depth: 0.55, gamma: 0.6, normalSize: 512, normalStrength: 1, quality: 70 },
  microcement: { src: 'microciment-2', seamless: 0.2, flatten: 0.8, flattenSigma: 40, blur: 0, lo: 0.003, hi: 0.99, depth: 0.6, gamma: 0.85, boostMid: 1.5, normalSize: 512, normalStrength: 1.5, quality: 70 },
  carpet: { src: 'moquette-1', seamless: 0, flatten: 0.3, flattenSigma: 40, blur: 0.7, lo: 0.01, hi: 0.985, depth: 0.55, gamma: 1, normalSize: 256, normalStrength: 1, quality: 70 },
}

const WEBP_DETAIL = { quality: 82, effort: 6 }
const WEBP_NORMAL = { quality: 92, effort: 6 }

// --- Outils numériques (plans Float32Array n × n) ---------------------------------------------------------

const srgbToLinear = new Float32Array(256).map((_, i) => {
  const v = i / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
})

/** Décode une image en 3 plans RVB (valeurs 0-255) de `size` × `size`, redimensionnée si besoin. */
async function readRgb(path, size) {
  const { data, info } = await sharp(path).removeAlpha().resize(size, size, { kernel: 'cubic' }).raw().toBuffer({ resolveWithObject: true })
  const n = info.width * info.height
  const planes = [new Float32Array(n), new Float32Array(n), new Float32Array(n)]
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) planes[c][i] = data[i * 3 + c]
  return planes
}

function luminanceLinear(rgb) {
  const n = rgb[0].length
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = 0.2126 * srgbToLinear[rgb[0][i] | 0] + 0.7152 * srgbToLinear[rgb[1][i] | 0] + 0.0722 * srgbToLinear[rgb[2][i] | 0]
  return out
}

/** Réduction par moyenne de blocs 2×2 (taille source paire). */
function halve(plane, n) {
  const m = n / 2
  const out = new Float32Array(m * m)
  for (let y = 0; y < m; y++) {
    for (let x = 0; x < m; x++) {
      const i = 2 * y * n + 2 * x
      out[y * m + x] = (plane[i] + plane[i + 1] + plane[i + n] + plane[i + n + 1]) / 4
    }
  }
  return out
}

function resizeTo(plane, n, target) {
  let p = plane
  let size = n
  while (size > target) {
    p = halve(p, size)
    size /= 2
  }
  return { plane: p, size }
}

/**
 * Rend un jeu de plans tuilable : fondu avec la copie décalée d'une demi-tuile. Le poids vaut 1 au centre
 * (la couture de la copie décalée y est cachée) et 0 sur les bords (là, la copie décalée est continue de
 * part et d'autre). `band` = fraction de la tuile occupée par chaque rampe.
 */
function makeSeamless(planes, n, band) {
  const ramp = (i) => {
    const d = Math.min(i, n - 1 - i) / (band * n)
    const t = Math.min(1, d)
    return t * t * (3 - 2 * t)
  }
  const half = n / 2
  return planes.map((p) => {
    const out = new Float32Array(n * n)
    for (let y = 0; y < n; y++) {
      const wy = ramp(y)
      for (let x = 0; x < n; x++) {
        const w = wy * ramp(x)
        const shifted = p[((y + half) % n) * n + ((x + half) % n)]
        out[y * n + x] = p[y * n + x] * w + shifted * (1 - w)
      }
    }
    return out
  })
}

/** Flou gaussien exact, séparable : pour les petits σ (le noyau est court, le coût négligeable). */
function blurExact(plane, n, sigma, wrap) {
  const radius = Math.ceil(sigma * 3)
  const kernel = new Float32Array(2 * radius + 1)
  let sum = 0
  for (let k = -radius; k <= radius; k++) {
    kernel[k + radius] = Math.exp(-(k * k) / (2 * sigma * sigma))
    sum += kernel[k + radius]
  }
  for (let k = 0; k < kernel.length; k++) kernel[k] /= sum
  const at = wrap ? (i) => ((i % n) + n) % n : (i) => Math.min(n - 1, Math.max(0, i))
  const tmp = new Float32Array(n * n)
  const out = new Float32Array(n * n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let acc = 0
      for (let k = -radius; k <= radius; k++) acc += plane[y * n + at(x + k)] * kernel[k + radius]
      tmp[y * n + x] = acc
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let acc = 0
      for (let k = -radius; k <= radius; k++) acc += tmp[at(y + k) * n + x] * kernel[k + radius]
      out[y * n + x] = acc
    }
  }
  return out
}

/**
 * Flou gaussien approché par trois passes de moyenne glissante (Kovesi), pour les grands σ : coût O(n²) quel que
 * soit σ (le flou exact de σ = 96 px coûtait des secondes et rendait les tests fragiles sous charge).
 * Avec `wrap` (défaut), le plan est bouclé : le résultat reste tuilable. Sans `wrap`, les bords sont prolongés : à
 * utiliser pour estimer une variation lente NON périodique (une source dont le haut est plus clair que le bas :
 * un flou bouclé la confondrait avec une marque et creuserait un raccord).
 */
function blurWrap(plane, n, sigma, wrap = true) {
  if (sigma < 4) return blurExact(plane, n, sigma, wrap)
  const passes = 3
  const ideal = Math.sqrt((12 * sigma * sigma) / passes + 1)
  let wl = Math.floor(ideal)
  if (wl % 2 === 0) wl--
  const wu = wl + 2
  const m = Math.round((12 * sigma * sigma - passes * wl * wl - 4 * passes * wl - 3 * passes) / (-4 * wl - 4))
  const at = wrap ? (i) => ((i % n) + n) % n : (i) => Math.min(n - 1, Math.max(0, i))
  let src = Float32Array.from(plane)
  let dst = new Float32Array(n * n)
  const pass = (width, stride, lineStride) => {
    const r = (width - 1) / 2
    for (let line = 0; line < n; line++) {
      const base = line * lineStride
      let acc = 0
      for (let k = -r; k <= r; k++) acc += src[base + at(k) * stride]
      for (let x = 0; x < n; x++) {
        dst[base + x * stride] = acc / width
        acc += src[base + at(x + r + 1) * stride] - src[base + at(x - r) * stride]
      }
    }
    ;[src, dst] = [dst, src]
  }
  for (let i = 0; i < passes; i++) {
    const width = i < m ? wl : wu
    pass(width, 1, n) // horizontale
    pass(width, n, 1) // verticale
  }
  return src
}

function percentile(plane, q) {
  const sorted = Float32Array.from(plane).sort()
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]
}

/**
 * Rapport entre l'écart moyen des bords opposés (la « couture » quand la tuile se répète) et celui de deux
 * colonnes / lignes voisines prises juste à l'intérieur de ces mêmes bords (là où le fondu du raccord ne change
 * pas encore le contraste) : ≈ 1 = raccord invisible, ≫ 1 = couture.
 */
export function seamRatio(values, n) {
  let seam = 0
  let inner = 0
  for (let k = 0; k < n; k++) {
    seam += Math.abs(values[k * n] - values[k * n + n - 1]) + Math.abs(values[k] - values[(n - 1) * n + k])
    inner += Math.abs(values[k * n + 1] - values[k * n + 2]) + Math.abs(values[k * n + n - 3] - values[k * n + n - 2])
    inner += Math.abs(values[n + k] - values[2 * n + k]) + Math.abs(values[(n - 3) * n + k] - values[(n - 2) * n + k])
  }
  return seam / (inner / 2)
}

/**
 * Contraste de la carte de détail TEL QUE LE JOUEUR LE VOIT : coefficient de variation (écart-type / moyenne) de la
 * carte rééchantillonnée à la densité d'écran du jeu. Sur téléphone la caméra montre ≈ 11 m de sol dans 680 px de
 * rendu (dpr 1,75 sur 390 px) : 60 à 80 px par mètre. Un motif plus fin que le pixel s'y moyenne (les mipmaps) et
 * le sol redevient un aplat, quelle que soit la profondeur de la carte (c'était le défaut de la première
 * version : moquette 0,047, éclats de terrazzo 0,052). `ppm` = pixels d'écran par mètre ; moyenne par blocs.
 */
export function screenContrast(values, n, tileMeters, ppm = 80) {
  const screenPx = Math.max(1, Math.round(tileMeters * ppm))
  if (screenPx >= n) {
    // plus de pixels d'écran que de texels : la carte est vue à pleine résolution (agrandie), rien ne se moyenne
    let sum = 0
    let sum2 = 0
    for (let i = 0; i < values.length; i++) {
      sum += values[i]
      sum2 += values[i] * values[i]
    }
    const mean = sum / values.length
    return Math.sqrt(Math.max(0, sum2 / values.length - mean * mean)) / mean
  }
  const out = new Float64Array(screenPx * screenPx)
  for (let y = 0; y < screenPx; y++) {
    const y0 = Math.floor((y * n) / screenPx)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * n) / screenPx))
    for (let x = 0; x < screenPx; x++) {
      const x0 = Math.floor((x * n) / screenPx)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * n) / screenPx))
      let acc = 0
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) acc += values[yy * n + xx]
      out[y * screenPx + x] = acc / ((y1 - y0) * (x1 - x0))
    }
  }
  let sum = 0
  let sum2 = 0
  for (const v of out) {
    sum += v
    sum2 += v * v
  }
  const mean = sum / out.length
  return Math.sqrt(Math.max(0, sum2 / out.length - mean * mean)) / mean
}

// --- Cartes -----------------------------------------------------------------------------------------------

function buildDetailPlane(lum1024, cfg) {
  let planes = [lum1024]
  const full = 1024
  if (cfg.seamless > 0) planes = makeSeamless(planes, full, cfg.seamless)
  const { plane: reduced, size: n } = resizeTo(planes[0], full, OUT_SIZE)
  // Grossissement des marques : un éclat de 3 px ou une maille de 2 px tombent sous le pixel à la distance du jeu
  // (≈ 80 px par mètre, caméra à 48°). Un léger flou (bouclé, donc tuilable), suivi de la renormalisation par
  // percentiles ci-dessous, les épaissit sans perdre leur contraste.
  const lum = cfg.blur > 0 ? blurWrap(reduced, n, cfg.blur) : reduced
  let mean = 0
  for (const v of lum) mean += v
  mean /= lum.length
  // Renfort des marques de taille moyenne (3 à 30 px, soit 6 à 60 cm au motif de 5 m) : ce sont celles que l'écran
  // restitue (le grain plus fin se moyenne, les très grandes taches sont aplanies) ; le microciment n'en a que de douces.
  if (cfg.boostMid > 0) {
    const fine = blurWrap(lum, n, 3)
    const coarse = blurWrap(lum, n, 30)
    for (let i = 0; i < lum.length; i++) lum[i] += cfg.boostMid * (fine[i] - coarse[i])
  }
  const low = cfg.flatten > 0 ? blurWrap(lum, n, cfg.flattenSigma, !cfg.flattenOpen) : null
  const flat = new Float32Array(lum.length)
  for (let i = 0; i < lum.length; i++) flat[i] = low ? lum[i] - cfg.flatten * (low[i] - mean) : lum[i]
  const lo = percentile(flat, cfg.lo)
  const hi = percentile(flat, cfg.hi)
  const out = new Float32Array(flat.length)
  for (let i = 0; i < flat.length; i++) {
    const g = Math.min(1, Math.max(0, (flat[i] - lo) / (hi - lo)))
    out[i] = 1 - cfg.depth * Math.pow(1 - g, cfg.gamma)
  }
  return { values: out, n }
}

async function buildNormalPlanes(path, cfg) {
  const full = 1024
  const rgb = await readRgb(path, full)
  let planes = rgb.map((p) => p.map((v) => (v / 255) * 2 - 1))
  if (cfg.seamless > 0) planes = makeSeamless(planes, full, cfg.seamless)
  const target = Math.min(OUT_SIZE, cfg.normalSize)
  const reduced = planes.map((p) => resizeTo(p, full, target))
  const n = reduced[0].size
  const [nx, ny, nz] = reduced.map((r) => r.plane)
  // On travaille en pentes (nx / nz, ny / nz) : le relief est exactement celui de la source, aux pentes raides près.
  for (let i = 0; i < nz.length; i++) {
    const z = Math.max(nz[i], 0.2)
    nx[i] /= z
    ny[i] /= z
  }
  // Les cartes de normales générées ne sont pas centrées : une inclinaison moyenne (ou une ondulation à très
  // grande échelle) éclairerait tout le sol autrement que la couleur de la charte. On retire la moyenne et les
  // ondulations plus larges que le motif utile (flou de 2 × σ d'aplanissement, bouclé) : seul le relief fin reste.
  for (const plane of [nx, ny]) {
    const low = blurWrap(plane, n, cfg.flattenSigma * 2 * (n / OUT_SIZE))
    let mean = 0
    for (let i = 0; i < plane.length; i++) mean += plane[i] - low[i]
    mean /= plane.length
    for (let i = 0; i < plane.length; i++) plane[i] = plane[i] - low[i] - mean
  }
  const out = Buffer.alloc(n * n * 3)
  for (let i = 0; i < n * n; i++) {
    let x = nx[i] * cfg.normalStrength
    let y = ny[i] * cfg.normalStrength
    let z = 1
    const len = Math.hypot(x, y, z) || 1
    x /= len
    y /= len
    z /= len
    out[i * 3] = Math.round((x * 0.5 + 0.5) * 255)
    out[i * 3 + 1] = Math.round((y * 0.5 + 0.5) * 255)
    out[i * 3 + 2] = Math.round((z * 0.5 + 0.5) * 255)
  }
  return { raw: out, n }
}

/** Moyenne, minimum et maximum (0-1) de la carte de détail contenue dans un fichier webp. */
export async function readDetailFile(input) {
  const { data, info } = await sharp(input).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true })
  let sum = 0
  let min = 255
  let max = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i]
    if (data[i] < min) min = data[i]
    if (data[i] > max) max = data[i]
  }
  return { mean: sum / data.length / 255, min: min / 255, max: max / 255, size: info.width, values: data }
}

/** Dossier des sources : `FLOORS_SRC`, `assets-src/floors`, ou le dossier d'origine des sources Magnific. */
export function sourceDir() {
  const candidates = [process.env.FLOORS_SRC, resolve('assets-src/floors'), join(homedir(), 'Dev/odyssee-musee-100-assets/sols-v5/magnific')].filter(Boolean)
  return candidates.find((d) => existsSync(join(d, `${FLOORS.marble.src}.png`)))
}

/**
 * Construit les deux cartes d'un sol, en mémoire. Renvoie les webp, les valeurs (pour les contrôles) et des
 * statistiques lisibles.
 */
export async function buildFloor(kind, srcDir = sourceDir()) {
  const cfg = FLOORS[kind]
  if (!cfg) throw new Error(`sol inconnu : ${kind}`)
  if (!srcDir) throw new Error('sources introuvables : voir docs/ASSETS.md (assets-src/floors ou FLOORS_SRC)')
  const albedo = await readRgb(join(srcDir, `${cfg.src}.png`), 1024)
  const detail = buildDetailPlane(luminanceLinear(albedo), cfg)
  const bytes = Buffer.alloc(detail.n * detail.n)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(detail.values[i] * 255)
  const detailWebp = await sharp(bytes, { raw: { width: detail.n, height: detail.n, channels: 1 } }).webp({ ...WEBP_DETAIL, quality: cfg.quality ?? WEBP_DETAIL.quality }).toBuffer()
  // Les statistiques sont lues sur le FICHIER (webp avec perte), pas sur les valeurs avant encodage : c'est
  // ce que le jeu décode, et la moyenne qui sert de gain au matériau (`detailMean`, floorSpec.ts).
  const decoded = await readDetailFile(detailWebp)
  const normal = await buildNormalPlanes(join(srcDir, `${cfg.src}.normal.png`), cfg)
  const normalWebp = await sharp(normal.raw, { raw: { width: normal.n, height: normal.n, channels: 3 } }).webp({ ...WEBP_NORMAL, quality: cfg.normalQuality ?? WEBP_NORMAL.quality }).toBuffer()
  return { detailWebp, normalWebp, detailBytes: bytes, detailSize: detail.n, stats: { mean: decoded.mean, min: decoded.min, seam: seamRatio(decoded.values, decoded.size) } }
}

/** Mosaïque 2×2 de la carte de détail, teintée d'un bleu de la charte : le raccord, s'il y en a un, saute aux yeux. */
async function writeMosaic(kind, built, dir) {
  const n = built.detailSize
  const tint = [0x15, 0x39, 0xa6]
  const lin = tint.map((v) => srgbToLinear[v])
  const tile = Buffer.alloc(n * n * 3)
  for (let i = 0; i < n * n; i++) {
    const f = built.detailBytes[i] / 255
    for (let c = 0; c < 3; c++) {
      const l = lin[c] * f
      tile[i * 3 + c] = Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055))
    }
  }
  const one = await sharp(tile, { raw: { width: n, height: n, channels: 3 } }).png().toBuffer()
  await sharp({ create: { width: n * 2, height: n * 2, channels: 3, background: '#000' } })
    .composite([0, 1, 2, 3].map((i) => ({ input: one, left: (i % 2) * n, top: Math.floor(i / 2) * n })))
    .png()
    .toFile(join(dir, `${kind}-mosaique.png`))
}

async function main() {
  const dbg = process.argv.indexOf('--debug')
  const debugDir = dbg >= 0 ? resolve(process.argv[dbg + 1] ?? 'floors-debug') : null
  if (debugDir) mkdirSync(debugDir, { recursive: true })
  mkdirSync(OUT_DIR, { recursive: true })
  let total = 0
  for (const kind of Object.keys(FLOORS)) {
    const built = await buildFloor(kind)
    writeFileSync(join(OUT_DIR, `${kind}-detail.webp`), built.detailWebp)
    writeFileSync(join(OUT_DIR, `${kind}-normal.webp`), built.normalWebp)
    total += built.detailWebp.length + built.normalWebp.length
    if (debugDir) await writeMosaic(kind, built, debugDir)
    const s = built.stats
    console.log(`${kind.padEnd(12)} détail ${(built.detailWebp.length / 1024).toFixed(1)} Ko · normales ${(built.normalWebp.length / 1024).toFixed(1)} Ko · moyenne ${s.mean.toFixed(3)} · min ${s.min.toFixed(3)} · raccord ×${s.seam.toFixed(2)}`)
  }
  console.log(`Total ${(total / 1024).toFixed(1)} Ko / ${(BUDGET_BYTES / 1024).toFixed(0)} Ko`)
  if (total > BUDGET_BYTES) {
    console.error('Budget des textures de sol dépassé.')
    process.exit(1)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
