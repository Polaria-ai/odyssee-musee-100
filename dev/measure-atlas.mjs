#!/usr/bin/env node
/* global process, console, window -- script Node ; la page `dev/atlas-lab.html` est pilotée par Playwright */
/**
 * Mesure des « veines » claires des atlas Meshy sur les trois personnages (WEL-930), au banc d'essai
 * `dev/atlas-lab.html` : le personnage est rendu comme dans le jeu (caméra, lumières, matériau, clip « idle », ratio de
 * pixels 1,75 d'un téléphone), de dos et de trois quarts, AVEC puis SANS le biais de LOD (`CHARACTER_LOD_BIAS`).
 *
 * Mesure : chaque rendu est comparé à une « vérité » lisse, la même image rendue sans mipmaps à 14 px par pixel CSS
 * puis réduite 8× par moyenne de boîte (ce que verrait un filtrage parfait). Pour les pixels du personnage que la vérité
 * montre sombres (luminance < 90) :
 *   - `veinesFranches` : part (%) éclaircie de plus de 25 niveaux de luminance (0-255) ;
 *   - `eclaircissement` : éclaircissement moyen (niveaux) ;
 * et, sur tout le personnage, `mae` : écart moyen de luminance (niveaux).
 * `--lod` : affiche aussi le niveau de mipmap lu par le GPU (médiane, 10e et 90e centiles) à cette distance de caméra.
 *
 * Prérequis : `pnpm exec vite --host 127.0.0.1 --port 4181 --strictPort` (serveur de développement).
 * Usage : PW_CHROMIUM_PATH=… node dev/measure-atlas.mjs [dossier] [--lod] [--glb-sans-biais dossier-de-GLB]
 *   - `dossier` : écrit `mesures-veines.json` ; sans lui, résultats à l'écran seulement ;
 *   - `--glb-sans-biais dossier` : lit le GLB « avant » (`<dossier>/<personnage>.glb`, par ex. extrait de git, à servir
 *     par Vite : sous `dev/`) pour la ligne « avant », au lieu du GLB livré avec seulement le biais retiré.
 *     Il doit être servi par le serveur de développement : une URL relative à sa racine, ex. `dev/lab-out`.
 * Les 3 captures de chaque cas (sans biais, avec biais, vérité) sont écrites dans `dossier` si fourni.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const args = process.argv.slice(2)
const outDir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--glb-sans-biais')
const withLod = args.includes('--lod')
const beforeDir = args.includes('--glb-sans-biais') ? args[args.indexOf('--glb-sans-biais') + 1] : null
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4181'
if (outDir) mkdirSync(outDir, { recursive: true })

const CHARACTERS = ['cyril', 'remi', 'archiviste']
const ROTATIONS = { dos: Math.PI, 'trois-quarts': Math.PI / 4 }
// Rectangle de 90×104 px CSS autour du personnage (centre : 0,85 m au-dessus des pieds), à la distance de jeu.
const HALF_W = 45
const HALF_H = 52

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.75 })
const page = await context.newPage()
page.on('pageerror', (e) => console.log('erreur de page :', e.message))
await page.goto(`${base}/dev/atlas-lab.html`)
await page.waitForFunction('window.labReady === true')

/** Rendu (PNG) d'un rectangle de l'écran au ratio de pixels demandé. */
const grab = async (rect, ratio) => Buffer.from((await page.evaluate(([x, y, w, h, r]) => window.lab.shot(x, y, w, h, r), [...rect, ratio])).split(',')[1], 'base64')
const raw = async (buf) => {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, w: info.width, h: info.height }
}
/** Moyenne de boîte par un facteur entier. */
async function boxDown(buf, factor) {
  const { data, w, h } = await raw(buf)
  const W = Math.floor(w / factor)
  const H = Math.floor(h / factor)
  const out = Buffer.alloc(W * H * 3)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) sum += data[((y * factor + dy) * w + x * factor + dx) * 3 + c]
        out[(y * W + x) * 3 + c] = Math.round(sum / (factor * factor))
      }
    }
  }
  return { data: out, w: W, h: H }
}
const luminance = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]

