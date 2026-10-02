import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  hasHorizontalOverflow,
  museeState,
  openRemiChat,
  teleport,
  waitForCameraSettled,
} from './support/museeApi'
import { lumaStats, minTextContrast, sceneMatch } from './support/pixels'
import { stubRemiApi } from './support/remiApi'

/**
 * Chat avec Rémi · IA (V5, WEL-920) : `src/features/remiChat/`. Ne s'ouvre PAS à l'entrée au musée (le visiteur y
 * arrive directement dans le jeu, avec la bulle d'accueil de Rémi en bas de l'écran) : seulement par « Parler à Rémi »
 * au comptoir ; remplace alors le dialogue scripté de conversation. Il est translucide : le musée reste visible derrière.
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

/** Entre au musée, referme la bulle d'accueil, puis ouvre le chat comme l'action « Parler à Rémi » (voir `openRemiChat`). */
async function openChat(page: Page): Promise<void> {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  await openRemiChat(page)
}

/** Premier message de Rémi, court (`strings.ts`, clé `greeting`). */
const GREETING_FR = 'Bonjour ! Je suis Rémi · IA. Posez-moi vos questions sur le musée, les 100 ou la soirée.'

/** Une longue réponse de Rémi (une dizaine de lignes sur téléphone), pour remplir le fil. */
const LONG_REPLY = 'Le Musée des 100 réunit les cent personnes qui font l’IA en Europe, réparties en trois ailes. '.repeat(8)

async function ask(page: Page, text: string): Promise<void> {
  await input(page).fill(text)
  await page.getByTestId('remi-chat-send').click()
}

test('à l’entrée, le chat ne s’ouvre PAS : la bulle d’accueil de Rémi, le musée visible, aucun appel réseau', async ({ page }) => {
  const stub = await stubRemiApi(page)
  await gotoMusee(page)
  await enterMuseum(page)

  await expect(page.getByTestId('dialogue-box')).toBeVisible()
  await expect(page.getByTestId('dialogue-box')).toContainText('Rémi Godeau')
  // Laisse le temps qu'une ouverture tardive (code du chat chargé à la demande) se montre, si elle devait avoir lieu.
  await page.waitForTimeout(1_500)
  const state = await museeState(page)
  expect(state.remiChatOpen).toBe(false)
  expect(state.dialogue?.id).toBe('welcome')
  await expect(chat(page)).toHaveCount(0)
  await expect(page.getByTestId('remi-bust')).toHaveCount(0)
  // Le HUD est là : on est dans le jeu.
  await expect(page.getByTestId('stamps-button')).toBeVisible()
  expect(stub.requests).toHaveLength(0)
})

test('au comptoir : le chat s’ouvre avec un court message de Rémi et les suggestions, sans appel réseau', async ({ page }) => {
  const stub = await stubRemiApi(page)
  await openChat(page)

  await expect(messages(page)).toHaveCount(1)
  await expect(messages(page).first()).toHaveAttribute('data-role', 'assistant')
  await expect(messages(page).first()).toHaveText(GREETING_FR)
  // Court : ni les huit paragraphes de l'accueil (déjà passés dans la bulle), ni le nom complet.
  await expect(messages(page).first()).not.toContainText('Bienvenue au Musée des 100')
  await expect(page.getByRole('heading', { name: 'Rémi · IA' })).toBeVisible()
  await expect(chat(page)).toContainText('Réponses générées par une IA')
  await expect(page.getByTestId('remi-chat-suggestion')).toHaveCount(4)

  const state = await museeState(page)
  expect(state.remiChatOpen).toBe(true)
  expect(state.dialogue).toBeNull()
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0)
  expect(stub.requests).toHaveLength(0)
})

test('client : l’envoi suit le contrat et le texte reçu s’affiche au fil du flux', async ({ page }) => {
  const stub = await stubRemiApi(page, { kind: 'reply', chunks: ['Le musée compte ', 'trois ailes.'] })
  await openChat(page)

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
  // Le premier message de Rémi ouvre l'historique envoyé.
  expect(body.messages[0].role).toBe('assistant')
  expect(body.messages[0].content).toBe(GREETING_FR)
  expect(body.context).toMatchObject({ visitedCount: 0, stampsCount: 0 })
})

