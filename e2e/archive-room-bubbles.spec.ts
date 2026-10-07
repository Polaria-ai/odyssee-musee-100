/**
 * Accès aux 22 thèmes directement dans la salle : vrais boutons DOM ancrés aux vitrines.
 * La poignée E2E prépare la position et lit l'état ; elle n'ouvre jamais une fiche ni un thème.
 * Toutes les transcriptions et synthèses de cette spec sont fictives.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  collectConsoleIssues,
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  hasHorizontalOverflow,
  museeInput,
  museePlayer,
  teleport,
  waitForCameraSettled,
} from './support/museeApi'

test.use({ locale: 'fr-FR', reducedMotion: 'reduce' })

const SESSION_IDS = ['table-ronde-1', 'table-ronde-2', 'table-ronde-3'] as const
const THEME_COUNTS = [7, 8, 7] as const
const MIN_TOUCH_TARGET = 48

interface Highlight {
  id: string
  title: { fr: string; en: string }
  body: { fr: string; en: string }
  source: { excerpt: string; startSec?: number; endSec?: number }
}

interface ArchiveRow {
  session_id: string
  transcript_fr: string
  transcript_en: string
  highlights?: Highlight[]
  archived_at: string
  published: boolean
}

interface ArchivesState {
  currentRoom: string | null
  nearbySessionId: string | null
  openSessionId: string | null
  openArchiveHighlightId: string | null
  sessions: { id: string; kind: string; title: { fr: string; en: string } }[]
  archives: Record<string, { published: boolean; highlights?: Highlight[] }>
  archivesLayout: {
    arrival: { position: { x: number; z: number } }
    slots: { sessionId: string; viewPoint: { x: number; z: number } }[]
  } | null
}

function archiveFixture(tableIndex: number): ArchiveRow {
  const table = tableIndex + 1
  const highlights = Array.from({ length: THEME_COUNTS[tableIndex] }, (_, index): Highlight => {
    const number = String(index + 1).padStart(2, '0')
    return {
      id: `room-test-${table}-${number}`,
      title: {
        fr: `Thème fictif ${table}.${number} · Une idée expliquée avec un titre long et lisible sur un petit écran`,
        // Une absence de traduction vérifie le repli français du titre et du corps.
        en: index === 1 ? '' : `Fictional theme ${table}.${number} · A long title to check reading and wrapping on a small screen`,
      },
      body: {
        fr: `[Test salle ${table}.${number}] Synthèse fictive française. ${'motlongdetest'.repeat(12)}`,
        en: index === 1 ? '' : `[Room test ${table}.${number}] Fictional English summary. ${'longtestword'.repeat(12)}`,
      },
      source: {
        excerpt: `[Test salle ${table}.${number}] Ce passage source français exact appartient uniquement à cette transcription fictive.`,
        ...(index === 0 ? { startSec: 70 + tableIndex * 900, endSec: 93 + tableIndex * 900 } : {}),
      },
    }
  })
  return {
    session_id: SESSION_IDS[tableIndex],
    transcript_fr: [
      `[Test salle ${table}] Début de la transcription intégrale fictive.`,
      'Ce paragraphe fictif est conservé en dehors des extraits choisis. '.repeat(8),
      ...highlights.map((highlight) => highlight.source.excerpt),
      `[Test salle ${table}] Fin de la transcription intégrale fictive.`,
    ].join('\n\n'),
    transcript_en: '',
    highlights,
    archived_at: '2026-10-07T08:00:00+02:00',
    published: true,
  }
}

async function archivesState(page: Page): Promise<ArchivesState> {
  return page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: { state: () => Record<string, unknown> } }).__musee
    if (!musee) throw new Error('window.__musee indisponible : ?e2e=1 requis')
    const state = musee.state()
    return {
      currentRoom: state.currentRoom,
      nearbySessionId: state.nearbySessionId,
      openSessionId: state.openSessionId,
      openArchiveHighlightId: state.openArchiveHighlightId,
      sessions: state.sessions,
      archives: state.archives,
      archivesLayout: state.archivesLayout,
    }
  }) as Promise<ArchivesState>
}

function group(page: Page, sessionId: string): Locator {
  return page.locator(`[data-testid="archive-world-group"][data-session-id="${sessionId}"]`)
}

function groupToggle(page: Page, sessionId: string): Locator {
  return page.locator(`[data-testid="archive-world-group-toggle"][data-session-id="${sessionId}"]`)
}

function bubble(page: Page, sessionId: string, highlightId: string): Locator {
  return page.locator(`[data-testid="archive-world-bubble"][data-session-id="${sessionId}"][data-highlight-id="${highlightId}"]`)
}

async function activate(locator: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await locator.tap()
  else await locator.click()
}

async function enterArchivesWithRows(page: Page, rows: ArchiveRow[]): Promise<ArchivesState> {
  let reads = 0
  await page.route('**/rest/v1/session_archives*', (route) => {
    reads += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  expect(reads, 'le build E2E doit réellement lire les archives Supabase interceptées').toBeGreaterThan(0)
  const state = await archivesState(page)
  expect(state.sessions.map((session) => session.id)).toEqual([...SESSION_IDS])
  expect(state.sessions.every((session) => session.kind === 'table-ronde')).toBe(true)
  expect(state.archivesLayout).not.toBeNull()
  expect(state.archivesLayout!.slots.map((slot) => slot.sessionId).sort()).toEqual([...SESSION_IDS])
  await expect(page.getByTestId('archive-room-bubbles')).toBeHidden()
  const arrival = state.archivesLayout!.arrival.position
  await teleport(page, arrival.x, arrival.z)
  await expect.poll(async () => (await archivesState(page)).currentRoom).toBe('archives')
  // L'accueil de la première arrivée est fermé par ses vrais contrôles, sans muter le store.
  await dismissWelcomeDialogue(page)
  return archivesState(page)
}

