import { expect, test } from '@playwright/test'
import { gotoMusee, museeState } from './support/museeApi'

// Plus de personnalisation (décision du 29/09) : « Entrer au musée » mène directement au jeu, en Cyril.
// Cette spec remplace `customize.spec.ts` (tenue, accessoire, pseudo, pastilles), supprimé avec l'écran.
test.use({ locale: 'fr-FR' })

const STORAGE_KEY = 'odyssee-musee-100:v1'

// Le projet TypeScript des tests n'a pas la lib DOM (voir `e2e/support/museeApi.ts`) : type local minimal.
type StorageHost = { localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void } }

test('« Entrer au musée » mène directement au jeu, sans écran de personnalisation', async ({ page }) => {
  await gotoMusee(page)
  await page.getByTestId('enter-button').click()

  await expect(page.locator('.app')).toHaveAttribute('data-screen', 'play')
  await expect(page.getByTestId('game-canvas')).toBeVisible()
  await expect(page.getByTestId('customizer')).toHaveCount(0)
  await expect(page.getByTestId('customizer-done')).toHaveCount(0)
  await expect(page.getByTestId('avatar-name')).toHaveCount(0)
})

test('un avatar enregistré par une version précédente est ignoré et effacé du stockage', async ({ page }) => {
  const legacyAvatar = { name: 'Ada', skinTone: '#f5c9a3', hairColor: '#3b2a1e', outfit: 'suit', outfitColor: '#7bc47f', accessory: 'cap' }
  await page.addInitScript(
    ({ key, avatar }) => {
      // Une seule fois, avant le chargement de l'app : simule un visiteur revenu avec son ancien personnage.
      const host = globalThis as unknown as StorageHost
      if (!host.localStorage.getItem(key)) host.localStorage.setItem(key, JSON.stringify({ lang: 'fr', avatar }))
    },
    { key: STORAGE_KEY, avatar: legacyAvatar },
  )

  await gotoMusee(page)
  await page.getByTestId('enter-button').click()
  await expect(page.locator('.app')).toHaveAttribute('data-screen', 'play')

  expect((await museeState(page)).screen).toBe('play')
  const stored = await page.evaluate((key) => {
    const host = globalThis as unknown as StorageHost
    return JSON.parse(host.localStorage.getItem(key) ?? '{}') as Record<string, unknown>
  }, STORAGE_KEY)
  expect(stored).not.toHaveProperty('avatar')
  expect(stored.lang).toBe('fr')
})
