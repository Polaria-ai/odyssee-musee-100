import { expect, test, type Page } from '@playwright/test'
import { dismissWelcomeDialogue, enterMuseum, gotoMusee, museePlayer, museeState, waitForCameraSettled, waitForRenderInfo } from './support/museeApi'
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
  // panne réseau : jusqu'à 4 reconnexions avec recul exponentiel (1, 2, 4 puis 8 s nominales, × gigue
  // 0,5 à 1,5) puis abandon en mode solo silencieux (`goSolo()`, `peersCount` à 0) — le comportement
  // documenté qu'on vérifie ici, sans dépendre d'un vrai réseau ni d'être seul de fait sur le canal partagé.
  await page.routeWebSocket(REALTIME_WS_PATTERN, (ws) => {
    ws.close()
  })

  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  // Le compteur reste à 0 pendant les reconnexions comme après l'abandon en solo (jusqu'à ~25 s dans le
  // pire cas de gigue) : on ne l'attend pas, on vérifie qu'il ne bouge jamais.
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

/** Compteurs de la session de présence (`window.__musee.presence()`, mode debug `?e2e=1`). */
interface PresenceStats {
  state: string
  room: number | null
  joins: number
  reconnects: number
  soloReason: string | null
  quota: string | null
  errors: Record<string, number>
  sent: number
  received: number
}

async function presenceStats(page: Page): Promise<PresenceStats | null> {
  return page.evaluate(() => {
    const musee = (globalThis as unknown as { __musee?: { presence?: () => unknown } }).__musee
    return (musee?.presence ? musee.presence() : null) as PresenceStats | null
  })
}

/** Trame Phoenix (vsn 2.0.0, JSON) : `[join_ref, ref, topic, event, payload]`. */
type PhoenixFrame = [string | null, string | null, string, string, unknown]

function parseFrame(message: string | Buffer): PhoenixFrame | null {
  if (typeof message !== 'string') return null // les broadcasts du SDK partent en binaire : sans intérêt ici
  try {
    return JSON.parse(message) as PhoenixFrame
  } catch {
    return null
  }
}

test('quota dépassé (« Too many connected users ») : solo tout de suite, une seule jointure, aucune erreur visible', async ({ page }) => {
  // Un faux serveur Realtime qui refuse la jointure comme le fait Supabase au-delà de 200 connexions
  // (`phx_reply` en `error`, raison « Too many connected users »). Réponse aux battements du SDK pour que
  // la socket reste saine.
  const joinTopics: string[] = []
  await page.routeWebSocket(REALTIME_WS_PATTERN, (ws) => {
    ws.onMessage((message) => {
      const frame = parseFrame(message)
      if (!frame) return
      const [joinRef, ref, topic, event] = frame
      if (event === 'phx_join') {
        joinTopics.push(topic)
        ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'error', response: { reason: 'Too many connected users' } }]))
      } else if (event === 'heartbeat') {
        ws.send(JSON.stringify([null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} }]))
      }
    })
  })
  const pageErrors: string[] = []
  const infos: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'info') infos.push(m.text())
  })

  await gotoMusee(page)
  await enterMuseum(page)
  await dismissWelcomeDialogue(page)

  // La jointure arrive après la gigue d'arrivée (0 à 2,5 s) : le solo suit immédiatement le refus.
  await expect
    .poll(async () => (await presenceStats(page))?.state, { timeout: 15_000, message: 'le refus « Too many connected users » devrait mener au solo' })
    .toBe('solo')
  const stats = (await presenceStats(page))!
  expect(stats.soloReason).toBe('quota')
  expect(stats.quota).toBe('too_many_connections')
  expect(stats.joins).toBe(1)
  expect(stats.reconnects).toBe(0)

  // Sans le chemin « quota », le premier recul (1 s × gigue 0,5 à 1,5) aurait déjà rejoint : on laisse passer plus de 8 s
  // (la plus longue des 4 reconnexions) pour s'assurer que rien ne repart avant le délai long de 5 minutes.
  await page.waitForTimeout(9_000)
  expect(joinTopics).toHaveLength(1)
  expect((await presenceStats(page))?.state).toBe('solo')
  expect((await museeState(page)).peersCount).toBe(0)

  // Le jeu reste jouable seul, sans erreur visible : un seul message d'information, aucune exception.
  expect(infos.filter((t) => t.includes('mode solo'))).toHaveLength(1)
  expect(infos.find((t) => t.includes('mode solo'))).toContain('quota')
  expect(pageErrors).toEqual([])
  expect((await museeState(page)).screen).toBe('play')
})

