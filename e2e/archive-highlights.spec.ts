/**
 * Bulles thématiques des trois tables rondes : vrai bouton du HUD puis navigation de la fiche.
 * Les seuls contenus utilisés ici sont fictifs. Supabase est intercepté avant le chargement ;
 * aucun transcript, appel IA ou visite de production n'est nécessaire.
 * Types locaux minimaux : ne pas importer le projet applicatif (tsconfig.node sans lib DOM).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  collectConsoleIssues,
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  hasHorizontalOverflow,
  teleport,
} from './support/museeApi'

test.use({ locale: 'fr-FR', reducedMotion: 'reduce' })

const SESSION_IDS = ['table-ronde-1', 'table-ronde-2', 'table-ronde-3'] as const
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
  sessions: { id: string; kind: string; order: number; title: { fr: string; en: string } }[]
  archives: Record<string, { published: boolean; highlights?: Highlight[] }>
  archivesLayout: { slots: { sessionId: string; viewPoint: { x: number; z: number } }[] } | null
}

/** Chaque extrait est une sous-chaîne exacte du transcript FR correspondant. */
function archiveFixture(index: number): ArchiveRow {
  const firstExcerpt = `[Test E2E ${index + 1}] Une première idée fictive est expliquée dans ce passage français.`
  const secondExcerpt = `[Test E2E ${index + 1}] Une deuxième idée fictive apparaît plus loin, sans repère temporel.`
  return {
    session_id: SESSION_IDS[index],
    transcript_fr: [
      `[Test E2E ${index + 1}] Début intégral de la transcription fictive.`,
      firstExcerpt,
      'Le texte continu fictif est conservé au-delà des passages choisis pour les bulles. '.repeat(8),
      secondExcerpt,
      `[Test E2E ${index + 1}] Fin intégrale de la transcription fictive.`,
    ].join('\n\n'),
    // Tester aussi le repli FR de la transcription lorsque sa traduction n'existe pas.
    transcript_en: '',
    highlights: [
      {
        id: `fixture-${index + 1}-first`,
        title: { fr: `Première idée fictive ${index + 1}`, en: `First fictional idea ${index + 1}` },
        body: {
          fr: `Un résumé fictif de la première idée. ${'motlongdetest'.repeat(12)}`,
          en: `A fictional summary of the first idea. ${'longtestword'.repeat(12)}`,
        },
        source: { excerpt: firstExcerpt, startSec: 70.9 + index * 900, endSec: 93 + index * 900 },
      },
      {
        id: `fixture-${index + 1}-second`,
        title: { fr: `Deuxième idée fictive ${index + 1}`, en: '' },
        body: { fr: 'Un deuxième résumé fictif reste en français faute de traduction.', en: '' },
        source: { excerpt: secondExcerpt },
      },
    ],
    archived_at: '2026-10-06T21:00:00+02:00',
    published: true,
  }
}

async function archivesState(page: Page): Promise<ArchivesState> {
  return page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: { state: () => unknown } }).__musee
    if (!musee) throw new Error('window.__musee indisponible : ?e2e=1 requis')
    const state = musee.state() as Record<string, unknown>
    return { sessions: state.sessions, archives: state.archives, archivesLayout: state.archivesLayout }
  }) as Promise<ArchivesState>
}

