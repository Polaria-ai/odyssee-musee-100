import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  hasHorizontalOverflow,
  museeState,
  teleport,
  waitForCameraSettled,
} from './support/museeApi'
import { stubRemiApi } from './support/remiApi'

/**
 * Chat avec Rémi · IA (V5, WEL-920) : `src/features/remiChat/`. S'ouvre à la première entrée au musée avec
 * le message d'accueil de Rémi, puis par « Parler à Rémi » au comptoir ; remplace le dialogue scripté.
 *
 * `/api/remi` est toujours intercepté (`support/remiApi.ts`, réponses SSE au format exact du contrat
 * `contract.ts`) : aucun test n'appelle le vrai réseau. Les tests marqués « client » (envoi, 503, 429, annulation)
 * exigent le vrai `client.ts` (qui poste sur cette route et lit le flux) ; avec le bouchon de l'orchestrateur,
 * qui répond sans réseau, ils échouent à l'assertion sur la requête reçue, c'est attendu.
 */
test.use({ locale: 'fr-FR' })

/** Cible tactile minimale (docs/DESIGN.md), tolérance sous-pixel. */
const MIN_TOUCH_TARGET = 47.5

const chat = (page: Page) => page.getByTestId('remi-chat')
const messages = (page: Page) => page.getByTestId('remi-chat-message')
const input = (page: Page) => page.getByTestId('remi-chat-input')

async function openChatOnEntry(page: Page): Promise<void> {
  await gotoMusee(page)
  await enterMuseum(page)
  await expect(chat(page)).toBeVisible()
}

async function ask(page: Page, text: string): Promise<void> {
  await input(page).fill(text)
  await page.getByTestId('remi-chat-send').click()
}

test('accueil : le chat s’ouvre à l’entrée avec le message de Rémi, sans appel réseau', async ({ page }) => {
  const stub = await stubRemiApi(page)
  await openChatOnEntry(page)

  await expect(messages(page)).toHaveCount(1)
  await expect(messages(page).first()).toHaveAttribute('data-role', 'assistant')
  await expect(messages(page).first()).toContainText('Rémi Godeau')
  await expect(messages(page).first()).toContainText("Il s'inscrit dans la soirée")
  await expect(page.getByRole('heading', { name: 'Rémi · IA' })).toBeVisible()
  await expect(chat(page)).toContainText('Réponses générées par une IA')
  await expect(page.getByTestId('remi-chat-suggestion')).toHaveCount(4)

  // L'accueil est instantané : le dialogue scripté n'est plus utilisé, rien n'est demandé au serveur.
  const state = await museeState(page)
  expect(state.remiChatOpen).toBe(true)
  expect(state.dialogue).toBeNull()
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0)
  expect(stub.requests).toHaveLength(0)
})

test('client : l’envoi suit le contrat et le texte reçu s’affiche au fil du flux', async ({ page }) => {
  const stub = await stubRemiApi(page, { kind: 'reply', chunks: ['Le musée compte ', 'trois ailes.'] })
  await openChatOnEntry(page)

  await ask(page, 'Combien d’ailes ?')
  await expect(messages(page).nth(1)).toHaveAttribute('data-role', 'user')
  await expect(messages(page).nth(1)).toHaveText('Combien d’ailes ?')
  await expect(messages(page).nth(2)).toHaveAttribute('data-role', 'assistant')
  await expect(messages(page).nth(2)).toHaveText('Le musée compte trois ailes.')
  await expect(page.getByTestId('remi-chat-typing')).toHaveCount(0)
  await expect(input(page)).toHaveValue('')

  // Les suggestions de départ disparaissent après le premier échange.
  await expect(page.getByTestId('remi-chat-suggestion')).toHaveCount(0)

  expect(stub.methods).toEqual(['POST'])
  expect(stub.requests).toHaveLength(1)
  const body = stub.requests[0]
  expect(body.lang).toBe('fr')
  expect(body.visitorId).toMatch(/\S/)
  expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Combien d’ailes ?' })
  // Le message d'accueil de Rémi ouvre l'historique envoyé.
  expect(body.messages[0].role).toBe('assistant')
  expect(body.messages[0].content).toContain('Bienvenue au Musée des 100')
  expect(body.context).toMatchObject({ visitedCount: 0, stampsCount: 0 })
})

