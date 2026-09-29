/**
 * Aides E2E autour de `window.__musee` (src/scene/debugApi.ts, activée par `?e2e=1`).
 * Les types ci-dessous sont une copie volontairement locale et minimale du contrat exposé par
 * `MuseeDebugApi` (intégration) : elle évite de faire dépendre le projet TypeScript des tests
 * (`tsconfig.node.json`, sans lib DOM) du code applicatif (`tsconfig.app.json`, avec lib DOM),
 * qui référence des globals navigateur (`navigator`, `window`) absents ici. Si le contrat change
 * côté application, ces tests échoueront à l'exécution — voir docs/TESTS.md.
 */
import { expect, type Page } from '@playwright/test'

export type Lang = 'fr' | 'en'
export type Screen = 'loading' | 'title' | 'play'
export type ExhibitWingId = 'infrastructures' | 'industrialisation' | 'culture'

export interface MuseePersonSummary {
  id: string
  wing: ExhibitWingId
  name: string
  order: number
  /** `true` = fiche d'attente fictive (voir `src/data/placeholder.ts`) ; absent tant que la vraie liste n'est pas importée. */
  placeholder?: boolean
}

export interface MuseeRoomBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Sous-ensemble de `RoomLayout` (src/types/index.ts) utile aux tests de performance et du plan. */
export interface MuseeRoomLayout {
  id: WingId
  bounds: MuseeRoomBounds
}

export type WingId = 'hall' | ExhibitWingId

export interface MuseeLayout {
  rooms: MuseeRoomLayout[]
}

export interface MuseeDialogue {
  id: string
  lines: unknown[]
}

/** Sous-ensemble utile de `GameState` (src/state/gameStore.ts) pour les tests E2E. */
export interface MuseeGameState {
  screen: Screen
  lang: Lang
  people: MuseePersonSummary[]
  visited: Record<string, number>
  stamps: Partial<Record<ExhibitWingId, number>>
  openPersonId: string | null
  nearbyPersonId: string | null
  nearCurator: boolean
  currentRoom: string | null
  dialogue: MuseeDialogue | null
  dialogueIndex: number
  stampCardOpen: boolean
  mapOpen: boolean
  peersCount: number
  layout: MuseeLayout | null
  openPerson: (personId: string) => void
  closePerson: () => void
  closeDialogue: () => void
  setLang: (lang: Lang) => void
}

export interface MuseePlayer {
  x: number
  z: number
  rotY: number
  moving: boolean
  speed: number
}

export interface MuseeInput {
  moveX: number
  moveY: number
  run: boolean
  tapTarget: { x: number; z: number } | null
}

export interface MuseeRenderInfo {
  calls: number
  triangles: number
  geometries: number
  textures: number
}

export interface MuseeCameraPosition {
  x: number
  y: number
  z: number
}

export interface MuseeDebugApi {
  state: () => MuseeGameState
  player: MuseePlayer
  input: MuseeInput
  teleport: (x: number, z: number, rotY?: number) => void
  goToPerson: (personId: string) => boolean
  renderInfo?: () => MuseeRenderInfo
  cameraPosition?: () => MuseeCameraPosition
  worldToScreen?: (x: number, y: number, z: number) => { clientX: number; clientY: number }
}

/** Navigue vers le musée avec la poignée de test activée (`?e2e=1`). */
/**
 * Ouvre le musée en mode test. Chaque appel rejoint par défaut son propre espace de salles de
 * présence (`presenceRoom`) : les tests ne croisent jamais de vrais visiteurs ni d'autres tests.
 * Passer `&presenceRoom=<id>` dans `extraQuery` pour réunir plusieurs contextes.
 */
export async function gotoMusee(page: Page, extraQuery = ''): Promise<void> {
  const room = extraQuery.includes('presenceRoom=') ? '' : `&presenceRoom=e2e-${crypto.randomUUID().slice(0, 12)}`
  await page.goto(`/?e2e=1${room}${extraQuery}`)
}

export async function museeState(page: Page): Promise<MuseeGameState> {
  return page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: { state: () => unknown } }).__musee
    if (!musee) throw new Error('window.__musee indisponible : ?e2e=1 est-il actif ?')
    return musee.state()
  }) as Promise<MuseeGameState>
}

