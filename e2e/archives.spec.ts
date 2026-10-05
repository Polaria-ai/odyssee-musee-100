/**
 * E2E « Les Archives de 2040 » (WEL-885). Plan en croix (WEL-888) : la salle est accrochée au sud du
 * hall et se rejoint à pied par la porte sud, derrière le point d'apparition — plus aucun portail.
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
  museePlayer,
  teleport,
  waitForCameraSettled,
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
  door: { x: number; z: number; width: number }
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
}

interface SessionArchive {
  sessionId: string
  transcript: { fr: string; en: string }
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

/**
 * Amène le joueur en jeu, avec le programme de la soirée chargé (sessions + plan des Archives).
 *
 * `greeted` (vrai par défaut) marque les Archives comme déjà découvertes : sinon, la première entrée
 * dans la salle (y compris par `teleport`) ouvre l'accueil de l'Archiviste, qui masque le bouton
 * d'action. Seuls les tests de l'accueil lui-même passent `greeted: false`.
 */
async function enterMuseumWithArchives(page: Page, { greeted = true }: { greeted?: boolean } = {}): Promise<ArchivesState> {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  if (greeted) {
    await page.evaluate(() => {
      const musee = (globalThis as unknown as { __musee?: { state: () => { markArchivesDiscovered: () => boolean } } }).__musee
      musee?.state().markArchivesDiscovered()
    })
  }
  const state = await archivesState(page)
  expect(state.sessions.length, 'le programme de la soirée doit être chargé (Supabase ou repli embarqué)').toBeGreaterThan(
    0,
  )
  expect(state.archivesLayout, 'le plan des Archives doit être fusionné dans le musée').not.toBeNull()
  return state
}

/**
 * Marche au clavier (touche maintenue) jusqu'à ce que `currentRoom` vaille `room`, puis relâche.
 * ArrowDown → +Z (vers le bas de l'écran, donc vers le sud), ArrowUp → −Z (voir `physics.ts`).
 */
async function walkUntilRoom(page: Page, key: 'ArrowDown' | 'ArrowUp', room: string): Promise<void> {
  await page.keyboard.down(key)
  try {
    await expect.poll(async () => (await archivesState(page)).currentRoom, { timeout: 8_000 }).toBe(room)
  } finally {
    await page.keyboard.up(key)
  }
}

/** Place le joueur dans le hall, face à la porte sud (dans son axe), à quelques pas du seuil. */
async function standBeforeSouthDoor(page: Page, archives: ArchivesLayout): Promise<void> {
  await teleport(page, archives.door.x, archives.door.z - 1.8)
  await expect.poll(async () => (await archivesState(page)).currentRoom).toBe('hall')
}

// ---------------------------------------------------------------------------
// Porte sud du hall : aller et retour à pied, accueil de l'Archiviste.
// ---------------------------------------------------------------------------

test('porte sud du hall : on entre à pied dans les Archives, sans portail ni fondu', async ({ page }) => {
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!

  await standBeforeSouthDoor(page, archives)
  await walkUntilRoom(page, 'ArrowDown', 'archives')

  await expect(page.getByTestId('portal-fade')).toHaveCount(0)
  expect((await museePlayer(page)).z, 'le joueur doit avoir franchi le seuil à pied').toBeGreaterThan(archives.door.z)
})

test('accueil de l’Archiviste à la première arrivée seulement ; retour au hall à pied', async ({ page }) => {
  const state = await enterMuseumWithArchives(page, { greeted: false })
  const archives = state.archivesLayout!
  expect(state.archivesDiscovered, 'ne doit pas être déjà découvert sur une session fraîche').toBe(false)

  // Aller : hall → Archives, par la porte sud.
  await standBeforeSouthDoor(page, archives)
  await walkUntilRoom(page, 'ArrowDown', 'archives')

  // Dialogue d'accueil (« Te voici dans les Archives de 2040… »), une seule fois.
  const box = page.getByTestId('dialogue-box')
  await expect(box).toBeVisible()
  await expect(box).toContainText("L'Archiviste")
  await expect(box).toContainText('Archives de 2040')
  await closeAnyDialogue(page)
  await expect(box).toBeHidden()
  expect((await archivesState(page)).archivesDiscovered).toBe(true)

  // Retour : Archives → hall, par la même porte.
  await teleport(page, archives.arrival.position.x, archives.arrival.position.z)
  await walkUntilRoom(page, 'ArrowUp', 'hall')

  // Deuxième arrivée : pas de nouveau dialogue d'accueil.
  await walkUntilRoom(page, 'ArrowDown', 'archives')
  await page.waitForTimeout(500)
  await expect(box).toBeHidden()
})

