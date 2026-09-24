import { expect, test } from '@playwright/test'
import { dismissWelcomeDialogue, enterMuseum, gotoMusee, museeState, openPersonViaState } from './support/museeApi'

// Le test part d'un français connu puis bascule vers l'anglais ; voir title-lang.spec.ts pour
// pourquoi la locale de départ doit être fixée explicitement.
test.use({ locale: 'fr-FR' })

test('recharger la page conserve la langue et les tampons', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  await page.getByTestId('hud-lang').click()
  await expect(page.getByTestId('stamps-button')).toHaveAccessibleName('Stamp card')

  const state = await museeState(page)
  const wing = 'culture' as const
  const wingPeople = state.people.filter((p) => p.wing === wing).sort((a, b) => a.order - b.order)
  const required = Math.min(wingPeople.length, Math.max(3, Math.ceil(wingPeople.length * 0.3)))
  for (const person of wingPeople.slice(0, required)) {
    await openPersonViaState(page, person.id)
  }
  await expect.poll(async () => (await museeState(page)).stamps[wing]).toBeTruthy()

  await page.reload()

  // Après rechargement, l'app repart de l'écran titre (l'écran courant n'est pas persisté, voir
  // src/state/persist.ts), mais la langue anglaise choisie avant le reload doit rester active.
  const title = page.getByTestId('title-screen')
  await expect(title).toBeVisible()
  await expect(title.getByRole('heading', { level: 1 })).toHaveText('The Museum of the 100')
  await expect(page.getByTestId('enter-button')).toHaveText('Enter the museum')

  await page.getByTestId('enter-button').click()
  await expect(page.getByTestId('customizer')).toBeVisible()
  await page.getByTestId('customizer-done').click()
  await expect(page.locator('.app')).toHaveAttribute('data-screen', 'play')

  const restored = await museeState(page)
  expect(restored.lang).toBe('en')
  expect(restored.stamps[wing], 'le tampon obtenu avant rechargement doit être conservé').toBeTruthy()
})
