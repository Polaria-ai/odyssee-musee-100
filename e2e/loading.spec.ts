import { expect, test } from '@playwright/test'
import { collectConsoleIssues, gotoMusee } from './support/museeApi'

const LOAD_BUDGET_MS = 10_000

test('l’écran titre s’affiche en moins de 10 s', async ({ page }) => {
  const start = Date.now()
  await gotoMusee(page)
  await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: LOAD_BUDGET_MS })
  const elapsed = Date.now() - start

  expect(elapsed, `chargement trop lent : ${elapsed} ms`).toBeLessThan(LOAD_BUDGET_MS)
})

test('pas d’erreur console au chargement (hors avertissements WebGL SwiftShader)', async ({ page }) => {
  // BUG `/favicon.ico` (module intégration) corrigé lors de la vérification finale (issue WEL-863) :
  // `public/favicon.ico` a été ajouté.
  //
  // BUG Supabase (module supabase, WEL-854), corrigé depuis : la migration
  // `supabase/migrations/20260924120000_people.sql` a été appliquée au projet distant
  // (`snqwuvqhxaysaygwqkdq`) — vérifié ici par un appel REST anonyme direct à
  // `/rest/v1/people?select=*&published=eq.true` : `200` et `[]` (table vide, en attendant l'import
  // de la vraie liste), là où on avait `PGRST205 — Could not find the table 'public.people'` (404)
  // avant la migration. `loadFromSupabase()` (`src/data/repository.ts`) reçoit donc désormais une
  // réponse propre (liste vide → repli sur `/data/people.json` puis les fiches d'attente, sans
  // jamais interroger un endpoint 404) : plus de log réseau d'erreur au chargement avec
  // `.env.local` renseigné. `test.fixme` retiré ci-dessous.
  const issues = collectConsoleIssues(page)
  await gotoMusee(page)
  await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: LOAD_BUDGET_MS })

  expect(issues.errors, `erreurs console : ${issues.errors.join(' | ')}`).toEqual([])
  expect(issues.pageErrors, `erreurs JS non interceptées : ${issues.pageErrors.join(' | ')}`).toEqual([])
})

test.describe('contenu du titre', () => {
  // Textes vérifiés en français ; voir title-lang.spec.ts pour pourquoi la locale doit être fixée.
  test.use({ locale: 'fr-FR' })

  test('affiche le sous-titre et le pied attendus', async ({ page }) => {
    await gotoMusee(page)
    const title = page.getByTestId('title-screen')
    await expect(title).toBeVisible()
    await expect(title.getByRole('heading', { level: 1 })).toHaveText('Le Musée des 100')
    await expect(title).toContainText("Les 100 qui font l'IA en Europe")
    await expect(title).toContainText("L'Opinion × Polaria")
  })
})