test('transcription publiée pendant la visite : la vitrine s’allume sans recharger la page', async ({ page }) => {
  // La lecture Supabase des transcriptions est interceptée : rien n'est publié en base. D'abord aucune
  // transcription, puis une transcription factice « publiée ».
  let published: unknown[] = []
  let reads = 0
  await page.route('**/rest/v1/session_archives*', (route) => {
    reads += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(published) })
  })
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!
  expect(Object.keys(state.archives)).toEqual([])
  // Sans `VITE_SUPABASE_URL` dans le build, le jeu ne lit jamais Supabase et rien ne peut être
  // publié : mieux vaut le dire que laisser attendre la transcription 10 s (voir docs/tests/archives.md).
  expect(reads, 'le jeu doit lire session_archives au chargement : build sans VITE_SUPABASE_URL ?').toBeGreaterThan(0)

  const slot = archives.slots[0]
  published = [
    {
      session_id: slot.sessionId,
      transcript_fr: '[Test E2E] Modération — Transcription factice publiée pendant la visite.\nIntervenant·e — Une seconde prise de parole factice.',
      transcript_en: '',
      archived_at: '2026-10-06T23:00:00+02:00',
      published: true,
    },
  ]

  // Entrer dans la salle relance la lecture des archives (puis toutes les 60 s).
  await teleport(page, slot.viewPoint.x, slot.viewPoint.z)
  await expect.poll(async () => Object.keys((await archivesState(page)).archives), { timeout: 10_000 }).toEqual([slot.sessionId])
  await expect(page.getByTestId('toast')).toContainText('Nouvelles transcriptions')

  await openArchiveViaState(page, slot.sessionId)
  await expect(page.getByTestId('archive-card')).toContainText('[Test E2E] Modération — Transcription factice publiée pendant la visite.')
  await expect(page.getByTestId('archive-card')).toContainText('Intervenant·e — Une seconde prise de parole factice.')
  await expect(page.getByTestId('archive-pending')).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// Vitrine : « Ouvrir la vitrine » → fiche.
// ---------------------------------------------------------------------------

test('vitrine : « Ouvrir la vitrine » ouvre une fiche de table ronde, transcription en attente', async ({
  page,
}) => {
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!

  const session = state.sessions[0]
  const slot = archives.slots.find((s) => s.sessionId === session.id)
  expect(slot, `pas de vitrine trouvée pour la table ronde ${session.id}`).toBeTruthy()

  await teleport(page, slot!.viewPoint.x, slot!.viewPoint.z)
  await page.waitForTimeout(500)

  const actionButton = page.getByTestId('action-button')
  await expect(actionButton).toHaveText('Ouvrir la vitrine')
  await actionButton.click()

  const card = page.getByTestId('archive-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText(session.title.fr)
  await expect(card).toContainText(session.startTime)
  if (session.speakers.length > 0) {
    await expect(card).toContainText(session.speakers[0].name)
  }

  const archive = state.archives[session.id]
  if (!archive?.published) {
    await expect(page.getByTestId('archive-pending')).toBeVisible()
    await expect(page.getByTestId('archive-pending')).toContainText('Transcription en attente')
  }

  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()
})

test('vitrine : navigation précédente/suivante entre tables rondes', async ({ page }) => {
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

test('Archiviste : « Parler à l’Archiviste » ouvre son chat IA (plus un dialogue scripté)', async ({ page }) => {
  const state = await enterMuseumWithArchives(page)
  const archivist = state.archivesLayout!.archivist

  await teleport(page, archivist.position.x, archivist.position.z)
  await page.waitForTimeout(500)

  const actionButton = page.getByTestId('action-button')
  await expect(actionButton).toHaveText("Parler à l'Archiviste")
  await actionButton.click()

  // Depuis WEL-929 : le chat de l'Archiviste · IA (détails dans `archiviste-chat.spec.ts`), pas la bulle du jeu.
  const chat = page.getByTestId('remi-chat')
  await expect(chat).toBeVisible({ timeout: 60_000 })
  await expect(chat).toHaveAttribute('data-persona', 'archiviste')
  await expect(page.getByRole('heading', { name: 'Archiviste · IA' })).toBeVisible()
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0)
})

/** Sonde de l'Archiviste 3D (`window.__musee.archivist()`, `src/state/runtime.ts::archivistProbe`). */
interface ArchivistProbe {
  loaded: boolean
  triangles: number
  clip: 'idle' | 'wave' | 'talk'
  yaw: number
  /** Fois où son maillage a été dessiné (ne bouge pas tant qu'elle est hors du champ de la caméra). */
  drawn: number
}

async function archivistProbe(page: Page): Promise<ArchivistProbe> {
  return page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: { archivist?: () => unknown } }).__musee
    if (!musee?.archivist) throw new Error('window.__musee.archivist indisponible : build sans la sonde de l’Archiviste ?')
    return musee.archivist()
  }) as Promise<ArchivistProbe>
}

