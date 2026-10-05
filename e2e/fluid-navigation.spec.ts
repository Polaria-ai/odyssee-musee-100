import { expect, test, type Page } from '@playwright/test'
import {
  collectConsoleIssues,
  dismissWelcomeDialogue,
  enterMuseum,
  gotoMusee,
  museePlayer,
  museeState,
  teleport,
  type ConsoleIssues,
  type MuseeDebugApi,
  type MuseeRoomBounds,
} from './support/museeApi'

test.use({ locale: 'fr-FR' })
// Deux traversées de 10 m et un parcours entre elles : le temps dépend des images SwiftShader.
test.setTimeout(120_000)

interface Point { x: number; z: number }
interface Frame {
  personId: string
  wing: string
  viewPoint: Point
}
interface Plan {
  rooms: Array<{ id: string; bounds: MuseeRoomBounds }>
  frames: Frame[]
}
interface Motion {
  reached: boolean
  samples: Point[]
}

const issuesByPage = new WeakMap<Page, ConsoleIssues>()

test.beforeEach(async ({ page }) => {
  issuesByPage.set(page, collectConsoleIssues(page))
  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)
})

test.afterEach(async ({ page }) => {
  const issues = issuesByPage.get(page)!
  expect(issues.errors, 'aucune erreur console pendant les déplacements et interactions').toEqual([])
  expect(issues.pageErrors, 'aucune exception JS pendant les déplacements et interactions').toEqual([])
})

/**
 * Applique une entrée de marche au vrai Player, image par image. Cette aide ne change jamais
 * sa position ni le plan : colliders du monde, Archives et mobilier supplémentaire restent actifs.
 * `target` arrête l'entrée après le franchissement ; sans cible on exerce une pression sur l'obstacle
 * pendant 2 s de simulation (120 images au maximum), avec un budget réel adapté à SwiftShader.
 */
async function walk(page: Page, axis: 'x' | 'z', direction: -1 | 1, target?: number): Promise<Motion> {
  const motion = await page.evaluate(
    ({ axis, direction, target }) => new Promise<Motion>((resolve) => {
      const g = globalThis as unknown as {
        __musee: MuseeDebugApi
        requestAnimationFrame: (callback: (time: number) => void) => number
      }
      const api = g.__musee
      api.input.moveX = axis === 'x' ? direction : 0
      api.input.moveY = axis === 'z' ? direction : 0
      api.input.run = false
      api.input.tapTarget = null
      const samples: Point[] = []
      const deadline = performance.now() + 35_000
      let previous = performance.now()
      let simulationSeconds = 0
      const frame = (now: number) => {
        simulationSeconds += Math.min((now - previous) / 1000, 1 / 15)
        previous = now
        const p = api.player
        samples.push({ x: p.x, z: p.z })
        const reached = target !== undefined && direction * (p[axis] - target) >= 0
        if (reached || (target === undefined && simulationSeconds >= 2) || now >= deadline) {
          api.input.moveX = 0
          api.input.moveY = 0
          api.input.run = false
          return resolve({ reached, samples })
        }
        g.requestAnimationFrame(frame)
      }
      g.requestAnimationFrame(frame)
    }),
    { axis, direction, target },
  )
  // Laisse la décélération naturelle finir avant le tronçon suivant (aucun raccourci de position).
  await expect.poll(async () => (await museePlayer(page)).moving, { timeout: 10_000 }).toBe(false)
  if (target !== undefined) {
    expect(motion.reached, `le Player doit atteindre ${axis}=${target} en marchant, sans obstacle caché`).toBe(true)
  }
  return motion
}

async function currentPlan(page: Page): Promise<Plan> {
  return (await museeState(page)).layout as unknown as Plan
}

