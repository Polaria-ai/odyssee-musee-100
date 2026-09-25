import { expect, test } from '@playwright/test'
import {
  collectConsoleIssues,
  dismissWelcomeDialogue,
  enterMuseum,
  goToPerson,
  gotoMusee,
  museePlayer,
  museeState,
} from './support/museeApi'

/**
 * Mode « regard » de la caméra (`LOOK_STILLNESS_SECONDS`, `src/player/camera.ts`) : engagé après
 * un court temps d'immobilité (0,4 s) pour un cadrage rapproché sur le portrait proche. Contrat de
 * caméra partagé (`cameraRig`/`cameraPositionFor`, `src/styles/tokens.ts`) : régression surveillée
 * ici plutôt qu'un rendu particulier — `goToPerson` immobilise le joueur (`teleport`, pas de
 * mouvement), donc le mode « regard » doit s'engager peu après.
 */
test('mode regard de la caméra : après immobilité devant un portrait, l’état et le rendu restent stables', async ({
  page,
}) => {
  const issues = collectConsoleIssues(page)
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  const state = await museeState(page)
  const first = state.people[0]
  expect(first, 'la liste des 100 (placeholder ou réelle) doit contenir au moins une fiche').toBeTruthy()

  await goToPerson(page, first.id)

  // > LOOK_STILLNESS_SECONDS (0,4 s) : le mode « regard » doit s'être engagé, sans exception ni
  // rendu figé/planté.
  await page.waitForTimeout(1_000)

  const player = await museePlayer(page)
  expect(Number.isFinite(player.x), 'position x du joueur non finie après le mode regard').toBe(true)
  expect(Number.isFinite(player.z), 'position z du joueur non finie après le mode regard').toBe(true)

  const after = await museeState(page)
  expect(after.openPersonId, 'goToPerson ne doit pas ouvrir la fiche tout seul').toBeNull()
  expect(after.nearbyPersonId, 'le portrait visé devrait rester à portée après immobilité').toBe(first.id)

  await expect(page.getByTestId('game-canvas')).toBeVisible()
  await expect(page.getByTestId('action-button')).toBeVisible()

  expect(issues.errors, `erreurs console pendant le mode regard : ${issues.errors.join(' | ')}`).toEqual([])
  expect(issues.pageErrors, `erreurs JS pendant le mode regard : ${issues.pageErrors.join(' | ')}`).toEqual([])
})
