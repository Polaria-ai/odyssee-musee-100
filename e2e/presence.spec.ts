import { expect, test } from '@playwright/test'
import { dismissWelcomeDialogue, enterMuseum, gotoMusee, museeState } from './support/museeApi'
import { isSupabaseReachable } from './support/supabaseEnv'

/**
 * Présence temps réel (`src/features/presence`, `peersCount` dans `src/state/gameStore.ts`).
 * Voir `src/features/presence/README.md` : mode solo silencieux sans Supabase joignable, un
 * visiteur ne se voit jamais lui-même (`self: false` en broadcast).
 *
 * Un visiteur fantôme (onglet resté connecté au temps réel, voir la note projet sur le navigateur
 * intégré) se traduirait ici par un `peersCount` non nul alors qu'un seul visiteur est réellement
 * présent : c'est ce que le premier test ci-dessous surveille.
 *
 * Ce fichier partage un canal Supabase Realtime RÉEL (`room-1`, voir
 * `src/features/presence/roomSelection.ts`) avec absolument tout autre test de la suite qui entre
 * en jeu (`enterMuseum`) au même instant — `fullyParallel: true` (`playwright.config.ts`, non
 * modifiable ici) en fait tourner beaucoup en même temps. Un vrai visiteur d'un AUTRE test qui
 * rejoint la même salle au même moment n'est pas un bug, mais ferait échouer une assertion stricte
 * « seul » ici pour une raison qui n'a rien à voir avec l'app (constaté en pratique en lançant la
 * suite complète). Le premier test bloque donc sa propre connexion Realtime (websocket mocké,
 * jamais de vrai réseau) pour rester déterministe quelle que soit la charge de la suite ; le second
 * (`@live`) a au contraire besoin d'un vrai réseau, et reste marqué comme tel.
 */

const REALTIME_WS_PATTERN = /realtime\/v1\/websocket/

test('un seul contexte : aucun visiteur fantôme (peersCount reste à 0)', async ({ page }) => {
  // Bloque la connexion Realtime AVANT toute navigation : par défaut, une route websocket ne se
  // connecte jamais au serveur (voir la JSDoc de `WebSocketRoute`) — Playwright ouvre quand même le
  // websocket côté page, puis on le ferme aussitôt nous-mêmes pour simuler une coupure immédiate.
  // `usePresence` (voir `src/features/presence/usePresence.ts`) traite ça comme n'importe quelle
  // panne réseau : jusqu'à 3 tentatives avec recul exponentiel (1 s, 2 s, 4 s) puis abandon en mode
  // solo silencieux (`goSolo()`, `peersCount` à 0) — le comportement documenté qu'on vérifie ici,
  // sans dépendre d'un vrai réseau ni d'être seul de fait sur le canal partagé.
  await page.routeWebSocket(REALTIME_WS_PATTERN, (ws) => {
    ws.close()
  })

  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  // Budget large : 3 tentatives à recul exponentiel plafonné (1 s + 2 s + 4 s ≈ 7 s, voir
  // `EFFECTIVE_PEER_TIMEOUT_MS`/`MAX_RECONNECT_ATTEMPTS` dans `usePresence.ts`) avant l'abandon.
  await expect
    .poll(async () => (await museeState(page)).peersCount, {
      timeout: 12_000,
      message: 'un visiteur seul ne doit jamais se voir lui-même comme pair (peersCount devrait être 0)',
    })
    .toBe(0)

  // Reste à 0 une fois retombé en solo (pas un pic transitoire suivi d'un faux positif).
  await page.waitForTimeout(1_000)
  expect((await museeState(page)).peersCount).toBe(0)
})

test('@live deux contextes simultanés se voient l’un l’autre en moins de 15 s', async ({ browser }) => {
  const reachable = await isSupabaseReachable()
  test.skip(
    !reachable,
    'Supabase injoignable depuis cet environnement (pas de réseau, ou .env.local absent/incomplet) : test @live ignoré.',
  )

  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  try {
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await gotoMusee(pageA)
    await enterMuseum(pageA)
    await dismissWelcomeDialogue(pageA)

    await gotoMusee(pageB)
    await enterMuseum(pageB)
    await dismissWelcomeDialogue(pageB)

    await expect
      .poll(async () => (await museeState(pageA)).peersCount, {
        timeout: 15_000,
        message: 'le premier visiteur devrait voir le second dans les 15 s',
      })
      .toBeGreaterThanOrEqual(1)
    await expect
      .poll(async () => (await museeState(pageB)).peersCount, {
        timeout: 15_000,
        message: 'le second visiteur devrait voir le premier dans les 15 s',
      })
      .toBeGreaterThanOrEqual(1)
  } finally {
    await contextA.close()
    await contextB.close()
  }
})
