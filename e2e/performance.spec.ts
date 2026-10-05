import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  museeState,
  roomCenter,
  teleport,
  waitForRenderInfo,
} from './support/museeApi'

/** Budget de dessin visible (docs/DESIGN.md, mobile d'abord) : appels de dessin par image. */
const MAX_DRAW_CALLS = 150

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
 * temps. `window.__musee.renderInfo()` (`src/scene/DebugProbe.tsx`, contrat intégration) est lu s'il
 * est déjà branché ; sinon on s'en passe, sans faire échouer ce test indicatif (voir le test dédié
 * ci-dessous pour l'assertion stricte sur les appels de dessin).
 */
async function sampleFrames(page: Page, durationMs: number): Promise<FrameSample> {
  return page.evaluate((duration) => {
    return new Promise<FrameSample>((resolve) => {
      const g = globalThis as unknown as {
        requestAnimationFrame: (cb: (t: number) => void) => number
        performance: { now: () => number }
        __musee?: { renderInfo?: () => { calls: number; triangles: number } }
      }
      let frames = 0
      const start = g.performance.now()
      function tick(now: number) {
        frames++
        if (now - start < duration) {
          g.requestAnimationFrame(tick)
        } else {
          const info = g.__musee?.renderInfo ? g.__musee.renderInfo() : null
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

test('performance : ≤ 150 appels de dessin visibles au spawn et au milieu de chaque aile', async ({ page }, testInfo) => {
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
  // Laisse la scène se stabiliser (chargement des textures/portraits proches) avant de mesurer,
  // comme le test de fps ci-dessus.
  await page.waitForTimeout(500)

  const spawnInfo = await waitForRenderInfo(page)
  testInfo.annotations.push({
    type: 'draw-calls',
    description: `spawn : ${spawnInfo.calls} appels, ${spawnInfo.triangles} triangles (${testInfo.project.name})`,
  })
  expect(spawnInfo.calls, `trop d'appels de dessin au spawn : ${spawnInfo.calls}`).toBeLessThanOrEqual(MAX_DRAW_CALLS)

  const state = await museeState(page)
  const wings = (state.layout?.rooms ?? []).filter((room) => room.id !== 'hall')
  expect(wings.length, 'le plan doit contenir au moins une aile (docs/DESIGN.md)').toBeGreaterThan(0)

  for (const room of wings) {
    const center = roomCenter(room.bounds)
    await teleport(page, center.x, center.z)
    // Laisse la géométrie/texture propres à cette aile finir de se charger avant de mesurer.
    await page.waitForTimeout(1_500)

    const info = await waitForRenderInfo(page)
    testInfo.annotations.push({
      type: 'draw-calls',
      description: `${room.id} : ${info.calls} appels, ${info.triangles} triangles (${testInfo.project.name})`,
    })
    expect(info.calls, `trop d'appels de dessin dans l'aile ${room.id} : ${info.calls}`).toBeLessThanOrEqual(
      MAX_DRAW_CALLS,
    )
  }
})
