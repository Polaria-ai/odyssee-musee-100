import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { dismissWelcomeDialogue, enterMuseum, goToPerson, gotoMusee, museeState } from './support/museeApi'

// Les trois surimpressions testées ici (panneau titre, fiche portrait, carnet de tampons) apparaissent
// via une animation d'opacité (`ui-title-in`, `ui-sheet-up`…). Playwright considère un élément
// « visible » (`toBeVisible()`) dès qu'il a une taille non nulle et n'est pas `display:none` — sans
// attendre la fin de l'animation — donc `AxeBuilder` peut échantillonner les couleurs en plein
// fondu (texte et fond encore semi-transparents sur le canvas 3D derrière), ce qui produit un
// contraste artificiellement bas et un test flaky (observé une fois sur `.ui-title__panel`, projet
// android, tous ses textes à la fois — bug distinct de celui déjà corrigé sur `.ui-title__footer`,
// voir plus bas). `reducedMotion: 'reduce'` déclenche la règle `@media (prefers-reduced-motion:
// reduce)` déjà présente dans `src/styles/global.css` (`animation-duration: 0.01ms`), qui est
// justement le mécanisme d'accessibilité prévu par `docs/DESIGN.md` pour ce cas : les couleurs sont
// alors toujours à leur valeur finale au moment du contrôle. Fixe le flake côté test (e2e/**),
// sans toucher aux animations elles-mêmes (module ui).
test.use({ reducedMotion: 'reduce' })

const SERIOUS_IMPACTS = new Set(['serious', 'critical'])

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations.filter((v) => SERIOUS_IMPACTS.has(v.impact ?? ''))
}

function describe(violations: Awaited<ReturnType<typeof seriousViolations>>): string {
  return violations.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.length} nœud(s)`).join('\n')
}

test('accessibilité : écran titre — pas de violation serious/critical', async ({ page }) => {
  // BUG connu (module ui) corrigé lors de la vérification finale (issue WEL-863) : `.ui-title__footer`
  // (texte « L'Opinion × Polaria… ») avait un contraste de 3.69:1 sur fond ciel `#9ed9f0`, sous le
  // seuil WCAG AA de 4.5:1. Couleur passée de `--ink-soft` à `--ink` (7.3:1) dans `src/ui/ui.css`.
  await gotoMusee(page)
  await expect(page.getByTestId('title-screen')).toBeVisible()

  const violations = await seriousViolations(page)
  expect(violations, describe(violations)).toEqual([])
})

test('accessibilité : fiche portrait — pas de violation serious/critical', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  const state = await museeState(page)
  await goToPerson(page, state.people[0].id)
  await page.getByTestId('action-button').click()
  await expect(page.getByTestId('portrait-card')).toBeVisible()

  const violations = await seriousViolations(page)
  expect(violations, describe(violations)).toEqual([])
})

test('accessibilité : carnet de tampons — pas de violation serious/critical', async ({ page }) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  await page.getByTestId('stamps-button').click()
  await expect(page.getByTestId('stamp-card')).toBeVisible()

  const violations = await seriousViolations(page)
  expect(violations, describe(violations)).toEqual([])
})