async function standAtVitrine(page: Page, state: ArchivesState, sessionId: string): Promise<void> {
  const slot = state.archivesLayout!.slots.find((candidate) => candidate.sessionId === sessionId)!
  await teleport(page, slot.viewPoint.x, slot.viewPoint.z)
  await expect.poll(async () => (await archivesState(page)).nearbySessionId).toBe(sessionId)
  await waitForCameraSettled(page)
  await expect(groupToggle(page, sessionId)).toBeVisible()
  await expect(groupToggle(page, sessionId)).toHaveAttribute('aria-expanded', 'true')
}

async function expectTouchTarget(locator: Locator): Promise<void> {
  const bounds = await locator.boundingBox()
  expect(bounds, 'cible tactile mesurable').not.toBeNull()
  expect(bounds!.width, 'largeur cible tactile').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
  expect(bounds!.height, 'hauteur cible tactile').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
}

async function expectInsideViewport(page: Page, locator: Locator): Promise<void> {
  const bounds = await locator.boundingBox()
  const viewport = page.viewportSize()!
  expect(bounds, 'zone visible mesurable').not.toBeNull()
  expect(bounds!.x, 'bord gauche de la zone').toBeGreaterThanOrEqual(-1)
  expect(bounds!.y, 'bord supérieur de la zone').toBeGreaterThanOrEqual(-1)
  expect(bounds!.x + bounds!.width, 'bord droit de la zone').toBeLessThanOrEqual(viewport.width + 1)
  expect(bounds!.y + bounds!.height, 'bord inférieur de la zone').toBeLessThanOrEqual(viewport.height + 1)
}