test('Archiviste 3D : le personnage est chargé, salue à l’approche (une fois) et se tourne vers le joueur dans une plage bornée', async ({
  page,
}) => {
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!
  const archivist = archives.archivist

  // Joueur à l'arrivée (hors de portée de l'Archiviste) : le GLB se charge, au repos.
  await teleport(page, archives.arrival.position.x, archives.arrival.position.z, archives.arrival.rotationY)
  await expect.poll(async () => (await archivistProbe(page)).loaded, { timeout: 30_000 }).toBe(true)
  const idle = await archivistProbe(page)
  // Le vrai maillage de l'Archiviste (≥ 10 000 triangles), pas un repli ni la silhouette abstraite d'avant (≈ 3 000).
  expect(idle.triangles, 'maillage de l’Archiviste').toBeGreaterThan(10_000)
  expect(idle.clip).toBe('idle')

  // Le joueur arrive à sa droite, à portée : elle le salue (clip « wave » joué une fois), puis revient au repos.
  await teleport(page, archivist.position.x + 1.6, archivist.position.z + 1.6, Math.PI)
  await expect.poll(async () => (await archivistProbe(page)).clip, { timeout: 10_000 }).toBe('wave')
  await expect.poll(async () => (await archivistProbe(page)).clip, { timeout: 30_000 }).toBe('idle')

  // Elle s'est tournée vers lui (côté est : rotation positive), sans jamais dépasser ±40°.
  await expect.poll(async () => (await archivistProbe(page)).yaw, { timeout: 10_000 }).toBeGreaterThan(0.3)
  expect((await archivistProbe(page)).yaw).toBeLessThanOrEqual((40 * Math.PI) / 180 + 1e-6)

  // De l'autre côté, elle se tourne de l'autre côté ; de loin (hall), elle reprend son orientation de repos.
  await teleport(page, archivist.position.x - 1.6, archivist.position.z + 1.6, Math.PI)
  await expect.poll(async () => (await archivistProbe(page)).yaw, { timeout: 10_000 }).toBeLessThan(-0.3)
  await teleport(page, archives.arrival.position.x, archives.arrival.position.z - 8, 0)
  await expect.poll(async () => Math.abs((await archivistProbe(page)).yaw), { timeout: 10_000 }).toBeLessThan(0.05)
})

test('Archiviste 3D : hors du champ de la caméra (spawn du hall) elle n’est pas dessinée, dans la salle elle l’est', async ({
  page,
}) => {
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!

  // Au point d'apparition du hall, elle est derrière le bas de l'écran (6,4 m au sud-est, tous formats testés) :
  // son maillage (12 467 triangles) ne doit pas être dessiné pour rien, c'est le budget de tous les joueurs au départ.
  await expect.poll(async () => (await archivistProbe(page)).loaded, { timeout: 30_000 }).toBe(true)
  await waitForCameraSettled(page)
  const atSpawn = (await archivistProbe(page)).drawn
  await page.waitForTimeout(1_500)
  expect((await archivistProbe(page)).drawn, 'dessinée alors qu’elle est hors du champ, au spawn du hall').toBe(atSpawn)

  // Dans la salle, face à elle, elle est dessinée à chaque image.
  await teleport(page, archives.archivist.position.x, archives.archivist.position.z + 2.4, Math.PI)
  await expect.poll(async () => (await archivistProbe(page)).drawn, { timeout: 15_000 }).toBeGreaterThan(atSpawn + 2)
})

