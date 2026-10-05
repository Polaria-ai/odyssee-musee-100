import { expect, test } from '@playwright/test'
import { gotoMusee } from './support/museeApi'

test('le musée s’ouvre et on peut entrer', async ({ page }) => {
  await gotoMusee(page, '&presenceRoom=e2e-smoke-' + crypto.randomUUID().slice(0, 12))
  await expect(page.getByTestId('title-screen')).toBeVisible()
  await page.getByTestId('enter-button').click()
  await expect(page.locator('.app')).toHaveAttribute('data-screen', 'play')
  await expect(page.getByTestId('game-canvas')).toBeVisible()
})
