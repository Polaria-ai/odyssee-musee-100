import { expect, test } from '@playwright/test'
import {
  closeAnyDialogue,
  closePersonViaState,
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  museeState,
  openPersonViaState,
} from './support/museeApi'

// Le carnet est en français dans le script (« Obtenu ») : locale fixée pour un test déterministe,
// indépendant de la langue du navigateur qui exécute la suite (voir docs/TESTS.md).
test.use({ locale: 'fr-FR' })

test('ouvrir assez de fiches d’une aile donne un tampon (toast + carnet)', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  const state = await museeState(page)
  const wing = 'infrastructures' as const
  const wingPeople = state.people.filter((p) => p.wing === wing).sort((a, b) => a.order - b.order)
  // requiredFor(total) = max(3, ceil(total * 0.3)) — voir src/features/stamps/stamps.ts (contrat, non modifiable ici).
  const required = Math.min(wingPeople.length, Math.max(3, Math.ceil(wingPeople.length * 0.3)))
  expect(wingPeople.length, 'le musée doit exposer des personnes dans cette aile').toBeGreaterThanOrEqual(required)

  for (const person of wingPeople.slice(0, required)) {
    await openPersonViaState(page, person.id)
  }

  // Le tampon déclenche aussi un toast et un dialogue de Minerve en file ; on n'a besoin que du tampon ici.
  await expect(page.getByTestId('toast')).toBeVisible({ timeout: 5_000 })

  const afterAward = await museeState(page)
  expect(afterAward.stamps[wing], 'le tampon devrait être enregistré dans le state').toBeTruthy()

  await closeAnyDialogue(page)
  // Le dernier `openPerson` a aussi laissé la fiche portrait ouverte (son overlay plein écran
  // intercepterait le clic ci-dessous) : on la ferme avant d'interagir avec le HUD.
  await closePersonViaState(page)
  await expect(page.getByTestId('portrait-card')).toBeHidden()

  await page.getByTestId('stamps-button').click()
  const card = page.getByTestId('stamp-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Obtenu')

  await page.getByTestId('stamp-close').click()
  await expect(card).toBeHidden()
})

test('le compteur du carnet dans le HUD reflète le nombre de tampons', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  await expect(page.getByTestId('stamps-button')).toContainText('0/3')

  const state = await museeState(page)
  const wingPeople = state.people.filter((p) => p.wing === 'industrialisation').sort((a, b) => a.order - b.order)
  const required = Math.min(wingPeople.length, Math.max(3, Math.ceil(wingPeople.length * 0.3)))
  for (const person of wingPeople.slice(0, required)) {
    await openPersonViaState(page, person.id)
  }

  await expect(page.getByTestId('stamps-button')).toContainText('1/3')
})