async function expectFocusedTheme(page: Page, row: ArchiveRow, selected: Highlight, lang: 'fr' | 'en' = 'fr'): Promise<void> {
  const card = page.getByTestId('archive-card')
  const detail = page.getByTestId('archive-highlight-detail')
  await expect(card).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(detail).toHaveAttribute('data-session-id', row.session_id)
  await expect(detail).toHaveAttribute('data-highlight-id', selected.id)
  await expect(card.getByRole('heading', { name: selected.title[lang] || selected.title.fr, exact: true })).toBeVisible()
  await expect(detail).toContainText(selected.body[lang] || selected.body.fr)
  const source = page.getByTestId('archive-focused-source')
  await expect(source).toBeVisible()
  await expect(source).toHaveAttribute('lang', 'fr')
  expect(await source.textContent()).toBe(selected.source.excerpt)
  expect(row.transcript_fr.includes(await source.textContent() ?? '')).toBe(true)
  await expect(page.getByTestId('archive-transcript')).toHaveCount(0)
  await expect(page.getByTestId('archive-highlights')).toHaveCount(0)
  for (const other of row.highlights!.filter((highlight) => highlight.id !== selected.id)) {
    await expect(card).not.toContainText(other.title.fr)
    if (other.title.en) await expect(card).not.toContainText(other.title.en)
    await expect(detail).not.toContainText(other.source.excerpt)
  }
  await expect(page.getByTestId('archive-room-bubbles')).toBeHidden()
  await expect(page.getByTestId('joystick-zone')).toHaveCount(0)
  const state = await archivesState(page)
  expect(state.openSessionId).toBe(row.session_id)
  expect(state.openArchiveHighlightId).toBe(selected.id)
  expect((await museeInput(page)).tapTarget, 'le tap de la bulle ne doit pas commander le sol').toBeNull()
}

async function closeTheme(page: Page, hasTouch: boolean): Promise<void> {
  const close = page.getByTestId('archive-close')
  await close.scrollIntoViewIfNeeded()
  await activate(close, hasTouch)
  await expect(page.getByTestId('archive-card')).toHaveCount(0)
  // La première consultation des trois tables déclenche le dialogue du tampon Archives.
  // On le ferme par ses vrais contrôles avant de rejoindre les autres thèmes de la salle.
  await dismissWelcomeDialogue(page)
  await expect(page.getByTestId('archive-room-bubbles')).toBeVisible()
  await expect(page.getByTestId('joystick-zone')).toBeVisible()
  const state = await archivesState(page)
  expect(state.openSessionId).toBeNull()
  expect(state.openArchiveHighlightId).toBeNull()
}

/** Défilement natif du nuage : il ne doit ni ouvrir une fiche, ni entraîner le joueur. */
async function scrollThemeCloud(page: Page, body: Locator, hasTouch: boolean): Promise<void> {
  const scrollTop = () => body.evaluate((element) => (element as unknown as { scrollTop: number }).scrollTop)
  const dimensions = await body.evaluate((element) => {
    const box = element as unknown as { scrollHeight: number; clientHeight: number }
    return { scrollHeight: box.scrollHeight, clientHeight: box.clientHeight }
  })
  expect(dimensions.scrollHeight, 'les titres longs sollicitent le défilement interne à 320 px').toBeGreaterThan(dimensions.clientHeight)
  const box = (await body.boundingBox())!
  const origin = { x: box.x + box.width / 2, y: box.y + box.height * 0.8 }
  const before = await museePlayer(page)
  if (hasTouch) {
    const touch = await page.context().newCDPSession(page)
    try {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...origin, id: 1 }] })
      for (let index = 1; index <= 6; index++) {
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: origin.x, y: origin.y - index * 20, id: 1 }],
        })
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } finally {
      await touch.detach()
    }
  } else {
    await page.mouse.move(origin.x, origin.y)
    await page.mouse.wheel(0, 200)
  }
  await expect.poll(scrollTop).toBeGreaterThan(0)
  await expect(page.getByTestId('archive-card')).toHaveCount(0)
  const after = await museePlayer(page)
  expect(Math.hypot(after.x - before.x, after.z - before.z), 'défiler les titres ne fait pas marcher le joueur').toBeLessThan(0.05)
  const input = await museeInput(page)
  expect(input.moveX).toBe(0)
  expect(input.moveY).toBe(0)
  expect(input.tapTarget).toBeNull()
}

