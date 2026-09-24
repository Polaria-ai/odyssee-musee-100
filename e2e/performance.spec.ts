import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { dismissWelcomeDialogue, enterMuseum, gotoMusee } from './support/museeApi'

interface FrameSample {
  frames: number
  elapsedMs: number
  rendererInfo: { calls: number; triangles: number } | null
}

/**
 * Mesure indicative des images/s sur `durationMs`, via `requestAnimationFrame`. Pas d'assertion
 * stricte sur le résultat : SwiftShader (rendu logiciel utilisé ici, cf. playwright.config.ts) est
 * nettement plus lent qu'un GPU réel et ne reflète pas la performance sur un vrai téléphone. La
 * mesure est seulement consignée en annotation de test pour suivre une régression grossière dans le
 * temps. `renderer.info` (three.js) n'est actuellement exposé nulle part sur `window` par l'app : on
 * s'en passe si absent, sans faire échouer le test.
 */
async function sampleFrames(page: Page, durationMs: number): Promise<FrameSample> {
  return page.evaluate((duration) => {
    return new Promise<FrameSample>((resolve) => {
      const g = globalThis as unknown as {
        requestAnimationFrame: (cb: (t: number) => void) => number
        performance: { now: () => number }
        __museeRenderer?: { info?: { render?: { calls: number; triangles: number } } }
      }
      let frames = 0
      const start = g.performance.now()
      function tick(now: number) {
        frames++
        if (now - start < duration) {
          g.requestAnimationFrame(tick)
        } else {
          const info = g.__museeRenderer?.info?.render ?? null
          resolve({
            frames,
            elapsedMs: now - start,
            rendererInfo: info ? { calls: info.calls, triangles: info.triangles } : null,
          })
        }
      }
      g.requestAnimationFrame(tick)
    })
  }, durationMs)
}

test('performance indicative : images/s sur 3 s (SwiftShader, sans assertion stricte)', async ({ page }, testInfo) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  // Laisse la scène se stabiliser (chargement des textures/portraits proches) avant de mesurer.
  await page.waitForTimeout(500)

  const sample = await sampleFrames(page, 3_000)
  const fps = (sample.frames / sample.elapsedMs) * 1000

  testInfo.annotations.push({
    type: 'performance',
    description: `${sample.frames} images en ${Math.round(sample.elapsedMs)} ms ≈ ${fps.toFixed(1)} i/s (SwiftShader, projet ${testInfo.project.name})` +
      (sample.rendererInfo
        ? ` — renderer.info: ${sample.rendererInfo.calls} appels, ${sample.rendererInfo.triangles} triangles`
        : ' — renderer.info non exposé sur window'),
  })

  // Pas d'assertion stricte de seuil (SwiftShader est lent et non représentatif d'un téléphone réel) :
  // on vérifie seulement qu'au moins quelques images ont été produites, signe que la boucle de rendu tourne.
  expect(sample.frames, 'aucune image rendue sur 3 s : la boucle de rendu semble arrêtée').toBeGreaterThan(0)
})
