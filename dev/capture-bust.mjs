#!/usr/bin/env node
/* global process, console -- script Node ; la page est pilotée par Playwright */
/**
 * Captures de vérification visuelle du buste de Rémi · IA (WEL-919), via `dev/bust-demo.html`.
 * Prérequis : `pnpm exec vite --host 127.0.0.1 --port 4181 --strictPort` (serveur de développement).
 * Usage :
 *   PW_CHROMIUM_PATH=… node dev/capture-bust.mjs <dossier> all
 *   PW_CHROMIUM_PATH=… node dev/capture-bust.mjs <dossier> custom <nom> "variant=split&mood=speaking&at=8&speed=0"
 *   PW_CHROMIUM_PATH=… node dev/capture-bust.mjs <dossier> sheet <nom> "variant=split&mood=speaking&at=8" [pas=0.5] [images=8]
 *     → planche de contact : `images` instants à `pas` secondes d'intervalle (avance de la chorégraphie sans
 *       rendu entre deux, `window.__bustControl.advance`), les images seules dans `<dossier>/<nom>-images/`.
 *   PW_CHROMIUM_PATH=… node dev/capture-bust.mjs <dossier> hands <nom> "variant=split&mood=speaking&at=8" [pas=0.5] [images=8]
 *     → comme `sheet`, mais gros plan sur chaque poing (os LeftHand / RightHand projetés), pour juger le skinning du poignet.
 *   PW_CHROMIUM_PATH=… node dev/capture-bust.mjs <dossier> video <nom> "variant=split&mood=speaking&at=8" [pas=0.0833] [images=72]
 *     → images seules puis, si `ffmpeg` est installé, `<dossier>/<nom>.mp4` (12 i/s par défaut) pour juger le mouvement.
 * Temps figé (`speed=0`, `at=N`) : la pose est exactement celle de l'instant N de la chorégraphie.
 */
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

const [outDir = 'captures', mode = 'all', customName, customQuery, stepArg, countArg] = process.argv.slice(2)
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4181'
mkdirSync(outDir, { recursive: true })

const SIZE = { split: { width: 720, height: 900 }, fullscreen: { width: 390, height: 844 } }

// Temps figé (`speed=0`) : pose exacte à l'instant `at` de la chorégraphie (graine par défaut). À cette graine,
// 4,8 s = ouverture des bras, 9 s = paumes ouvertes, 11,8 s = énumération (trois temps), 15,2 s = main sur le cœur.
const PRESETS = [
  ...['idle', 'listening', 'thinking', 'speaking'].flatMap((mood) =>
    ['split', 'fullscreen'].map((variant) => ({ name: `${variant}-${mood}`, query: `variant=${variant}&mood=${mood}&at=9&speed=0` })),
  ),
  ...[
    [4.8, 'ouverture-des-bras'],
    [11.8, 'enumeration'],
    [15.2, 'main-sur-le-coeur'],
  ].flatMap(([at, gesture]) =>
    ['split', 'fullscreen'].map((variant) => ({ name: `${variant}-speaking-instant-${gesture}`, query: `variant=${variant}&mood=speaking&at=${at}&speed=0` })),
  ),
]

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})

const problems = []