test('client : une suggestion part comme message du visiteur', async ({ page }) => {
  const stub = await stubRemiApi(page, { kind: 'reply', chunks: ['Ce sont les 100 personnes du musée.'] })
  await openChat(page)

  await page.getByTestId('remi-chat-suggestion').filter({ hasText: 'Qui sont les 100 ?' }).click()
  await expect(messages(page).nth(1)).toHaveText('Qui sont les 100 ?')
  await expect(messages(page).nth(2)).toHaveText('Ce sont les 100 personnes du musée.')
  expect(stub.requests.at(-1)?.messages.at(-1)).toEqual({ role: 'user', content: 'Qui sont les 100 ?' })
})

test('client : service indisponible (503) → réponse de repli scripté', async ({ page }) => {
  const stub = await stubRemiApi(page, { kind: 'http', status: 503 })
  await openChat(page)

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
  await openChat(page)

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
  await openChat(page)

  await ask(page, 'Ma question en vol')
  await expect(page.getByTestId('remi-chat-typing')).toBeVisible()
  expect(stub.requests).toHaveLength(1)

  const aborted = page.waitForEvent('requestfailed', (request) => request.url().includes('/api/remi'))
  await page.getByTestId('remi-chat-close').click()
  await expect(chat(page)).toBeHidden()
  await aborted

  await openRemiChat(page)
  await expect(input(page)).toHaveValue('Ma question en vol')
  // La question sans réponse n'est plus dans le fil : seul l'accueil reste.
  await expect(messages(page)).toHaveCount(1)
})