test('client : une suggestion part comme message du visiteur', async ({ page }) => {
  const stub = await stubRemiApi(page, { kind: 'reply', chunks: ['Ce sont les 100 personnes du musée.'] })
  await openChatOnEntry(page)

  await page.getByTestId('remi-chat-suggestion').filter({ hasText: 'Qui sont les 100 ?' }).click()
  await expect(messages(page).nth(1)).toHaveText('Qui sont les 100 ?')
  await expect(messages(page).nth(2)).toHaveText('Ce sont les 100 personnes du musée.')
  expect(stub.requests.at(-1)?.messages.at(-1)).toEqual({ role: 'user', content: 'Qui sont les 100 ?' })
})

test('client : service indisponible (503) → réponse de repli scripté', async ({ page }) => {
  const stub = await stubRemiApi(page, { kind: 'http', status: 503 })
  await openChatOnEntry(page)

  await ask(page, 'Bonjour Rémi')
  const reply = messages(page).nth(2)
  await expect(reply).toHaveAttribute('data-role', 'assistant')
  await expect(reply).toContainText('Je vous réponds brièvement :')
  await expect(reply).toContainText("Vous n'avez pas encore ouvert de portrait")
  expect(stub.requests).toHaveLength(1)
  // Le visiteur peut écrire de nouveau.
  await expect(input(page)).toBeEnabled()
})

test('client : trop de visiteurs (429) → attente aimable, « Réessayer » renvoie la même question', async ({ page }) => {
  const stub = await stubRemiApi(page, (n) => (n === 1 ? { kind: 'http', status: 429 } : { kind: 'reply', chunks: ['Me revoilà !'] }))
  await openChatOnEntry(page)

  await ask(page, 'Une question')
  await expect(messages(page).nth(2)).toContainText('Un instant, beaucoup de visiteurs me parlent en même temps')
  await page.getByTestId('remi-chat-retry').click()
  await expect(messages(page).nth(2)).toHaveText('Me revoilà !')
  await expect(page.getByTestId('remi-chat-retry')).toHaveCount(0)

  expect(stub.requests).toHaveLength(2)
  expect(stub.requests[1].messages.at(-1)).toEqual({ role: 'user', content: 'Une question' })
  // Une seule bulle du visiteur : la même question n'a pas été dupliquée.
  await expect(messages(page).and(page.locator('[data-role="user"]'))).toHaveCount(1)
})

test('client : fermer pendant la réponse annule la requête et rend la question au champ', async ({ page }) => {
  const stub = await stubRemiApi(page, { kind: 'hang' })
  await openChatOnEntry(page)

  await ask(page, 'Ma question en vol')
  await expect(page.getByTestId('remi-chat-typing')).toBeVisible()
  expect(stub.requests).toHaveLength(1)

  const aborted = page.waitForEvent('requestfailed', (request) => request.url().includes('/api/remi'))
  await page.getByTestId('remi-chat-close').click()
  await expect(chat(page)).toBeHidden()
  await aborted

  await page.evaluate(() => (globalThis as unknown as { __musee: { state: () => { openRemiChat: () => void } } }).__musee.state().openRemiChat())
  await expect(chat(page)).toBeVisible()
  await expect(input(page)).toHaveValue('Ma question en vol')
  // La question sans réponse n'est plus dans le fil : seul l'accueil reste.
  await expect(messages(page)).toHaveCount(1)
})

