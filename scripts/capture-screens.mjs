#!/usr/bin/env node
/* global window -- code évalué dans la page via page.evaluate */
/**
 * Captures d'écran de vérification visuelle (téléphone portrait, paysage).
 * Prérequis : `pnpm build && pnpm preview` sur 127.0.0.1:4173.
 * Usage : PW_CHROMIUM_PATH=… node scripts/capture-screens.mjs [dossier=screens]
 */
import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'

const out = process.argv[2] || 'screens'
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})

async function session(name, contextOptions) {
  const ctx = await browser.newContext(contextOptions)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const shot = async (label, wait = 1500) => {
    await page.waitForTimeout(wait)
    await page.screenshot({ path: `${out}/${name}-${label}.png` })
  }
  await page.goto(`${base}/?e2e=1`)
  await page.getByTestId('title-screen').waitFor()
  await shot('01-titre', 2500)
  await page.getByTestId('enter-button').click()
  await page.getByTestId('customizer').waitFor()
  await shot('02-perso', 2000)
  await page.getByTestId('customizer-done').click()
  await shot('03-accueil-minerve', 3500)
  await page.evaluate(() => window.__musee.state().closeDialogue())
  await shot('04-hall-spawn')
  const rooms = await page.evaluate(() => window.__musee.state().layout.rooms.map((r) => ({ id: r.id, b: r.bounds })))
  for (const r of rooms.filter((x) => x.id !== 'hall')) {
    const cx = (r.b.minX + r.b.maxX) / 2
    const cz = (r.b.minZ + r.b.maxZ) / 2
    await page.evaluate(([x, z]) => window.__musee.teleport(x, z), [cx, cz])
    await shot(`05-aile-${r.id}`, 2000)
    // point au fond de l'aile (derrière les cimaises éventuelles)
    const deepZ = r.id === 'industrialisation' ? r.b.minZ + 2 : r.b.minZ + 1.2
    await page.evaluate(([x, z]) => window.__musee.teleport(x, z), [cx, deepZ])
    await shot(`06-aile-${r.id}-fond`, 2000)
  }
  const frameIds = await page.evaluate(() => {
    const frames = window.__musee.state().layout.frames
    const pick = (wing) => frames.filter((f) => f.wing === wing)
    return ['infrastructures', 'industrialisation', 'culture'].flatMap((w) => {
      const list = pick(w)
      return [list[0], list[Math.floor(list.length / 2)], list[list.length - 1]].filter(Boolean).map((f) => f.personId)
    })
  })
  for (const [i, id] of frameIds.entries()) {
    await page.evaluate((pid) => window.__musee.goToPerson(pid), id)
    await shot(`07-portrait-${i}-${id}`, 2600)
  }
  const firstId = frameIds[0]
  await page.evaluate((id) => window.__musee.goToPerson(id), firstId)
  await page.waitForTimeout(2600)
  await page.evaluate(() => window.__musee.state().interact())
  await shot('08-fiche', 1500)
  await page.keyboard.press('Escape')
  const curator = await page.evaluate(() => window.__musee.state().layout.curator.position)
  await page.evaluate(([x, z]) => window.__musee.teleport(x, z + 2.2), [curator.x, curator.z])
  await shot('09-pres-minerve', 2000)
  await page.evaluate(() => window.__musee.state().setStampCardOpen(true))
  await shot('10-carnet', 1200)
  await page.evaluate(() => window.__musee.state().setStampCardOpen(false))

  // Plan en croix (WEL-888) : porte sud du hall, salle des Archives, retour, plan.
  const archives = await page.evaluate(() => {
    const a = window.__musee.state().archivesLayout
    return { door: a.door, arrival: a.arrival.position, archivist: a.archivist.position, slots: a.slots.map((s) => s.viewPoint) }
  })
  await page.evaluate(([x, z]) => window.__musee.teleport(x, z), [archives.door.x, archives.door.z - 1.6])
  await shot('11-hall-porte-sud', 2000)
  await page.evaluate(([x, z]) => window.__musee.teleport(x, z), [archives.archivist.x, archives.door.z - 0.8])
  await shot('12-hall-bord-sud-est', 2000)
  await page.evaluate(([x, z]) => window.__musee.teleport(x, z), [archives.arrival.x, archives.arrival.z])
  await shot('13-archives-accueil', 3000)
  await page.evaluate(() => window.__musee.state().closeDialogue())
  await shot('14-archives-arrivee', 1200)
  await page.evaluate(([x, z]) => window.__musee.teleport(x, z + 1.4), [archives.archivist.x, archives.archivist.z])
  await shot('15-archives-archiviste', 2000)
  const mid = archives.slots[Math.floor(archives.slots.length / 2)]
  await page.evaluate(([x, z]) => window.__musee.teleport(x, z), [mid.x, mid.z])
  await shot('16-archives-milieu', 2000)
  const last = archives.slots[archives.slots.length - 1]
  await page.evaluate(([x, z]) => window.__musee.teleport(x, z), [last.x, last.z])
  await shot('17-archives-fond', 2000)
  await page.evaluate(() => window.__musee.state().setMapOpen(true))
  await shot('18-plan', 1200)
  console.log(name, errors.length ? `erreurs : ${errors.join(' | ')}` : 'aucune erreur de page')
  await ctx.close()
}

await session('iphone', { ...devices['iPhone 13'] })
await session('paysage', { ...devices['iPhone 13 landscape'] })
await browser.close()
