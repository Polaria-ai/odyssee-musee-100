import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  museeState,
  teleport,
} from './support/museeApi'
import { stubRemiApi } from './support/remiApi'

/**
 * Chat avec l'Archiviste · IA (WEL-929) : le même chat que celui de Rémi (`src/features/remiChat/`), configuré par
 * persona, ouvert par « Parler à l'Archiviste » dans les Archives de 2040 au lieu du dialogue scripté. Même fonction
 * `/api/remi` : la requête porte `persona: 'archiviste'` (celle de Rémi n'a pas le champ).
 *
 * `/api/remi` est toujours intercepté (`support/remiApi.ts`, flux SSE au format exact du contrat) : aucun test
 * n'appelle le vrai réseau, ni OpenRouter ni Supabase (faux projet de `support/supabaseStub.ts`).
 */
test.use({ locale: 'fr-FR' })

const chat = (page: Page) => page.getByTestId('remi-chat')
const messages = (page: Page) => page.getByTestId('remi-chat-message')
const input = (page: Page) => page.getByTestId('remi-chat-input')
const action = (page: Page) => page.getByTestId('action-button')

/** Premier message de l'Archiviste, court (`strings.ts`, `archivisteStrings.greeting`). */
const GREETING_FR =
  "Bonjour. Je suis l'Archiviste · IA, gardienne des Archives de 2040. Interrogez-moi sur les vitrines ou sur le programme du 6 octobre."
const REMI_GREETING_FR = 'Bonjour ! Je suis Rémi · IA. Posez-moi vos questions sur le musée, les 100 ou la soirée.'

interface ArchivesProbe {
  archivist: { x: number; z: number }
  curator: { x: number; z: number }
  sessions: number
}

/** Positions du socle de l'Archiviste et du comptoir de Rémi, et nombre de vitrines (lus dans l'état du jeu). */
async function probe(page: Page): Promise<ArchivesProbe> {
  return page.evaluate(() => {
    const s = (
      globalThis as unknown as {
        __musee: {
          state: () => {
            layout: { curator: { position: { x: number; z: number } } }
            archivesLayout: { archivist: { position: { x: number; z: number } } }
            sessions: unknown[]
          }
        }
      }
    ).__musee.state()
    return { archivist: s.archivesLayout.archivist.position, curator: s.layout.curator.position, sessions: s.sessions.length }
  })
}

/** En jeu, bulle d'accueil de Rémi fermée, Archives déjà « découvertes » (sinon la première entrée ouvre l'accueil scripté). */
async function enterPlaying(page: Page): Promise<ArchivesProbe> {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  await page.evaluate(() => {
    ;(globalThis as unknown as { __musee: { state: () => { markArchivesDiscovered: () => boolean } } }).__musee.state().markArchivesDiscovered()
  })
  return probe(page)
}

/** Le vrai geste : se placer au socle de l'Archiviste puis toucher « Parler à l'Archiviste ». */
async function talkToArchivist(page: Page, p: ArchivesProbe): Promise<void> {
  await teleport(page, p.archivist.x, p.archivist.z)
  await expect(action(page)).toHaveText("Parler à l'Archiviste")
  await action(page).click()
  await expect(chat(page)).toBeVisible({ timeout: 60_000 })
}

/** Le vrai geste, côté Rémi : au comptoir, « Parler à Rémi ». */
async function talkToRemi(page: Page, p: ArchivesProbe): Promise<void> {
  await teleport(page, p.curator.x, p.curator.z + 2.2)
  await expect(action(page)).toHaveText('Parler à Rémi')
  await action(page).click()
  await expect(chat(page)).toBeVisible({ timeout: 60_000 })
}

async function ask(page: Page, text: string): Promise<void> {
  await input(page).fill(text)
  await page.getByTestId('remi-chat-send').click()
}

async function closeChat(page: Page): Promise<void> {
  await page.getByTestId('remi-chat-close').click()
  await expect(chat(page)).toBeHidden()
}

test('« Parler à l’Archiviste » ouvre SON chat : nom, mention IA, accueil court, puces, buste de l’Archiviste, sans appel réseau', async ({
  page,
}) => {
  const stub = await stubRemiApi(page)
  const p = await enterPlaying(page)
  await talkToArchivist(page, p)

  // Son chat, pas un dialogue scripté ni celui de Rémi.
  await expect(chat(page)).toHaveAttribute('data-persona', 'archiviste')
  await expect(chat(page)).toHaveAttribute('data-accent', 'cyan')
  await expect(page.getByRole('heading', { name: 'Archiviste · IA' })).toBeVisible()
  await expect(chat(page)).toContainText('Réponses générées par une IA')
  await expect(page.getByRole('heading', { name: 'Rémi · IA' })).toHaveCount(0)
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0)
  const state = await museeState(page)
  expect(state.remiChatOpen).toBe(true)
  expect(state.chatPersona).toBe('archiviste')
  expect(state.dialogue).toBeNull()

  // Son message d'accueil et ses quatre puces.
  await expect(messages(page)).toHaveCount(1)
  await expect(messages(page).first()).toHaveAttribute('data-role', 'assistant')
  await expect(messages(page).first()).toHaveText(GREETING_FR)
  const chips = page.getByTestId('remi-chat-suggestion')
  await expect(chips).toHaveCount(4)
  await expect(chips).toHaveText(['Que contiennent les Archives ?', 'Le programme du 6 octobre', 'Qui êtes-vous ?', "Que s'est-il dit ce soir ?"])

  // Le buste est celui de l'Archiviste (même composant, autre personnage).
  await expect(page.getByTestId('remi-bust')).toHaveAttribute('data-character', 'archiviste')
  expect(stub.requests).toHaveLength(0)
})