test('une salle de 30 visiteurs : 29 pairs connus, 8 montés au plus, le rendu ne grossit pas avec la salle', async ({ page }) => {
  test.setTimeout(120_000) // chargement complet, caméra posée, puis ouverture de la salle et positions reçues
  // Un faux serveur Realtime qui annonce 29 autres visiteurs (la salle est pleine avec nous : 30), puis diffuse
  // leur position chaque seconde, tous autour du joueur. Il ne répond à la jointure qu'une fois le test prêt
  // (`openRoom`), ce qui laisse mesurer le rendu SANS visiteurs d'abord, quelle que soit la lenteur de la machine.
  let openRoom!: () => void
  const roomOpened = new Promise<void>((resolve) => {
    openRoom = resolve
  })
  const others = Array.from({ length: 29 }, (_, i) => ({ id: `peer-${i}`, joinTs: 1_000 + i }))
  let player = { x: 0, z: 0 }
  const intervals: Array<ReturnType<typeof setInterval>> = []
  await page.routeWebSocket(REALTIME_WS_PATTERN, (ws) => {
    ws.onMessage((message) => {
      const frame = parseFrame(message)
      if (!frame) return
      const [joinRef, ref, topic, event] = frame
      if (event === 'heartbeat') {
        ws.send(JSON.stringify([null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} }]))
      } else if (event === 'phx_join') {
        ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: [] } }]))
        void roomOpened.then(() => {
          // La liste de la salle, comme le fait le serveur juste après la jointure…
          const state = Object.fromEntries(others.map((o, i) => [`key-${i}`, { metas: [{ ...o, phx_ref: String(i + 1) }] }]))
          ws.send(JSON.stringify([joinRef, null, topic, 'presence_state', state]))
          // …puis une position par seconde et par pair, en cercle autour du joueur (à 2 à 6 m).
          intervals.push(
            setInterval(() => {
              others.forEach((o, i) => {
                const angle = (i / others.length) * Math.PI * 2
                const radius = 2 + (i % 5)
                const position = { i: o.id, x: player.x + Math.cos(angle) * radius, z: player.z + Math.sin(angle) * radius, r: 0, m: 0 }
                ws.send(JSON.stringify([joinRef, null, topic, 'broadcast', { type: 'broadcast', event: 'pos', payload: position }]))
              })
            }, 1_000),
          )
        })
      } else if (event === 'presence' || event === 'phx_leave') {
        ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]))
      }
    })
  })

  try {
    await gotoMusee(page)
    await enterMuseum(page)
    await dismissWelcomeDialogue(page)
    const p = await museePlayer(page)
    player = { x: p.x, z: p.z }
    // Même caméra avant et après : sinon le décompte des triangles dépend du cadrage, pas des visiteurs.
    await waitForCameraSettled(page)
    const baseline = await waitForRenderInfo(page)
    openRoom()

    await expect
      .poll(async () => (await museeState(page)).peersCount, { timeout: 30_000, message: 'les 29 autres visiteurs de la salle devraient être connus' })
      .toBe(29)
    expect((await presenceStats(page))?.state).toBe('subscribed')
    expect((await presenceStats(page))?.soloReason).toBeNull()
    await page.waitForTimeout(3_500) // des positions arrivent, la sélection des plus proches se fait
    await waitForCameraSettled(page)

    const withRoom = await waitForRenderInfo(page)
    const extraCalls = withRoom.calls - baseline.calls
    const extraTriangles = withRoom.triangles - baseline.triangles
    // 8 Cyril au plus (12 428 triangles chacun ; mesuré : +99 430 triangles et +15 appels de dessin pour 8), jamais 29
    // (29 × 12 428 = 360 000 triangles). Quelques-uns peuvent être hors champ de la caméra : borne basse de 6.
    expect(extraTriangles, 'au moins 6 visiteurs doivent être rendus').toBeGreaterThanOrEqual(6 * 12_000)
    expect(extraTriangles, 'jamais plus de 8 visiteurs rendus').toBeLessThanOrEqual(8 * 12_600)
    expect(extraCalls).toBeLessThanOrEqual(8 * 4)
    // La présence compte bien toute la salle : le plafond de rendu n'y change rien.
    expect((await museeState(page)).peersCount).toBe(29)
  } finally {
    for (const t of intervals) clearInterval(t)
  }
})

test('@live deux contextes simultanés se voient l’un l’autre en moins de 15 s', async ({ browser }) => {
  // Deux chargements complets (parfois depuis le site en ligne, via E2E_BASE_URL) + attente de présence.
  test.setTimeout(120_000)
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
    // Même espace de salles pour les deux visiteurs, isolé du reste de la suite.
    const shared = `&presenceRoom=e2e-live-${crypto.randomUUID().slice(0, 12)}`

    await gotoMusee(pageA, shared)
    await enterMuseum(pageA)
    await dismissWelcomeDialogue(pageA)

    await gotoMusee(pageB, shared)
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