// ---------------------------------------------------------------------------
// Carnet (4e tampon) et plan du musée.
// ---------------------------------------------------------------------------

test('carnet : compteur « n/4 » et 4e tampon (Archives) après 3 tables rondes consultées', async ({ page }) => {
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

test('plan du musée : la salle des Archives est dans le plan, reliée au hall', async ({ page }) => {
  await enterMuseumWithArchives(page)

  await page.getByTestId('map-button').click()
  const map = page.getByTestId('museum-map')
  await expect(map).toBeVisible()

  // Hall + 3 ailes + Archives, à la même échelle ; plus d'encart ni de pictogramme de portail.
  await expect(map.locator('.ui-map__plan svg .ui-map__room')).toHaveCount(5)
  await expect(page.getByTestId('map-portal-marker')).toHaveCount(0)
  const legend = page.getByTestId('map-archives')
  await expect(legend).toBeVisible()
  await expect(legend).toContainText('Archives de 2040')
  await expect(page.getByTestId('map-archives-count')).toContainText('archives consultées')

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
  await expect(actionButton).toHaveText('Open the display case')
  await actionButton.click()

  const card = page.getByTestId('archive-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Transcript pending')
  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()

  await page.getByTestId('hud-lang').click()
  await expect(actionButton).toHaveText('Ouvrir la vitrine')
  await actionButton.click()
  await expect(card).toBeVisible()
  await expect(card).toContainText('Transcription en attente')
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
// Contenu : seules les trois tables rondes ont une vitrine dans les Archives.
// ---------------------------------------------------------------------------

test('contenu : plan des Archives = les trois tables rondes, sans autre séquence', async ({
  page,
}) => {
  const state = await enterMuseumWithArchives(page)
  const archives = state.archivesLayout!

  const expectedIds = ['table-ronde-1', 'table-ronde-2', 'table-ronde-3']
  expect(state.sessions.map((session) => session.id)).toEqual(expectedIds)
  expect(state.sessions.every((session) => session.kind === 'table-ronde')).toBe(true)
  expect(archives.slots.map((slot) => slot.sessionId)).toEqual(expectedIds)
  expect(Object.keys(state.archives).every((id) => expectedIds.includes(id))).toBe(true)
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

  // Porte sud du hall : aller à pied.
  await standBeforeSouthDoor(page, archives)
  await walkUntilRoom(page, 'ArrowDown', 'archives')

  // Une vitrine.
  const slot = archives.slots[0]
  await teleport(page, slot.viewPoint.x, slot.viewPoint.z)
  await page.waitForTimeout(500)
  await page.getByTestId('action-button').click()
  await expect(page.getByTestId('archive-card')).toBeVisible()
  await page.keyboard.press('Escape')

  // L'Archiviste : depuis la V5.1 (WEL-929), « Parler à l'Archiviste » ouvre son chat IA (code chargé à
  // la demande, d'où le délai large), plus le dialogue scripté. /api/remi est intercepté par gotoMusee.
  await teleport(page, archives.archivist.position.x, archives.archivist.position.z)
  await page.waitForTimeout(500)
  await page.getByTestId('action-button').click()
  const chat = page.getByTestId('remi-chat')
  await expect(chat).toBeVisible({ timeout: 60_000 })
  await expect(chat).toHaveAttribute('data-persona', 'archiviste')
  await page.getByTestId('remi-chat-close').click()
  await expect(chat).toBeHidden()
  await closeAnyDialogue(page)

  // Carnet et plan.
  await page.getByTestId('stamps-button').click()
  await expect(page.getByTestId('stamp-card')).toBeVisible()
  await page.getByTestId('stamp-close').click()
  await page.getByTestId('map-button').click()
  await expect(page.getByTestId('museum-map')).toBeVisible()
  await page.keyboard.press('Escape')

  // Retour au hall à pied.
  await teleport(page, archives.arrival.position.x, archives.arrival.position.z)
  await walkUntilRoom(page, 'ArrowUp', 'hall')

  expect(issues.errors, issues.errors.join('\n')).toEqual([])
  expect(issues.pageErrors, issues.pageErrors.join('\n')).toEqual([])
})
