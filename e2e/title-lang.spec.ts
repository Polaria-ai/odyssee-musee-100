import { expect, test } from '@playwright/test'
import { enterMuseum, gotoMusee, museeState } from './support/museeApi'

// Sans langue persistée, l'app retombe sur `navigator.language` (voir src/state/gameStore.ts,
// `initialLang`) : la locale du navigateur de test (souvent `en-US` par défaut) déciderait alors de
// la langue de départ à notre place. On la fixe en français pour un test déterministe — l'anglais
// est déjà couvert par les bascules ci-dessous.
test.use({ locale: 'fr-FR' })

test('bascule FR/EN sur l’écran titre', async ({ page }) => {
  await gotoMusee(page)
  const title = page.getByTestId('title-screen')
  await expect(title.getByRole('heading', { level: 1 })).toHaveText('Le Musée des 100')
  await expect(page.getByTestId('enter-button')).toHaveText('Entrer au musée')

  await page.getByTestId('lang-toggle').click()

  await expect(title.getByRole('heading', { level: 1 })).toHaveText('The Museum of the 100')
  await expect(page.getByTestId('enter-button')).toHaveText('Enter the museum')
})

test('bascule FR/EN dans le HUD une fois en jeu', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await expect(page.getByTestId('hud')).toBeVisible()

  const stampsButton = page.getByTestId('stamps-button')
  await expect(stampsButton).toHaveAccessibleName('Carnet de tampons')

  await page.getByTestId('hud-lang').click()
  await expect(stampsButton).toHaveAccessibleName('Stamp card')
  expect((await museeState(page)).lang).toBe('en')

  await page.getByTestId('hud-lang').click()
  await expect(stampsButton).toHaveAccessibleName('Carnet de tampons')
  expect((await museeState(page)).lang).toBe('fr')
})