test('fermeture : bouton et Échap ferment le chat, l’historique est gardé à la réouverture', async ({ page }) => {
  await stubRemiApi(page, { kind: 'reply', chunks: ['Réponse de test.'] })
  await openChat(page)

  await page.getByTestId('remi-chat-close').click()
  await expect(chat(page)).toBeHidden()
  expect((await museeState(page)).remiChatOpen).toBe(false)
  // Le HUD du jeu (masqué pendant le chat, qui le recouvre) est de nouveau là.
  await expect(page.getByTestId('stamps-button')).toBeVisible()

  await openRemiChat(page)
  await expect(messages(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(chat(page)).toBeHidden()
})

test('« Parler à Rémi » au comptoir (le vrai geste) ouvre le chat, plus un dialogue scripté', async ({ page }) => {
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
  // Un fil neuf : le court premier message de Rémi, pas l'accueil complet déjà passé dans la bulle.
  await expect(messages(page)).toHaveCount(1)
  await expect(messages(page).first()).toHaveText(GREETING_FR)
  expect((await museeState(page)).remiChatOpen).toBe(true)
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
  await openRemiChat(page)

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
  await openChat(page)

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
  await openChat(page)

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
  // Un fil assez long pour remplir la zone du fil : le premier message de Rémi est court (une phrase), et un fil court
  // n'a aucune raison de se tasser quand le clavier s'ouvre.
  await stubRemiApi(page, { kind: 'reply', chunks: [LONG_REPLY] })
  await openChat(page)
  await ask(page, 'Parlez-moi du musée')
  await expect(messages(page).nth(2)).toContainText('trois ailes')
  await expect(page.getByTestId('remi-chat-typing')).toHaveCount(0)

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
  await openChat(page)

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
  await openChat(page)
  await input(page).fill('Bonjour')

  const results = await new AxeBuilder({ page }).include('[data-testid="remi-chat"]').analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, serious.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.length} nœud(s)`).join('\n')).toEqual([])
})

/** Feuille de style qui cache le chat sans le fermer : le musée figé derrière apparaît seul (état et rendu inchangés). */
const HIDE_CHAT = '[data-testid="remi-chat"] { visibility: hidden !important; }'

test('le musée est visible derrière Rémi et derrière le chat : aucun aplat opaque, mêmes reliefs que le musée seul', async ({ page }, testInfo) => {
  // Entrée, chat, deux captures plein écran décodées dans la page : long sous SwiftShader chargé.
  test.slow()
  await openChat(page)
  // Fondu d'ouverture terminé, scène stable.
  await page.waitForTimeout(800)

  // 1. Aucune couche du chat ne pose de fond : ni la racine, ni la scène de Rémi, ni le buste. Seul le voile nuit
  //    (`::before`) assombrit le musée, et il reste léger (aucun arrêt au-dessus de 75 % d'opacité).
  const layers = await page.evaluate(() => {
    type Host = {
      document: { querySelector: (selector: string) => unknown }
      getComputedStyle: (element: unknown, pseudo?: string) => { backgroundColor: string; backgroundImage: string }
    }
    const g = globalThis as unknown as Host
    const read = (selector: string, pseudo?: string) => {
      const style = g.getComputedStyle(g.document.querySelector(selector), pseudo)
      return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage }
    }
    return {
      chat: read('[data-testid="remi-chat"]'),
      stage: read('[data-testid="remi-chat-stage"]'),
      bust: read('[data-testid="remi-bust"]'),
      veil: read('[data-testid="remi-chat"]', '::before'),
    }
  })
  for (const name of ['chat', 'stage', 'bust'] as const) {
    expect(layers[name].backgroundColor, `${name} : fond transparent`).toBe('rgba(0, 0, 0, 0)')
    expect(layers[name].backgroundImage, `${name} : ni dégradé ni image`).toBe('none')
  }
  const veilAlphas = [...layers.veil.backgroundImage.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) => Number(m[1]))
  expect(veilAlphas.length, 'le voile est un dégradé nuit').toBeGreaterThan(1)
  expect(Math.max(...veilAlphas), 'le voile reste léger').toBeLessThanOrEqual(0.75)

  // 2. Pixels : à chaque endroit où le musée seul a du relief, la capture avec le chat suit le même relief (le voile et
  //    le flou changent les valeurs, pas la forme). Un fond opaque ou un dégradé uni la ferait tomber à zéro.
  const withChat = await page.screenshot({ scale: 'css' })
  const hidden = await page.addStyleTag({ content: HIDE_CHAT })
  const museumOnly = await page.screenshot({ scale: 'css' })
  await hidden.evaluate((el) => el.remove())

  const museum = await lumaStats(page, museumOnly)
  expect(museum.std, 'le musée figé a du relief (la mesure a un objet)').toBeGreaterThan(10)
  expect(museum.colors, 'le musée figé n’est pas un aplat').toBeGreaterThan(40)
  const match = await sceneMatch(page, withChat, museumOnly)
  testInfo.annotations.push({ type: 'musée visible', description: `${match.matching}/${match.textured} blocs de relief retrouvés (${(match.ratio * 100).toFixed(0)} %)` })
  expect(match.textured, 'assez de blocs à relief pour conclure').toBeGreaterThan(40)
  expect(match.ratio, `part du relief du musée retrouvée à travers le chat (${match.matching}/${match.textured})`).toBeGreaterThanOrEqual(0.2)

  // 3. Le chat est bien là par-dessus, et le HUD du jeu, que sa translucidité laisserait voir sans qu'on puisse
  //    l'appuyer, est masqué pendant qu'il est ouvert.
  await expect(chat(page)).toBeVisible()
  await expect(page.getByTestId('stamps-button')).toBeHidden()
})

test('musée figé derrière le chat : l’image ne devient jamais noire ni vide quand la fenêtre change de taille', async ({ page }) => {
  // Quatre redimensionnements, chacun suivi d'une capture : long sous SwiftShader chargé.
  test.slow()
  await openChat(page)
  const canvas = page.getByTestId('game-canvas')
  const hidden = await page.addStyleTag({ content: HIDE_CHAT })

  const cameraNow = () =>
    page.evaluate(() => {
      const c = (globalThis as unknown as { __musee: { cameraPosition: () => { x: number; y: number; z: number } } }).__musee.cameraPosition()
      return [c.x, c.y, c.z]
    })
  // Taille du tampon de dessin du <canvas> du musée (`game-canvas` est le conteneur que R3F crée autour) : R3F la change,
  // et efface donc l'image, à chaque redimensionnement.
  const backingStore = () => canvas.locator('canvas').evaluate((el) => `${(el as unknown as { width: number }).width}x${(el as unknown as { height: number }).height}`)
  const expectPaintedMuseum = async (label: string) => {
    const stats = await lumaStats(page, await canvas.screenshot({ scale: 'css' }))
    const detail = `${label} : luma moyenne ${stats.mean.toFixed(1)}, écart-type ${stats.std.toFixed(1)}, ${stats.colors} couleurs`
    expect(stats.mean, `${detail} (le musée n’est pas noir)`).toBeGreaterThan(30)
    expect(stats.std, `${detail} (le musée n’est pas uniforme)`).toBeGreaterThan(10)
    expect(stats.colors, `${detail} (le musée n’est pas un aplat)`).toBeGreaterThan(20)
  }

  await expectPaintedMuseum('avant redimensionnement')
  // Le joueur saute à 7 m pendant le chat : si la boucle de rendu complète repartait au redimensionnement, la caméra
  // le suivrait. Elle doit rester où elle était.
  const cameraBefore = await cameraNow()
  await teleport(page, cameraBefore[0] + 6, cameraBefore[2] - 4)

  const { width, height } = page.viewportSize()!
  const steps: Array<[string, number, number]> = [
    ['hauteur réduite (clavier qui redimensionne la page)', width, Math.round(height * 0.6)],
    ['hauteur rétablie (clavier refermé)', width, height],
    ['rotation (largeur et hauteur échangées)', height, width],
    ['retour à la taille d’origine', width, height],
  ]
  for (const [label, w, h] of steps) {
    const before = await backingStore()
    await page.setViewportSize({ width: w, height: h })
    // R3F a changé la taille du canvas : l'image a été effacée, elle doit déjà avoir été redessinée.
    await expect.poll(backingStore, { message: `${label} : le canvas du musée doit être redimensionné` }).not.toBe(before)
    await expectPaintedMuseum(label)
  }

  const cameraAfter = await cameraNow()
  expect(Math.hypot(...cameraAfter.map((v, i) => v - cameraBefore[i])), 'le musée ne doit toujours pas être rendu image par image').toBeLessThan(0.05)
  await hidden.evaluate((el) => el.remove())
  await expect(chat(page)).toBeVisible()
})

test('musée figé derrière le chat : si le contexte WebGL est perdu pendant le chat, le musée remonté est redessiné', async ({ page }) => {
  // Perte de contexte, remontage du canvas, rechargement de la scène, capture : long sous SwiftShader chargé.
  test.slow()
  await openChat(page)
  const canvas = page.getByTestId('game-canvas')
  const hidden = await page.addStyleTag({ content: HIDE_CHAT })

  // Marque l'élément <canvas> actuel, puis lui fait perdre son contexte (mémoire saturée sur un téléphone qui porte
  // deux scènes WebGL) : l'application remonte un nouveau <canvas> (`useCanvasRecovery`).
  await canvas.locator('canvas').evaluate((el) => {
    const element = el as unknown as { dataset: Record<string, string>; getContext: (kind: 'webgl2') => { getExtension: (name: string) => { loseContext: () => void } | null } | null }
    element.dataset.ancien = '1'
    element.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
  })
  await expect(canvas.locator('canvas:not([data-ancien])'), 'un nouveau <canvas> remplace celui qui a perdu son contexte').toHaveCount(1, { timeout: 30_000 })

  // Le nouveau contexte ne reçoit aucune image de la boucle de rendu (en pause pendant le chat) : sans `PausedRepaint`,
  // le musée resterait vide derrière le chat jusqu'à sa fermeture.
  await expect
    .poll(
      async () => {
        const stats = await lumaStats(page, await canvas.screenshot({ scale: 'css' }))
        return stats.mean > 30 && stats.std > 10 && stats.colors > 20
      },
      { message: 'le musée remonté est dessiné (ni noir, ni uniforme)', timeout: 30_000 },
    )
    .toBe(true)
  expect((await museeState(page)).remiChatOpen, 'le chat est resté ouvert').toBe(true)
  await hidden.evaluate((el) => el.remove())
})

test('texte lisible sur le musée : contraste AA (au moins 4,5) mesuré sur les pixels réels derrière chaque texte', async ({ page }, testInfo) => {
  // Deux états du chat, une capture chacun, décodées dans la page : long sous SwiftShader chargé.
  test.slow()
  await stubRemiApi(page, { kind: 'reply', chunks: ['Les Archives de 2040 sont au sud du hall. ', 'Chaque séquence de la soirée y a sa vitrine.'] })
  await openChat(page)
  await page.waitForTimeout(800)

  interface Target {
    label: string
    rect: { x: number; y: number; width: number; height: number }
    color: { r: number; g: number; b: number; a: number }
  }

  /**
   * Relève, pour chaque élément, sa zone de texte et sa couleur de texte, puis photographie le chat TEXTE MASQUÉ :
   * il ne reste que les fonds réels (musée + voile + verre) sous chaque texte.
   */
  async function measure(locators: Array<{ label: string; locator: ReturnType<Page['getByTestId']>; inset: [number, number]; placeholder?: boolean }>) {
    const targets: Target[] = []
    for (const { label, locator, inset, placeholder } of locators) {
      const box = (await locator.boundingBox())!
      const css = await locator.evaluate((el, ph) => {
        const g = globalThis as unknown as { getComputedStyle: (e: unknown, pseudo?: string) => { color: string } }
        return g.getComputedStyle(el, ph ? '::placeholder' : undefined).color
      }, placeholder === true)
      const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)!
      targets.push({
        label,
        rect: {
          x: Math.round(box.x + inset[0]),
          y: Math.round(box.y + inset[1]),
          width: Math.round(box.width - 2 * inset[0]),
          height: Math.round(box.height - 2 * inset[1]),
        },
        color: { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) },
      })
    }
    const maskText = await page.addStyleTag({
      content:
        '[data-testid="remi-chat"] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }' +
        '[data-testid="remi-chat"] ::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; }',
    })
    const background = await page.screenshot({ scale: 'css' })
    await maskText.evaluate((el) => el.remove())
    const results: Array<{ label: string; ratio: number }> = []
    for (const t of targets) results.push({ label: t.label, ratio: await minTextContrast(page, background, t.rect, t.color) })
    return results
  }

  const results = [
    ...(await measure([
      { label: 'titre « Rémi · IA »', locator: page.getByRole('heading', { name: 'Rémi · IA' }), inset: [0, 2] },
      { label: 'mention « Réponses générées par une IA »', locator: page.locator('.remi-chat__notice'), inset: [6, 1] },
      { label: 'premier message de Rémi', locator: messages(page).first(), inset: [8, 6] },
      { label: 'suggestion de question', locator: page.getByTestId('remi-chat-suggestion').first(), inset: [14, 10] },
      { label: 'champ de saisie (texte indicatif)', locator: input(page), inset: [16, 10], placeholder: true },
    ])),
  ]
  await page.getByTestId('remi-chat-suggestion').filter({ hasText: 'Que sont les Archives de 2040 ?' }).click()
  await expect(messages(page).nth(2)).toContainText('vitrine')
  await expect(page.getByTestId('remi-chat-typing')).toHaveCount(0)
  results.push(
    ...(await measure([
      { label: 'message du visiteur (corail)', locator: messages(page).nth(1), inset: [8, 6] },
      { label: 'réponse de Rémi', locator: messages(page).nth(2), inset: [8, 6] },
    ])),
  )

  for (const { label, ratio } of results) testInfo.annotations.push({ type: 'contraste', description: `${label} : ${ratio.toFixed(2)}:1` })
  for (const { label, ratio } of results) expect(ratio, `${label} : contraste ${ratio.toFixed(2)}:1 sous le seuil AA de 4,5:1`).toBeGreaterThanOrEqual(4.5)
})
