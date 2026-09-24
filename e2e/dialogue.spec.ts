import { expect, test } from '@playwright/test'
import { enterMuseum, gotoMusee, museeState } from './support/museeApi'

// Le script de Minerve testé ici (texte exact) est celui en français ; voir title-lang.spec.ts pour
// pourquoi la locale doit être fixée explicitement.
test.use({ locale: 'fr-FR' })

test('dialogue d’accueil de Minerve : s’affiche, avance au tap, se ferme', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)

  const box = page.getByTestId('dialogue-box')
  await expect(box).toBeVisible()
  await expect(box).toContainText('Minerve')

  // Un premier tap termine l'effet machine à écrire de la ligne en cours (ou avance si déjà finie) :
  // on avance donc jusqu'à voir le texte de la deuxième ligne, connue à l'avance (script FR figé).
  // Timeout court sur l'expect interne (sinon il hérite des 15 s par défaut de playwright.config.ts
  // et consomme à lui seul tout le budget de `toPass`, qui ne pourrait alors jamais retenter un clic).
  await expect(async () => {
    await box.click()
    await expect(box).toContainText("Tu es à L'Odyssée de l'IA", { timeout: 400 })
  }).toPass({ timeout: 5_000 })

  // Le dialogue d'accueil a 7 répliques : chaque tap termine l'effet machine à écrire de la ligne
  // en cours, ou avance à la suivante si elle est déjà entièrement affichée — donc jusqu'à deux taps
  // par ligne dans le pire cas. Borné largement pour ne jamais boucler indéfiniment si l'app ne
  // répond plus.
  for (let i = 0; i < 30 && (await box.isVisible()); i++) {
    await box.click()
  }
  await expect(box).toBeHidden()

  // Une fois fermé, l'action n'est plus rejouée : l'état ne garde plus de dialogue actif.
  expect((await museeState(page)).dialogue).toBeNull()
})

test('le dialogue peut être fermé directement via le bouton « Passer »', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)

  const box = page.getByTestId('dialogue-box')
  await expect(box).toBeVisible()
  await page.getByRole('button', { name: 'Passer' }).click()
  await expect(box).toBeHidden()
})