export async function museePlayer(page: Page): Promise<MuseePlayer> {
  return page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: { player: MuseePlayer } }).__musee
    if (!musee) throw new Error('window.__musee indisponible : ?e2e=1 est-il actif ?')
    return musee.player
  })
}

/**
 * Compteurs du renderer (`gl.info.render`, three.js), exposés par `src/scene/DebugProbe.tsx` une
 * fois le `<Canvas>` monté. `null` tant que `DebugProbe` n'a pas encore branché la poignée (juste
 * après le montage) : les appelants qui en ont besoin doivent le lire avec `expect.poll`.
 */
export async function museeRenderInfo(page: Page): Promise<MuseeRenderInfo | null> {
  return page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: MuseeDebugApi }).__musee
    return musee?.renderInfo ? musee.renderInfo() : null
  })
}

/** Attend que `renderInfo()` soit disponible puis renvoie sa dernière valeur. */
export async function waitForRenderInfo(page: Page, timeout = 5_000): Promise<MuseeRenderInfo> {
  let last: MuseeRenderInfo | null = null
  await expect
    .poll(
      async () => {
        last = await museeRenderInfo(page)
        return last !== null
      },
      { timeout },
    )
    .toBe(true)
  return last as unknown as MuseeRenderInfo
}

/**
 * Attend que la caméra cesse de bouger de façon perceptible. `teleport()` déplace le joueur
 * instantanément, mais la caméra le suit avec un amortissement exponentiel (voir `Player.tsx`,
 * `CAMERA_DAMP_RATE`) : elle reste un moment « en transit » entre l'ancienne et la nouvelle
 * position. Nécessaire avant tout test qui convertit un point écran en point au sol
 * (`screenToFloor`, via un clic/tap) juste après un `teleport()` — sinon la cible visée dépend
 * d'une caméra encore en mouvement et peut, selon la charge de la machine (plusieurs navigateurs
 * Playwright en parallèle, images plus rares), atterrir trop près du joueur (sous
 * `TAP_STOP_DISTANCE`, `src/player/Player.tsx`) : le joueur ne bouge alors jamais, de façon
 * instable (régression trouvée en vérification, pas au premier passage de ce test).
 */
export async function waitForCameraSettled(page: Page, timeout = 5_000): Promise<void> {
  let last: MuseeCameraPosition | null = null
  await expect
    .poll(
      async () => {
        const pos = await page.evaluate(() => {
          const musee = (globalThis as unknown as { __musee?: MuseeDebugApi }).__musee
          return musee?.cameraPosition ? musee.cameraPosition() : null
        })
        if (!pos) return false
        const stable =
          last !== null &&
          Math.abs(pos.x - last.x) < 0.005 &&
          Math.abs(pos.y - last.y) < 0.005 &&
          Math.abs(pos.z - last.z) < 0.005
        last = pos
        return stable
      },
      { timeout },
    )
    .toBe(true)
}

/** Centre (x, z) de l'emprise d'une salle (`RoomLayout.bounds`) : point de téléportation stable pour s'y tenir « au milieu ». */
export function roomCenter(bounds: MuseeRoomBounds): Vec2 {
  return { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 }
}

interface Vec2 {
  x: number
  z: number
}

export async function museeInput(page: Page): Promise<MuseeInput> {
  return page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: { input: MuseeInput } }).__musee
    if (!musee) throw new Error('window.__musee indisponible : ?e2e=1 est-il actif ?')
    return musee.input
  })
}

/** Coordonnées écran d'un point du monde (caméra courante). */
export async function worldToScreen(page: Page, x: number, y: number, z: number): Promise<{ clientX: number; clientY: number }> {
  const pos = await page.evaluate(
    ({ x, y, z }) => {
      const musee = (globalThis as unknown as { __musee?: MuseeDebugApi }).__musee
      return musee?.worldToScreen ? musee.worldToScreen(x, y, z) : null
    },
    { x, y, z },
  )
  if (!pos) throw new Error('window.__musee.worldToScreen indisponible')
  return pos
}