/** Reprise effective du déplacement après le retour au jeu, avec un glissé tactile sur mobile. */
async function expectJoystickResumes(page: Page, hasTouch: boolean): Promise<void> {
  const viewport = page.viewportSize()!
  const candidates = [
    { x: viewport.width * 0.15, y: viewport.height * 0.9 },
    { x: viewport.width * 0.15, y: viewport.height * 0.72 },
    { x: viewport.width * 0.5, y: viewport.height * 0.72 },
    { x: viewport.width * 0.15, y: viewport.height * 0.56 },
  ]
  let origin: { x: number; y: number } | undefined
  for (const candidate of candidates) {
    const ownsPoint = await page.evaluate(({ x, y }) => {
      const doc = (globalThis as unknown as {
        document: { elementFromPoint: (x: number, y: number) => { closest: (selector: string) => unknown } | null }
      }).document
      return Boolean(doc.elementFromPoint(x, y)?.closest('[data-testid="joystick-zone"]'))
    }, candidate)
    if (ownsPoint) {
      origin = candidate
      break
    }
  }
  expect(origin, 'une zone réelle du joystick doit rester atteignable sans traverser les bulles').toBeDefined()
  const point = origin!
  const before = await museePlayer(page)
  const touch = hasTouch ? await page.context().newCDPSession(page) : null
  try {
    if (touch) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] })
    } else {
      await page.mouse.move(point.x, point.y)
      await page.mouse.down()
    }
    for (let index = 1; index <= 6; index++) {
      const moved = { x: point.x, y: point.y - index * 12 }
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...moved, id: 1 }] })
      else await page.mouse.move(moved.x, moved.y)
    }
    await expect(page.getByTestId('joystick-knob')).toBeVisible()
    await expect.poll(async () => {
      const player = await museePlayer(page)
      return Math.hypot(player.x - before.x, player.z - before.z)
    }, { timeout: 6_000, message: 'le vrai glissé doit déplacer le joueur après fermeture' }).toBeGreaterThan(0.15)
  } finally {
    if (touch) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await touch.detach()
    } else {
      await page.mouse.up()
    }
  }
  await expect.poll(async () => (await museeInput(page)).moveX).toBe(0)
  await expect.poll(async () => (await museeInput(page)).moveY).toBe(0)
  expect((await museeInput(page)).tapTarget).toBeNull()
}

