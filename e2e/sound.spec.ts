import { expect, test } from '@playwright/test'
import { dismissWelcomeDialogue, enterMuseum, gotoMusee } from './support/museeApi'

/**
 * Bouton son (`sound-toggle`, `src/audio/SoundToggle.tsx`) : présent sur l'écran titre et dans le
 * HUD (deux instances distinctes du même composant, jamais montées en même temps — voir
 * `src/App.tsx`, `TitleScreen`/`Hud` s'excluent l'un l'autre), coupé par défaut (soirée en salle,
 * voir `docs/DESIGN.md`), état partagé (moteur audio global, `src/audio/engine.ts`) et persisté en
 * `localStorage` (clé `odyssee-musee-100:sound`, distincte de l'état de jeu persisté).
 */

test('bouton son sur l’écran titre : coupé par défaut, ≥ 48 px', async ({ page }) => {
  await gotoMusee(page)
  const toggle = page.getByTestId('sound-toggle')
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  const box = await toggle.boundingBox()
  expect(box, 'le bouton son devrait avoir une géométrie mesurable').not.toBeNull()
  if (box) {
    expect(Math.min(box.width, box.height), 'cible tactile trop petite').toBeGreaterThanOrEqual(47.5)
  }
})

test('bouton son : clic sur le titre allume le son, retrouvé allumé dans le HUD', async ({ page }) => {
  await gotoMusee(page)
  const titleToggle = page.getByTestId('sound-toggle')
  await titleToggle.click()
  await expect(titleToggle).toHaveAttribute('aria-pressed', 'true')

  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  // Même moteur audio global (`src/audio/engine.ts`) : l'instance du HUD reflète l'état déjà activé
  // sur le titre, sans qu'on ait besoin de re-cliquer.
  const hudToggle = page.getByTestId('sound-toggle')
  await expect(hudToggle).toHaveAttribute('aria-pressed', 'true')

  await hudToggle.click()
  await expect(hudToggle).toHaveAttribute('aria-pressed', 'false')
})

test('bouton son : l’état survit à un rechargement', async ({ page }) => {
  await gotoMusee(page)
  await page.getByTestId('sound-toggle').click()
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'true')

  await page.reload()

  await expect(page.getByTestId('title-screen')).toBeVisible()
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'true')
})
