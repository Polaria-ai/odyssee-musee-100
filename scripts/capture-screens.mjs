#!/usr/bin/env node
/* global window -- code évalué dans la page via page.evaluate */
/**
 * Captures d'écran de vérification visuelle (téléphone portrait, paysage).
 * Prérequis : `pnpm build && pnpm preview` sur 127.0.0.1:4173 (ou E2E_BASE_URL).
 * Usage : PW_CHROMIUM_PATH=… node scripts/capture-screens.mjs [dossier=screens] [--chat]
 *
 * `--chat` : ne capture que l'entrée dans le jeu (bulle d'accueil de Rémi en bas de l'écran, musée visible) et le chat
 * avec Rémi · IA (V5) ouvert au comptoir par « Parler à Rémi », sur PC 1440×900, iPhone 390×844 et paysage 844×390,
 * avec deux échanges simulés. `/api/remi` est intercepté (réponses SSE au format de `src/features/remiChat/contract.ts`) :
 * aucun appel réseau réel. Le chat est translucide : le musée doit se voir derrière Rémi et derrière les bulles.
 */
import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'

const args = process.argv.slice(2)
const chatOnly = args.includes('--chat')
const out = args.find((a) => !a.startsWith('--')) || 'screens'
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})

async function session(name, contextOptions) {
  const ctx = await browser.newContext(contextOptions)
  ctx.setDefaultTimeout(120_000)
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
  // Plus d'écran de personnalisation : on entre directement en Cyril (décision du 29/09).
  await page.getByTestId('enter-button').click()
  // L'accueil de Rémi est la bulle scriptée en bas de l'écran (le chat ne s'ouvre qu'au comptoir).
  await shot('03-accueil-remi', 3500)
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
    // L'entrée dans les Archives ouvre l'accueil de l'Archiviste : on le ferme avant la suite.
    await page.evaluate(() => window.__musee.state().closeDialogue())
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
  await page.evaluate(() => window.__musee.state().closeDialogue())
  const curator = await page.evaluate(() => window.__musee.state().layout.curator.position)
  await page.evaluate(([x, z]) => window.__musee.teleport(x, z + 2.2), [curator.x, curator.z])
  await shot('09-pres-remi', 2000)
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

/** Corps d'un flux SSE au format du contrat : un `delta` par morceau, puis `done`. */
function sse(chunks) {
  return [...chunks.map((text) => ({ type: 'delta', text })), { type: 'done' }].map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
}

/**
 * Entrée dans le jeu (bulle d'accueil), puis chat avec Rémi · IA ouvert au comptoir : premier message, puis deux
 * échanges simulés (réponses interceptées sur `/api/remi`).
 */
async function chatSession(name, contextOptions) {
  const ctx = await browser.newContext({ locale: 'fr-FR', ...contextOptions })
  // Machine partagée et rendu logiciel : les attentes par défaut (30 s) sont parfois trop courtes.
  ctx.setDefaultTimeout(120_000)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const replies = [
    ['Les Archives de 2040 sont au sud du hall. ', 'Chaque séquence de la soirée y a sa vitrine : vous pouvez les consulter une à une.'],
    ['Je vous suggère l\'aile Infrastructures, à l\'ouest. ', 'Devant un portrait, touchez « Regarder » pour ouvrir sa fiche.'],
  ]
  let asked = 0
  await page.route('**/api/remi', (route) =>
    route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' }, body: sse(replies[Math.min(asked++, replies.length - 1)]) }),
  )
  const shot = async (label, wait = 600) => {
    await page.waitForTimeout(wait)
    await page.screenshot({ path: `${out}/${name}-${label}.png` })
  }
  await page.goto(`${base}/?e2e=1`)
  await page.getByTestId('title-screen').waitFor()
  await page.getByTestId('enter-button').click()
  // Arrivée directement dans le jeu : la bulle de Rémi en bas, le musée visible, aucun chat.
  await page.getByTestId('dialogue-box').waitFor()
  await shot('chat-01-entree', 3500)
  await page.evaluate(() => window.__musee.state().closeDialogue())
  // Au comptoir : « Parler à Rémi » ouvre le chat par-dessus le musée.
  const curator = await page.evaluate(() => window.__musee.state().layout.curator.position)
  await page.evaluate(([x, z]) => window.__musee.teleport(x, z + 2.2), [curator.x, curator.z])
  await page.getByTestId('action-button').waitFor()
  await shot('chat-02-comptoir', 4000)
  await page.getByTestId('action-button').click()
  await page.getByTestId('remi-chat').waitFor()
  // Le buste 3D arrive après l'ouverture (silhouette en attendant) : on attend qu'il soit à l'écran avant de photographier.
  await page.locator('[data-testid="remi-bust"][data-state="ready"]').waitFor().catch(() => errors.push('buste 3D jamais prêt'))
  await shot('chat-03-ouverture', 1500)
  await page.getByTestId('remi-chat-suggestion').nth(2).click()
  await page.getByTestId('remi-chat-message').nth(2).waitFor()
  await page.getByTestId('remi-chat-input').fill('Par où commencer ?')
  await shot('chat-04-saisie', 400)
  await page.getByTestId('remi-chat-send').click()
  await page.getByTestId('remi-chat-message').nth(4).waitFor()
  await page.getByTestId('remi-chat-typing').waitFor({ state: 'detached' })
  await shot('chat-05-deux-echanges', 800)
  console.log(name, errors.length ? `erreurs : ${errors.join(' | ')}` : 'aucune erreur de page')
  await ctx.close()
}

if (chatOnly) {
  await chatSession('pc-1440x900', { viewport: { width: 1440, height: 900 } })
  await chatSession('iphone-390x844', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
  await chatSession('paysage-844x390', { ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 } })
} else {
  await session('iphone', { ...devices['iPhone 13'] })
  await session('paysage', { ...devices['iPhone 13 landscape'] })
}
await browser.close()