test('salle : les 22 thèmes 7/8/7 ouvrent chacun leur fiche et leur source par vrai tap ou clic', async ({ page }, testInfo) => {
  test.setTimeout(150_000)
  const hasTouch = testInfo.project.use.hasTouch === true
  const issues = collectConsoleIssues(page)
  const rows = SESSION_IDS.map((_, index) => archiveFixture(index))
  const state = await enterArchivesWithRows(page, rows)
  expect(Object.keys(state.archives).sort()).toEqual([...SESSION_IDS])
  await expect(page.getByTestId('archive-world-group')).toHaveCount(3)
  await expect(page.getByTestId('archive-world-bubble')).toHaveCount(22)
  expect(await page.getByTestId('archive-world-group').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-session-id')).sort(),
  )).toEqual([...SESSION_IDS])

  for (const [index, row] of rows.entries()) {
    await standAtVitrine(page, state, row.session_id)
    const themes = group(page, row.session_id).getByTestId('archive-world-bubble')
    await expect(themes).toHaveCount(THEME_COUNTS[index])
    await expect(page.locator('[data-testid="archive-world-bubble"]:visible')).toHaveCount(THEME_COUNTS[index])
    await expect(groupToggle(page, row.session_id)).toContainText(String(THEME_COUNTS[index]))
    for (const highlight of row.highlights!) {
      const target = bubble(page, row.session_id, highlight.id)
      await expect(target).toHaveAccessibleName(new RegExp(highlight.title.fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      await target.scrollIntoViewIfNeeded()
      await expect(target).toBeInViewport()
      await expectTouchTarget(target)
      await activate(target, hasTouch)
      await expectFocusedTheme(page, row, highlight)
      await closeTheme(page, hasTouch)
    }
  }
  expect(issues.pageErrors).toEqual([])
  expect(issues.errors).toEqual([])
})

test('salle : le compteur choisi reste ouvert malgré la proximité et permet Enter, Espace et Échap', async ({ page }, testInfo) => {
  const hasTouch = testInfo.project.use.hasTouch === true
  const rows = SESSION_IDS.map((_, index) => archiveFixture(index))
  const state = await enterArchivesWithRows(page, rows)
  await standAtVitrine(page, state, SESSION_IDS[1])
  await expect(page.locator('[data-testid="archive-world-bubble"]:visible')).toHaveCount(8)

  const manual = groupToggle(page, SESSION_IDS[0])
  await expect(manual).toBeInViewport()
  await expectTouchTarget(manual)
  await activate(manual, hasTouch)
  await expect(manual).toHaveAttribute('aria-expanded', 'true')
  await expect(groupToggle(page, SESSION_IDS[1])).toHaveAttribute('aria-expanded', 'false')
  // Deux contrôles de proximité passent au minimum : le choix manuel ne doit pas être écrasé.
  await page.waitForTimeout(400)
  expect((await archivesState(page)).nearbySessionId).toBe(SESSION_IDS[1])
  await expect(manual).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('[data-testid="archive-world-bubble"]:visible')).toHaveCount(7)
  await expect(page.getByTestId('archive-card')).toHaveCount(0)

  if (testInfo.project.name === 'desktop') {
    const otherCounter = groupToggle(page, SESSION_IDS[2])
    await otherCounter.focus()
    await otherCounter.press('Space')
    await expect(otherCounter).toHaveAttribute('aria-expanded', 'true')
    await expect(manual).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('archive-card')).toHaveCount(0)
    expect((await museeInput(page)).tapTarget).toBeNull()
    await manual.focus()
    await manual.press('Enter')
    await expect(manual).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('archive-card')).toHaveCount(0)
    const firstTheme = bubble(page, SESSION_IDS[0], rows[0].highlights![0].id)
    // Tab rejoint le véritable bouton suivant, sans appeler l'action d'ouverture du store.
    await manual.press('Tab')
    await expect(firstTheme).toBeFocused()
    await firstTheme.press('Enter')
  } else {
    await activate(bubble(page, SESSION_IDS[0], rows[0].highlights![0].id), hasTouch)
  }
  await expectFocusedTheme(page, rows[0], rows[0].highlights![0])
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('archive-card')).toHaveCount(0)
  await expect(page.getByTestId('archive-room-bubbles')).toBeVisible()
  await expect(page.getByTestId('joystick-zone')).toBeVisible()
  expect((await archivesState(page)).openArchiveHighlightId).toBeNull()
})