test('fermeture : bouton et Échap ferment le chat, l’historique est gardé à la réouverture', async ({ page }) => {
  await stubRemiApi(page, { kind: 'reply', chunks: ['Réponse de test.'] })
  await openChatOnEntry(page)

  await page.getByTestId('remi-chat-close').click()
  await expect(chat(page)).toBeHidden()
  expect((await museeState(page)).remiChatOpen).toBe(false)
  // Le HUD du jeu est de nouveau là.
  await expect(page.getByTestId('stamps-button')).toBeVisible()

  await page.evaluate(() => (globalThis as unknown as { __musee: { state: () => { openRemiChat: () => void } } }).__musee.state().openRemiChat())
  await expect(chat(page)).toBeVisible()
  await expect(messages(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(chat(page)).toBeHidden()
})

test('« Parler à Rémi » au comptoir ouvre le chat, plus un dialogue scripté', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  const curator = await page.evaluate(
    () => (globalThis as unknown as { __musee: { state: () => { layout: { curator: { position: { x: number; z: number } } } } } }).__musee.state().layout.curator.position,
  )
  await teleport(page, curator.x, curator.z + 2.2)

  const action = page.getByTestId('action-button')
  await expect(action).toContainText('Rémi')
  await action.click()
  await expect(chat(page)).toBeVisible()
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0)
  // L'historique de l'accueil est conservé : le chat rouvre sur le même fil.
  await expect(messages(page)).toHaveCount(1)
  await expect(messages(page).first()).toContainText('Bienvenue au Musée des 100')
})

test('le rendu du musée est en pause pendant le chat et reprend à la fermeture', async ({ page }) => {
  // Entrée, caméra au repos (en images rendues), pause, reprise : long sous SwiftShader chargé.
  test.slow()
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  // Scène chargée et caméra au repos avant de rouvrir le chat : sinon un chargement tardif du décor
  // (sur un téléphone lent) replacerait la caméra pendant la mesure.
  await waitForCameraSettled(page)
  await page.evaluate(() => (globalThis as unknown as { __musee: { state: () => { openRemiChat: () => void } } }).__musee.state().openRemiChat())
  await expect(chat(page)).toBeVisible()

  const camera = () =>
    page.evaluate(() => {
      const c = (globalThis as unknown as { __musee: { cameraPosition: () => { x: number; y: number; z: number } } }).__musee.cameraPosition()
      return [c.x, c.y, c.z]
    })

  await page.waitForTimeout(800)
  const before = await camera()
  // Le joueur saute à 7 m : la caméra, amortie, ne le suit qu'image après image (voir `waitForCameraSettled`) ;
  // une seule image rendue la déplacerait de plusieurs mètres (le pas d'une image est plafonné à 1/15 s, donc au
  // moins un tiers du chemin). Tolérance de 5 cm : le reliquat d'amortissement d'une image déjà en cours à
  // l'ouverture du chat (quelques millimètres) ne compte pas.
  await teleport(page, before[0] + 6, before[2] - 4)
  await page.waitForTimeout(1_500)
  const paused = await camera()
  expect(Math.hypot(...paused.map((v, i) => v - before[i])), 'le musée ne doit plus être rendu pendant le chat').toBeLessThan(0.05)

  await page.getByTestId('remi-chat-close').click()
  await expect(chat(page)).toBeHidden()
  await expect
    .poll(async () => Math.hypot(...(await camera()).map((v, i) => v - before[i])), {
      message: 'la caméra doit reprendre sa course à la fermeture du chat',
      timeout: 15_000,
    })
    .toBeGreaterThan(0.05)
})

