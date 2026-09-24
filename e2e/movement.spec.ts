import { expect, test } from '@playwright/test'
import { dismissWelcomeDialogue, enterMuseum, gotoMusee, museeInput, museePlayer, teleport } from './support/museeApi'

/** Centre du hall : loin de tout mur/collider (voir docs/DESIGN.md, hall ≈ 22×18 m centré sur l'origine). */
const SAFE_SPOT = { x: 0, z: 0 }

test.beforeEach(async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  await teleport(page, SAFE_SPOT.x, SAFE_SPOT.z, 0)
})

test('glisser sur la zone du joystick déplace le joueur (window.__musee.player)', async ({ page }) => {
  const zone = page.getByTestId('joystick-zone')
  await expect(zone).toBeVisible()

  const before = await museePlayer(page)

  const viewport = page.viewportSize()
  const originX = (viewport?.width ?? 400) * 0.28
  const originY = (viewport?.height ?? 800) * 0.72

  await page.mouse.move(originX, originY)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(originX, originY + i * 12)
  }
  await expect(page.getByTestId('joystick-knob')).toBeVisible()

  await expect
    .poll(async () => (await museePlayer(page)).moving, { timeout: 2_000 })
    .toBe(true)

  const dragging = await museePlayer(page)
  await page.mouse.up()

  const moved = Math.hypot(dragging.x - before.x, dragging.z - before.z)
  expect(moved, 'le joueur devrait avoir avancé pendant le glissé').toBeGreaterThan(0.15)

  // Repos après relâchement : l'entrée retombe à zéro.
  await expect.poll(async () => (await museeInput(page)).moveX).toBe(0)
  await expect.poll(async () => (await museeInput(page)).moveY).toBe(0)
})

test('tap au sol déclenche un déplacement automatique vers la cible', async ({ page }) => {
  const before = await museePlayer(page)

  const viewport = page.viewportSize()
  const x = (viewport?.width ?? 400) * 0.5
  const y = (viewport?.height ?? 800) * 0.55

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.up()

  // Une marque de tap doit apparaître brièvement à l'endroit touché.
  await expect(page.locator('.joystick-tap-marker')).toBeVisible({ timeout: 2_000 })

  await expect
    .poll(async () => (await museePlayer(page)).moving, { timeout: 2_000 })
    .toBe(true)

  await expect
    .poll(
      async () => {
        const p = await museePlayer(page)
        return Math.hypot(p.x - before.x, p.z - before.z)
      },
      { timeout: 2_000 },
    )
    .toBeGreaterThan(0.1)
})

test('flèches du clavier déplacent le joueur (desktop)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Clavier : couvert uniquement par le projet desktop.')

  const before = await museePlayer(page)

  await page.keyboard.down('ArrowUp')
  await expect
    .poll(async () => (await museePlayer(page)).moving, { timeout: 2_000 })
    .toBe(true)
  const during = await museePlayer(page)
  await page.keyboard.up('ArrowUp')

  // ArrowUp → moveY = -1 → le joueur avance vers -Z (voir inputToWorldDirection, physics.ts).
  expect(during.z, 'ArrowUp devrait faire décroître z').toBeLessThan(before.z - 0.05)
  expect(Math.abs(during.x - before.x)).toBeLessThan(0.3)

  await expect.poll(async () => (await museeInput(page)).moveY).toBe(0)
})