export async function teleport(page: Page, x: number, z: number, rotY = 0): Promise<void> {
  await page.evaluate(
    ({ x, z, rotY }) => {
      const musee = (globalThis as unknown as { __musee?: MuseeDebugApi }).__musee
      musee?.teleport(x, z, rotY)
    },
    { x, z, rotY },
  )
}

/** Téléporte devant le portrait demandé ; échoue le test si l'id est introuvable dans le plan. */
export async function goToPerson(page: Page, personId: string): Promise<void> {
  const found = await page.evaluate((id) => {
    const musee = (globalThis as unknown as { __musee?: MuseeDebugApi }).__musee
    return musee?.goToPerson(id) ?? false
  }, personId)
  expect(found, `goToPerson('${personId}') aurait dû trouver un cadre`).toBe(true)
}

/** Ferme instantanément le dialogue en cours (si un), sans jouer l'animation de fermeture. */
export async function closeAnyDialogue(page: Page): Promise<void> {
  await page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: MuseeDebugApi }).__musee
    musee?.state().closeDialogue()
  })
}

/** Ouvre une fiche directement via l'état (marque visitée + ouvre), sans naviguer en 3D. */
export async function openPersonViaState(page: Page, personId: string): Promise<void> {
  await page.evaluate((id) => {
    const musee = (globalThis as unknown as { __musee?: MuseeDebugApi }).__musee
    musee?.state().openPerson(id)
  }, personId)
}

export async function closePersonViaState(page: Page): Promise<void> {
  await page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: MuseeDebugApi }).__musee
    musee?.state().closePerson()
  })
}

/**
 * Amène le joueur de l'écran titre à l'écran de jeu : clique « Entrer » (on entre directement
 * au musée, en Cyril : plus d'écran de personnalisation) et attend le canvas. Le dialogue
 * d'accueil de Rémi peut ensuite s'afficher (voir `dismissWelcomeDialogue`) : on ne le ferme
 * pas ici, chaque test décide s'il veut l'observer ou le fermer.
 */
export async function enterMuseum(page: Page): Promise<void> {
  await expect(page.getByTestId('title-screen')).toBeVisible()
  await page.getByTestId('enter-button').click()
  await expect(page.locator('.app')).toHaveAttribute('data-screen', 'play')
  await expect(page.getByTestId('game-canvas')).toBeVisible()
}

/**
 * Ferme le dialogue d'accueil de Rémi s'il est affiché, en cliquant jusqu'à sa fermeture
 * (borné, pour ne jamais boucler indéfiniment si l'app ne répond pas).
 */
export async function dismissWelcomeDialogue(page: Page): Promise<void> {
  const box = page.getByTestId('dialogue-box')
  if (!(await box.isVisible().catch(() => false))) return
  for (let i = 0; i < 20 && (await box.isVisible().catch(() => false)); i++) {
    await box.click()
    await page.waitForTimeout(50)
  }
}

/** Vrai si la page déborde horizontalement (scrollWidth > clientWidth), signe d'un débordement CSS. */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = (
      globalThis as unknown as { document: { documentElement: { scrollWidth: number; clientWidth: number } } }
    ).document
    // +1 px de tolérance : arrondis sous-pixel selon le device pixel ratio.
    return doc.documentElement.scrollWidth > doc.documentElement.clientWidth + 1
  })
}

/** Messages console/WebGL propres au rendu logiciel SwiftShader (CI, ANGLE), tolérés. */
const SWIFTSHADER_NOISE = /swiftshader|angle|gpu process|groupmarkernotset|software rendering|webgl.*(deprecated|performance)/i

export interface ConsoleIssues {
  errors: string[]
  pageErrors: string[]
}

/**
 * Attache les collecteurs `console` + `pageerror` d'une page. À appeler avant toute navigation
 * pour ne rien manquer du chargement initial. Les avertissements WebGL/SwiftShader sont filtrés.
 */
export function collectConsoleIssues(page: Page): ConsoleIssues {
  const issues: ConsoleIssues = { errors: [], pageErrors: [] }
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (SWIFTSHADER_NOISE.test(text)) return
    issues.errors.push(text)
  })
  page.on('pageerror', (err) => {
    const text = err.message
    if (SWIFTSHADER_NOISE.test(text)) return
    issues.pageErrors.push(text)
  })
  return issues
}
