import { expect, test, type Page } from '@playwright/test'
import { closeAnyDialogue, dismissWelcomeDialogue, enterMuseum, gotoMusee, museeState, openPersonViaState, closePersonViaState } from './support/museeApi'

// Le texte de Rémi testé ici (accueil, tampons) est celui en français ; voir title-lang.spec.ts pour
// pourquoi la locale doit être fixée explicitement.
test.use({ locale: 'fr-FR' })

// L'accueil de Rémi est la bulle scriptée en bas de l'écran (`dialogue-box`) : le visiteur arrive directement dans
// le jeu, le musée sous les yeux. Le chat avec Rémi · IA (`src/features/remiChat/`) ne s'ouvre qu'au comptoir, par
// « Parler à Rémi » : il a sa propre spec (`remi-chat.spec.ts`). On vérifie ici l'accueil lui-même, que le chat ne
// s'ouvre pas à l'entrée, et que les autres dialogues (tampons, Archiviste) restent dans la même bulle.

/**
 * Affiche en entier la réplique `index` de la bulle, puis rend la main (sans avancer). Un clic termine la frappe de la
 * machine à écrire ; l'appelant reclique pour passer à la réplique suivante.
 * À chaque nouvelle réplique, la frappe repart de zéro et le curseur ▼ disparaît : on attend cette disparition avant
 * de se fier au curseur, sinon on lirait l'image transitoire où la bulle montre déjà le nouveau texte en entier
 * (le tampon de lettres affichées de la réplique précédente n'est pas encore remis à zéro) et on cliquerait deux fois.
 */
async function revealLine(page: Page, index: number): Promise<void> {
  const box = page.getByTestId('dialogue-box')
  const caret = box.locator('.ui-dialogue__caret')
  await expect.poll(async () => (await museeState(page)).dialogueIndex, { message: `la réplique ${index} doit être la réplique courante` }).toBe(index)
  // Première réplique : la frappe a pu finir seule sur une machine lente. Les suivantes viennent d'un clic : la frappe repart.
  if (index > 0) await expect(caret, `la frappe de la réplique ${index} doit repartir de zéro`).toBeHidden()
  if (!(await caret.isVisible())) await box.click()
  await expect(caret, `la réplique ${index} doit s'afficher en entier`).toBeVisible()
}

test('accueil de Rémi : on arrive directement dans le jeu, la bulle de dialogue en bas de l’écran, sans chat', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)

  const box = page.getByTestId('dialogue-box')
  await expect(box).toBeVisible()
  await expect(box).toContainText('Rémi Godeau')

  // C'est bien la bulle scriptée, pas le chat.
  const state = await museeState(page)
  expect(state.dialogue?.id).toBe('welcome')
  expect(state.remiChatOpen).toBe(false)
  await expect(page.getByTestId('remi-chat')).toHaveCount(0)

  // En bas de l'écran, et sans recouvrir le jeu : le musée reste visible au-dessus.
  const viewport = page.viewportSize()!
  const bubble = (await box.boundingBox())!
  expect(bubble.y + bubble.height, 'la bulle est collée au bas de l’écran').toBeGreaterThan(viewport.height * 0.85)
  expect(bubble.height, 'la bulle ne prend qu’une partie de l’écran').toBeLessThan(viewport.height * 0.4)
  await expect(page.getByTestId('game-canvas')).toBeVisible()
})

test('accueil de Rémi : tap pour avancer, huit répliques dont l’invitation à parler à Rémi au comptoir, puis il se ferme', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  const box = page.getByTestId('dialogue-box')
  await expect(box).toBeVisible()

  // Chaque tap termine la frappe de la réplique, le suivant passe à la réplique d'après : les huit défilent dans l'ordre.
  const expected = [
    'Bienvenue au Musée des 100. Je suis Rémi Godeau',
    "Il s'inscrit dans la soirée",
    'Trois ailes accompagnent les trois tables rondes',
    'Pour vous déplacer, glissez le pouce',
    "Approchez-vous d'un portrait",
    'Le rallye des tampons',
    'Au sud du hall, une porte mène aux Archives de 2040',
    // Dernière réplique : l'invitation à venir discuter avec Rémi au comptoir.
    'Parler à Rémi',
  ]
  for (const [index, text] of expected.entries()) {
    await revealLine(page, index)
    await expect(box).toContainText(text)
    if (index < expected.length - 1) await box.click()
  }
  expect((await museeState(page)).dialogueIndex).toBe(7)
  await expect(box).toContainText('par écrit')

  // Un dernier tap ferme la bulle ; le chat ne s'est pas ouvert pour autant.
  await box.click()
  await expect(box).toBeHidden()
  const state = await museeState(page)
  expect(state.dialogue).toBeNull()
  expect(state.remiChatOpen).toBe(false)
  await expect(page.getByTestId('remi-chat')).toHaveCount(0)
})

test('« Passer » ferme l’accueil d’un coup, le jeu reste jouable et le chat fermé', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await expect(page.getByTestId('dialogue-box')).toBeVisible()

  await page.getByRole('button', { name: 'Passer' }).click()
  await expect(page.getByTestId('dialogue-box')).toBeHidden()
  const state = await museeState(page)
  expect(state.dialogue).toBeNull()
  expect(state.remiChatOpen).toBe(false)
  // Le HUD du jeu est là.
  await expect(page.getByTestId('stamps-button')).toBeVisible()
})

test('l’accueil avance au clavier (Entrée) sur PC', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'clavier physique : projet desktop')
  await gotoMusee(page)
  await enterMuseum(page)
  await expect(page.getByTestId('dialogue-box')).toBeVisible()

  // Une première frappe termine la ligne en cours, la suivante passe à la réplique d'après.
  for (let i = 0; i < 40 && (await museeState(page)).dialogueIndex < 1; i++) {
    await page.keyboard.press('Enter')
    await page.waitForTimeout(40)
  }
  expect((await museeState(page)).dialogueIndex).toBeGreaterThanOrEqual(1)
  expect((await museeState(page)).remiChatOpen).toBe(false)
})

test('les autres dialogues de Rémi (tampons) restent dans la bulle de dialogue', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  await expect(page.getByTestId('dialogue-box')).toBeHidden()

  const state = await museeState(page)
  const wing = 'culture' as const
  const wingPeople = state.people.filter((p) => p.wing === wing).sort((a, b) => a.order - b.order)
  // requiredFor(total) = max(3, ceil(total * 0.3)) — voir src/features/stamps/stamps.ts.
  const required = Math.min(wingPeople.length, Math.max(3, Math.ceil(wingPeople.length * 0.3)))
  for (const person of wingPeople.slice(0, required)) await openPersonViaState(page, person.id)
  await closePersonViaState(page)

  const box = page.getByTestId('dialogue-box')
  await expect(box).toBeVisible()
  await expect(box).toContainText('Rémi Godeau')
  await expect(page.getByTestId('remi-chat')).toHaveCount(0)

  // « Passer » ferme la bulle, comme avant.
  await page.getByRole('button', { name: 'Passer' }).click()
  await closeAnyDialogue(page)
  await expect(box).toBeHidden()
})
