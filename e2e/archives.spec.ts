/**
 * E2E « Les Archives de 2040 » (salle rejointe depuis le hall par la Porte de 2040, WEL-885).
 *
 * Comme `e2e/support/museeApi.ts` (voir son en-tête), les types ci-dessous sont une copie locale et
 * volontairement minimale du contrat exposé par `window.__musee` (`src/scene/debugApi.ts`) et de
 * l'état du store (`src/state/gameStore.ts`, `src/types/index.ts`) : ce fichier ne dépend jamais du
 * projet TypeScript applicatif (lib DOM absente de `tsconfig.node.json`). Si le contrat change côté
 * application, ces tests échoueront à l'exécution — voir docs/tests/archives.md.
 *
 * Ce module est scopé aux Archives (WEL-885) : il n'édite jamais `e2e/support/**`, seulement ce
 * fichier. Les aides déjà fournies par `support/museeApi.ts` (`gotoMusee`, `enterMuseum`,
 * `dismissWelcomeDialogue`, `teleport`, `closeAnyDialogue`, `collectConsoleIssues`,
 * `waitForRenderInfo`) sont réutilisées telles quelles ; les aides propres aux Archives
 * (`archivesState`, `openArchiveViaState`, `closeArchiveViaState`) vivent ici.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  closeAnyDialogue,
  collectConsoleIssues,
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  teleport,
  waitForRenderInfo,
} from './support/museeApi'

// Les textes vérifiés ici (dialogue de l'Archiviste, fiche d'archive, carnet, plan) sont en français
// dans le script — locale fixée pour un test déterministe, comme `dialogue.spec.ts`/`stamps.spec.ts`.
test.use({ locale: 'fr-FR' })

// ---------------------------------------------------------------------------
// Types locaux (sous-ensemble du contrat, voir l'en-tête de ce fichier).
// ---------------------------------------------------------------------------

interface Vec2 {
  x: number
  z: number
}

interface Placement {
  position: Vec2
  rotationY: number
}

interface ArchiveSlot {
  sessionId: string
  position: [number, number, number]
  rotationY: number
  viewPoint: Vec2
}

interface ArchivesLayout {
  slots: ArchiveSlot[]
  arrival: Placement
  hallPortal: Placement
  returnPortal: Placement
  archivist: Placement
}

interface SessionSpeaker {
  name: string
  organization?: string
  moderator?: boolean
}

interface EveningSession {
  id: string
  order: number
  startTime: string
  kind: string
  title: { fr: string; en: string }
  speakers: SessionSpeaker[]
  provisional: boolean
}

interface SessionArchiveQuote {
  text: { fr: string; en: string }
  author: string
  verified: boolean
}

interface SessionArchive {
  sessionId: string
  quotes: SessionArchiveQuote[]
  published: boolean
}

interface ArchivesState {
  screen: string
  lang: 'fr' | 'en'
  currentRoom: string | null
  sessions: EveningSession[]
  archives: Record<string, SessionArchive>
  archivesLayout: ArchivesLayout | null
  visitedSessions: Record<string, number>
  archivesDiscovered: boolean
  stamps: Record<string, number>
}

// ---------------------------------------------------------------------------
// Aides propres aux Archives.
// ---------------------------------------------------------------------------

/**
 * Lit un sous-ensemble (sérialisable, sans fonctions) de l'état utile aux Archives. Ne renvoie
 * jamais les actions du store (`openSession`, `closeSession`…) : `page.evaluate` les perdrait de
 * toute façon en les faisant traverser la frontière page → Node (voir `openArchiveViaState` /
 * `closeArchiveViaState` ci-dessous, qui les appellent côté page).
 */
