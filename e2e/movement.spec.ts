import { expect, test } from '@playwright/test'
import {
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  museeInput,
  museePlayer,
  teleport,
  waitForCameraSettled,
  worldToScreen,
} from './support/museeApi'

/**
 * Point libre du hall, sur le chemin de l'aile ouest : loin du banc circulaire de l'Arbre des 100
 * (centre du hall), des colonnes et des bancs. Le centre exact du hall n'est plus libre depuis
 * l'ajout de l'arbre.
 */
const SAFE_SPOT = { x: -5, z: 0 }
/** Cible du tap au sol : 2,5 m au nord du point libre, sur le même chemin dégagé. */
const TAP_TARGET = { x: -5, z: -2.5 }
/** SwiftShader sur les runners CI (2 cœurs) est lent : marges larges pour les attentes d'état. */
const MOVE_TIMEOUT = 6_000

test.beforeEach(async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  await teleport(page, SAFE_SPOT.x, SAFE_SPOT.z, 0)
  // Le tap au sol (ci-dessous) vise un point écran → sol dépendant de la caméra courante : la
  // laisser rattraper le joueur téléporté avant de taper (voir `waitForCameraSettled`).
  await waitForCameraSettled(page)
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
    .poll(async () => (await museePlayer(page)).moving, { timeout: MOVE_TIMEOUT })
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

  // Vise un point de sol précis et libre plutôt qu'une position d'écran fixe : la caméra s'adapte
  // au format d'écran, une position fixe pouvait tomber sur le joueur lui-même ou derrière un obstacle.
  const { clientX: x, clientY: y } = await worldToScreen(page, TAP_TARGET.x, 0, TAP_TARGET.z)

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.up()

  // Une marque de tap doit apparaître brièvement à l'endroit touché.
  await expect(page.locator('.joystick-tap-marker')).toBeVisible({ timeout: 2_000 })

  await expect
    .poll(
      async () => {
        const p = await museePlayer(page)
        return Math.hypot(p.x - before.x, p.z - before.z)
      },
      { timeout: MOVE_TIMEOUT, message: 'le joueur devrait marcher vers le point touché' },
    )
    .toBeGreaterThan(0.3)

  // Il avance bien vers la cible (au nord), pas dans une direction quelconque.
  const after = await museePlayer(page)
  expect(after.z, 'le tap au nord du joueur doit le faire avancer vers −Z').toBeLessThan(before.z - 0.2)
})

test('flèches du clavier déplacent le joueur (desktop)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Clavier : couvert uniquement par le projet desktop.')

  const before = await museePlayer(page)

  await page.keyboard.down('ArrowUp')
  await expect
    .poll(async () => (await museePlayer(page)).moving, { timeout: MOVE_TIMEOUT })
    .toBe(true)
  const during = await museePlayer(page)
  await page.keyboard.up('ArrowUp')

  // ArrowUp → moveY = -1 → le joueur avance vers -Z (voir inputToWorldDirection, physics.ts).
  expect(during.z, 'ArrowUp devrait faire décroître z').toBeLessThan(before.z - 0.05)
  expect(Math.abs(during.x - before.x)).toBeLessThan(0.3)

  await expect.poll(async () => (await museeInput(page)).moveY).toBe(0)
})
