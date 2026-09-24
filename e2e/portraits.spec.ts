import { expect, test } from '@playwright/test'
import { dismissWelcomeDialogue, enterMuseum, goToPerson, gotoMusee, museeState } from './support/museeApi'

// Le bouton d'action (« Regarder ») est vérifié en français ; voir title-lang.spec.ts pour pourquoi
// la locale doit être fixée explicitement.
test.use({ locale: 'fr-FR' })

test.beforeEach(async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
})

test('goToPerson → bouton « Regarder » → fiche portrait avec le nom → suivant/précédent → Échap ferme', async ({
  page,
}) => {
  const state = await museeState(page)
  const first = state.people[0]
  expect(first, 'la liste des 100 (placeholder ou réelle) doit contenir au moins une fiche').toBeTruthy()

  await goToPerson(page, first.id)

  const actionButton = page.getByTestId('action-button')
  await expect(actionButton).toBeVisible({ timeout: 5_000 })
  await expect(actionButton).toHaveText(new RegExp(`^Regarder`))

  await actionButton.click()

  const card = page.getByTestId('portrait-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText(first.name)

  const next = page.getByTestId('portrait-next')
  const prev = page.getByTestId('portrait-prev')
  await expect(prev).toBeDisabled() // premier de son aile : pas de précédent.

  await next.click()
  await expect(card).not.toContainText(first.name)
  const afterNextState = await museeState(page)
  expect(afterNextState.openPersonId).not.toBe(first.id)

  await prev.click()
  await expect(card).toContainText(first.name)

  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()

  const closedState = await museeState(page)
  expect(closedState.openPersonId).toBeNull()
})

test('fermeture de la fiche via le bouton ✕', async ({ page }) => {
  const state = await museeState(page)
  const first = state.people[0]
  await goToPerson(page, first.id)
  await page.getByTestId('action-button').click()

  const card = page.getByTestId('portrait-card')
  await expect(card).toBeVisible()
  await page.getByTestId('portrait-close').click()
  await expect(card).toBeHidden()
})
