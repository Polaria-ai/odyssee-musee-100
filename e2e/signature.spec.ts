import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { SIGNATURE_PLATE } from '../src/features/signature/plateLayout'
import {
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  hasHorizontalOverflow,
  museeInput,
  museePlayer,
  teleport,
  waitForCameraSettled,
  worldToScreen,
} from './support/museeApi'

/**
 * Signature Polaria (WEL-922) : mention de l'écran titre, badge en jeu, carte de crédits, plaque du hall.
 * Locale fixée en français (textes attendus) ; `reducedMotion` pour des mesures de géométrie sans animation
 * d'entrée en cours (le panneau titre glisse de 18 px à l'ouverture).
 *
 * Peu de tests, chacun avec UN chargement de l'application (le démarrage de la scène WebGL logicielle coûte
 * plusieurs secondes sur un runner). La taille de la page se fixe AVANT le chargement : redimensionner en cours
 * de route met `100dvh` (hauteur de `.app`) plusieurs secondes à suivre en WebGL logiciel, et les mesures de
 * géométrie liraient une mise en page périmée.
 */
test.use({ locale: 'fr-FR', reducedMotion: 'reduce' })
// Chaque test charge la scène WebGL logicielle puis enchaîne plusieurs vérifications : marge triple.
test.slow()

const PORTRAIT = { width: 390, height: 844 }
const LANDSCAPE = { width: 844, height: 390 }

interface Box {
  x: number
  y: number
  width: number
  height: number
}

async function box(locator: Locator, label: string): Promise<Box> {
  const b = await locator.boundingBox()
  expect(b, `${label} devrait avoir une géométrie mesurable`).not.toBeNull()
  return b as Box
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/** Rectangles (px) de tout ce que le HUD montre : boutons, pastille de salle, compteur de visiteurs, aide au premier pas. */
async function hudRects(page: Page): Promise<Array<Box & { label: string }>> {
  return page.evaluate(() => {
    interface Rect {
      x: number
      y: number
      width: number
      height: number
    }
    interface El {
      getBoundingClientRect: () => Rect
      getAttribute: (name: string) => string | null
      className: string
    }
    const doc = (globalThis as unknown as { document: { querySelectorAll: (selector: string) => ArrayLike<El> } }).document
    return Array.from(doc.querySelectorAll('[data-testid="hud"] button, .ui-hud__room-pill, [data-testid="peers-count"], [data-testid="coach-mark"]'))
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height, label: el.getAttribute('data-testid') ?? String(el.className) }
      })
      .filter((r) => r.width > 0 && r.height > 0)
  })
}

/** Vrai quand l'image est chargée et décodée (largeur naturelle non nulle). */
async function logoLoaded(logo: Locator): Promise<boolean> {
  return logo.evaluate((el) => {
    const img = el as unknown as { complete: boolean; naturalWidth: number }
    return img.complete && img.naturalWidth > 0
  })
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
}

