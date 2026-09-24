import { expect, test } from '@playwright/test'
import { dismissWelcomeDialogue, enterMuseum, gotoMusee, hasHorizontalOverflow, museePlayer } from './support/museeApi'

const LANDSCAPE = { width: 844, height: 390 }
/** Cible tactile minimale (docs/DESIGN.md), tolérance sous-pixel. */
const MIN_TOUCH_TARGET = 47.5

test('paysage (844×390) : HUD et joystick utilisables, pas de débordement horizontal', async ({ page }) => {
  await page.setViewportSize(LANDSCAPE)
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  expect(await hasHorizontalOverflow(page), 'la page ne doit pas déborder horizontalement en paysage').toBe(false)

  const hud = page.getByTestId('hud')
  await expect(hud).toBeVisible()
  const joystickZone = page.getByTestId('joystick-zone')
  await expect(joystickZone).toBeVisible()

  for (const testId of ['hud-lang', 'stamps-button']) {
    const el = page.getByTestId(testId)
    await expect(el).toBeVisible()
    const box = await el.boundingBox()
    expect(box, `${testId} devrait avoir une géométrie mesurable`).not.toBeNull()
    if (!box) continue
    expect(box.x, `${testId} déborde à gauche`).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, `${testId} déborde à droite`).toBeLessThanOrEqual(LANDSCAPE.width + 1)
    expect(box.y, `${testId} déborde en haut`).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height, `${testId} déborde en bas`).toBeLessThanOrEqual(LANDSCAPE.height + 1)
    expect(Math.min(box.width, box.height), `${testId} : cible tactile trop petite`).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET,
    )
  }

  // Le joystick doit rester exploitable en paysage : un glissé fait avancer le joueur.
  const before = await museePlayer(page)
  await page.mouse.move(LANDSCAPE.width * 0.25, LANDSCAPE.height * 0.7)
  await page.mouse.down()
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(LANDSCAPE.width * 0.25, LANDSCAPE.height * 0.7 + i * 10)
  }
  await expect.poll(async () => (await museePlayer(page)).moving, { timeout: 2_000 }).toBe(true)
  await page.mouse.up()
  const after = await museePlayer(page)
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.1)
})