test('PC : écran coupé en deux, Rémi à gauche, le chat à droite', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'mise en page PC : largeur ≥ 900 px ET paysage')
  await openChatOnEntry(page)

  const viewport = page.viewportSize()!
  await expect(chat(page)).toHaveAttribute('data-layout', 'split')
  await expect(page.getByTestId('remi-bust')).toHaveAttribute('data-variant', 'split')

  const stage = (await page.getByTestId('remi-chat-stage').boundingBox())!
  const frame = (await page.getByTestId('remi-chat-frame').boundingBox())!
  const half = viewport.width / 2
  expect(stage.x).toBeCloseTo(0, 0)
  expect(stage.width).toBeCloseTo(half, 0)
  expect(stage.height).toBeCloseTo(viewport.height, 0)
  expect(frame.x).toBeCloseTo(half, 0)
  expect(frame.width).toBeCloseTo(half, 0)
  expect(frame.height).toBeCloseTo(viewport.height, 0)

  // Tout le panneau (fil, saisie, bouton fermer) est dans la moitié droite.
  for (const testId of ['remi-chat-input', 'remi-chat-send', 'remi-chat-close']) {
    const box = (await page.getByTestId(testId).boundingBox())!
    expect(box.x, `${testId} dans la moitié droite`).toBeGreaterThanOrEqual(half - 1)
    expect(box.x + box.width, `${testId} dans la fenêtre`).toBeLessThanOrEqual(viewport.width + 1)
  }
  // Sur PC, le focus est sur la saisie dès l'ouverture.
  await expect(input(page)).toBeFocused()
})

test('téléphone : Rémi plein écran, saisie visible dans la fenêtre', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'mise en page téléphone (projets iphone et android)')
  await openChatOnEntry(page)

  const viewport = page.viewportSize()!
  await expect(chat(page)).toHaveAttribute('data-layout', 'overlay')
  await expect(page.getByTestId('remi-bust')).toHaveAttribute('data-variant', 'fullscreen')

  const stage = (await page.getByTestId('remi-chat-stage').boundingBox())!
  expect(stage.x).toBeCloseTo(0, 0)
  expect(stage.y).toBeCloseTo(0, 0)
  expect(stage.width).toBeCloseTo(viewport.width, 0)
  expect(stage.height).toBeCloseTo(viewport.height, 0)

  // À l'accueil, le clavier ne doit pas surgir : le focus n'est pas sur la saisie.
  await expect(input(page)).not.toBeFocused()

  const box = (await input(page).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height, 'la saisie doit rester dans la fenêtre').toBeLessThanOrEqual(viewport.height + 1)
  // Les bulles s'affichent par-dessus le bas de l'écran : le fil est entre l'en-tête et la saisie.
  const thread = (await page.getByTestId('remi-chat-thread').boundingBox())!
  const closeBox = (await page.getByTestId('remi-chat-close').boundingBox())!
  expect(thread.y).toBeGreaterThanOrEqual(closeBox.y + closeBox.height - 1)
  expect(thread.y + thread.height).toBeLessThanOrEqual(box.y + 1)
  expect(thread.height, 'le fil laisse voir une bonne part du buste').toBeLessThanOrEqual(viewport.height * 0.55)

  // 16 px au moins : en dessous, Safari iOS zoomerait la page au focus.
  const fontSize = await input(page).evaluate((el) =>
    parseFloat((globalThis as unknown as { getComputedStyle: (e: unknown) => { fontSize: string } }).getComputedStyle(el).fontSize),
  )
  expect(fontSize).toBeGreaterThanOrEqual(16)

  for (const testId of ['remi-chat-close', 'remi-chat-send']) {
    const target = (await page.getByTestId(testId).boundingBox())!
    expect(Math.min(target.width, target.height), `${testId} : cible tactile trop petite`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
  }
  for (const chip of await page.getByTestId('remi-chat-suggestion').all()) {
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
  }
  expect(await hasHorizontalOverflow(page), 'aucun débordement horizontal').toBe(false)
})