async function archivesState(page: Page): Promise<ArchivesState> {
  return page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: { state: () => unknown } }).__musee
    if (!musee) throw new Error('window.__musee indisponible : ?e2e=1 est-il actif ?')
    const s = musee.state() as Record<string, unknown>
    return {
      screen: s.screen,
      lang: s.lang,
      currentRoom: s.currentRoom,
      sessions: s.sessions,
      archives: s.archives,
      archivesLayout: s.archivesLayout,
      visitedSessions: s.visitedSessions,
      archivesDiscovered: s.archivesDiscovered,
      stamps: s.stamps,
    }
  }) as Promise<ArchivesState>
}

/** Ouvre une fiche d'archive directement via l'état (marque consultée + ouvre), sans naviguer en 3D. */
async function openArchiveViaState(page: Page, sessionId: string): Promise<void> {
  await page.evaluate((id) => {
    const musee = (globalThis as unknown as { __musee?: { state: () => { openSession: (id: string) => void } } })
      .__musee
    musee?.state().openSession(id)
  }, sessionId)
}

async function closeArchiveViaState(page: Page): Promise<void> {
  await page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: { state: () => { closeSession: () => void } } }).__musee
    musee?.state().closeSession()
  })
}

/** Amène le joueur en jeu, avec le programme de la soirée chargé (sessions + plan des Archives). */
async function enterMuseumWithArchives(page: Page): Promise<ArchivesState> {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  const state = await archivesState(page)
  expect(state.sessions.length, 'le programme de la soirée doit être chargé (Supabase ou repli embarqué)').toBeGreaterThan(
    0,
  )
  expect(state.archivesLayout, 'le plan des Archives doit être fusionné dans le musée').not.toBeNull()
  return state
}

// ---------------------------------------------------------------------------
// Porte de 2040 : aller, accueil de l'Archiviste, retour.
// ---------------------------------------------------------------------------

test('Porte de 2040 franchissable : fondu puis salle des Archives', async ({ page }) => {
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!

  await teleport(page, archives.hallPortal.position.x, archives.hallPortal.position.z)

  const fade = page.getByTestId('portal-fade')
  await expect(fade).toBeVisible()
  await expect(fade).toBeHidden({ timeout: 5_000 })

  await expect.poll(async () => (await archivesState(page)).currentRoom).toBe('archives')
})

test('accueil de l’Archiviste à la première arrivée seulement ; retour au hall', async ({ page }) => {
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!
  expect(state.archivesDiscovered, 'ne doit pas être déjà découvert sur une session fraîche').toBe(false)

  // Aller : hall → Archives.
  await teleport(page, archives.hallPortal.position.x, archives.hallPortal.position.z)
  const fade = page.getByTestId('portal-fade')
  await expect(fade).toBeVisible()
  await expect(fade).toBeHidden({ timeout: 5_000 })
  await expect.poll(async () => (await archivesState(page)).currentRoom).toBe('archives')

  // Dialogue d'accueil (« Tu viens de franchir la Porte de 2040… »), une seule fois.
  const box = page.getByTestId('dialogue-box')
  await expect(box).toBeVisible()
  await expect(box).toContainText("L'Archiviste")
  await expect(box).toContainText('la Porte de 2040')
  await closeAnyDialogue(page)
  await expect(box).toBeHidden()
  expect((await archivesState(page)).archivesDiscovered).toBe(true)

  // Retour : Archives → hall.
  await teleport(page, archives.returnPortal.position.x, archives.returnPortal.position.z)
  await expect(fade).toBeVisible()
  await expect(fade).toBeHidden({ timeout: 5_000 })
  await expect.poll(async () => (await archivesState(page)).currentRoom).toBe('hall')

  // Le verrou anti-rebond des anneaux (1,5 s, `PORTAL_TRIGGER_LOCK_SECONDS`) doit être purgé avant
  // de retraverser, sans quoi le second passage par la Porte de 2040 ne se déclencherait pas.
  await page.waitForTimeout(1_800)

  // Deuxième arrivée : pas de nouveau dialogue d'accueil.
  await teleport(page, archives.hallPortal.position.x, archives.hallPortal.position.z)
  await expect(fade).toBeVisible()
  await expect(fade).toBeHidden({ timeout: 5_000 })
  await expect.poll(async () => (await archivesState(page)).currentRoom).toBe('archives')
  await page.waitForTimeout(500)
  await expect(box).toBeHidden()
})