test('envoi : la requête porte persona « archiviste » et la progression des vitrines ; la réponse arrive au fil du flux', async ({ page }) => {
  const stub = await stubRemiApi(page, { kind: 'reply', chunks: ['Chaque séquence de la soirée ', 'a sa vitrine.'] })
  const p = await enterPlaying(page)
  await talkToArchivist(page, p)

  await ask(page, 'Que contiennent les Archives ?')
  await expect(messages(page).nth(1)).toHaveAttribute('data-role', 'user')
  await expect(messages(page).nth(1)).toHaveText('Que contiennent les Archives ?')
  await expect(messages(page).nth(2)).toHaveAttribute('data-role', 'assistant')
  await expect(messages(page).nth(2)).toHaveText('Chaque séquence de la soirée a sa vitrine.')
  await expect(page.getByTestId('remi-chat-typing')).toHaveCount(0)
  await expect(input(page)).toHaveValue('')
  await expect(page.getByTestId('remi-chat-suggestion')).toHaveCount(0)

  expect(stub.methods).toEqual(['POST'])
  expect(stub.requests).toHaveLength(1)
  const body = stub.requests[0]
  expect(body.persona).toBe('archiviste')
  expect(body.lang).toBe('fr')
  expect(body.visitorId).toMatch(/\S/)
  expect(body.messages[0]).toEqual({ role: 'assistant', content: GREETING_FR })
  expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Que contiennent les Archives ?' })
  // Archiviste : vitrines consultées, tampons, nombre de vitrines (et non les portraits de Rémi).
  expect(body.context).toEqual({ visitedCount: 0, stampsCount: 0, total: p.sessions })
})

test('une puce part comme message du visiteur', async ({ page }) => {
  const stub = await stubRemiApi(page, { kind: 'reply', chunks: ['Les archives seront déposées après la soirée.'] })
  const p = await enterPlaying(page)
  await talkToArchivist(page, p)

  await page.getByTestId('remi-chat-suggestion').filter({ hasText: 'Que s\'est-il dit ce soir ?' }).click()
  await expect(messages(page).nth(1)).toHaveText("Que s'est-il dit ce soir ?")
  await expect(messages(page).nth(2)).toHaveText('Les archives seront déposées après la soirée.')
  expect(stub.requests.at(-1)?.persona).toBe('archiviste')
  expect(stub.requests.at(-1)?.messages.at(-1)).toEqual({ role: 'user', content: "Que s'est-il dit ce soir ?" })
})

test('service indisponible (503) : repli au vouvoiement, puis le visiteur peut réécrire', async ({ page }) => {
  const stub = await stubRemiApi(page, { kind: 'http', status: 503 })
  const p = await enterPlaying(page)
  await talkToArchivist(page, p)

  await ask(page, 'Bonjour')
  const reply = messages(page).nth(2)
  await expect(reply).toHaveAttribute('data-role', 'assistant')
  await expect(reply).toContainText('Je vous réponds brièvement :')
  // Archives vides (faux projet Supabase) : l'état des vitrines, jamais une citation ni un propos de la soirée.
  await expect(reply).toContainText(/vitrines|archives/)
  await expect(reply).not.toContainText(/«|»/)
  await expect(input(page)).toBeEnabled()
  expect(stub.requests).toHaveLength(1)
  expect(stub.requests[0].persona).toBe('archiviste')
})

test('fermeture par la croix puis par Échap : le musée revient, le bouton d’action aussi, l’historique est gardé', async ({ page }) => {
  await stubRemiApi(page, { kind: 'reply', chunks: ['Bien sûr.'] })
  const p = await enterPlaying(page)
  await talkToArchivist(page, p)
  await ask(page, 'Une question')
  await expect(messages(page).nth(2)).toHaveText('Bien sûr.')

  await closeChat(page)
  expect((await museeState(page)).remiChatOpen).toBe(false)
  await expect(action(page)).toHaveText("Parler à l'Archiviste")

  // Réouverture : la conversation est là (le fil survit à la fermeture), Échap referme.
  await action(page).click()
  await expect(chat(page)).toBeVisible()
  await expect(messages(page)).toHaveCount(3)
  await expect(messages(page).nth(1)).toHaveText('Une question')
  await page.keyboard.press('Escape')
  await expect(chat(page)).toBeHidden()
  expect((await museeState(page)).remiChatOpen).toBe(false)
})