test('clavier virtuel (visualViewport simulé) : la saisie reste au-dessus, le fil se tasse', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'clavier virtuel : projets iphone et android')
  // Playwright n'a pas de clavier virtuel : on remplace `visualViewport` par une fenêtre visuelle pilotable, comme
  // celle que Safari iOS et Chrome Android réduisent quand le clavier s'ouvre (la page, elle, ne change pas de taille).
  await page.addInitScript(() => {
    const g = globalThis as unknown as {
      innerHeight: number
      visualViewport: unknown
      __setVisualViewport: (height: number, offsetTop?: number) => void
    }
    const listeners = new Set<() => void>()
    const fake = {
      height: g.innerHeight,
      offsetTop: 0,
      scale: 1,
      addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_type: string, fn: () => void) => listeners.delete(fn),
    }
    Object.defineProperty(g, 'visualViewport', { configurable: true, value: fake })
    g.__setVisualViewport = (height, offsetTop = 0) => {
      fake.height = height
      fake.offsetTop = offsetTop
      listeners.forEach((fn) => fn())
    }
  })
  await openChatOnEntry(page)

  const viewport = page.viewportSize()!
  const frame = page.getByTestId('remi-chat-frame')
  await expect(frame).toHaveAttribute('data-keyboard', 'false')
  const closedThread = (await page.getByTestId('remi-chat-thread').boundingBox())!

  // Clavier ouvert : 320 px de moins, et iOS décale la fenêtre visuelle de 20 px pour montrer le champ.
  const keyboard = 320
  const offsetTop = 20
  await page.evaluate(
    ([height, top]) => (globalThis as unknown as { __setVisualViewport: (h: number, t: number) => void }).__setVisualViewport(height, top),
    [viewport.height - keyboard, offsetTop],
  )
  await expect(frame).toHaveAttribute('data-keyboard', 'true')
  const box = (await frame.boundingBox())!
  expect(box.y).toBeCloseTo(offsetTop, 0)
  expect(box.height).toBeCloseTo(viewport.height - keyboard, 0)

  for (const testId of ['remi-chat-input', 'remi-chat-send']) {
    const target = (await page.getByTestId(testId).boundingBox())!
    expect(target.y + target.height, `${testId} doit rester au-dessus du clavier`).toBeLessThanOrEqual(offsetTop + viewport.height - keyboard + 1)
    expect(target.y).toBeGreaterThanOrEqual(offsetTop)
  }
  const close = (await page.getByTestId('remi-chat-close').boundingBox())!
  expect(close.y, 'le bouton fermer reste dans la zone visible').toBeGreaterThanOrEqual(offsetTop)
  const openThread = (await page.getByTestId('remi-chat-thread').boundingBox())!
  expect(openThread.height, 'le fil se tasse pour laisser la place au clavier').toBeLessThan(closedThread.height)
  expect(openThread.height).toBeGreaterThan(40)

  // Clavier refermé : le chat retrouve toute la fenêtre.
  await page.evaluate(
    (height) => (globalThis as unknown as { __setVisualViewport: (h: number) => void }).__setVisualViewport(height),
    viewport.height,
  )
  await expect(frame).toHaveAttribute('data-keyboard', 'false')
  expect((await frame.boundingBox())!.height).toBeCloseTo(viewport.height, 0)
})

test('paysage (844×390) : pas de débordement, saisie et fermeture dans la fenêtre', async ({ page }) => {
  const landscape = { width: 844, height: 390 }
  await page.setViewportSize(landscape)
  await openChatOnEntry(page)

  expect(await hasHorizontalOverflow(page), 'aucun débordement horizontal en paysage').toBe(false)
  for (const testId of ['remi-chat-input', 'remi-chat-send', 'remi-chat-close']) {
    const box = (await page.getByTestId(testId).boundingBox())!
    expect(box.x, `${testId} déborde à gauche`).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, `${testId} déborde à droite`).toBeLessThanOrEqual(landscape.width + 1)
    expect(box.y, `${testId} déborde en haut`).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height, `${testId} déborde en bas`).toBeLessThanOrEqual(landscape.height + 1)
  }
  // Rémi garde sa part de l'écran à gauche.
  const stage = (await page.getByTestId('remi-chat-stage').boundingBox())!
  expect(stage.width).toBeGreaterThan(landscape.width * 0.3)
})

test('accessibilité : chat ouvert — pas de violation serious/critical', async ({ page }) => {
  // Le fondu d'ouverture fausserait le contraste mesuré (voir accessibility.spec.ts).
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openChatOnEntry(page)
  await input(page).fill('Bonjour')

  const results = await new AxeBuilder({ page }).include('[data-testid="remi-chat"]').analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, serious.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.length} nœud(s)`).join('\n')).toEqual([])
})
