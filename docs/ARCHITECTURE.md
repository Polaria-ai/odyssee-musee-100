# Architecture — Le Musée des 100

Vite + React 19 + TypeScript, **react-three-fiber** (three.js) pour la 3D, **zustand** pour l'état, **zod** pour valider les données, **Supabase** (Postgres + Storage + Realtime) pour la liste des 100 et la présence des visiteurs. Site statique : déployable sur Vercel (`vercel.json`) ou n'importe quel hébergeur.

## Flux

```
main.tsx → App.tsx
  ├─ loadPeople()            data/repository.ts   Supabase → /data/people.json → fiches d'attente
  ├─ buildMuseumLayout()     world/layout.ts      plan pur et déterministe (salles, murs, cadres)
  ├─ <Experience/>           scene/Experience.tsx Canvas unique
  │    ├─ <Museum/>          world/               architecture, décor, portraits
  │    ├─ <StampStations/>   features/stamps/     socles à tampon
  │    ├─ <Minerve/>         npc/                 chouette conservatrice
  │    ├─ <Player/>          player/              avatar, déplacement, collisions, caméra
  │    └─ <RemoteVisitors/>  features/presence/   autres visiteurs
  └─ surimpressions DOM      ui/, features/avatar, features/stamps, player/TouchJoystick
```

## Deux états

- `src/state/gameStore.ts` (zustand) : état « froid » — écran, langue, avatar, fiche ouverte, visites, tampons, dialogue, toast.
- `src/state/runtime.ts` : état « chaud » mis à jour à chaque image — entrée joystick/clavier (`input`), position du joueur (`player`) et ponts DOM↔Canvas (`bridges.screenToFloor`). Objets mutables, **jamais** dans React.
- Action principale unique : `useGame.getState().interact()` (bouton rond du HUD, Entrée/E) — regarde le portrait proche, sinon parle à Minerve. `Player` alimente `nearbyPersonId`, `nearCurator` et `currentRoom`.

## Contrat

`src/types/index.ts` est la source de vérité des types. Les signatures exportées de chaque module (voir les fichiers d'origine marqués `STUB`) sont contractuelles : un module peut tout réécrire à l'intérieur, mais garde ses exports et leurs signatures. Besoin d'un changement de contrat → le signaler dans le rapport, ne pas modifier le fichier d'un autre module.

## Propriété des fichiers (agents)

| Module | Propriétaire | Fichiers |
|---|---|---|
| Intégration | orchestrateur | `src/types/`, `src/state/`, `src/i18n/index.ts`, `src/scene/`, `src/App.tsx`, `src/main.tsx`, `src/styles/`, configs, `.github/`, `docs/ARCHITECTURE.md` |
| Monde | agent `world` | `src/world/**` |
| Joueur | agent `player` | `src/player/**` |
| Minerve | agent `npc` | `src/npc/**` |
| Interface | agent `ui` | `src/ui/**` |
| Avatar + tampons | agent `features` | `src/features/avatar/**`, `src/features/stamps/**` |
| Présence | agent `presence` | `src/features/presence/**` |
| Données | agent `data` | `src/data/**`, `supabase/**`, `scripts/import-people.ts`, `scripts/export-local.ts`, `scripts/content-invariants.ts`, `data/`, `docs/IMPORT.md` |
| QA | agent `qa` | `e2e/**`, `docs/TESTS.md` |

Textes : chaque module a son `strings.ts` (`defineStrings`) — `src/i18n/strings.test.ts` impose FR + EN complets.

## Vérifications

| Commande | Rôle |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ESLint + TypeScript strict |
| `pnpm test` | Vitest (logique pure + composants en jsdom) |
| `pnpm build` | build de production |
| `pnpm verify:bundle` | budget de poids (JS gzip ≤ 650 Ko, entrée ≤ 160 Ko) |
| `pnpm verify:security` | pas de clé serveur dans le bundle, pas de HTML injecté, en-têtes HTTP |
| `pnpm verify:content` | liste des 100 cohérente (ids uniques, textes présents) |
| `pnpm e2e` | Playwright : iPhone, Android, desktop (WebGL SwiftShader) |

En local sans navigateur Playwright : `PW_CHROMIUM_PATH="$HOME/.agent-browser/browsers/chrome-149.0.7827.54/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" pnpm e2e`.

La CI GitHub (`.github/workflows/ci.yml`) enchaîne tout sur chaque PR.

## Supabase

Projet `odyssee-musee-100` (`snqwuvqhxaysaygwqkdq`, eu-west-3). Table `people` en lecture publique (lignes publiées), photos dans `public/portraits/` (statique) ou bucket `portraits`. Présence via Realtime (canaux partitionnés, quotas du plan gratuit : voir `src/features/presence/`).

Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clé publishable, côté client). `SUPABASE_SERVICE_ROLE_KEY` uniquement pour les scripts d'import locaux, jamais préfixée `VITE_`.