function describeViolations(list: Awaited<ReturnType<typeof seriousViolations>>): string {
  return list.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.length} nœud(s)`).join('\n')
}

for (const [name, viewport] of [
  ['portrait 390×844', PORTRAIT],
  ['paysage 844×390', LANDSCAPE],
] as const) {
  test(`écran titre (${name}) : « Une création » + logo Polaria sous le pied, lien et © 2026, sans chevaucher le panneau`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await gotoMusee(page)
    await expect(page.getByTestId('title-screen')).toBeVisible()

    const signature = page.getByTestId('title-signature')
    await expect(signature).toBeVisible()
    await expect(signature).toContainText('Une création')
    await expect(signature).toContainText('© 2026 Polaria')
    const logo = signature.getByAltText('Polaria')
    await expect(logo).toBeVisible()
    await expect.poll(() => logoLoaded(logo), { message: 'le logo Polaria doit être chargé (public/brand/polaria-logo.webp)' }).toBe(true)
    const logoBox = await box(logo, 'logo')
    expect(logoBox.height, 'hauteur du logo : 20 à 24 px').toBeGreaterThanOrEqual(19.5)
    expect(logoBox.height).toBeLessThanOrEqual(24.5)

    const link = page.getByTestId('title-signature-link')
    await expect(link).toHaveAttribute('href', 'https://www.polaria.ai')
    await expect(link).toHaveAttribute('target', '_blank')
    expect(await link.getAttribute('rel')).toContain('noopener')

    // Mise en page : sous le pied existant, dans le viewport, et sous le panneau central.
    const footer = await box(page.getByText("L'Opinion × Polaria"), 'pied')
    const sig = await box(signature, 'signature')
    expect(sig.y, 'la signature est sous le pied').toBeGreaterThanOrEqual(footer.y + footer.height - 1)
    expect(sig.y + sig.height, 'la signature tient dans le viewport').toBeLessThanOrEqual(viewport.height + 0.5)
    expect(sig.x).toBeGreaterThanOrEqual(0)
    expect(sig.x + sig.width).toBeLessThanOrEqual(viewport.width + 0.5)
    const panel = await box(page.locator('.ui-title__panel'), 'panneau titre')
    expect(panel.y + panel.height, 'le panneau central ne touche pas le pied').toBeLessThanOrEqual(footer.y - 4)
    expect(await hasHorizontalOverflow(page), 'pas de débordement horizontal').toBe(false)

    // Anglais : « Created by », le logo et la mention de droits restent.
    await page.getByTestId('lang-toggle').click()
    await expect(signature).toContainText('Created by')
    await expect(signature.getByAltText('Polaria')).toBeVisible()
    await expect(signature).toContainText('© 2026 Polaria')
  })
}

for (const [name, viewport] of [
  ['portrait 390×844', PORTRAIT],
  ['paysage 844×390', LANDSCAPE],
] as const) {
  test(`jeu (${name}) : badge discret qui ne chevauche ni le HUD, ni l'action, ni le joystick ; la carte de crédits s'ouvre, tient à l'écran et se ferme`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await gotoMusee(page)
    await enterMuseum(page)
    await dismissWelcomeDialogue(page)

    const badge = page.getByTestId('signature-badge')
    await expect(badge).toBeVisible()
    const logo = badge.locator('img')
    await expect.poll(() => logoLoaded(logo)).toBe(true)
    await expect(badge, 'discret : 70 % d’opacité').toHaveCSS('opacity', '0.7')
    const logoBox = await box(logo, 'logo du badge')
    expect(logoBox.height, 'logo du badge : environ 16 px de haut').toBeGreaterThanOrEqual(15.5)
    expect(logoBox.height).toBeLessThanOrEqual(16.5)

    const b = await box(badge, 'badge')
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.y).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + 0.5)
    expect(b.y + b.height).toBeLessThanOrEqual(viewport.height + 0.5)
    expect(b.height, 'zone de toucher d’au moins 24 px de haut (WCAG 2.5.8)').toBeGreaterThanOrEqual(24)

    // Près de Rémi : le bouton d'action (coin bas droit) apparaît, avec la barre du haut et l'aide au premier pas.
    const curator = await page.evaluate(() => {
      const musee = (globalThis as unknown as { __musee?: { state: () => { layout: { curator: { position: { x: number; z: number } } } } } }).__musee
      return musee?.state().layout.curator.position ?? null
    })
    expect(curator).not.toBeNull()
    await teleport(page, curator!.x, curator!.z + 2.2, 0)
    const action = page.getByTestId('action-button')
    await expect(action, 'le bouton d’action apparaît près de Rémi').toBeVisible()

    // Aucun contrôle du HUD, ni la pastille de salle, ni l'aide au premier pas, ni l'action ne se trouve sous le badge.
    // Mesure atomique (un seul `evaluate`) : l'aide au premier pas se masque d'elle-même (10 s, ou au premier pas),
    // une lecture élément par élément pouvait donc la perdre entre « visible » et « position ».
    const hudParts = await hudRects(page)
    expect(hudParts.length).toBeGreaterThan(0)
    expect(hudParts.map((part) => part.label)).toContain('action-button')
    for (const part of hudParts) {
      expect(part.y + part.height, `${part.label} dans le viewport`).toBeLessThanOrEqual(viewport.height + 0.5)
      expect(overlaps(b, part), `le badge chevauche ${part.label}`).toBe(false)
    }

    // Le joystick reste utilisable tout près du badge (un glissé qui démarre juste au-dessus de lui).
    const originX = b.x + b.width / 2
    const originY = Math.max(40, b.y - 30)
    const before = await museePlayer(page)
    await page.mouse.move(originX, originY)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) await page.mouse.move(originX + i * 10, originY - i * 10)
    await expect.poll(async () => (await museePlayer(page)).moving, { timeout: 6_000 }).toBe(true)
    await page.mouse.up()
    const after = await museePlayer(page)
    expect(Math.hypot(after.x - before.x, after.z - before.z), 'le joueur avance').toBeGreaterThan(0.05)

    // --- Carte de crédits : un tap sur le badge l'ouvre.
    await badge.click()
    const card = page.getByTestId('signature-card')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('role', 'dialog')
    await expect(card.getByRole('heading', { name: 'Le Musée des 100 — une création Polaria' })).toBeVisible()
    await expect(card).toContainText("Conçu et développé par Polaria pour L'Odyssée de l'IA (L'Opinion × Polaria), 6 octobre 2026")
    await expect(card).toContainText('© 2026 Polaria. Tous droits réservés.')
    const link = page.getByTestId('signature-link')
    await expect(link).toHaveAttribute('href', 'https://www.polaria.ai')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(card.getByAltText('Polaria')).toBeVisible()
    expect(await hasHorizontalOverflow(page)).toBe(false)

    // La carte tient dans le viewport (en paysage de téléphone, 390 px de haut) et son ✕ et son lien sont tapables.
    const cardBox = await box(card, 'carte')
    expect(cardBox.y).toBeGreaterThanOrEqual(-0.5)
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(viewport.height + 0.5)
    expect(cardBox.x).toBeGreaterThanOrEqual(-0.5)
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width + 0.5)
    const closeBox = await box(page.getByTestId('signature-close'), '✕')
    expect(Math.min(closeBox.width, closeBox.height), 'cible tactile du ✕').toBeGreaterThanOrEqual(47.5)
    const linkBox = await box(link, 'lien polaria.ai')
    expect(linkBox.height, 'cible tactile du lien').toBeGreaterThanOrEqual(43.5)
    expect(linkBox.y + linkBox.height).toBeLessThanOrEqual(viewport.height + 0.5)

    const fr = await seriousViolations(page)
    expect(fr, describeViolations(fr)).toEqual([])

    // Clavier physique (projet desktop) : sous la carte, les flèches/ZQSD ne déplacent pas le joueur.
    if (testInfo.project.name === 'desktop') {
      await teleport(page, -5, 0, 0)
      const resting = await museePlayer(page)
      await page.keyboard.down('KeyW')
      await page.waitForTimeout(700)
      await page.keyboard.up('KeyW')
      const kept = await museePlayer(page)
      expect(Math.hypot(kept.x - resting.x, kept.z - resting.z), 'le joueur ne doit pas avancer sous la carte').toBeLessThan(0.05)
      await expect(card).toBeVisible()
    }

    // Échap ferme et rend le focus au badge.
    await page.keyboard.press('Escape')
    await expect(card).toBeHidden()
    await expect(badge).toBeFocused()

    // ✕ ferme.
    await badge.click()
    await expect(card).toBeVisible()
    await page.getByTestId('signature-close').click()
    await expect(card).toBeHidden()

    // Un tap sur le fond ferme (un coin du viewport, hors de la carte centrée).
    await badge.click()
    await expect(card).toBeVisible()
    await page.mouse.click(8, viewport.height - 8)
    await expect(card).toBeHidden()

    // Bilingue : en anglais, la carte aussi, et toujours sans violation d'accessibilité.
    await page.getByTestId('hud-lang').click()
    await badge.click()
    await expect(card).toContainText('Designed and developed by Polaria for The AI Odyssey')
    await expect(card).toContainText('© 2026 Polaria. All rights reserved.')
    const en = await seriousViolations(page)
    expect(en, describeViolations(en)).toEqual([])
  })
}

