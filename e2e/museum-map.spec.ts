import { expect, test } from '@playwright/test'
import {
  closePersonViaState,
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  museeState,
  openPersonViaState,
} from './support/museeApi'

// Les libellés du plan (« Plan du musée », compteurs « X/Y vus ») sont vérifiés en français ; voir
// title-lang.spec.ts pour pourquoi la locale doit être fixée explicitement.
test.use({ locale: 'fr-FR' })

test.beforeEach(async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
})

test('map-button ouvre le plan du musée ; Échap le ferme', async ({ page }) => {
  const map = page.getByTestId('museum-map')
  await expect(map).toBeHidden()

  await page.getByTestId('map-button').click()
  await expect(map).toBeVisible()
  await expect(map).toContainText('Plan du musée')

  await page.keyboard.press('Escape')
  await expect(map).toBeHidden()

  // Réouverture, fermeture cette fois via la croix (`map-close`).
  await page.getByTestId('map-button').click()
  await expect(map).toBeVisible()
  await page.getByTestId('map-close').click()
  await expect(map).toBeHidden()
})

test('plan : les compteurs par aile reflètent les fiches déjà vues', async ({ page }) => {
  const state = await museeState(page)
  const wing = 'industrialisation' as const
  const wingPeople = state.people.filter((p) => p.wing === wing).sort((a, b) => a.order - b.order)
  expect(wingPeople.length, 'le musée doit exposer des personnes dans cette aile').toBeGreaterThan(0)

  const seenCount = Math.min(2, wingPeople.length)
  for (const person of wingPeople.slice(0, seenCount)) {
    await openPersonViaState(page, person.id)
  }
  // La fiche du dernier `openPerson` reste ouverte par-dessus le HUD : on la referme avant d'ouvrir
  // le plan (même précaution que `stamps.spec.ts`).
  await closePersonViaState(page)

  await page.getByTestId('map-button').click()
  const map = page.getByTestId('museum-map')
  await expect(map).toBeVisible()

  const otherWing = state.people.filter((p) => p.wing === 'infrastructures')
  await expect(map).toContainText(`${seenCount}/${wingPeople.length} vus`)
  if (otherWing.length > 0) {
    await expect(map).toContainText(`0/${otherWing.length} vus`)
  }
})