test('salle : 320 px, FR/EN, fiche ciblée accessible, transcription complète et reprise tactile du jeu', async ({ page }, testInfo) => {
  const hasTouch = testInfo.project.use.hasTouch === true
  await page.setViewportSize({ width: 320, height: 568 })
  const rows = SESSION_IDS.map((_, index) => archiveFixture(index))
  const state = await enterArchivesWithRows(page, rows)
  await standAtVitrine(page, state, SESSION_IDS[0])
  await expectInsideViewport(page, group(page, SESSION_IDS[0]))
  expect(await hasHorizontalOverflow(page)).toBe(false)
  const roomAxe = await new AxeBuilder({ page }).include('[data-testid="archive-room-bubbles"]').analyze()
  const roomSerious = roomAxe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
  expect(roomSerious, roomSerious.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([])
  const roomScreenshot = testInfo.outputPath('archive-room-320.png')
  await page.screenshot({ path: roomScreenshot })
  await testInfo.attach('archive-room-320', { path: roomScreenshot, contentType: 'image/png' })
  await scrollThemeCloud(page, group(page, SESSION_IDS[0]).locator('.archive-world-group__body'), hasTouch)
  const last = bubble(page, SESSION_IDS[0], rows[0].highlights!.at(-1)!.id)
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport()
  await expectTouchTarget(last)
  await expectInsideViewport(page, group(page, SESSION_IDS[0]))

  const first = rows[0].highlights![0]
  await activate(bubble(page, SESSION_IDS[0], first.id), hasTouch)
  await expectFocusedTheme(page, rows[0], first)
  await expect(page.getByTestId('archive-card').getByRole('heading', { name: first.title.fr, exact: true })).toBeInViewport()
  await expect(page.getByTestId('archive-close')).toBeInViewport()
  await expectTouchTarget(page.getByTestId('archive-close'))
  await expectTouchTarget(page.getByTestId('archive-all-highlights'))
  const detailScreenshot = testInfo.outputPath('archive-focused-theme-320.png')
  await page.screenshot({ path: detailScreenshot })
  await testInfo.attach('archive-focused-theme-320', { path: detailScreenshot, contentType: 'image/png' })
  expect(await hasHorizontalOverflow(page)).toBe(false)
  const sheetOverflows = await page.getByTestId('archive-card').locator('.archive-card__sheet').evaluate((element) => {
    const sheet = element as unknown as { scrollWidth: number; clientWidth: number }
    return sheet.scrollWidth > sheet.clientWidth + 1
  })
  expect(sheetOverflows, 'la synthèse avec un mot très long reste contenue dans la fiche').toBe(false)
  const axe = await new AxeBuilder({ page }).include('[data-testid="archive-card"]').analyze()
  const serious = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([])

  await closeTheme(page, hasTouch)
  await activate(page.getByTestId('hud-lang'), hasTouch)
  await expect(bubble(page, SESSION_IDS[0], first.id)).toHaveAccessibleName(new RegExp(first.title.en))
  await activate(bubble(page, SESSION_IDS[0], first.id), hasTouch)
  await expectFocusedTheme(page, rows[0], first, 'en')
  await expect(page.getByTestId('archive-all-highlights')).toHaveAccessibleName('All themes and the transcript')
  await closeTheme(page, hasTouch)

  const fallback = rows[0].highlights![1]
  await expect(bubble(page, SESSION_IDS[0], fallback.id)).toHaveAccessibleName(new RegExp(fallback.title.fr))
  await activate(bubble(page, SESSION_IDS[0], fallback.id), hasTouch)
  await expectFocusedTheme(page, rows[0], fallback, 'en')
  const complete = page.getByTestId('archive-all-highlights')
  await complete.scrollIntoViewIfNeeded()
  await activate(complete, hasTouch)
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.getByTestId('archive-highlight-detail')).toHaveCount(0)
  await expect(page.getByTestId('archive-highlight')).toHaveCount(7)
  expect(await page.getByTestId('archive-transcript').locator(':scope > div').textContent()).toBe(rows[0].transcript_fr)
  expect((await archivesState(page)).openArchiveHighlightId).toBeNull()
  await closeTheme(page, hasTouch)
  await expectJoystickResumes(page, hasTouch)
})

test('salle : ni brouillon, ni keynote, ni ancienne archive sans thèmes ne créent de bulles', async ({ page }, testInfo) => {
  const hasTouch = testInfo.project.use.hasTouch === true
  const legacy = { ...archiveFixture(0), highlights: undefined }
  const draft = { ...archiveFixture(1), published: false }
  const published = archiveFixture(2)
  const outside = { ...archiveFixture(0), session_id: 'keynote-test-hors-archives' }
  const state = await enterArchivesWithRows(page, [legacy, draft, published, outside])
  expect(Object.keys(state.archives).sort()).toEqual([SESSION_IDS[0], SESSION_IDS[2]])
  await expect(page.getByTestId('archive-world-group')).toHaveCount(1)
  await expect(page.getByTestId('archive-world-bubble')).toHaveCount(7)
  await expect(group(page, SESSION_IDS[0])).toHaveCount(0)
  await expect(group(page, SESSION_IDS[1])).toHaveCount(0)
  await expect(group(page, outside.session_id)).toHaveCount(0)
  await standAtVitrine(page, state, SESSION_IDS[2])
  await activate(bubble(page, SESSION_IDS[2], published.highlights![0].id), hasTouch)
  await expectFocusedTheme(page, published, published.highlights![0])
})