for (const wing of ['infrastructures', 'culture'] as const) {
  test(`${wing} : boucle réelle par le passage du milieu puis celui du fond, portraits et carnet accessibles`, async ({ page }, testInfo) => {
    const plan = await currentPlan(page)
    const room = plan.rooms.find((r) => r.id === wing)!
    expect(room, 'l’aile doit être peuplée pour vérifier ses couloirs').toBeTruthy()
    const frames = plan.frames.filter((f) => f.wing === wing)
    const xs = [...new Set(frames.map((f) => f.viewPoint.x))].sort((a, b) => a - b)
    // Localise le nouveau passage depuis l'espacement réel des portraits, sans importer la formule du monde.
    const gaps = xs.slice(1).map((x, i) => ({ width: x - xs[i], center: (x + xs[i]) / 2 }))
    const largest = gaps.sort((a, b) => b.width - a.width)[0]
    expect(largest.width, 'une ouverture centrale doit séparer les deux groupes de portraits').toBeGreaterThan(4)
    const middleX = largest.center
    const dir = wing === 'infrastructures' ? -1 : 1
    const farX = dir < 0 ? room.bounds.minX : room.bounds.maxX
    // La traversée passe devant les racks/banquettes du fond ; les props gardent leurs colliders.
    const rearX = farX - dir * 3
    const startZ = 5.7
    const northZ = -5.4

    // Unique téléportation de setup : tous les tronçons suivants sont de vrais déplacements continus.
    await teleport(page, middleX, startZ, Math.PI)
    const middle = await walk(page, 'z', -1, northZ)
    expect(middle.samples.every((p) => Math.abs(p.x - middleX) < 0.15), 'le passage du milieu se traverse droit').toBe(true)
    expect((await museePlayer(page)).z).toBeLessThan(-5)
    await testInfo.attach(`${wing}-milieu`, { body: await page.screenshot(), contentType: 'image/png' })

    const toRear = await walk(page, 'x', dir, rearX)
    const rear = await walk(page, 'z', 1, startZ)
    expect(rear.samples.every((p) => Math.abs(p.x - rearX) < 0.45), 'le passage du fond se traverse malgré les décors actifs').toBe(true)
    expect((await museePlayer(page)).z).toBeGreaterThan(5)
    const route = [...middle.samples, ...toRear.samples, ...rear.samples]
    expect(route.every((p) => Math.abs(p.x) > 16), 'la boucle ne doit jamais revenir à la porte du hall').toBe(true)
    await testInfo.attach(`${wing}-fond`, { body: await page.screenshot(), contentType: 'image/png' })
    await testInfo.attach(`${wing}-trajet`, { body: Buffer.from(JSON.stringify(route)), contentType: 'application/json' })

    // Continue à pied vers un portrait de la dernière rangée sud ; le vrai bouton ouvre sa fiche.
    const southZ = Math.max(...frames.map((f) => f.viewPoint.z))
    const frame = frames.filter((f) => Math.abs(f.viewPoint.z - southZ) < 0.01)
      .sort((a, b) => Math.abs(a.viewPoint.x - rearX) - Math.abs(b.viewPoint.x - rearX))[0]
    const p = await museePlayer(page)
    await walk(page, 'x', frame.viewPoint.x < p.x ? -1 : 1, frame.viewPoint.x)
    await walk(page, 'z', -1, frame.viewPoint.z)
    await expect.poll(async () => (await museeState(page)).nearbyPersonId).toBe(frame.personId)
    await page.getByTestId('action-button').click()
    await expect(page.getByTestId('portrait-card')).toBeVisible()
    expect((await museeState(page)).openPersonId).toBe(frame.personId)
    await page.getByTestId('portrait-close').click()
    await expect(page.getByTestId('portrait-card')).toBeHidden()
    await page.getByTestId('stamps-button').click()
    await expect(page.getByTestId('stamp-card')).toBeVisible()
    await page.getByTestId('stamp-close').click()
  })
}

const objects = [
  { name: 'Arbre des 100', x: 0, z: 2.5, half: 2, offset: 1.5, travel: 3 },
  // Banc ajouté par props : absent de layout.colliders, il est branché séparément au Player.
  { name: 'banc supplémentaire du hall', x: -9, z: 1, half: 0.85, offset: 0.95, travel: 2 },
  { name: 'vitrine des Archives', x: -8, z: 14.5, half: 0.55, offset: 0.75, travel: 2 },
] as const

for (const object of objects) {
  test(`${object.name} : l’ancien bord est libre à pied et le noyau reste solide`, async ({ page }, testInfo) => {
    const sideX = object.x + object.offset
    // Le rayon du joueur (.35 m) rendait ce trajet bloquant avec l'ancienne boîte.
    expect(object.offset).toBeLessThan(object.half + 0.35)
    await teleport(page, sideX, object.z - object.travel, 0)
    const around = await walk(page, 'z', 1, object.z + object.travel)
    expect(around.samples.every((p) => Math.abs(p.x - sideX) < 0.1), 'contournement droit, sans déviation par collision').toBe(true)
    expect((await museePlayer(page)).z).toBeGreaterThan(object.z + object.half)
    await testInfo.attach('ancien-bord-libre', { body: await page.screenshot(), contentType: 'image/png' })

    // Nouveau setup pour une tentative distincte, dirigée vers le centre de l'objet.
    await teleport(page, object.x, object.z - object.travel, 0)
    const blocked = await walk(page, 'z', 1)
    const final = await museePlayer(page)
    expect(final.z, 'le joueur avance jusqu’au noyau, qui doit rester branché à sa physique').toBeGreaterThan(object.z - object.travel + 0.25)
    expect(final.z, 'le joueur ne doit pas traverser le noyau solide').toBeLessThan(object.z - object.half / 2)
    expect(Math.abs(final.x - object.x)).toBeLessThan(0.1)
    const last = blocked.samples.slice(-5)
    expect(Math.max(...last.map((p) => p.z)) - Math.min(...last.map((p) => p.z)), 'la pression maintenue finit contre l’obstacle').toBeLessThan(0.02)
  })
}

test('le mur extérieur reste bloquant après la réduction du mobilier', async ({ page }) => {
  const room = (await currentPlan(page)).rooms.find((r) => r.id === 'culture')!
  const x = (room.bounds.minX + room.bounds.maxX) / 2
  await teleport(page, x, room.bounds.maxZ - 2, 0)
  await walk(page, 'z', 1)
  const p = await museePlayer(page)
  expect(p.z).toBeGreaterThan(room.bounds.maxZ - 1)
  expect(p.z, 'le mur extérieur garde son épaisseur et son effet de collision').toBeLessThan(room.bounds.maxZ - 0.5)
  expect(Math.abs(p.x - x)).toBeLessThan(0.1)
})
