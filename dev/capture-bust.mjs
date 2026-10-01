#!/usr/bin/env node
/* global process, console -- script Node ; la page est pilotée par Playwright */
/**
 * Captures de vérification visuelle du buste de Rémi · IA (WEL-919), via `dev/bust-demo.html`.
 * Prérequis : `pnpm exec vite --host 127.0.0.1 --port 4181 --strictPort` (serveur de développement).
 * Usage :
 *   PW_CHROMIUM_PATH=… node dev/capture-bust.mjs <dossier> all
 *   PW_CHROMIUM_PATH=… node dev/capture-bust.mjs <dossier> custom <nom> "variant=split&mood=speaking&at=8&speed=0"
 * Temps figé (`speed=0`, `at=N`) : la pose est exactement celle de l'instant N de la chorégraphie.
 */
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const [outDir = 'captures', mode = 'all', customName, customQuery] = process.argv.slice(2)
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

if (mode === 'custom') await capture({ name: customName, query: customQuery })
else for (const preset of PRESETS) await capture(preset)

await browser.close()
if (problems.length) console.log(`\nMessages console :\n${[...new Set(problems)].join('\n')}`)
else console.log('\nAucun message console (erreur ou avertissement).')
