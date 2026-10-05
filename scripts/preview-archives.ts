#!/usr/bin/env tsx
/**
 * Aperçu des archives AVANT publication : la relecture humaine du soir (docs/EVENING-AGENT.md §4)
 * se fait dans le vrai jeu, sans rien écrire en base ni publier. Le build local du site (servi
 * par `pnpm preview`) est ouvert dans Chromium en interceptant la lecture Supabase des archives,
 * qui renvoie la sortie de l'agent comme si elle était déjà publiée. Captures : la salle, puis une
 * fiche par archive (haut et bas de la fiche), en portrait iPhone.
 *
 * Prérequis : `pnpm build && pnpm preview` (127.0.0.1:4173) dans un autre terminal.
 * Usage : PW_CHROMIUM_PATH=… pnpm exec tsx scripts/preview-archives.ts --file sortie-agent.json
 *           [--out screens/archives-preview] [--lang fr|en]
 * Sortie non nulle si le jeu n'affiche pas exactement les archives acceptées par l'import.
 */
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, devices } from '@playwright/test'
import { parseAgentOutput, toSessionArchives } from '../src/data/eveningSchema'
import { toSupabaseRow } from './import-evening'

/**
 * Sous-ensemble de `window.__musee` (voir `src/scene/debugApi.ts`) utilisé ici. Les fonctions
 * passées à `page.evaluate` sont sérialisées : chacune refait son propre accès à `globalThis`
 * (le projet des scripts n'a pas la lib DOM, comme les tests E2E).
 */
interface MuseeState {
  archives: Record<string, unknown>
  sessions: { id: string }[]
  archivesLayout: { arrival: { position: { x: number; z: number } }; slots: { sessionId: string; viewPoint: { x: number; z: number } }[] } | null
  closeDialogue: () => void
  markArchivesDiscovered: () => boolean
  openSession: (id: string) => void
  closeSession: () => void
}
interface MuseeLike {
  state: () => MuseeState
  teleport: (x: number, z: number) => void
}
type WithMusee = { __musee: MuseeLike }

interface CliArgs {
  file?: string
  out: string
  lang: 'fr' | 'en'
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { out: 'screens/archives-preview', lang: 'fr' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--file') args.file = argv[++i]
    else if (arg === '--out') args.out = argv[++i]
    else if (arg === '--lang') args.lang = argv[++i] === 'en' ? 'en' : 'fr'
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!args.file) {
    console.error('Usage : tsx scripts/preview-archives.ts --file <sortie-agent.json> [--out <dossier>] [--lang fr|en]')
    process.exitCode = 1
    return
  }
  const raw: unknown = JSON.parse(await readFile(resolve(args.file), 'utf8'))
  const { accepted, errors, generatedAt } = parseAgentOutput(raw)
  if (errors.length) {
    console.log(`Rejets à l'import (${errors.length}) — non affichés dans l'aperçu :`)
    for (const e of errors) console.log(`  - ${e}`)
  }
  if (!accepted.length) {
    console.log('Aucune archive valide : rien à prévisualiser.')
    process.exitCode = 1
    return
  }
  // Publiées dans l'aperçu SEULEMENT : la réponse est fabriquée ici, la base n'est jamais touchée.
  const rows = toSessionArchives(accepted, generatedAt ?? new Date().toISOString(), true).map((a) => toSupabaseRow(a, { publish: true }))

  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
  await mkdir(args.out, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: args.lang === 'en' ? 'en-US' : 'fr-FR' })
  const page = await ctx.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  await page.route('**/rest/v1/session_archives*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }),
  )

  // Salle de présence à part : l'aperçu ne croise jamais de vrais visiteurs.
  await page.goto(`${base}/?e2e=1&presenceRoom=apercu-archives`)
  await page.getByTestId('title-screen').waitFor()
  await page.getByTestId('enter-button').click()
  await page.getByTestId('customizer').waitFor()
  await page.getByTestId('customizer-done').click()
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const s = (globalThis as unknown as WithMusee).__musee.state()
    s.closeDialogue()
    s.markArchivesDiscovered()
  })

  const loaded = await page.evaluate(() => Object.keys((globalThis as unknown as WithMusee).__musee.state().archives).sort())
  const expected = accepted.map((a) => a.sessionId).sort()
  const missing = expected.filter((id) => !loaded.includes(id))
  const extra = loaded.filter((id) => !expected.includes(id))

  const layout = await page.evaluate(() => {
    const state = (globalThis as unknown as WithMusee).__musee.state()
    const a = state.archivesLayout
    if (!a) throw new Error('plan des Archives absent')
    const order = state.sessions.map((s) => s.id)
    return { arrival: a.arrival.position, slots: a.slots.map((s) => ({ id: s.sessionId, x: s.viewPoint.x, z: s.viewPoint.z })), order }
  })
  const shot = async (name: string, wait = 1200) => {
    await page.waitForTimeout(wait)
    await page.screenshot({ path: `${args.out}/${name}.png` })
  }

  await page.evaluate(([x, z]) => (globalThis as unknown as WithMusee).__musee.teleport(x, z), [layout.arrival.x, layout.arrival.z])
  await shot('00-salle-arrivee', 2500)
  const mid = layout.slots[Math.floor(layout.slots.length / 2)]
  if (mid) {
    await page.evaluate(([x, z]) => (globalThis as unknown as WithMusee).__musee.teleport(x, z), [mid.x, mid.z])
    await shot('00-salle-milieu', 2000)
  }

  for (const id of expected) {
    const slot = layout.slots.find((s) => s.id === id)
    if (!slot) continue
    const n = String(layout.order.indexOf(id) + 1).padStart(2, '0')
    await page.evaluate(([x, z]) => (globalThis as unknown as WithMusee).__musee.teleport(x, z), [slot.x, slot.z])
    await page.waitForTimeout(900)
    await page.evaluate((sid) => (globalThis as unknown as WithMusee).__musee.state().openSession(sid), id)
    await page.getByTestId('archive-card').waitFor()
    await shot(`${n}-${id}-haut`, 700)
    // Bas de la fiche (fin de la transcription) : on fait défiler les conteneurs de la fiche.
    await page.evaluate(() => {
      type Scrollable = { scrollHeight: number; clientHeight: number; scrollTop: number }
      const doc = (globalThis as unknown as { document: { querySelectorAll: (sel: string) => ArrayLike<Scrollable> } }).document
      const nodes = doc.querySelectorAll('[data-testid="archive-card"], [data-testid="archive-card"] *')
      for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i]
        if (el.scrollHeight > el.clientHeight + 4) el.scrollTop = el.scrollHeight
      }
    })
    await shot(`${n}-${id}-bas`, 500)
    await page.evaluate(() => (globalThis as unknown as WithMusee).__musee.state().closeSession())
  }

  await browser.close()
  console.log(`\nAperçu : ${expected.length} archive(s) acceptée(s), ${loaded.length} affichée(s) par le jeu — captures dans ${args.out}/`)
  const programme = layout.order.filter((id) => !expected.includes(id))
  if (programme.length) console.log(`Séquences sans archive (la vitrine reste « en cours de rédaction ») : ${programme.join(', ')}`)
  if (missing.length || extra.length) {
    console.error(`ÉCART : manquantes dans le jeu [${missing.join(', ')}], en trop [${extra.join(', ')}]`)
    process.exitCode = 1
  }
  if (pageErrors.length) {
    console.error(`Erreurs de page : ${pageErrors.join(' | ')}`)
    process.exitCode = 1
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
