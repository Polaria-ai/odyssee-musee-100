import { expect, test } from '@playwright/test'

test('le musée s’ouvre et on peut entrer', async ({ page }) => {
  await page.goto('/?e2e=1&presenceRoom=e2e-smoke-' + crypto.randomUUID().slice(0, 12))
  await expect(page.getByTestId('title-screen')).toBeVisible()
  await page.getByTestId('enter-button').click()
  await expect(page.getByTestId('customizer')).toBeVisible()
  await page.getByTestId('customizer-done').click()
  await expect(page.locator('.app')).toHaveAttribute('data-screen', 'play')
  await expect(page.getByTestId('game-canvas')).toBeVisible()
})