async function enterWithArchiveRows(page: Page, rows: ArchiveRow[]): Promise<ArchivesState> {
  let reads = 0
  await page.route('**/rest/v1/session_archives*', (route) => {
    reads += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  // Préparation seulement : éviter que le premier accueil couvre le HUD à la téléportation.
  // Aucune fiche n'est ouverte par le store : l'ouverture passe toujours par « Ouvrir la vitrine ».
  await page.evaluate(() => {
    const musee = (globalThis as unknown as {
      __musee?: { state: () => { markArchivesDiscovered: () => boolean } }
    }).__musee
    musee?.state().markArchivesDiscovered()
  })
  expect(reads, 'build E2E sans variables Supabase factices : aucune lecture interceptée').toBeGreaterThan(0)
  const state = await archivesState(page)
  expect(state.sessions.map((session) => session.id)).toEqual([...SESSION_IDS])
  expect(state.sessions.every((session) => session.kind === 'table-ronde')).toBe(true)
  expect(state.archivesLayout).not.toBeNull()
  expect(state.archivesLayout!.slots.map((slot) => slot.sessionId).sort()).toEqual([...SESSION_IDS])
  return state
}

/** Tactile réel sur les deux projets mobiles, clic sur desktop. */
async function activate(locator: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await locator.tap()
  else await locator.click()
}

async function openFirstVitrine(page: Page, state: ArchivesState, hasTouch: boolean, lang: 'fr' | 'en' = 'fr'): Promise<void> {
  const first = state.archivesLayout!.slots.find((slot) => slot.sessionId === SESSION_IDS[0])!
  await teleport(page, first.viewPoint.x, first.viewPoint.z)
  const action = page.getByTestId('action-button')
  await expect(action).toHaveText(lang === 'fr' ? 'Ouvrir la vitrine' : 'Open the display case')
  await activate(action, hasTouch)
  await expect(page.getByTestId('archive-card')).toBeVisible()
}

async function expectCompleteTranscript(page: Page, row: ArchiveRow): Promise<void> {
  const text = page.getByTestId('archive-transcript').locator(':scope > div')
  await expect(text).toBeVisible()
  // Une comparaison stricte inclut les paragraphes hors bulles, les sauts de ligne et la fin.
  expect(await text.textContent()).toBe(row.transcript_fr)
}

async function sheetScrollTop(page: Page): Promise<number> {
  return page.getByTestId('archive-card').locator('.archive-card__sheet').evaluate((element) =>
    (element as unknown as { scrollTop: number }).scrollTop,
  )
}

async function expectCardStartsAtTop(page: Page, session: ArchivesState['sessions'][number]): Promise<void> {
  await expect.poll(() => sheetScrollTop(page)).toBe(0)
  await expect(page.getByTestId('archive-card').getByRole('heading', { name: session.title.fr, exact: true })).toBeInViewport()
  await expect(page.getByTestId('archive-highlight').first()).toBeInViewport()
}

test('bulles : exactement trois tables rondes, navigation réelle et transcript intégral préservé', async ({ page }, testInfo) => {
  const issues = collectConsoleIssues(page)
  const hasTouch = testInfo.project.use.hasTouch === true
  const rows = SESSION_IDS.map((_, index) => archiveFixture(index))
  const state = await enterWithArchiveRows(page, rows)
  expect(Object.keys(state.archives).sort()).toEqual([...SESSION_IDS])
  await openFirstVitrine(page, state, hasTouch)
  await expect(page.getByTestId('archive-prev')).toBeDisabled()

  for (const [index, row] of rows.entries()) {
    const card = page.getByTestId('archive-card')
    await expect(card).toContainText(state.sessions[index].title.fr)
    await expect(page.getByTestId('archive-highlight')).toHaveCount(2)
    await expect(card.getByRole('heading', { name: row.highlights![0].title.fr })).toBeVisible()
    await expect(card.getByRole('heading', { name: row.highlights![1].title.fr })).toBeVisible()
    const source = page.getByTestId('archive-highlight-source').first()
    await expect(source).toBeHidden()
    await activate(page.getByTestId('archive-highlight').first().getByRole('button', { name: 'Voir le passage source' }), hasTouch)
    await expect(source).toBeVisible()
    expect(await source.textContent()).toBe(row.highlights![0].source.excerpt)
    await expectCompleteTranscript(page, row)
    if (index < rows.length - 1) {
      // Le bouton est réellement rejoint au bas du transcript avant de naviguer.
      await page.getByTestId('archive-next').scrollIntoViewIfNeeded()
      await expect.poll(() => sheetScrollTop(page)).toBeGreaterThan(0)
      await activate(page.getByTestId('archive-next'), hasTouch)
      await expectCardStartsAtTop(page, state.sessions[index + 1])
    }
  }

  await expect(page.getByTestId('archive-next')).toBeDisabled()
  await page.getByTestId('archive-prev').scrollIntoViewIfNeeded()
  await expect.poll(() => sheetScrollTop(page)).toBeGreaterThan(0)
  await activate(page.getByTestId('archive-prev'), hasTouch)
  await expectCardStartsAtTop(page, state.sessions[1])
  await expect(page.getByTestId('archive-highlight-source').first()).toBeHidden()
  await page.getByTestId('archive-prev').scrollIntoViewIfNeeded()
  await expect.poll(() => sheetScrollTop(page)).toBeGreaterThan(0)
  await activate(page.getByTestId('archive-prev'), hasTouch)
  await expectCardStartsAtTop(page, state.sessions[0])
  await expect(page.getByTestId('archive-highlight-source').first()).toBeHidden()
  await expect(page.getByTestId('archive-card')).toContainText(rows[0].highlights![0].title.fr)
  await expect(page.getByTestId('archive-prev')).toBeDisabled()
  await expectCompleteTranscript(page, rows[0])
  expect(issues.pageErrors).toEqual([])
  expect(issues.errors).toEqual([])
})

test('bulles : FR/EN, source française au clavier et au toucher, accessibilité et largeur 320 px', async ({ page }, testInfo) => {
  const hasTouch = testInfo.project.use.hasTouch === true
  const rows = SESSION_IDS.map((_, index) => archiveFixture(index))
  const state = await enterWithArchiveRows(page, rows)
  await openFirstVitrine(page, state, hasTouch)
  await page.setViewportSize({ width: 320, height: 568 })

  const card = page.getByTestId('archive-card')
  const firstBubble = page.getByTestId('archive-highlight').first()
  const source = firstBubble.getByTestId('archive-highlight-source')
  // Le nom accessible change à l'ouverture : garder le même bouton avec un locator stable.
  const toggle = firstBubble.locator('button.archive-highlights__source-toggle')
  await toggle.scrollIntoViewIfNeeded()
  await expect(toggle).toHaveAccessibleName('Voir le passage source')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(await toggle.getAttribute('aria-controls')).toBe(await source.getAttribute('id'))
  await toggle.focus()
  await toggle.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(toggle).toHaveAccessibleName('Masquer le passage source')
  await expect(source).toBeVisible()
  await expect(source).toHaveAttribute('lang', 'fr')
  expect(await source.textContent()).toBe(rows[0].highlights![0].source.excerpt)
  await toggle.press('Space')
  await expect(source).toBeHidden()
  await expect(toggle).toHaveAccessibleName('Voir le passage source')
  await activate(toggle, hasTouch)
  await expect(source).toBeVisible()
  await expect(toggle).toHaveAccessibleName('Masquer le passage source')
  await expect(page.getByTestId('archive-highlight-time')).toHaveCount(1)
  await expect(page.getByTestId('archive-highlight-time')).toHaveText('Dans l’enregistrement · 00:01:10 – 00:01:33')

  for (const button of await card.locator('button:not(.archive-card__backdrop)').all()) {
    const bounds = await button.boundingBox()
    expect(bounds, 'chaque cible de la fiche possède une taille mesurable').not.toBeNull()
    expect(bounds!.width, 'largeur cible tactile').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
    expect(bounds!.height, 'hauteur cible tactile').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
  }
  expect(await hasHorizontalOverflow(page), 'aucun débordement global à 320 px').toBe(false)
  const sheetOverflows = await card.locator('.archive-card__sheet').evaluate((element) => {
    const sheet = element as unknown as { scrollWidth: number; clientWidth: number }
    return sheet.scrollWidth > sheet.clientWidth + 1
  })
  expect(sheetOverflows, 'aucun débordement interne, même avec un mot de test très long').toBe(false)

  const results = await new AxeBuilder({ page }).include('[data-testid="archive-card"]').analyze()
  const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([])

  await activate(page.getByTestId('archive-close'), hasTouch)
  await activate(page.getByTestId('hud-lang'), hasTouch)
  await openFirstVitrine(page, state, hasTouch, 'en')
  await expect(card.getByRole('heading', { name: 'Key takeaways' })).toBeVisible()
  await expect(card.getByRole('heading', { name: rows[0].highlights![0].title.en })).toBeVisible()
  await expect(card).toContainText(rows[0].highlights![0].body.en)
  // La deuxième bulle sans traduction garde son contenu français, sans perdre sa source.
  await expect(card.getByRole('heading', { name: rows[0].highlights![1].title.fr })).toBeVisible()
  const englishToggle = page.getByTestId('archive-highlight').first().locator('button.archive-highlights__source-toggle')
  await expect(englishToggle).toHaveAccessibleName('Show the source passage')
  await activate(englishToggle, hasTouch)
  await expect(englishToggle).toHaveAccessibleName('Hide the source passage')
  await expect(page.getByTestId('archive-highlight-source').first()).toBeVisible()
  await expect(page.getByTestId('archive-highlight-source').first()).toHaveAttribute('lang', 'fr')
  expect(await page.getByTestId('archive-highlight-source').first().textContent()).toBe(rows[0].highlights![0].source.excerpt)
  await expect(page.getByTestId('archive-highlight-time')).toHaveText('In the recording · 00:01:10 – 00:01:33')
  await expectCompleteTranscript(page, rows[0])
})

test('bulles : anciennes archives sans highlights et brouillon non publié restent compatibles', async ({ page }, testInfo) => {
  const hasTouch = testInfo.project.use.hasTouch === true
  const legacy = { ...archiveFixture(0), highlights: undefined }
  const draft = { ...archiveFixture(1), published: false }
  const emptyHighlights = { ...archiveFixture(2), highlights: [] }
  const state = await enterWithArchiveRows(page, [legacy, draft, emptyHighlights])
  expect(Object.keys(state.archives).sort()).toEqual([SESSION_IDS[0], SESSION_IDS[2]])
  await openFirstVitrine(page, state, hasTouch)

  await expect(page.getByTestId('archive-highlights')).toHaveCount(0)
  await expectCompleteTranscript(page, legacy)
  await activate(page.getByTestId('archive-next'), hasTouch)
  await expect(page.getByTestId('archive-pending')).toBeVisible()
  await expect(page.getByTestId('archive-transcript')).toHaveCount(0)
  await expect(page.getByTestId('archive-highlights')).toHaveCount(0)
  await expect(page.getByTestId('archive-highlight-source')).toHaveCount(0)
  await expect(page.getByTestId('archive-card')).not.toContainText(draft.highlights![0].title.fr)
  await expect(page.getByTestId('archive-card')).not.toContainText(draft.highlights![0].source.excerpt)

  await activate(page.getByTestId('archive-next'), hasTouch)
  await expect(page.getByTestId('archive-highlights')).toHaveCount(0)
  await expect(page.getByTestId('archive-pending')).toHaveCount(0)
  await expectCompleteTranscript(page, emptyHighlights)
  await expect(page.getByTestId('archive-next')).toBeDisabled()
})