// ---------------------------------------------------------------------------
// Vitrine : « Consulter l'archive » → fiche.
// ---------------------------------------------------------------------------

test('vitrine : « Consulter l’archive » ouvre une fiche complète (programme provisoire, archive en attente)', async ({
  page,
}) => {
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!

  const session = state.sessions.find((s) => s.speakers.length > 0) ?? state.sessions[0]
  const slot = archives.slots.find((s) => s.sessionId === session.id)
  expect(slot, `pas de vitrine trouvée pour la séquence ${session.id}`).toBeTruthy()

  await teleport(page, slot!.viewPoint.x, slot!.viewPoint.z)
  await page.waitForTimeout(500)

  const actionButton = page.getByTestId('action-button')
  await expect(actionButton).toHaveText("Consulter l'archive")
  await actionButton.click()

  const card = page.getByTestId('archive-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText(session.title.fr)
  await expect(card).toContainText(session.startTime)
  await expect(card).toContainText('Programme provisoire')
  if (session.speakers.length > 0) {
    await expect(card).toContainText(session.speakers[0].name)
  }

  const archive = state.archives[session.id]
  if (!archive?.published) {
    await expect(page.getByTestId('archive-pending')).toBeVisible()
    await expect(page.getByTestId('archive-pending')).toContainText('Archive en cours de rédaction')
  }

  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()
})

test('vitrine : navigation précédente/suivante entre séquences', async ({ page }) => {
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!
  const ordered = [...state.sessions].sort((a, b) => a.order - b.order)
  const first = ordered[0]
  const slot = archives.slots.find((s) => s.sessionId === first.id)!

  await teleport(page, slot.viewPoint.x, slot.viewPoint.z)
  await page.waitForTimeout(500)
  await page.getByTestId('action-button').click()

  const card = page.getByTestId('archive-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText(first.title.fr)

  const prevButton = page.getByTestId('archive-prev')
  const nextButton = page.getByTestId('archive-next')
  await expect(prevButton).toBeDisabled()
  if (ordered.length > 1) {
    await expect(nextButton).toBeEnabled()
    await nextButton.click()
    await expect(card).toContainText(ordered[1].title.fr)
    await expect(prevButton).toBeEnabled()
    await prevButton.click()
    await expect(card).toContainText(first.title.fr)
  }

  const last = ordered[ordered.length - 1]
  const lastSlot = archives.slots.find((s) => s.sessionId === last.id)!
  await closeArchiveViaState(page)
  await expect(card).toBeHidden()
  await teleport(page, lastSlot.viewPoint.x, lastSlot.viewPoint.z)
  await page.waitForTimeout(500)
  await page.getByTestId('action-button').click()
  await expect(card).toContainText(last.title.fr)
  await expect(nextButton).toBeDisabled()

  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()
})

// ---------------------------------------------------------------------------
// L'Archiviste.
// ---------------------------------------------------------------------------

test('Archiviste : « Parler à l’Archiviste » ouvre un dialogue', async ({ page }) => {
  const state = await enterMuseumWithArchives(page)
  const archivist = state.archivesLayout!.archivist

  await teleport(page, archivist.position.x, archivist.position.z)
  await page.waitForTimeout(500)

  const actionButton = page.getByTestId('action-button')
  await expect(actionButton).toHaveText("Parler à l'Archiviste")
  await actionButton.click()

  const box = page.getByTestId('dialogue-box')
  await expect(box).toBeVisible()
  await expect(box).toContainText("L'Archiviste")
})

// ---------------------------------------------------------------------------
// Carnet (4e tampon) et plan du musée.
// ---------------------------------------------------------------------------

test('carnet : compteur « n/4 » et 4e tampon (Archives) après 3 archives consultées', async ({ page }) => {
  const state = await enterMuseumWithArchives(page)
  expect(state.sessions.length, 'au moins 3 séquences nécessaires pour ce test').toBeGreaterThanOrEqual(3)

  await expect(page.getByTestId('stamps-button')).toContainText('0/4')

  for (const session of state.sessions.slice(0, 3)) {
    await openArchiveViaState(page, session.id)
    await closeArchiveViaState(page)
  }

  await expect(page.getByTestId('stamps-button')).toContainText('1/4')

  await page.getByTestId('stamps-button').click()
  const card = page.getByTestId('stamp-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Obtenu')

  await page.getByTestId('stamp-close').click()
  await expect(card).toBeHidden()
})

test('plan du musée : encart des Archives et marqueur de la Porte de 2040', async ({ page }) => {
  await enterMuseumWithArchives(page)

  await page.getByTestId('map-button').click()
  const map = page.getByTestId('museum-map')
  await expect(map).toBeVisible()

  const archivesPanel = page.getByTestId('map-archives')
  await expect(archivesPanel).toBeVisible()
  await expect(archivesPanel).toContainText('Les Archives de 2040')
  await expect(page.getByTestId('map-portal-marker')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(map).toBeHidden()
})

// ---------------------------------------------------------------------------
// FR/EN.
// ---------------------------------------------------------------------------

test('FR/EN : bascule des textes des Archives (bouton d’action, fiche)', async ({ page }) => {
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!
  const firstSlot = archives.slots[0]

  await teleport(page, archives.archivist.position.x, archives.archivist.position.z)
  await page.waitForTimeout(500)
  const actionButton = page.getByTestId('action-button')
  await expect(actionButton).toHaveText("Parler à l'Archiviste")

  await page.getByTestId('hud-lang').click()
  await expect(actionButton).toHaveText('Talk to the Archivist')

  await teleport(page, firstSlot.viewPoint.x, firstSlot.viewPoint.z)
  await page.waitForTimeout(500)
  await expect(actionButton).toHaveText('Consult the archive')
  await actionButton.click()

  const card = page.getByTestId('archive-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Provisional program')
  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()

  await page.getByTestId('hud-lang').click()
  await expect(actionButton).toHaveText("Consulter l'archive")
  await actionButton.click()
  await expect(card).toBeVisible()
  await expect(card).toContainText('Programme provisoire')
})

// ---------------------------------------------------------------------------
// Performance (mobile d'abord, docs/DESIGN.md).
// ---------------------------------------------------------------------------

test('performance : ≤ 150 appels de dessin dans la salle des Archives', async ({ page }, testInfo) => {
  const state = await enterMuseumWithArchives(page)
  const arrival = state.archivesLayout!.arrival

  await teleport(page, arrival.position.x, arrival.position.z, arrival.rotationY)
  await page.waitForTimeout(1_500)

  const info = await waitForRenderInfo(page)
  testInfo.annotations.push({
    type: 'draw-calls',
    description: `archives (arrivée) : ${info.calls} appels, ${info.triangles} triangles (${testInfo.project.name})`,
  })
  expect(info.calls, `trop d'appels de dessin dans les Archives : ${info.calls}`).toBeLessThanOrEqual(150)
})

// ---------------------------------------------------------------------------
// Contenu : rien d'inventé, tout provisoire (règle absolue de ce chantier).
// ---------------------------------------------------------------------------

const FORBIDDEN_NAMES = ['Octave Klaba', 'Maya Noël', 'Anne Bouverot', 'Xavier Boilaud']

test('contenu : plan des Archives = une vitrine par séquence (18) ; programme entièrement provisoire ; aucune attribution interdite', async ({
  page,
}) => {
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!

  expect(archives.slots.length, 'une vitrine par séquence du programme').toBe(state.sessions.length)
  expect(state.sessions.length, 'programme de la soirée : 18 séquences (docs/EVENING-AGENT.md)').toBe(18)

  for (const session of state.sessions) {
    expect(session.provisional, `la séquence ${session.id} devrait être provisoire`).toBe(true)
    for (const speaker of session.speakers) {
      expect(
        FORBIDDEN_NAMES,
        `attribution interdite trouvée sur la séquence ${session.id} : ${speaker.name}`,
      ).not.toContain(speaker.name)
    }
  }

  // Défensif : si une archive a déjà été déposée et publiée (`state().archives`), aucune citation
  // ne doit non plus attribuer l'une de ces personnes — rien n'est jamais inventé à l'avance.
  for (const archive of Object.values(state.archives)) {
    for (const quote of archive.quotes) {
      expect(FORBIDDEN_NAMES, `citation attribuée à un nom interdit : ${quote.author}`).not.toContain(quote.author)
    }
  }
})

// ---------------------------------------------------------------------------
// Accessibilité (fiche d'archive).
// ---------------------------------------------------------------------------

test.describe('accessibilité', () => {
  // Même précaution que `accessibility.spec.ts` : la feuille de la fiche d'archive monte du bas via
  // une animation d'opacité/transform ; `reducedMotion: 'reduce'` déclenche
  // `@media (prefers-reduced-motion: reduce)` (`src/styles/global.css`) pour échantillonner des
  // couleurs déjà à leur valeur finale, pas en plein fondu.
  test.use({ reducedMotion: 'reduce' })

  const SERIOUS_IMPACTS = new Set(['serious', 'critical'])

  test('fiche d’archive — pas de violation serious/critical', async ({ page }) => {
    const state = await enterMuseumWithArchives(page)
    const firstSlot = state.archivesLayout!.slots[0]

    await teleport(page, firstSlot.viewPoint.x, firstSlot.viewPoint.z)
    await page.waitForTimeout(500)
    await page.getByTestId('action-button').click()
    await expect(page.getByTestId('archive-card')).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    const violations = results.violations.filter((v) => SERIOUS_IMPACTS.has(v.impact ?? ''))
    const description = violations
      .map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.length} nœud(s)`)
      .join('\n')
    expect(violations, description).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Console propre sur le parcours complet (tables Supabase désormais en place).
// ---------------------------------------------------------------------------

test('aucune erreur console sur le parcours complet des Archives', async ({ page }) => {
  const issues = collectConsoleIssues(page)

  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!

  // Porte de 2040 : aller.
  await teleport(page, archives.hallPortal.position.x, archives.hallPortal.position.z)
  const fade = page.getByTestId('portal-fade')
  await expect(fade).toBeVisible()
  await expect(fade).toBeHidden({ timeout: 5_000 })
  await closeAnyDialogue(page) // accueil de l'Archiviste

  // Une vitrine.
  const slot = archives.slots[0]
  await teleport(page, slot.viewPoint.x, slot.viewPoint.z)
  await page.waitForTimeout(500)
  await page.getByTestId('action-button').click()
  await expect(page.getByTestId('archive-card')).toBeVisible()
  await page.keyboard.press('Escape')

  // L'Archiviste.
  await teleport(page, archives.archivist.position.x, archives.archivist.position.z)
  await page.waitForTimeout(500)
  await page.getByTestId('action-button').click()
  await expect(page.getByTestId('dialogue-box')).toBeVisible()
  await closeAnyDialogue(page)

  // Carnet et plan.
  await page.getByTestId('stamps-button').click()
  await expect(page.getByTestId('stamp-card')).toBeVisible()
  await page.getByTestId('stamp-close').click()
  await page.getByTestId('map-button').click()
  await expect(page.getByTestId('museum-map')).toBeVisible()
  await page.keyboard.press('Escape')

  // Retour au hall.
  await teleport(page, archives.returnPortal.position.x, archives.returnPortal.position.z)
  await expect(fade).toBeVisible()
  await expect(fade).toBeHidden({ timeout: 5_000 })

  expect(issues.errors, issues.errors.join('\n')).toEqual([])
  expect(issues.pageErrors, issues.pageErrors.join('\n')).toEqual([])
})
