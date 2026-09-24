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
export type Screen = 'loading' | 'title' | 'customize' | 'play'
export type ExhibitWingId = 'infrastructures' | 'industrialisation' | 'culture'

export interface MuseeAvatarConfig {
  name: string
  skinTone: string
  hairColor: string
  outfit: string
  outfitColor: string
  accessory: string
}

export interface MuseePersonSummary {
  id: string
  wing: ExhibitWingId
  name: string
  order: number
}

export interface MuseeDialogue {
  id: string
  lines: unknown[]
}

/** Sous-ensemble utile de `GameState` (src/state/gameStore.ts) pour les tests E2E. */
export interface MuseeGameState {
  screen: Screen
  lang: Lang
  avatar: MuseeAvatarConfig
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
  peersCount: number
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

export interface MuseeDebugApi {
  state: () => MuseeGameState
  player: MuseePlayer
  input: MuseeInput
  teleport: (x: number, z: number, rotY?: number) => void
  goToPerson: (personId: string) => boolean
}

/** Navigue vers le musée avec la poignée de test activée (`?e2e=1`). */
export async function gotoMusee(page: Page, extraQuery = ''): Promise<void> {
  await page.goto(`/?e2e=1${extraQuery}`)
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

export async function museeInput(page: Page): Promise<MuseeInput> {
  return page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: { input: MuseeInput } }).__musee
    if (!musee) throw new Error('window.__musee indisponible : ?e2e=1 est-il actif ?')
    return musee.input
  })
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
 * Amène le joueur de l'écran titre à l'écran de jeu : clique « Entrer », valide la
 * personnalisation par défaut, et attend le canvas. Le dialogue d'accueil de Minerve
 * peut ensuite s'afficher (voir `dismissWelcomeDialogue`) : on ne le ferme pas ici,
 * chaque test décide s'il veut l'observer ou le fermer.
 */
export async function enterMuseum(page: Page): Promise<void> {
  await expect(page.getByTestId('title-screen')).toBeVisible()
  await page.getByTestId('enter-button').click()
  await expect(page.getByTestId('customizer')).toBeVisible()
  await page.getByTestId('customizer-done').click()
  await expect(page.locator('.app')).toHaveAttribute('data-screen', 'play')
  await expect(page.getByTestId('game-canvas')).toBeVisible()
}

/**
 * Ferme le dialogue d'accueil de Minerve s'il est affiché, en cliquant jusqu'à sa fermeture
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
