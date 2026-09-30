import { expect, test } from '@playwright/test'
import {
  closePersonViaState,
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  museeState,
  openPersonViaState,
} from './support/museeApi'

/**
 * Fiche d'attente (`person.placeholder`, `src/data/placeholder.ts`) : la vraie liste des 100 n'est
 * pas encore reçue, les 100 fiches actuelles sont fictives. `organizationLabel` (`src/ui/format.ts`)
 * affiche alors le texte localisé `portraitOrgPending` à la place de l'organisation, jamais vide et
 * jamais dans les deux langues à la fois.
 */
test.use({ locale: 'fr-FR' })

test('fiche d’attente : « À dévoiler le 6 octobre » en FR, « Revealed on October 6 » en EN, sans mélange', async ({
  page,
}) => {
  // Depuis l'intégration des vrais 100 (branche feat/les-100-reels), `/data/people.json` n'est plus
  // vide : on le vide pour ce test, qui couvre le repli sur les fiches d'attente (liste absente).
  await page.route('**/data/people.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  const state = await museeState(page)
  const placeholderPerson = state.people.find((p) => p.placeholder)
  expect(placeholderPerson, 'le musée doit exposer au moins une fiche d’attente').toBeTruthy()
  const personId = placeholderPerson!.id

  const card = page.getByTestId('portrait-card')

  await openPersonViaState(page, personId)
  await expect(card).toBeVisible()
  await expect(card).toContainText('À dévoiler le 6 octobre')
  await expect(card).not.toContainText('Revealed on October 6')
  await closePersonViaState(page)
  await expect(card).toBeHidden()

  await page.getByTestId('hud-lang').click()

  await openPersonViaState(page, personId)
  await expect(card).toBeVisible()
  await expect(card).toContainText('Revealed on October 6')
  await expect(card).not.toContainText('À dévoiler le 6 octobre')
})
