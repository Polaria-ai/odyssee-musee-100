import { expect, test } from '@playwright/test'
import { dismissWelcomeDialogue, enterMuseum, gotoMusee } from './support/museeApi'

/**
 * Aide au premier pas (`coach-mark`, `src/ui/CoachMark.tsx`) : bulle montrée une seule fois, après
 * le dialogue d'accueil de Rémi, masquée dès que le joueur bouge (ou après 10 s), et jamais
 * remontrée ensuite (mémorisée en `localStorage`, clé `musee.ui.coachMarkSeen`).
 */

test('aide au premier pas : visible au premier passage, masquée au premier déplacement, absente au rechargement', async ({
  page,
}) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  const coach = page.getByTestId('coach-mark')
  // Le minuteur ne s'arme qu'une fois le dialogue d'accueil terminé et un court délai passé
  // (voir `CoachMark.tsx`) : borne large, jamais la limite par défaut de 10 s (`AUTO_HIDE_MS`).
  await expect(coach).toBeVisible({ timeout: 5_000 })

  // Glissé sur la zone du joystick (mêmes événements souris que `movement.spec.ts`) : fait
  // passer `player.moving` à `true`, ce que `CoachMark` surveille pour se masquer aussitôt.
  const viewport = page.viewportSize()
  const originX = (viewport?.width ?? 400) * 0.28
  const originY = (viewport?.height ?? 800) * 0.72
  await page.mouse.move(originX, originY)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(originX, originY + i * 12)
  }
  await expect(coach, 'la bulle devrait se masquer dès que le joueur bouge').toBeHidden({ timeout: 2_000 })
  await page.mouse.up()

  await page.reload()
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  // Laisse le temps qu'aurait pris le minuteur de première apparition : la bulle ne doit jamais
  // réapparaître une fois vue (contrairement au premier passage, ci-dessus).
  await page.waitForTimeout(2_000)
  await expect(coach, 'l’aide au premier pas ne doit plus réapparaître après avoir déjà été vue').toBeHidden()
})