test('plaque du hall : un vrai clic sur le canvas à sa position projetée ouvre la carte, sans faire marcher le joueur', async ({ page }) => {
  await page.setViewportSize(PORTRAIT)
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  // Au pied de la plaque (mur nord, côté est), puis on laisse la caméra rattraper le joueur téléporté.
  const [px, py, pz] = SIGNATURE_PLATE.position
  await teleport(page, px, pz + 2.2, 0)
  await waitForCameraSettled(page)

  const plate = await worldToScreen(page, px, py, pz)
  const viewport = page.viewportSize() ?? PORTRAIT
  expect(plate.clientX, 'la plaque est dans le champ (x)').toBeGreaterThan(0)
  expect(plate.clientX).toBeLessThan(viewport.width)
  expect(plate.clientY, 'la plaque est dans le champ (y)').toBeGreaterThan(0)
  expect(plate.clientY).toBeLessThan(viewport.height)

  const before = await museePlayer(page)
  await page.mouse.click(plate.clientX, plate.clientY)

  const card = page.getByTestId('signature-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText('une création Polaria')
  expect((await museeInput(page)).tapTarget, 'le tap sur la plaque ne pose pas de cible de marche').toBeNull()

  // Clic fantôme : la carte ne doit pas se refermer d'elle-même juste après son ouverture.
  await page.waitForTimeout(600)
  await expect(card).toBeVisible()
  const after = await museePlayer(page)
  expect(Math.hypot(after.x - before.x, after.z - before.z), 'le joueur n’a pas bougé').toBeLessThan(0.05)

  // Échap ferme.
  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()

  // Ouverte par la plaque, la carte se ferme aussi au ✕ (au-delà de la garde anti-clic fantôme de 350 ms).
  await page.mouse.click(plate.clientX, plate.clientY)
  await expect(card).toBeVisible()
  await page.waitForTimeout(450)
  await page.getByTestId('signature-close').click()
  await expect(card).toBeHidden()

  // Le tap-pour-marcher est intact : un point libre du sol, 2,5 m à l'ouest du joueur, ne rouvre rien et fait marcher.
  const target = await worldToScreen(page, px - 2.5, 0, pz + 2.2)
  const start = await museePlayer(page)
  await page.mouse.click(target.clientX, target.clientY)
  await expect(card).toBeHidden()
  await expect
    .poll(
      async () => {
        const p = await museePlayer(page)
        return Math.hypot(p.x - start.x, p.z - start.z)
      },
      { timeout: 8_000 },
    )
    .toBeGreaterThan(0.5)
})