async function capture({ name, query }) {
  const variant = /variant=(\w+)/.exec(query)?.[1] ?? 'split'
  const size = SIZE[variant]
  const ctx = await browser.newContext({ viewport: { width: size.width + 40, height: size.height + 40 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${name}] console.${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`))
  await page.goto(`${base}/dev/bust-demo.html?${query}&controls=0`)
  await page.locator('[data-testid="remi-bust"][data-state="ready"]').waitFor({ timeout: 90000 })
  // La silhouette de chargement s'efface en 0,35 s : on attend qu'elle soit transparente (machine chargée = fondu plus long).
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="remi-bust-silhouette"]')
    return !el || getComputedStyle(el).opacity === '0'
  }, undefined, { timeout: 90000 })
  await page.waitForTimeout(1800)
  const path = `${outDir}/${name}.png`
  await page.getByTestId('frame').screenshot({ path })
  await ctx.close()
  console.log(path)
}

/** Ouvre la page de démonstration, temps figé, et attend que le buste soit affiché et la silhouette effacée. */
async function openFrozen(query, scale = 1) {
  const variant = /variant=(\w+)/.exec(query)?.[1] ?? 'split'
  const size = SIZE[variant]
  // Gros plans : marge de 300 px autour du cadre, pour que le découpage autour d'un poing en bord de cadre reste dans la page.
  const margin = scale > 1 ? 340 : 40
  const ctx = await browser.newContext({ viewport: { width: size.width + margin, height: size.height + margin }, deviceScaleFactor: scale })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${customName}] console.${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`[${customName}] pageerror: ${e.message}`))
  await page.goto(`${base}/dev/bust-demo.html?${query}&speed=0&controls=0`)
  await page.locator('[data-testid="remi-bust"][data-state="ready"]').waitFor({ timeout: 90000 })
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="remi-bust-silhouette"]')
    return !el || getComputedStyle(el).opacity === '0'
  }, undefined, { timeout: 90000 })
  await page.waitForFunction(() => Boolean(window.__bustControl), undefined, { timeout: 30000 })
  return { ctx, page }
}

/** Deux images complètes de la boucle de rendu : la pose avancée à la main est alors à l'écran. */
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250)))))

/** Planche (ou gros plans des poings) d'`images` instants espacés de `pas` secondes. */
async function sheet(name, query, closeups, video = false) {
  const step = Number(stepArg ?? (video ? 1 / 12 : 0.5))
  const count = Number(countArg ?? (video ? 72 : 8))
  const { ctx, page } = await openFrozen(query, closeups ? 2 : 1)
  const dir = `${outDir}/${name}-images`
  mkdirSync(dir, { recursive: true })
  const tiles = []
  for (let k = 0; k < count; k++) {
    if (k > 0) await page.evaluate((s) => window.__bustControl.advance(s), step)
    await settle(page)
    const frame = page.getByTestId('frame')
    const box = await frame.boundingBox()
    if (!closeups) {
      const file = `${dir}/${String(k).padStart(3, '0')}.png`
      await frame.screenshot({ path: file })
      tiles.push(file)
      continue
    }
    for (const hand of ['RightHand', 'LeftHand']) {
      const at = await page.evaluate((n) => window.__bustProject(n), hand)
      if (!at) continue
      const cx = box.x + ((at.x + 1) / 2) * box.width
      const cy = box.y + ((1 - at.y) / 2) * box.height
      const half = 150
      const file = `${dir}/${String(k).padStart(2, '0')}-${hand}.png`
      await page.screenshot({ path: file, clip: { x: Math.max(0, cx - half), y: Math.max(0, cy - half), width: half * 2, height: half * 2 } })
      tiles.push(file)
    }
  }
  await ctx.close()
  if (video) {
    const out = `${outDir}/${name}.mp4`
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(Math.round(1 / step)), '-i', `${dir}/%03d.png`, '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-pix_fmt', 'yuv420p', '-crf', '20', out], { stdio: 'inherit' })
    console.log(r.status === 0 ? out : `ffmpeg indisponible ou en échec : images dans ${dir}`)
    return
  }
  const cols = closeups ? 4 : 4 // gros plans : une paire (main droite, main gauche) par instant, deux instants par rangée
  const meta = await sharp(tiles[0]).metadata()
  const fit = closeups ? 0.7 : meta.width > 500 ? 0.5 : 0.6
  const tw = Math.round(meta.width * fit)
  const th = Math.round(meta.height * fit)
  const rows = Math.ceil(tiles.length / cols)
  const resized = await Promise.all(tiles.map((f) => sharp(f).resize(tw, th).toBuffer()))
  await sharp({ create: { width: tw * cols, height: th * rows, channels: 3, background: '#0b1020' } })
    .composite(resized.map((input, i) => ({ input, left: (i % cols) * tw, top: Math.floor(i / cols) * th })))
    .png()
    .toFile(`${outDir}/${name}.png`)
  console.log(`${outDir}/${name}.png`)
}

if (mode === 'custom') await capture({ name: customName, query: customQuery })
else if (mode === 'sheet') await sheet(customName, customQuery, false)
else if (mode === 'hands') await sheet(customName, customQuery, true)
else if (mode === 'video') await sheet(customName, customQuery, false, true)
else for (const preset of PRESETS) await capture(preset)

await browser.close()
if (problems.length) console.log(`\nMessages console :\n${[...new Set(problems)].join('\n')}`)
else console.log('\nAucun message console (erreur ou avertissement).')
