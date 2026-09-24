import { expect, test } from '@playwright/test'
import { gotoMusee, museeState } from './support/museeApi'

// Les libellés des pastilles (« Tenue », « Costume »…) sont en français ; voir title-lang.spec.ts
// pour pourquoi la locale doit être fixée explicitement.
test.use({ locale: 'fr-FR' })

test('personnalisation : tenue, accessoire, pseudo → écran de jeu, avatar enregistré', async ({ page }) => {
  await gotoMusee(page)
  await page.getByTestId('enter-button').click()

  const customizer = page.getByTestId('customizer')
  await expect(customizer).toBeVisible()

  // Tenue : « Costume » (radiogroup accessible, cf. AvatarCustomizer.tsx).
  await page.getByRole('radiogroup', { name: 'Tenue' }).getByRole('radio', { name: 'Costume' }).click()
  // Accessoire : « Casquette ».
  await page.getByRole('radiogroup', { name: 'Accessoire' }).getByRole('radio', { name: 'Casquette' }).click()
  // Pseudo.
  await page.getByTestId('avatar-name').fill('TesteurE2E')

  await page.getByTestId('customizer-done').click()

  await expect(page.locator('.app')).toHaveAttribute('data-screen', 'play')
  await expect(page.getByTestId('game-canvas')).toBeVisible()

  const state = await museeState(page)
  expect(state.avatar.outfit).toBe('suit')
  expect(state.avatar.accessory).toBe('cap')
  expect(state.avatar.name).toBe('TesteurE2E')
})

test('personnalisation : les pastilles choisies restent visuellement sélectionnées', async ({ page }) => {
  await gotoMusee(page)
  await page.getByTestId('enter-button').click()
  await expect(page.getByTestId('customizer')).toBeVisible()

  const suitRadio = page.getByRole('radiogroup', { name: 'Tenue' }).getByRole('radio', { name: 'Costume' })
  await suitRadio.click()
  await expect(suitRadio).toHaveAttribute('aria-checked', 'true')

  const teeRadio = page.getByRole('radiogroup', { name: 'Tenue' }).getByRole('radio', { name: 'T-shirt' })
  await expect(teeRadio).toHaveAttribute('aria-checked', 'false')
})