test('le chat de Rémi n’est pas affecté : même geste au comptoir, son nom, son accueil, sa requête sans persona, historique à part', async ({
  page,
}) => {
  const stub = await stubRemiApi(page, { kind: 'reply', chunks: ['Réponse.'] })
  const p = await enterPlaying(page)

  // 1. Une conversation avec l'Archiviste.
  await talkToArchivist(page, p)
  await ask(page, 'Question à l’Archiviste')
  await expect(messages(page).nth(2)).toHaveText('Réponse.')
  await closeChat(page)

  // 2. Rémi au comptoir : SON chat, un fil neuf, son buste, sa requête telle qu'avant l'Archiviste (aucun champ persona).
  await talkToRemi(page, p)
  await expect(chat(page)).toHaveAttribute('data-persona', 'remi')
  await expect(chat(page)).toHaveAttribute('data-accent', 'corail')
  await expect(page.getByRole('heading', { name: 'Rémi · IA' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Archiviste · IA' })).toHaveCount(0)
  await expect(page.getByTestId('remi-bust')).toHaveAttribute('data-character', 'remi')
  await expect(messages(page)).toHaveCount(1)
  await expect(messages(page).first()).toHaveText(REMI_GREETING_FR)
  await expect(page.getByTestId('remi-chat-suggestion')).toHaveText([
    'Comment ça marche ?',
    'Qui sont les 100 ?',
    'Que sont les Archives de 2040 ?',
    'Le programme du 6 octobre',
  ])
  expect((await museeState(page)).chatPersona).toBe('remi')

  await ask(page, 'Question à Rémi')
  await expect(messages(page).nth(2)).toHaveText('Réponse.')
  expect(stub.requests).toHaveLength(2)
  expect(stub.requests[1].persona).toBeUndefined()
  expect('persona' in stub.requests[1]).toBe(false)
  expect(stub.requests[1].messages.map((m) => m.content)).not.toContain('Question à l’Archiviste')
  expect(stub.requests[1].context).toMatchObject({ total: expect.any(Number) })
  await closeChat(page)

  // 3. Retour à l'Archiviste : sa conversation est intacte, sans rien de celle de Rémi.
  await talkToArchivist(page, p)
  await expect(messages(page)).toHaveCount(3)
  await expect(messages(page).nth(1)).toHaveText('Question à l’Archiviste')
  await expect(chat(page)).not.toContainText('Question à Rémi')
})

/** Couleur de fond calculée d'un élément (le navigateur la rend en `rgb()` ou `rgba()`). */
async function background(locator: ReturnType<Page['getByTestId']>): Promise<string> {
  return locator.evaluate((el) => (globalThis as unknown as { getComputedStyle: (e: unknown) => { backgroundColor: string } }).getComputedStyle(el).backgroundColor)
}

test('accent : cyan pour l’Archiviste, corail pour Rémi (parole du visiteur, bouton d’envoi) ; accessibilité sans violation', async ({ page }) => {
  // Le fondu d'ouverture fausserait le contraste mesuré (voir accessibility.spec.ts).
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await stubRemiApi(page, { kind: 'reply', chunks: ['Réponse.'] })
  const p = await enterPlaying(page)

  await talkToArchivist(page, p)
  await ask(page, 'Question')
  await expect(messages(page).nth(2)).toHaveText('Réponse.')
  await input(page).fill('Une autre question')
  // Cyan vif de la charte (#6de4e5), la bulle du visiteur un peu translucide.
  expect(await background(messages(page).nth(1))).toBe('rgba(109, 228, 229, 0.94)')
  expect(await background(page.getByTestId('remi-chat-send'))).toBe('rgb(109, 228, 229)')
  const archivisteResults = await new AxeBuilder({ page }).include('[data-testid="remi-chat"]').analyze()
  const archivisteSerious = archivisteResults.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(archivisteSerious, archivisteSerious.map((v) => `${v.id} (${v.impact}) : ${v.help}`).join('\n')).toEqual([])
  await closeChat(page)

  // Rémi garde son corail (#e8785c).
  await talkToRemi(page, p)
  await ask(page, 'Question')
  await expect(messages(page).nth(2)).toHaveText('Réponse.')
  await input(page).fill('Une autre question')
  expect(await background(messages(page).nth(1))).toBe('rgba(232, 120, 92, 0.94)')
  expect(await background(page.getByTestId('remi-chat-send'))).toBe('rgb(232, 120, 92)')
})

test('l’Archiviste garde ses dialogues scriptés hors du chat : l’arrivée dans la salle reste dans la bulle du jeu', async ({ page }) => {
  await stubRemiApi(page)
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  const p = await probe(page)

  // Première arrivée dans les Archives : annonce scriptée (DialogueBox), aucun chat.
  await teleport(page, p.archivist.x, p.archivist.z + 3)
  await expect(page.getByTestId('dialogue-box')).toBeVisible()
  await expect(page.getByTestId('dialogue-box')).toContainText("L'Archiviste")
  await expect(chat(page)).toHaveCount(0)
  expect((await museeState(page)).remiChatOpen).toBe(false)
})