/** Écart d'un rendu à la vérité (voir l'en-tête). Les pixels de fond (proches du coin haut gauche des deux images) sont ignorés. */
function compare(test, truth) {
  const w = Math.min(test.w, truth.w)
  const h = Math.min(test.h, truth.h)
  const near = (d, i) => Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) < 14
  let all = 0
  let mae = 0
  let dark = 0
  let lighten = 0
  let veins = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const it = (y * test.w + x) * 3
      const ir = (y * truth.w + x) * 3
      if (near(truth.data, ir) && near(test.data, it)) continue
      const lt = luminance(test.data, it)
      const lr = luminance(truth.data, ir)
      all++
      mae += Math.abs(lt - lr)
      if (lr < 90) {
        dark++
        lighten += Math.max(0, lt - lr)
        if (lt - lr > 25) veins++
      }
    }
  }
  const round = (v) => Math.round(v * 100) / 100
  return { pixelsSombres: dark, veinesFranches: round((100 * veins) / Math.max(dark, 1)), eclaircissement: round(lighten / Math.max(dark, 1)), mae: round(mae / Math.max(all, 1)), pixels: all }
}

/** Niveau de mipmap lu par le GPU sur le personnage (valeur du rouge décodée du sRGB, × 16). */
async function lodStats(rect) {
  await page.evaluate(() => window.lab.debugLod())
  const { data } = await raw(await grab(rect, 1.75))
  const lods = []
  for (let i = 0; i < data.length; i += 3) {
    if (data[i + 2] > 200 && data[i] > 0 && data[i + 1] < 20) {
      const v = data[i] / 255
      lods.push(16 * (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    }
  }
  lods.sort((a, b) => a - b)
  const at = (q) => Math.round(lods[Math.floor(lods.length * q)] * 100) / 100
  return { pixels: lods.length, p10: at(0.1), mediane: at(0.5), p90: at(0.9) }
}

const results = {}
for (const character of CHARACTERS) {
  for (const [rotationName, rotY] of Object.entries(ROTATIONS)) {
    const key = `${character}/${rotationName}`
    const load = (url) => page.evaluate(([u, c, r]) => window.lab.load(u, c, r, 0.3), [url, character, rotY])
    const afterUrl = `/models/characters/${character}.glb`
    const beforeUrl = beforeDir ? `/${beforeDir}/${character}.glb` : afterUrl

    await load(beforeUrl)
    await page.evaluate(() => {
      window.lab.setBias(0)
      window.lab.setFilter('nomip')
    })
    const center = await page.evaluate(() => window.lab.project(0, 0.85, 0))
    const rect = [Math.round(center.x - HALF_W), Math.round(center.y - HALF_H), 2 * HALF_W, 2 * HALF_H]
    const truthBuf = await grab(rect, 14)
    const truth = await boxDown(truthBuf, 8)

    const shots = {}
    for (const variant of ['sans-biais', 'avec-biais']) {
      await load(variant === 'sans-biais' ? beforeUrl : afterUrl)
      if (variant === 'sans-biais') await page.evaluate(() => window.lab.setBias(0))
      const buf = await grab(rect, 1.75)
      shots[variant] = buf
      results[`${key}/${variant}`] = compare(await raw(buf), truth)
      console.log(key.padEnd(24), variant.padEnd(11), JSON.stringify(results[`${key}/${variant}`]))
    }
    if (withLod) {
      await load(afterUrl)
      results[`${key}/niveau-de-mipmap`] = await lodStats(rect)
      console.log(key.padEnd(24), 'niveau de mipmap lu par le GPU :', JSON.stringify(results[`${key}/niveau-de-mipmap`]))
    }
    if (outDir) {
      const tiles = [shots['sans-biais'], shots['avec-biais'], await sharp(truth.data, { raw: { width: truth.w, height: truth.h, channels: 3 } }).png().toBuffer()]
      // Trois vignettes de même taille (celle du rendu), agrandies 4× au plus proche voisin : sans biais | avec biais | vérité.
      const { width, height } = await sharp(tiles[1]).metadata()
      const zoomed = await Promise.all(tiles.map((t) => sharp(t).resize({ width: width * 4, height: height * 4, fit: 'fill', kernel: 'nearest' }).png().toBuffer()))
      await sharp({ create: { width: width * 4 * 3, height: height * 4, channels: 3, background: '#000' } })
        .composite(zoomed.map((input, i) => ({ input, left: i * width * 4, top: 0 })))
        .png()
        .toFile(join(outDir, `${character}-${rotationName}-sans-biais-avec-biais-verite.png`))
    }
  }
}
if (outDir) writeFileSync(join(outDir, 'mesures-veines.json'), JSON.stringify(results, null, 1))
await browser.close()
